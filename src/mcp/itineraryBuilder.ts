import { POI, POICategory } from '../types/poi';
import { Itinerary, Day, TimeBlock, Activity, TimeBlockName } from '../types/itinerary';
import { estimateTravelTime } from '../utils/travelTime';
import { ragService } from '../rag/service';
import { recalculateDaySchedule } from '../utils/itineraryHelper';

// Constants
const START_HOUR = 10; // 10:00 AM
const MAX_DAILY_ACTIVE_MINUTES_RELAXED = 360; // 6h
const MAX_DAILY_ACTIVE_MINUTES_PACKED = 480; // 8h
const ABSOLUTE_DAILY_CAP_MINUTES = 540; // 9h absolute cap

interface ItineraryConstraints {
    maxVisibleHoursPerDay: number;
}

function createEmptyDay(dayNum: number): Day {
    return {
        day_number: dayNum,
        blocks: [
            { name: 'morning', activities: [] },
            { name: 'afternoon', activities: [] },
            { name: 'evening', activities: [] }
        ]
    };
}

function getBlockForTime(hour: number): TimeBlockName {
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
}

function formatTime(hour: number, minute: number): string {
    const h = Math.floor(hour).toString().padStart(2, '0');
    const m = Math.floor(minute).toString().padStart(2, '0');
    return `${h}:${m}`;
}

export function generateItinerary(
    pois: POI[],
    daysCount: number,
    pace: 'relaxed' | 'packed',
    foodPreference?: string,
    fixedPois: Record<number, string[]> = {}
): Itinerary {
    const targetLimitMins = pace === 'relaxed' ? MAX_DAILY_ACTIVE_MINUTES_RELAXED : MAX_DAILY_ACTIVE_MINUTES_PACKED;
    const maxItemsPerDay = pace === 'relaxed' ? 4 : 6;

    const itinerary: Itinerary = {
        id: `trip_${Date.now()}`,
        title: `${daysCount}-Day ${pace === 'relaxed' ? 'Relaxed' : 'Packed'} Trip`,
        total_duration_days: daysCount,
        days: []
    };

    const sightsPool = pois.filter(p => p.category !== 'food');
    const foodPool = pois.filter(p => p.category === 'food');
    const processedPoiIds = new Set<string>();
    const totalSightsCount = sightsPool.length;

    for (let d = 1; d <= daysCount; d++) {
        const remainingDays = daysCount - d + 1;
        const processedSightsCount = [...processedPoiIds].filter(id => sightsPool.some(p => p.id === id)).length;
        const remainingSights = totalSightsCount - processedSightsCount;

        // Dynamically calculate target for this day to ensure even distribution
        let currentDayTarget = Math.ceil(remainingSights / remainingDays);

        // If packed, we can exceed the even split, but we must leave at least 1 item per remaining day
        if (pace === 'packed') {
            const minToLeaveForOthers = remainingDays - 1;
            currentDayTarget = Math.min(currentDayTarget + 2, Math.max(1, remainingSights - minToLeaveForOthers), maxItemsPerDay);
        }

        const day = createEmptyDay(d);
        let currentHour = START_HOUR;
        let totalDayMins = 0; // Cumulative (Activity + Travel)
        let lastPoi: POI | null = null;
        let sightsInDay = 0;
        let foodStopAdded = false;

        // 1. Process Fixed POIs for this day first
        const forcedIds = fixedPois[d] || [];
        for (const fid of forcedIds) {
            const fPoi = pois.find(p => p.id === fid && !processedPoiIds.has(fid));
            if (fPoi) {
                const travelTime = lastPoi ? estimateTravelTime(lastPoi, fPoi) : 0;
                addActivityToDay(day, fPoi, travelTime, currentHour);
                processedPoiIds.add(fid);
                lastPoi = fPoi;
                currentHour += (fPoi.avg_visit_duration_minutes + travelTime) / 60;
                totalDayMins += fPoi.avg_visit_duration_minutes + travelTime;
                if (fPoi.category === 'food') foodStopAdded = true;
                else sightsInDay++;
            }
        }

        // 2. Fill remaining slots greedily but respecting distribution
        let dayComplete = false;

        while (!dayComplete) {
            // Check for lunch/dinner stop
            if (!foodStopAdded && currentHour >= 13) {
                let foodCandidates = foodPool.filter(f => !processedPoiIds.has(f.id));
                // Prefer matching food preference
                if (foodPreference && foodPreference !== 'no preference') {
                    const matched = foodCandidates.filter(f => f.tags?.some(t => t.toLowerCase() === foodPreference.toLowerCase() || t.toLowerCase().split(' ').includes(foodPreference.toLowerCase())));
                    if (matched.length > 0) foodCandidates = matched;
                }

                if (foodCandidates.length > 0) {
                    // Pick nearest
                    let foodPoi = foodCandidates[0];
                    let minT = Infinity;
                    if (lastPoi) {
                        foodCandidates.forEach(f => {
                            const t = estimateTravelTime(lastPoi!, f);
                            if (t < minT) { minT = t; foodPoi = f; }
                        });
                    }

                    const travelT = lastPoi ? estimateTravelTime(lastPoi, foodPoi) : 0;
                    if (totalDayMins + foodPoi.avg_visit_duration_minutes + travelT <= targetLimitMins) {
                        addActivityToDay(day, foodPoi, travelT, currentHour);
                        processedPoiIds.add(foodPoi.id);
                        lastPoi = foodPoi;
                        currentHour += (foodPoi.avg_visit_duration_minutes + travelT) / 60;
                        totalDayMins += foodPoi.avg_visit_duration_minutes + travelT;
                        foodStopAdded = true;
                    } else {
                        // Not enough time for food within target, but we need one. We'll stop adding sights.
                        // This might result in a slightly longer day if we MUST add food, 
                        // but let's try to fit it in ABSOLUTE_DAILY_CAP_MINUTES if target is impossible.
                        if (totalDayMins + foodPoi.avg_visit_duration_minutes + travelT <= ABSOLUTE_DAILY_CAP_MINUTES) {
                            addActivityToDay(day, foodPoi, travelT, currentHour);
                            processedPoiIds.add(foodPoi.id);
                            lastPoi = foodPoi;
                            currentHour += (foodPoi.avg_visit_duration_minutes + travelT) / 60;
                            totalDayMins += foodPoi.avg_visit_duration_minutes + travelT;
                            foodStopAdded = true;
                        }
                        dayComplete = true;
                        break;
                    }
                    continue;
                }
            }

            // Target sights reached?
            if (sightsInDay >= currentDayTarget && (foodStopAdded || foodPool.filter(f => !processedPoiIds.has(f.id)).length === 0)) {
                dayComplete = true;
                break;
            }

            const candidates = sightsPool.filter(p => !processedPoiIds.has(p.id));
            if (candidates.length === 0) {
                // No more sights. Try to add food if not added.
                if (!foodStopAdded) {
                    currentHour = Math.max(currentHour, 13);
                    // Next loop iteration will handle food adding
                    if (foodPool.filter(f => !processedPoiIds.has(f.id)).length === 0) dayComplete = true;
                    continue;
                }
                dayComplete = true;
                break;
            }

            let candidateIndex = -1;
            let bestScore = -Infinity;
            const RAG_BONUS = 500; // Large enough to prioritize over distance if reasonably close

            for (let i = 0; i < candidates.length; i++) {
                const p = candidates[i];
                const travelTime = lastPoi ? estimateTravelTime(lastPoi, p) : 0;

                // Deterministic scoring: lower travel time is better
                // Adding a RAG bonus to prioritize landmarks with verified information
                let score = -travelTime;
                if (ragService.hasRag(p.id)) {
                    score += RAG_BONUS;
                }

                if (score > bestScore) {
                    bestScore = score;
                    candidateIndex = sightsPool.findIndex(x => x.id === p.id);
                }
            }

            if (candidateIndex === -1) break;

            const poi = sightsPool[candidateIndex];
            const travelTime = lastPoi ? estimateTravelTime(lastPoi, poi) : 0;
            const visitDuration = poi.avg_visit_duration_minutes;

            // Goal 2: Before finalizing a day, check caps
            if (totalDayMins + visitDuration + travelTime > targetLimitMins || totalDayMins + visitDuration + travelTime > ABSOLUTE_DAILY_CAP_MINUTES) {
                // Before quitting, try to fit food if not added
                if (!foodStopAdded) {
                    currentHour = Math.max(currentHour, 13);
                    continue;
                }
                dayComplete = true;
                break;
            }

            // Success: Add Activity
            addActivityToDay(day, poi, travelTime, currentHour);
            processedPoiIds.add(poi.id);
            lastPoi = poi;
            currentHour += (visitDuration + travelTime) / 60;
            totalDayMins += visitDuration + travelTime;
            sightsInDay++;
        }

        recalculateDaySchedule(day);
        itinerary.days.push(day);
    }

    return itinerary;
}

/**
 * Helper to consolidate activity addition logic
 */
function addActivityToDay(day: Day, poi: POI, travelTime: number, startHour: number) {
    const startTimeStr = formatTime(Math.floor(startHour), Math.round((startHour % 1) * 60));
    const endHour = startHour + (poi.avg_visit_duration_minutes / 60);
    const endTimeStr = formatTime(Math.floor(endHour), Math.round((endHour % 1) * 60));

    const blockName = getBlockForTime(startHour);
    const block = day.blocks.find(b => b.name === blockName)!;

    // Update previous activity's travel time if exists in this day
    for (let bIdx = day.blocks.length - 1; bIdx >= 0; bIdx--) {
        const b = day.blocks[bIdx];
        if (b.activities.length > 0) {
            b.activities[b.activities.length - 1].travel_time_to_next_minutes = travelTime;
            break;
        }
    }

    block.activities.push({
        poi_id: poi.id,
        name: poi.name,
        type: poi.category,
        duration_minutes: poi.avg_visit_duration_minutes,
        start_time: startTimeStr,
        end_time: endTimeStr,
        travel_time_to_next_minutes: 0,
        geo_coordinates: poi.location
    });
}
