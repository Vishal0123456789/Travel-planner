import { Itinerary } from '../types/itinerary';
import { ragService } from './service';
import { RagResult } from './types';

/**
 * Step 18: Guardrails
 * 
 * Ensures that the explanation generation primarily uses logic, 
 * and only uses RAG for allowed POIs.
 */

export function getRagForItinerary(itinerary: Itinerary): Record<string, RagResult> {
    const poiMap = new Map<string, string>();
    itinerary.days.forEach(day => {
        day.blocks.forEach(block => {
            block.activities.forEach(activity => {
                poiMap.set(activity.poi_id, activity.name);
            });
        });
    });

    const results: Record<string, RagResult> = {};
    poiMap.forEach((name, id) => {
        const rag = ragService.getRagByPoiId(id);
        if (rag.summary) {
            results[id] = {
                ...rag,
                poi_name: name
            };
        }
    });

    return results;
}

export function getSafeContextForExplanation(
    userQuery: string,
    itinerary: Itinerary
): string {
    const ragData = getRagForItinerary(itinerary);

    // Convert to a string format for the LLM context if needed,
    // though Step 5 suggests we should return a structured object to the UI.
    return JSON.stringify(ragData);
}
