export interface BaseItem {
    id: string;
}

export interface Metadata {
    text: string;
    [key: string]: any;
}

export interface Item extends BaseItem {
    vector?: number[];
    score?: number, 
    metadata: Metadata;
}