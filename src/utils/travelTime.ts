import { POI } from '../types/poi';

const EARTH_RADIUS_KM = 6371;
const ASSUMED_SPEED_KMH = 20;

function toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
}

/**
 * Calculates the Haversine distance between two points in kilometers.
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
}

/**
 * Estimates travel time between two POIs in minutes.
 * Assumes a constant city driving speed.
 */
export function estimateTravelTime(p1: POI, p2: POI): number {
    const distanceKm = calculateDistanceKm(
        p1.location.lat, p1.location.lon,
        p2.location.lat, p2.location.lon
    );

    const timeHours = distanceKm / ASSUMED_SPEED_KMH;
    return Math.ceil(timeHours * 60);
}
