import { Itinerary } from './itinerary';

export type ConversationMode =
    | 'IDLE'
    | 'UNDERSTANDING'
    | 'CONFIRMING_CONSTRAINTS'
    | 'PLANNING'
    | 'PRESENTING'
    | 'EDITING';

/**
 * Key constraints required to build a plan.
 */
export interface UserConstraints {
    destination?: string;
    duration_days?: number;
    dates?: {
        start: string;
        end: string;
    };
    pace?: 'relaxed' | 'moderate' | 'packed';
    interests?: string[];
    budget?: 'low' | 'medium' | 'high';
    travelers?: string; // e.g. "couple", "family"
    food_preference?: string;
}

export interface ConversationHistoryItem {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

export interface ConversationContext {
    mode: ConversationMode;

    /** Current state of gathered requirements */
    constraints: UserConstraints;

    /** List of critical slots that are still undefined */
    missing_critical_slots: Array<keyof UserConstraints>;

    /** 
     * Tracks confirmed vs assumed constraints.
     * If a constraint is in 'assumed', it must be confirmed before PLANNING.
     */
    assumptions: Partial<UserConstraints>;

    history: ConversationHistoryItem[];

    /** The current generated plan (if any) */
    current_itinerary?: Itinerary;

    /** Version number for diffing and rollback */
    itinerary_version: number;
}

/**
 * Hard Gate Rule:
 * The system must never enter 'PLANNING' state unless:
 * 1. missing_critical_slots is empty.
 * 2. assumptions are explicitly acknowledged or empty.
 */
export function canEnterPlanning(context: ConversationContext): boolean {
    return (
        context.missing_critical_slots.length === 0 &&
        Object.keys(context.assumptions).length === 0
        // Logic: In reality, assumptions move to constraints once confirmed, so this list should be empty.
    );
}
