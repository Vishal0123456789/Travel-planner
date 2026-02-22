import { Itinerary } from '../types/itinerary';
import { POI } from '../types/poi';
import { EditCommand } from '../types/edit';

import { evaluateFeasibility, FeasibilityReport } from './feasibilityEval';
import { evaluateGrounding, GroundingReport } from './groundingEval';
import { evaluateEditCorrectness, EditEvalReport } from './editCorrectnessEval';
import { UDAIPUR_POIS } from '../mocks/udaipur_sample';

export interface EvaluationSummary {
    passed: boolean; // Global pass
    feasibility: FeasibilityReport;
    grounding: GroundingReport;
    editCorrectness?: EditEvalReport;
}

// Prepare explicit Index
const POI_INDEX: Record<string, POI> = {};
UDAIPUR_POIS.forEach(p => POI_INDEX[p.id] = p);

/**
 * The Master Eval Function.
 */
export function runEvaluations(
    itinerary: Itinerary,
    context?: {
        pace?: 'relaxed' | 'packed',
        previousItinerary?: Itinerary,
        editIntent?: EditCommand
    }
): EvaluationSummary {

    const feasibility = evaluateFeasibility(itinerary, context?.pace || 'relaxed');
    const grounding = evaluateGrounding(itinerary, POI_INDEX);

    let editCorrectness: EditEvalReport | undefined;
    if (context?.previousItinerary && context?.editIntent) {
        editCorrectness = evaluateEditCorrectness(
            context.previousItinerary,
            itinerary,
            context.editIntent
        );
    } else if (context?.editIntent && !context.previousItinerary) {
        console.error("Warning: Edit intent provided but no previous itinerary to compare.");
    }

    const passed =
        feasibility.pass &&
        grounding.pass &&
        (editCorrectness ? editCorrectness.pass : true);

    return {
        passed,
        feasibility,
        grounding,
        editCorrectness
    };
}
