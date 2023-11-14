import { pipeline } from "@xenova/transformers";
import { LocalIndex } from "vectra";
import { Item } from "./item";

import { createHash } from "crypto";

const modelname = "Xenova/bge-large-en-v1.5";

const pipe = await pipeline("feature-extraction", modelname);

export async function getEmbeddings(phrase: string) {
    const response =  await pipe(phrase, {"pooling": "mean", "normalize": false});
    return response.data;
}

export async function createItem(text: string, vector?: number[]) {

    if (!vector) {
        vector = await getEmbeddings(text);
    }
    const item: Item = {
        id: await createHash("sha256").update(text).digest("hex"),
        vector: vector,
        metadata: { "text": text }
    };
    return item;
}

export async function addItem(index: LocalIndex, item: string | Item) {
    try {
            if (typeof item === "string") {
                const toadd = await createItem(item)
                console.log('Adding string item: ' + toadd.id + " -> " + toadd.metadata.text);

                await index.insertItem({
                    id: toadd.id,
                    vector: toadd.vector,
                    metadata: toadd.metadata
            });
        } else {
            if (typeof item.vector === "undefined") {
                item.vector = await getEmbeddings(item.metadata.text);
            }
            console.log('Adding object item: ' + item.id + " -> " + item.metadata.text);

            await index.insertItem({
                id: item.id,
                vector: item.vector,
                metadata: item.metadata
            });
        }
    }catch (error) {
        console.log(error);
    }   
}

export async function addItems(index: LocalIndex, items: string[] | Item[]) {
    await Promise.all(items.map( async (element : string | Item) => {
        try {
            await addItem(index, element);
        } catch (error) {
            console.log(error);
        }
    }));
}
export async function upsertItem(index: LocalIndex, item: string | Item) {
    if (typeof item === 'string') {
        const toadd = await createItem(item);
        await index.upsertItem(toadd);
        console.log("Upserting string item: " + toadd.id + " -> "+ toadd.metadata.text)
    } else if (typeof item === 'object') {
        console.log("Upserting object item: " + item.id + " -> "+ item.metadata.text)
        if (item.vector === undefined) {
            item.vector = await getEmbeddings(item.metadata.text);
        }
        if (item.id === undefined) {
            item.id = await createHash("sha256").update(item.metadata.text).digest("hex");
        }
        await index.upsertItem({
            id: item.id,
            vector: item.vector,
            metadata: item.metadata
        });
    }
}


export async function upsertItems(index: LocalIndex, items: string[] | Item[]) {
    await Promise.all(items.map( async (element: string|Item) => {
        if (typeof element === "string") {
            const result = await index.listItemsByMetadata({text: element});
            if (result.length > 0) {
                for (const res of result) {
                    await index.deleteItem(res.id);
                }
            } 
            const item = await createItem(element);
            console.log(`Upserting item of type string: ${item.id} -> ${item.metadata.text}`)
            await upsertItem(index, item);
        }
        else {
            if (typeof element === 'object') {
                await upsertItem(index, element);
            }
        }
    }));
}

export async function convertResultsToItems(results: any[]): Promise<Item[]> {
    const items: Item[] = [];
    for (const result of results) {

        const item = await createItem(result.item.metadata.text, result.item.vector);

        item.score = result.score;
        items.push(item);
    }
    return items;
}

export async function query(index: LocalIndex, item: string | Item, n=1): Promise<Item[] | null> {
    if (typeof item === "string") {
        const vector = await getEmbeddings(item);
        const results = await index.queryItems(vector, n);
        if (results.length > 0) {
            for (const result of results) {
                console.log(`[${result.score}] ${result.item.metadata.text}`);
            }
            let resultsitems = await convertResultsToItems(results);
            return resultsitems;
        } else {
            console.log(`No results found`);
            return null;
        }
    } else {
        if (typeof item.vector === "undefined") {
            item.vector = await getEmbeddings(item.metadata.text) as number[];
        }
        const results = await index.queryItems(item.vector, n);
        if (results.length > 0) {
            for (const result of results) {
                console.log(`[${result.score}] ${result.item.metadata.text}`);
            }
            let resultsitems = await convertResultsToItems(results);
            return resultsitems;
        } else {
            console.log(`No results found`);
            return null;
        }
    }
}

export async function getAllItems(index: LocalIndex): Promise<Item[]> {
    const results = await index.listItems();
    let items: Item[] = [];
    for (const result of results) {
        let item = await createItem(result.metadata.text as string, result.vector);
        items.push(item);
    }
    return items;
}