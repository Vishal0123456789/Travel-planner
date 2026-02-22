import { Itinerary } from '../types/itinerary';
import { EditCommand } from '../types/edit';

export interface EditEvalReport {
    pass: boolean;
    unexpectedChanges: string[];
}

/**
 * Ensures that if I edit Day 1, Day 2 remains identical.
 */
export function evaluateEditCorrectness(
    before: Itinerary,
    after: Itinerary,
    editIntent: EditCommand
): EditEvalReport {
    const report: EditEvalReport = {
        pass: true,
        unexpectedChanges: []
    };

    // Determine intended scope
    let expectedDayChanges: number[] = [];

    if (editIntent.op === 'remove') expectedDayChanges = [editIntent.day_number];
    if (editIntent.op === 'add') expectedDayChanges = [editIntent.target_day_number];
    if (editIntent.op === 'swap') expectedDayChanges = [editIntent.day_number];
    if (editIntent.op === 'move') expectedDayChanges = [editIntent.from_day, editIntent.to_day];
    if (editIntent.op === 'add_by_category') expectedDayChanges = [editIntent.day_number];
    if (editIntent.op === 'replace_by_attribute') expectedDayChanges = [editIntent.day_number];
    if (editIntent.op === 'day_relaxation') expectedDayChanges = [editIntent.day_number];

    // Compare Days
    const maxDays = Math.max(before.days.length, after.days.length);

    for (let i = 0; i < maxDays; i++) {
        // 0-indexed in loop, days are 1-indexed usually
        // Assuming days array is ordered.
        // Safe lookup:
        const dayNum = i + 1;
        const dayBefore = before.days.find(d => d.day_number === dayNum);
        const dayAfter = after.days.find(d => d.day_number === dayNum);

        if (!dayBefore && !dayAfter) continue; // Should not happen

        // If a day was added/removed entirely?
        if (!!dayBefore !== !!dayAfter) {
            // Is this expected? only if we changed duration? Edit Schema doesn't have "change duration" yet.
            // Assuming fixed duration for now.
            report.unexpectedChanges.push(`Day ${dayNum} existence changed.`);
            report.pass = false;
            continue;
        }

        if (dayBefore && dayAfter) {
            if (expectedDayChanges.includes(dayNum)) {
                // This day WAS targeted. It SHOULD change.
                // We could do deep verification (e.g. did the specific POI change?), 
                // but "Edit Correctness" mostly cares about *containment*.
                continue;
            }

            // Verification: This day should be identical
            // Diff Blocks/Activities
            const jsonBefore = JSON.stringify(dayBefore.blocks);
            const jsonAfter = JSON.stringify(dayAfter.blocks);
            if (jsonBefore !== jsonAfter) {
                report.unexpectedChanges.push(`Day ${dayNum} changed unexpectedly (Targeted: ${expectedDayChanges}).`);
                report.pass = false;
            }
        }
    }

    return report;
}
