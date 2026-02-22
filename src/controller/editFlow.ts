
import { interpretEdit } from '../llm/integration';
import { applyEdit } from './editLogic';
import { runEvaluations, EvaluationSummary } from '../evals/index';
import { Itinerary } from '../types/itinerary';
import { EditCommand, EditOperationType } from '../types/edit';
import { ConversationContext } from '../types/state';

export interface EditResult {
    success: boolean;
    updatedItinerary?: Itinerary;
    evaluations?: EvaluationSummary;
    diffSummary: string[];
    failureReason?: string;
    op?: EditOperationType;
}

/**
 * Goal 1: Robust Day Parsing
 */
function parseDayReference(userInput: string, totalDays: number): number | undefined {
    const input = userInput.toLowerCase();

    // Explicit "day X"
    const dayMatch = input.match(/day\s*(\d+)/);
    if (dayMatch) return parseInt(dayMatch[1]);

    // Ordinals
    if (input.includes("first day")) return 1;
    if (input.includes("second day")) return 2;
    if (input.includes("third day")) return 3;
    if (input.includes("fourth day")) return 4;
    if (input.includes("fifth day")) return 5;

    // Relative
    if (input.includes("last day") || input.includes("final day")) return totalDays;

    return undefined;
}

/**
 * Step 25: Edit Flow Controller
 * Orchestrated: LLM -> Edit -> Logic -> Eval
 */
export async function handleEditRequest(
    userInput: string,
    currentItinerary: Itinerary,
    context: ConversationContext
): Promise<EditResult> {

    // 1. Interpret
    const editCommand: EditCommand = await interpretEdit(userInput, currentItinerary);

    // Goal 1: Robust Day Validation
    const extractedDay = parseDayReference(userInput, currentItinerary.days.length);

    // Override LLM if our robust parser found something clearer
    if (extractedDay !== undefined) {
        if (editCommand.op === 'add') {
            (editCommand as any).target_day_number = extractedDay;
        } else if (editCommand.op === 'move') {
            (editCommand as any).from_day = extractedDay;
        } else {
            (editCommand as any).day_number = extractedDay;
        }
    }

    // Final Validation
    let finalDayNum: number | undefined;
    if (editCommand.op === 'add') finalDayNum = editCommand.target_day_number;
    else if (editCommand.op === 'move') finalDayNum = editCommand.from_day;
    else finalDayNum = (editCommand as any).day_number;

    if (finalDayNum === undefined || finalDayNum < 1 || finalDayNum > currentItinerary.days.length) {
        return {
            success: false,
            diffSummary: [],
            failureReason: "I couldn’t identify which day you meant. Please specify a valid day number."
        };
    }

    // 2. Apply
    let updatedItinerary = applyEdit(currentItinerary, editCommand);

    // Goal 6: Integrity Logging (Directly after application)
    const modifiedDay = updatedItinerary.days.find(d => d.day_number === finalDayNum);
    if (modifiedDay) {
        const activities = modifiedDay.blocks.flatMap(b => b.activities);
        const activityMins = activities.reduce((sum, a) => sum + a.duration_minutes, 0);
        const travelMins = activities.reduce((sum, a) => sum + a.travel_time_to_next_minutes, 0);
    }

    const oldActivitiesJson = JSON.stringify(currentItinerary.days.flatMap(d => d.blocks.flatMap(b => b.activities.map(a => a.poi_id))));
    let newActivitiesJson = JSON.stringify(updatedItinerary.days.flatMap(d => d.blocks.flatMap(b => b.activities.map(a => a.poi_id))));

    if (oldActivitiesJson === newActivitiesJson) {
        return {
            success: false,
            diffSummary: [],
            failureReason: "Could you clarify what you’d like to modify? I couldn't detect any structural changes in your request."
        };
    }

    // Normalize pace for the planner/evaluator
    let derivedPace: 'relaxed' | 'packed' | undefined;
    if (context.constraints.pace === 'moderate') {
        derivedPace = 'relaxed';
    } else {
        derivedPace = context.constraints.pace;
    }

    // 3. Eval (Step 27)
    let evals = runEvaluations(updatedItinerary, {
        previousItinerary: currentItinerary,
        editIntent: editCommand,
        pace: derivedPace
    });

    // Semantic Retry Logic (Step 2)
    if (!evals.passed && editCommand.op === 'add_by_category') {
        console.log("Feasibility failed for add_by_category. Attempting relaxation retry.");
        const relaxedCommand: EditCommand = {
            op: 'day_relaxation',
            day_number: finalDayNum!
        };
        const evenMoreUpdated = applyEdit(updatedItinerary, relaxedCommand);
        const secondEval = runEvaluations(evenMoreUpdated, {
            previousItinerary: currentItinerary,
            editIntent: editCommand,
            pace: derivedPace
        });

        if (secondEval.passed) {
            console.log("Relaxation retry successful.");
            updatedItinerary = evenMoreUpdated;
            evals = secondEval;
            newActivitiesJson = JSON.stringify(updatedItinerary.days.flatMap(d => d.blocks.flatMap(b => b.activities.map(a => a.poi_id))));
        }
    }

    // 4. Validate Results
    if (!evals.passed) {
        return {
            success: false,
            evaluations: evals,
            diffSummary: [],
            failureReason: `Edit unsafe: ${evals.feasibility.errors.join(", ")} ${evals.editCorrectness?.unexpectedChanges.join(", ")}`
        };
    }

    // 5. Diff Summary (Step 28)
    const diffs: string[] = [];
    if (editCommand.op === 'swap') diffs.push(`Swapped existing activity for new one on Day ${finalDayNum}`);
    if (editCommand.op === 'remove') diffs.push(`Removed activity from Day ${finalDayNum}`);
    if (editCommand.op === 'add') diffs.push(`Added ${(editCommand as any).poi_id_to_add ? 'new activity' : 'activity'} to Day ${finalDayNum}`);
    if (editCommand.op === 'move') diffs.push(`Moved activity to Day ${finalDayNum}`);
    if (editCommand.op === 'add_by_category') {
        const addedPoi = updatedItinerary.days.find(d => d.day_number === finalDayNum)?.blocks.flatMap(b => b.activities).find(a => !oldActivitiesJson.includes(a.poi_id));
        diffs.push(`Added ${addedPoi ? addedPoi.name : 'new ' + (editCommand as any).category} to Day ${finalDayNum}`);
    }
    if (editCommand.op === 'replace_by_attribute') {
        const addedPoi = updatedItinerary.days.find(d => d.day_number === finalDayNum)?.blocks.find(b => b.name === (editCommand as any).time_block)?.activities[0];
        diffs.push(`Swapped activity for an ${(editCommand as any).attribute} alternative (${addedPoi?.name}) on Day ${finalDayNum}`);
    }
    if (editCommand.op === 'day_relaxation') diffs.push(`Reduced activity density on Day ${finalDayNum}`);

    return {
        success: true,
        updatedItinerary,
        evaluations: evals,
        diffSummary: diffs,
        op: editCommand.op
    };
}
