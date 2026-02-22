export type EditOperationType = 'add' | 'remove' | 'swap' | 'move' | 'add_by_category' | 'replace_by_attribute' | 'day_relaxation' | 'day_optimization';

export interface BaseEditCommand {
    op: EditOperationType;
    /** Optional reasoning for the edit derived from user intent */
    intent_reasoning?: string;
}

export interface RemoveActivityCommand extends BaseEditCommand {
    op: 'remove';
    /** The POI ID to remove */
    target_poi_id: string;
    day_number: number;
}

export interface AddActivityCommand extends BaseEditCommand {
    op: 'add';
    /** The POI ID to add (requires search/lookup) */
    poi_id_to_add: string;
    /** Where to add it */
    target_day_number: number;
    time_block?: 'morning' | 'afternoon' | 'evening';
}

export interface SwapActivityCommand extends BaseEditCommand {
    op: 'swap';
    /** The POI ID to replace */
    target_poi_id: string;
    /** The New POI ID to insert */
    replacement_poi_id: string;
    day_number: number;
}

export interface MoveActivityCommand extends BaseEditCommand {
    op: 'move';
    target_poi_id: string;
    from_day: number;
    to_day: number;
    to_time_block?: 'morning' | 'afternoon' | 'evening';
}

export interface AddByCategoryCommand extends BaseEditCommand {
    op: 'add_by_category';
    category: string;
    day_number: number;
    fame?: 'high' | 'medium' | 'low';
}

export interface ReplaceByAttributeCommand extends BaseEditCommand {
    op: 'replace_by_attribute';
    attribute: 'indoor' | 'outdoor';
    day_number: number;
    time_block: 'morning' | 'afternoon' | 'evening';
}

export interface DayRelaxationCommand extends BaseEditCommand {
    op: 'day_relaxation';
    day_number: number;
}

export interface DayOptimizationCommand extends BaseEditCommand {
    op: 'day_optimization';
    day_number: number;
}

export type EditCommand =
    | RemoveActivityCommand
    | AddActivityCommand
    | SwapActivityCommand
    | MoveActivityCommand
    | AddByCategoryCommand
    | ReplaceByAttributeCommand
    | DayRelaxationCommand
    | DayOptimizationCommand;
