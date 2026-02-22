import { Itinerary } from '../types/itinerary';

export interface FeasibilityDailySummary {
    day: number;
    activityMinutes: number;
    travelMinutes: number;
    totalDurationMinutes: number;
}

export interface FeasibilityReport {
    pass: boolean;
    warnings: string[];
    errors: string[];
    dailySummary: FeasibilityDailySummary[];
    feasibilityScore: number; // 0-100
}

/**
 * Rules:
 * 1. Sum(activity + travel) <= daily limit (Relaxed=6h, Packed=8h, but we deduce pace from total?) 
 *    Actually, let's assume a standard limit or infer from intent.
 *    The prompt says: "Relaxed -> 6 hours active, Packed -> 8 hours active". 
 *    But the Itinerary object doesn't store 'pace' metadata directly in Schema Step 1? 
 *    Ah, `title` might have it. Or passing it as param.
 *    Let's be safe and assume 8 hours is max hard limit for "Pass", warning if > 6h.
 * 2. End Time <= 10 PM (22:00)
 * 3. Implicit Meal Break: Check if gap exists around lunch (12-2) or just total duration isn't continuous?
 *    Simplification: Just check if total duration isn't absurdly dense.
 */
export function evaluateFeasibility(itinerary: Itinerary, intendedPace: 'relaxed' | 'packed' = 'relaxed'): FeasibilityReport {
    const report: FeasibilityReport = {
        pass: true,
        warnings: [],
        errors: [],
        dailySummary: [],
        feasibilityScore: 100
    };

    const limitMinutes = intendedPace === 'relaxed' ? 360 : 480; // 6h vs 8h

    for (const day of itinerary.days) {
        let activityMins = 0;
        let travelMins = 0;

        // Flatten activities
        const activities = day.blocks.flatMap(b => b.activities);

        if (activities.length === 0) {
            report.warnings.push(`Day ${day.day_number} is empty.`);
            continue;
        }

        // Check End Time of last activity
        const lastActivity = activities[activities.length - 1];
        const [endH, endM] = lastActivity.end_time.split(':').map(Number);
        if (endH >= 22) {
            report.errors.push(`Day ${day.day_number}: Last activity ends after 10 PM (${lastActivity.end_time}).`);
            report.pass = false;
        }

        for (const act of activities) {
            activityMins += act.duration_minutes;
            travelMins += act.travel_time_to_next_minutes;
        }

        const total = activityMins + travelMins;

        report.dailySummary.push({
            day: day.day_number,
            activityMinutes: activityMins,
            travelMinutes: travelMins,
            totalDurationMinutes: total
        });

        // Goal 3: Validate Limit (Hard Error)
        if (total > limitMinutes) {
            report.errors.push(`Day ${day.day_number}: Total time ${Math.round(total / 60)}h ${total % 60}m exceeds allowed window of ${limitMinutes / 60}h.`);
            report.pass = false;
            report.feasibilityScore -= 30;
        }

        // Goal 3: Warn if travel > 30% of total_day_minutes
        if (total > 0 && travelMins > (total * 0.3)) {
            report.warnings.push(`Day ${day.day_number}: Excessive travel time detected (${Math.round((travelMins / total) * 100)}% of day).`);
            report.feasibilityScore -= 10;
        }
    }

    // Final clamp
    report.feasibilityScore = Math.max(0, Math.min(100, report.feasibilityScore));

    // If score too low, fail?
    if (report.feasibilityScore < 50) report.pass = false;

    return report;
}
