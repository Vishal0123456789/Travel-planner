import fs from 'fs';
import path from 'path';
import { RagEntry, RagResult } from './types';

class RagService {
    private index: Map<string, RagEntry> = new Map();

    constructor() {
        this.loadData();
    }

    private loadData() {
        const filePath = path.join(__dirname, '..', 'data', 'udaipur_rag.json');
        try {
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as RagEntry[];
                data.forEach(entry => {
                    this.index.set(entry.poi_id, entry);
                });
                console.log(`Loaded ${this.index.size} RAG entries.`);
            } else {
                console.warn(`RAG data file not found at ${filePath}`);
            }
        } catch (error) {
            console.error('Failed to load RAG data:', error);
        }
    }

    public hasRag(poi_id: string): boolean {
        return this.index.has(poi_id);
    }

    public performIntegrityCheck(allPois: { id: string, name: string }[]) {
        const poiSet = new Set(allPois.map(p => p.id));
        const ragIds = Array.from(this.index.keys());

        // 1. Check for broken links (RAG -> POI)
        let brokenLinks = 0;
        ragIds.forEach(id => {
            if (!poiSet.has(id)) {
                console.warn(`[RAG Integrity] POI ID "${id}" in RAG data does not exist in the main POI dataset.`);
                brokenLinks++;
            }
        });

        // 2. Check for missing major landmarks (POI -> RAG)
        const majorLandmarks = [
            "City Palace",
            "Lake Pichola",
            "Jagdish Temple",
            "Jagdish Mandir",
            "Monsoon Palace",
            "Sajjan Garh",
            "Saheliyon-ki-Bari",
            "Bagore Ki Haveli",
            "Fateh Sagar",
            "Jag Mandir"
        ];

        allPois.forEach(poi => {
            const isMajor = majorLandmarks.some(landmark =>
                poi.name.toLowerCase().includes(landmark.toLowerCase())
            );

            if (isMajor && !this.index.has(poi.id)) {
                console.warn(`[RAG Integrity] Major landmark found but missing RAG linkage: "${poi.name}" (${poi.id})`);
            }
        });

        if (brokenLinks === 0) {
            console.log(`[RAG Integrity] All ${ragIds.length} RAG entries correctly mapped to POI IDs.`);
        }
    }

    public getRagByPoiId(poi_id: string): RagResult {
        const entry = this.index.get(poi_id);
        if (!entry) {
            return {
                summary: null,
                source_name: null,
                source_url: null
            };
        }

        return {
            summary: entry.summary,
            source_name: this.extractSourceName(entry.source_url),
            source_url: entry.source_url
        };
    }

    private extractSourceName(url: string): string {
        try {
            const domain = new URL(url).hostname;
            if (domain.includes('wikipedia.org')) return 'Wikipedia';
            if (domain.includes('wikivoyage.org')) return 'Wikivoyage';
            return domain.replace('www.', '');
        } catch {
            return 'Verified Source';
        }
    }
}

export const ragService = new RagService();
