import { Day, Activity } from '../types/itinerary';
import { calculateDistanceKm } from './travelTime';

const ASSUMED_SPEED_KMH = 20;

export function recalculateDaySchedule(day: Day): { activityMins: number, travelMins: number } {
    let currentH = 10;
    let currentM = 0;
    let totalActivityMins = 0;
    let totalTravelMins = 0;

    // Flatten all activities in order: morning -> afternoon -> evening
    const orderedBlocks = ['morning', 'afternoon', 'evening'];
    const allActivities: Activity[] = [];

    orderedBlocks.forEach(blockName => {
        const block = day.blocks.find(b => b.name === blockName);
        if (block) {
            allActivities.push(...block.activities);
        }
    });

    for (let i = 0; i < allActivities.length; i++) {
        const activity = allActivities[i];

        // 1. Set Start Time
        const startTimeStr = `${currentH.toString().padStart(2, '0')}:${currentM.toString().padStart(2, '0')}`;
        activity.start_time = startTimeStr;

        // 2. Add Duration
        const duration = activity.duration_minutes;
        totalActivityMins += duration;
        currentM += duration;
        while (currentM >= 60) {
            currentH += 1;
            currentM -= 60;
        }

        // 3. Set End Time
        const endTimeStr = `${currentH.toString().padStart(2, '0')}:${currentM.toString().padStart(2, '0')}`;
        activity.end_time = endTimeStr;

        // 4. Calculate Travel to next
        if (i < allActivities.length - 1) {
            const nextActivity = allActivities[i + 1];
            const dist = calculateDistanceKm(
                activity.geo_coordinates.lat, activity.geo_coordinates.lon,
                nextActivity.geo_coordinates.lat, nextActivity.geo_coordinates.lon
            );
            const travelTime = Math.ceil((dist / ASSUMED_SPEED_KMH) * 60);

            activity.travel_time_to_next_minutes = travelTime;
            totalTravelMins += travelTime;

            // Add travel time to current clock
            currentM += travelTime;
            while (currentM >= 60) {
                currentH += 1;
                currentM -= 60;
            }
        } else {
            activity.travel_time_to_next_minutes = 0;
        }
    }

    return { activityMins: totalActivityMins, travelMins: totalTravelMins };
}
