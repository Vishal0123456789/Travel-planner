/**
 * Step 10: Intent Taxonomy
 */
export type IntentType =
    | 'CREATE_TRIP'
    | 'EDIT_ITINERARY'
    | 'SHOW_CURRENT_PLAN'
    | 'EXPLAIN_DECISION'
    | 'CONFIRM_ACK'
    | 'UNKNOWN';

export interface IntentResult {
    intent: IntentType;
    confidence: number;
    reasoning?: string;
    needs_clarification?: boolean;
}

/**
 * Step 11: Extraction
 */
export interface ExtractedConstraints {
    destination?: string;
    duration_days?: number;
    pace?: 'relaxed' | 'moderate' | 'packed'; // Match UserConstraints
    startDate?: string;
    budget?: 'low' | 'medium' | 'high'; // Match UserConstraints strict union
    // Others...
}

export interface ConstraintExtractionResult {
    slots: ExtractedConstraints;
    slotConfidence: Record<keyof ExtractedConstraints, number>;
    missingCriticalSlots: string[];
}

/**
 * Step 13: Explanation Context
 */
export interface ExplanationContext {
    itinerarySummary?: string;
    evalResults?: { passed: boolean, warnings: string[] };
    userQuery?: string;
    ragData?: Record<string, {
        poi_name?: string;
        summary: string | null;
        source_name: string | null;
        source_url: string | null;
    }>;
}

export interface ExplanationResult {
    explanation_text: string;
    citation: {
        source_name: string | null;
        source_url: string | null;
    };
}
