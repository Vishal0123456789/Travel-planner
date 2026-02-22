import { POI } from '../types/poi';
import { UDAIPUR_POIS } from '../mocks/udaipur_sample';

/**
 * Searches for POIs based on city (implicit in source for now) and tags.
 */
export function searchPois(
    city: string, // Unused for now as we only have Udaipur mocks
    tags: string[],
    excludeIds: string[] = []
): POI[] {
    // Filter by tags and exclusions
    let results = UDAIPUR_POIS.filter(poi => {
        if (excludeIds.includes(poi.id)) return false;

        // If no tags provided, return everything (or maybe just top popular?)
        if (tags.length === 0) return true;

        // Check if POI has at least one matching tag
        // Also match strictly against POI category if needed, but tags are more flexible
        const hasTag = poi.tags?.some(t => tags.includes(t)) || false;
        // Also check partial title match?
        // The requirement says "Tag/category match"

        return hasTag;
    });

    // Edge case: No results -> relax tag constraint?
    // Requirements: "If no results -> relax tag constraint (log warning)"
    if (results.length === 0 && tags.length > 0) {
        console.warn(`No POIs found for tags [${tags.join(', ')}]. Relaxing constraints.`);
        // Fallback: return everything not excluded, sorted by popularity
        results = UDAIPUR_POIS.filter(poi => !excludeIds.includes(poi.id));
    }

    // Rank by Popularity Score
    results.sort((a, b) => b.popularity_score - a.popularity_score);

    return results;
}
