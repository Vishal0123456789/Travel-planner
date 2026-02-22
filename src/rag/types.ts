export interface RagEntry {
    poi_id: string;
    title: string;
    summary: string;
    source_url: string;
}

export interface RagResult {
    poi_name?: string;
    summary: string | null;
    source_name: string | null;
    source_url: string | null;
}

