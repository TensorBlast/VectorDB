import * as ItemService from './itemService'

import { LocalIndex, IndexItem } from "vectra";
import path from "path";
import express, { Request, Response } from "express";
import * as lodash from "lodash";
import * as dotenv from "dotenv";

export const itemRouter = express.Router();

export const queryRouter = express.Router();

dotenv.config();
let index;

const __dirname = path.resolve(process.env.INDEX_LOCATION || "");
if (!process.env.INDEX_LOCATION) {
    console.log("INDEX_LOCATION not set! Using default -> " + __dirname);
    index = new LocalIndex(path.join(__dirname,"..", "index"));
}
else {
    index = new LocalIndex(path.join(__dirname, "index"));
}

itemRouter.get("/", async (req: Request, res: Response) => {
    console.log(`LOG: Received GET request for all items - from ${req.ip}`)
    try {
        const items: IndexItem[] = await ItemService.getAllItems(index);
        res.status(200).send(items);
    }
    catch (e) {
        res.status(500).send(e.message);
    }
});

itemRouter.get("/:id", async (req: Request, res: Response) => {
    try {
        console.log(`LOG: Received GET request for item with id ${req.params.id} - from ${req.ip}`)
        const items: IndexItem | undefined = await index.getItem(req.params.id);
        if (items === undefined) { 
            res.status(404).send(`Item with id ${req.params.id} not found!`);
        }
        else {
            res.status(200).send(items);
        }
    }
    catch (e) {
        res.status(500).send(e.message);
    }
});

itemRouter.post("/", async (req: Request, res: Response) => {
    try {
        let body = req.body;
        if (body.text instanceof Array && ('vector' in body)){
            console.log(`POST request containing multiple items with existing vectors. Inserting ${body.text.length} chunks - from ${req.ip}`)
            lodash.zip(body.text, body.vector).map(async (element: any) => {
                const item = await ItemService.createItem(element[0], element[1]);
                await ItemService.upsertItem(index,item);
            });
            res.status(200).send('Inserted all records with existing vectors!')
        } else if (body.text instanceof Array) {
            console.log(`POST request containing multiple items with existing vectors. Inserting ${body.text.length} chunks - from ${req.ip}`)
            const items: IndexItem[] = [];
            for (const txt of body.text) {
                const item = await ItemService.createItem(txt);
                items.push(item);
            }
            await ItemService.upsertItems(index, items);
            console.log(items);
            res.status(200).send(`Inserted all ${items.length} records!`)
        }
        else {
            console.log(`LOG: Received POST request for single item - from ${req.ip}`)
            let item;
            if ('vector' in body) {
                item = await ItemService.createItem(body.text, body.vector);
            }
            else {
                item = await ItemService.createItem(body.text);
            }
            console.log(`POST request containing single item. Inserting - ${body.text}`);
            await ItemService.upsertItem(index, item);
            console.log(item);
            res.status(200).send(item);
        }
    }
    catch (e) {
        console.log(`Error: ${e.message}`)
        res.status(500).send(e.message);
    }
});

queryRouter.get("/", async (req: Request, res: Response) => {

    try {
        const text : string = req.body.text;
        const vector : number[] = req.body.vector;
        const k : number = req.body.k;
        console.log(text);
        if (text === undefined && vector === undefined) {
            console.log(`LOG: Received GET request for cosine similarity query. Sending 400 as no text or vector defined - from ${req.ip}`)
            res.status(400).send("Please provide either text or vector!");
        }
        else if (vector === undefined) {
            console.log(`LOG: Received GET request for cosine similarity query. Text: ${text} - from ${req.ip}`)
            const results : ItemService.Result[] | null = await ItemService.query(index, text, k);
            if (results !== null && results?.length > 0) {
                res.status(200).send(results);
            }
            else {
                res.status(404).send(`No results found for ${text}`);
            }
        }
        else if (text === undefined) {
            console.log(`LOG: Received GET request for cosine similarity query. Vector Length: ${vector.length} - from ${req.ip}`)
            const results : ItemService.Result[] | null = await ItemService.queryVector(index, vector, k);
            if (results !== null && results?.length > 0) {
                res.status(200).send(results);
            }
            else {
                res.status(404).send(`No results found for ${vector}`);
            }
        }
        else {
            res.status(400).send("Please provide either text or vector, not both!");
        }
    } catch (error: any) {
        console.log(`Error: ${error.message}`)
        res.status(500).send(error.message);
    }
});