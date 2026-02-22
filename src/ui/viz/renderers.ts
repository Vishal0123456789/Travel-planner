export class ItineraryRenderer {
    render(itinerary: any, evalReport: any) {
        // Pseudo-code for logic that would populate the HTML
        // 1. Clear container
        // 2. Loop Days
        // 3. Loop Blocks
        // 4. Inject Evaluation Warnings if any
        console.log("Rendering Itinerary", itinerary.id);
    }
}

export class MapVisualizer {
    render(mapData: any) {
        // Would initialize Leaflet markers
        // Draw polylines for routes
        console.log("Drawing Map", mapData.pins.length, "pins");
    }
}
