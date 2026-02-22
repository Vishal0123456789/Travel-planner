import { Itinerary } from '../types/itinerary';
import { POI } from '../types/poi';

export interface GroundingReport {
    pass: boolean;
    missingPois: string[];
    groundingScore: number; // %
}

/**
 * Checks if every POI in the itinerary is a real POI we know about.
 */
export function evaluateGrounding(
    itinerary: Itinerary,
    poiIndex: Record<string, POI>
): GroundingReport {
    const report: GroundingReport = {
        pass: true,
        missingPois: [],
        groundingScore: 100
    };

    const activities = itinerary.days.flatMap(d => d.blocks.flatMap(b => b.activities));

    if (activities.length === 0) return report; // Empty is trivially grounded?

    let validCount = 0;

    for (const act of activities) {
        if (!poiIndex[act.poi_id]) {
            report.missingPois.push(act.poi_id);
        } else {
            validCount++;

            // Secondary check: Lat/Lon must exist
            // (Typescript guarantees it usually, but runtime check)
            if (!act.geo_coordinates || act.geo_coordinates.lat === 0) {
                report.missingPois.push(`${act.poi_id} (Missing Coords)`);
                validCount--; // Invalidate
            }
        }
    }

    report.groundingScore = Math.round((validCount / activities.length) * 100);

    if (report.missingPois.length > 0) {
        report.pass = false;
    }

    return report;
}
