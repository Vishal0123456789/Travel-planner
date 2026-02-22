export type POICategory = 'sight' | 'food' | 'rest' | 'activity' | 'shopping' | 'other';

export interface POI {
  /** OpenStreetMap ID (e.g., "node/12345") */
  id: string;
  
  /** Name of the place */
  name: string;
  
  /** Geo-coordinates */
  location: {
    lat: number;
    lon: number;
  };
  
  /** Category for itinerary logic */
  category: POICategory;
  
  /** Recommended visit duration in minutes */
  avg_visit_duration_minutes: number;
  
  /** 0-100 score for ranking */
  popularity_score: number;
  
  /** Opening hours in standardized format (e.g., "09:00-17:00") */
  opening_hours: string;
  
  /** Optional: specific criteria for tagging */
  tags?: string[];
  
  /** Optional: Address or display location */
  address?: string;
}
