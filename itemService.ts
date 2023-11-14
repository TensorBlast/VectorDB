import { pipeline } from "@xenova/transformers";
import { LocalIndex, ItemSelector } from "vectra";
import { IndexItem } from "vectra";
import { createHash } from "crypto";

const modelname = "Xenova/bge-large-en-v1.5";

const pipe = await pipeline("feature-extraction", modelname);

type Result = IndexItem & { score: number };

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

export async function convertResultsToItems(results: any[]): Promise<IndexItem[]> {
    const items: IndexItem[] = [];
    for (const result of results) {

        const item : IndexItem = await createItem(result.item.metadata.text as string, result.item.vector);

        items.push(item);
    }
    return items;
}

export async function query(index: LocalIndex, item: string | IndexItem, n=1): Promise<IndexItem[] | null> {
    if (typeof item === "string") {
        const vector = await getEmbeddings(item);
        const results = await index.queryItems(vector, n);
        if (results.length > 0) {
            for (const result of results) {
                console.log(`[${result.score}] ${result.item.metadata.text}`);
            }
            const resultsitems = await convertResultsToItems(results);
            return resultsitems;
        } else {
            console.log(`No results found`);
            return null;
        }
    } else {
        if (typeof item.vector === "undefined") {
            item.vector = await getEmbeddings(item.metadata.text as string);
        }
        const results = await index.queryItems(item.vector, n);
        if (results.length > 0) {
            for (const result of results) {
                console.log(`[${result.score}] ${result.item.metadata.text}`);
            }
            const resultsitems = await convertResultsToItems(results);
            return resultsitems;
        } else {
            console.log(`No results found`);
            return null;
        }
    }
}

export async function getAllItems(index: LocalIndex): Promise<IndexItem[]> {
    const results = await index.listItems();
    let items: IndexItem[] = [];
    for (const result of results) {
        let item = await createItem(result.metadata.text as string, result.vector);
        items.push(item);
    }
    return items;
}