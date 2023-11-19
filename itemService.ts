import { pipeline, env } from "@xenova/transformers";
import { LocalIndex, ItemSelector } from "vectra";
import { IndexItem } from "vectra";
import { createHash } from "crypto";
import * as dotenv from "dotenv";

if (process.env.DOTENV !== undefined) {
    console.log('ItemService using dotenv: ' + process.env.DOTENV);
    dotenv.config({path: process.env.DOTENV});
}
else {
    console.log(`ItemService using default dotenv`);
    dotenv.config();
}

let modelname = process.env.MODELNAME || "Xenova/bge-large-en-v1.5";
env.localModelPath = process.env.MODELPATH || "";

if (env.localModelPath !== "") {
    console.log("Service Methods using: Local model path: " + env.localModelPath);
    env.allowRemoteModels = false;
}
const pipe = await pipeline("feature-extraction", modelname);

export type Result = IndexItem & { score: number };

export async function getEmbeddings(phrase: string) {
    const response =  await pipe(phrase, {"pooling": "mean", "normalize": false});
    return response.data;
}

export async function createItem(text: string, vector?: number[]) : Promise<IndexItem> {
    if (!vector) {
        vector = await getEmbeddings(text);
    }
    const item: IndexItem = {
        id: await createHash("sha256").update(text).digest("hex"),
        vector: vector!,
        metadata: { "text": text },
        norm: ItemSelector.normalize(vector!)
    };
    return item;
}

export async function addItem(index: LocalIndex, item: string | IndexItem) {
    try {
            if (typeof item === "string") {
                const update = await createItem(item)
                console.log('Adding string item: ' + update.id + " -> " + update.metadata.text);

                await index.insertItem(update);
        } else {
            console.log('Adding object item: ' + item.id + " -> " + item.metadata.text);
            await index.insertItem(item);
        }
    }catch (error) {
        console.log(error);
    }   
}

export async function addItems(index: LocalIndex, items: string[] | IndexItem[]) {
    for (const item of items) {
        await addItem(index, item);
    }
}
export async function upsertItem(index: LocalIndex, item: string | IndexItem) {
    if (typeof item === 'string') {
        const toadd = await createItem(item);
        await index.upsertItem(toadd);
        console.log("Upserting string item: " + toadd.id + " -> "+ toadd.metadata.text)
    } else if (typeof item === 'object') {
        console.log("Upserting object item: " + item.id + " -> "+ item.metadata.text)
        await index.upsertItem(item);
    }
}


export async function upsertItems(index: LocalIndex, items: string[] | IndexItem[]) {
    for (const item of items) {
        await upsertItem(index, item);
    }
}

export async function convertResults(results: any[]): Promise<Result[]> {
    const res: Result[] = [];
    for (const result of results) {

        const item : Result = {
            id: result.item.id,
            vector: result.item.vector,
            metadata: result.item.metadata,
            norm: result.item.norm,
            score: result.score
        };

        res.push(item);
    }
    return res;
}

export async function query(index: LocalIndex, item: string | IndexItem, n=1): Promise<Result[] | null> {
    if (typeof item === "string") {
        const vector = await getEmbeddings(item);
        const results = await index.queryItems(vector, n);
        if (results.length > 0) {
            for (const result of results) {
                console.log(`[${result.score}] ${result.item.metadata.text}`);
            }
            const resultsitems = await convertResults(results);
            return resultsitems;
        } else {
            console.log(`No results found`);
            return null;
        }
    } else {
        if (item.vector === null) {
            item.vector = await getEmbeddings(item.metadata.text as string);
        }
        const results = await index.queryItems(item.vector, n);
        if (results.length > 0) {
            for (const result of results) {
                console.log(`[${result.score}] ${result.item.metadata.text}`);
            }
            const resultsitems = await convertResults(results);
            return resultsitems;
        } else {
            console.log(`No results found`);
            return null;
        }
    }
}

export async function queryVector(index: LocalIndex, vector: number[], n=1): Promise<Result[] | null> {
    const results = await index.queryItems(vector, n);
    if (results.length > 0) {
        for (const result of results) {
            console.log(`[${result.score}] ${result.item.metadata.text}`);
        }
        const resultsitems = await convertResults(results);
        return resultsitems;
    } else {
        console.log(`No results found`);
        return null;
    }
}

export async function getAllItems(index: LocalIndex): Promise<IndexItem[]> {
    const results = await index.listItems();
    return results;
}
