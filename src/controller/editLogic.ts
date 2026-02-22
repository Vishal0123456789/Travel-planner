import { Itinerary, Day, TimeBlock, Activity } from '../types/itinerary';
import {
    EditCommand,
    SwapActivityCommand,
    RemoveActivityCommand,
    AddActivityCommand,
    MoveActivityCommand,
    AddByCategoryCommand,
    ReplaceByAttributeCommand,
    DayRelaxationCommand
} from '../types/edit';
import { UDAIPUR_POIS } from '../mocks/udaipur_sample';
import { calculateDistanceKm } from '../utils/travelTime';
import { recalculateDaySchedule } from '../utils/itineraryHelper';

const INDOOR_CATEGORIES = ['museum', 'palace', 'restaurant', 'cafe', 'temple'];
const OUTDOOR_CATEGORIES = ['lake', 'ghat', 'garden', 'viewpoint', 'zoo'];

function isIndoor(poi: any): boolean {
    const cat = poi.category?.toLowerCase() || '';
    return INDOOR_CATEGORIES.some(c => cat.includes(c)) || (poi.tags && poi.tags.some((t: string) => INDOOR_CATEGORIES.includes(t.toLowerCase())));
}

function isOutdoor(poi: any): boolean {
    const cat = poi.category?.toLowerCase() || '';
    return OUTDOOR_CATEGORIES.some(c => cat.includes(c)) || (poi.tags && poi.tags.some((t: string) => OUTDOOR_CATEGORIES.includes(t.toLowerCase())));
}


/**
 * Step 26: Scoped Itinerary Update
 * Applies the edit to the JSON structure.
 */
export function applyEdit(itinerary: Itinerary, command: EditCommand): Itinerary {
    const nextItinerary: Itinerary = JSON.parse(JSON.stringify(itinerary));

    if (command.op === 'remove') {
        const cmd = command as RemoveActivityCommand;
        const day = nextItinerary.days.find(d => d.day_number === cmd.day_number);
        if (day) {
            day.blocks.forEach(b => {
                b.activities = b.activities.filter(a => a.poi_id !== cmd.target_poi_id);
            });
            recalculateDaySchedule(day);
        }
    }

    if (command.op === 'add') {
        const cmd = command as AddActivityCommand;
        let day = nextItinerary.days.find(d => d.day_number === cmd.target_day_number);

        if (!day) {
            day = {
                day_number: cmd.target_day_number,
                blocks: [
                    { name: 'morning', activities: [] },
                    { name: 'afternoon', activities: [] },
                    { name: 'evening', activities: [] }
                ]
            } as Day;
            nextItinerary.days.push(day as Day);
        }

        const newPoi = UDAIPUR_POIS.find(p => p.id === cmd.poi_id_to_add);
        if (newPoi && day) {
            const targetBlock = cmd.time_block || 'afternoon';
            const block = day.blocks.find(b => b.name === targetBlock);
            if (block) {
                block.activities.push({
                    poi_id: newPoi.id,
                    name: newPoi.name,
                    duration_minutes: newPoi.avg_visit_duration_minutes,
                    start_time: "00:00", // Will be recalculated
                    end_time: "00:00",
                    travel_time_to_next_minutes: 0,
                    geo_coordinates: newPoi.location,
                    type: newPoi.category
                });
                recalculateDaySchedule(day);
            }
        }
    }

    if (command.op === 'add_by_category') {
        const cmd = command as AddByCategoryCommand;
        const day = nextItinerary.days.find(d => d.day_number === cmd.day_number);
        if (day) {
            const existingPoiIds = new Set(nextItinerary.days.flatMap(d => d.blocks.flatMap(b => b.activities.map(a => a.poi_id))));

            const candidates = UDAIPUR_POIS.filter(p =>
                (p.category?.toLowerCase().includes(cmd.category.toLowerCase()) ||
                    p.tags?.some(t => t.toLowerCase().includes(cmd.category.toLowerCase()))) &&
                !existingPoiIds.has(p.id)
            ).sort((a, b) => (b.popularity_score || 0) - (a.popularity_score || 0));

            const bestMatch = candidates[0];
            if (bestMatch) {
                // Prefer afternoon
                const block = day.blocks.find(b => b.name === 'afternoon') || day.blocks[1];
                block.activities.push({
                    poi_id: bestMatch.id,
                    name: bestMatch.name,
                    duration_minutes: bestMatch.avg_visit_duration_minutes,
                    start_time: "00:00",
                    end_time: "00:00",
                    travel_time_to_next_minutes: 0,
                    geo_coordinates: bestMatch.location,
                    type: bestMatch.category
                });
                recalculateDaySchedule(day);
            }
        }
    }

    if (command.op === 'replace_by_attribute') {
        const cmd = command as ReplaceByAttributeCommand;
        const day = nextItinerary.days.find(d => d.day_number === cmd.day_number);
        if (day) {
            const block = day.blocks.find(b => b.name === cmd.time_block);
            if (block && block.activities.length > 0) {
                const existingPoiIds = new Set(nextItinerary.days.flatMap(d => d.blocks.flatMap(b => b.activities.map(a => a.poi_id))));

                const candidates = UDAIPUR_POIS.filter(p =>
                    !existingPoiIds.has(p.id) &&
                    (cmd.attribute === 'indoor' ? isIndoor(p) : isOutdoor(p))
                ).sort((a, b) => (b.popularity_score || 0) - (a.popularity_score || 0));

                if (candidates.length > 0) {
                    const bestMatch = candidates[0];
                    block.activities[0] = {
                        poi_id: bestMatch.id,
                        name: bestMatch.name,
                        duration_minutes: bestMatch.avg_visit_duration_minutes,
                        start_time: "00:00",
                        end_time: "00:00",
                        travel_time_to_next_minutes: 0,
                        geo_coordinates: bestMatch.location,
                        type: bestMatch.category
                    };
                    recalculateDaySchedule(day);
                }
            }
        }
    }

    if (command.op === 'day_relaxation') {
        const cmd = command as DayRelaxationCommand;
        const day = nextItinerary.days.find(d => d.day_number === cmd.day_number);
        if (day) {
            // Find lowest ranked activity (using popularity_score if available in UDAIPUR_POIS)
            const allActivities = day.blocks.flatMap(b => b.activities);
            if (allActivities.length > 1) {
                let lowestScore = Infinity;
                let lowestPoiId = "";

                allActivities.forEach(a => {
                    const poi = UDAIPUR_POIS.find(p => p.id === a.poi_id);
                    const score = poi?.popularity_score || 50;
                    if (score < lowestScore) {
                        lowestScore = score;
                        lowestPoiId = a.poi_id;
                    }
                });

                day.blocks.forEach(b => {
                    b.activities = b.activities.filter(a => a.poi_id !== lowestPoiId);
                });
                recalculateDaySchedule(day);
            }
        }
    }

    if (command.op === 'move') {
        const cmd = command as MoveActivityCommand;
        let activityToMove: any;
        nextItinerary.days.forEach(d => {
            d.blocks.forEach(b => {
                const found = b.activities.find(a => a.poi_id === cmd.target_poi_id);
                if (found) {
                    activityToMove = JSON.parse(JSON.stringify(found));
                    b.activities = b.activities.filter(a => a.poi_id !== cmd.target_poi_id);
                    recalculateDaySchedule(d);
                }
            });
        });

        if (activityToMove) {
            const targetDay = nextItinerary.days.find(d => d.day_number === cmd.to_day);
            if (targetDay) {
                const targetBlock = targetDay.blocks.find(b => b.name === (cmd.to_time_block || 'afternoon'));
                if (targetBlock) {
                    targetBlock.activities.push(activityToMove);
                    recalculateDaySchedule(targetDay);
                }
            }
        }
    }

    if (command.op === 'swap') {
        const cmd = command as SwapActivityCommand;
        const day = nextItinerary.days.find(d => d.day_number === cmd.day_number);
        if (day) {
            const newPoi = UDAIPUR_POIS.find(p => p.id === cmd.replacement_poi_id);
            if (newPoi) {
                day.blocks.forEach(b => {
                    b.activities.forEach((a, idx) => {
                        if (a.poi_id === cmd.target_poi_id) {
                            b.activities[idx] = {
                                ...a,
                                poi_id: newPoi.id,
                                name: newPoi.name,
                                geo_coordinates: newPoi.location,
                                type: newPoi.category,
                                duration_minutes: newPoi.avg_visit_duration_minutes
                            };
                        }
                    });
                });
                recalculateDaySchedule(day);
            }
        }
    }

    return nextItinerary;
}
