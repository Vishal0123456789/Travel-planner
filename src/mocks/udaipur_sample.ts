import { POI } from '../types/poi';
import { Itinerary, Day } from '../types/itinerary';

export const UDAIPUR_POIS: POI[] = [
    {
        id: "osm_node_936651777",
        name: "City Palace",
        location: { lat: 24.5764, lon: 73.6835 },
        category: "sight",
        avg_visit_duration_minutes: 120,
        popularity_score: 95,
        opening_hours: "09:30-17:30",
        tags: ["history", "architecture", "lake_view"]
    },
    {
        id: "node/789012",
        name: "Lake Pichola",
        location: { lat: 24.5733, lon: 73.6756 },
        category: "sight",
        avg_visit_duration_minutes: 60,
        popularity_score: 98,
        opening_hours: "00:00-24:00",
        tags: ["nature", "boating"]
    },
    {
        id: "osm_node_6687057486",
        name: "Ambrai Ghat",
        location: { lat: 24.5700, lon: 73.6800 },
        category: "sight",
        avg_visit_duration_minutes: 45,
        popularity_score: 85,
        opening_hours: "06:00-22:00",
        tags: ["sunset", "viewpoint"]
    },
    {
        id: "osm_way_111321620",
        name: "Jagdish Temple",
        location: { lat: 24.5794, lon: 73.6845 },
        category: "sight",
        avg_visit_duration_minutes: 45,
        popularity_score: 90,
        opening_hours: "05:00-22:00",
        tags: ["religion", "architecture", "history"]
    },
    {
        id: "osm_way_108781864",
        name: "Saheliyon-ki-Bari",
        location: { lat: 24.6033, lon: 73.6917 },
        category: "sight",
        avg_visit_duration_minutes: 60,
        popularity_score: 88,
        opening_hours: "09:00-19:00",
        tags: ["nature", "garden", "history"]
    },
    {
        id: "osm_node_7332544542",
        name: "Bagore Ki Haveli",
        location: { lat: 24.5790, lon: 73.6800 },
        category: "sight",
        avg_visit_duration_minutes: 90,
        popularity_score: 92,
        opening_hours: "10:00-19:00",
        tags: ["history", "culture", "museum"]
    },
    {
        id: "node/444555",
        name: "Fateh Sagar Lake",
        location: { lat: 24.6000, lon: 73.6750 },
        category: "sight",
        avg_visit_duration_minutes: 90,
        popularity_score: 94,
        opening_hours: "00:00-24:00",
        tags: ["nature", "boating", "sunset"]
    },
    {
        id: "osm_way_111334933",
        name: "Monsoon Palace (Sajjangarh)",
        location: { lat: 24.5900, lon: 73.6300 },
        category: "sight",
        avg_visit_duration_minutes: 120,
        popularity_score: 89,
        opening_hours: "09:00-18:00",
        tags: ["history", "architecture", "viewpoint"]
    },
    {
        id: "osm_node_4830850421",
        name: "Jag Mandir",
        location: { lat: 24.5680, lon: 73.6770 },
        category: "sight",
        avg_visit_duration_minutes: 90,
        popularity_score: 91,
        opening_hours: "10:00-18:00",
        tags: ["history", "architecture", "lake_view"]
    },
    {
        id: "node/777888",
        name: "Shilpgram",
        location: { lat: 24.6050, lon: 73.6450 },
        category: "sight",
        avg_visit_duration_minutes: 120,
        popularity_score: 80,
        opening_hours: "11:00-19:00",
        tags: ["culture", "craft", "village"]
    },
    {
        id: "osm_node_3898009271",
        name: "Vintage Car Museum",
        location: { lat: 24.5750, lon: 73.6930 },
        category: "sight",
        avg_visit_duration_minutes: 60,
        popularity_score: 82,
        opening_hours: "09:00-21:00",
        tags: ["museum", "cars", "history"]
    },
    {
        id: "node/999000",
        name: "Gulab Bagh & Zoo",
        location: { lat: 24.5720, lon: 73.6950 },
        category: "sight",
        avg_visit_duration_minutes: 90,
        popularity_score: 75,
        opening_hours: "08:00-18:00",
        tags: ["nature", "garden", "zoo"]
    },
    {
        id: "osm_node_655410653",
        name: "Ambrai Restaurant",
        location: { lat: 24.5760, lon: 73.6800 },
        category: "food",
        avg_visit_duration_minutes: 90,
        popularity_score: 96,
        opening_hours: "12:00-23:00",
        tags: ["fine dining", "local cuisine", "lake view"]
    },
    {
        id: "food/002",
        name: "Lakeside Street Food Stalls",
        location: { lat: 24.5800, lon: 73.6850 },
        category: "food",
        avg_visit_duration_minutes: 45,
        popularity_score: 92,
        opening_hours: "16:00-22:00",
        tags: ["street food", "local cuisine", "vegetarian"]
    },
    {
        id: "osm_node_10881009914",
        name: "Millets of Mewar",
        location: { lat: 24.5780, lon: 73.6820 },
        category: "food",
        avg_visit_duration_minutes: 75,
        popularity_score: 89,
        opening_hours: "11:00-22:30",
        tags: ["vegetarian", "local cuisine", "healthy"]
    },
    {
        id: "food/004",
        name: "Upre by 1500 AD",
        location: { lat: 24.5740, lon: 73.6780 },
        category: "food",
        avg_visit_duration_minutes: 90,
        popularity_score: 94,
        opening_hours: "12:30-23:00",
        tags: ["fine dining", "non-vegetarian", "rooftop"]
    },
    {
        id: "osm_node_4086293817",
        name: "Jheel's Ginger Coffee Bar",
        location: { lat: 24.5795, lon: 73.6815 },
        category: "food",
        avg_visit_duration_minutes: 60,
        popularity_score: 91,
        opening_hours: "09:00-21:00",
        tags: ["cafe", "vegetarian", "bakery"]
    }
];

export const SAMPLE_ITINERARY: Itinerary = {
    id: "trip_001",
    title: "Relaxed Udaipur Getaway",
    total_duration_days: 1,
    days: [
        {
            day_number: 1,
            blocks: [
                {
                    name: "morning",
                    activities: [
                        {
                            poi_id: "osm_node_936651777",
                            name: "City Palace",
                            type: "sight",
                            duration_minutes: 120,
                            start_time: "10:00",
                            end_time: "12:00",
                            travel_time_to_next_minutes: 15,
                            geo_coordinates: { lat: 24.5764, lon: 73.6835 }
                        }
                    ]
                },
                {
                    name: "evening",
                    activities: [
                        {
                            poi_id: "osm_node_6687057486",
                            name: "Ambrai Ghat",
                            type: "sight",
                            duration_minutes: 60,
                            start_time: "17:30",
                            end_time: "18:30",
                            travel_time_to_next_minutes: 0,
                            geo_coordinates: { lat: 24.5700, lon: 73.6800 }
                        }
                    ]
                }
            ]
        }
    ]
};
