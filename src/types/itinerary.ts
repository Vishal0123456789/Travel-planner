import { POI, POICategory } from './poi';

/**
 * Represents a single activity in the itinerary.
 */
export interface Activity {
    /** Reference to the POI */
    poi_id: string;

    /** Display name (can be overridden from POI name) */
    name: string;

    /** Type of activity matching POI category */
    type: POICategory;

    /** Planned duration in minutes */
    duration_minutes: number;

    /** Start time in 24h format "HH:MM" */
    start_time: string;

    /** End time in 24h format "HH:MM" */
    end_time: string;

    /** Travel time to the NEXT activity in minutes. 0 if last activity. */
    travel_time_to_next_minutes: number;

    /** Copied for map efficiency */
    geo_coordinates: {
        lat: number;
        lon: number;
    };

    /** Automated "Why this spot?" reasoning */
    reasoning?: string;
}

/**
 * A generic time block (Morning, Afternoon, Evening).
 */
export type TimeBlockName = 'morning' | 'afternoon' | 'evening';

export interface TimeBlock {
    name: TimeBlockName;
    activities: Activity[];
}

/**
 * A single day in the trip.
 */
export interface Day {
    day_number: number;
    date?: string; // Optional if real dates are used
    blocks: TimeBlock[];
}

/**
 * The complete itinerary state.
 */
export interface Itinerary {
    id: string;
    title: string;
    days: Day[];
    total_duration_days: number;
}

// --- Map Visualization Schemas ---

export interface MapPin {
    poi_id: string;
    lat: number;
    lon: number;
    label: string;
    category: POICategory;
    day_number: number; // For color coding
}

export interface MapRouteSegment {
    from_poi_id: string;
    to_poi_id: string;
    /** Encoded polyline string or array of coords */
    coordinates: Array<[number, number]>;
    day_number: number;
    color_hex: string;
}

export interface MapData {
    pins: MapPin[];
    routes: MapRouteSegment[];
    center: {
        lat: number;
        lon: number;
        zoom: number;
    };
}
