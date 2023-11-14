import * as ItemService from './itemService'

import { LocalIndex, IndexItem } from "vectra";
import path from "path";
import express, { Request, Response } from "express";
import * as lodash from "lodash";

export const itemRouter = express.Router();

const __dirname = path.resolve();


const index = new LocalIndex(path.join(__dirname,"..", "index"));

itemRouter.get("/", async (req: Request, res: Response) => {
    try {
        const items: IndexItem[] = await ItemService.getAllItems(index);
        res.status(200).send(items);
    }
    catch (e) {
        res.status(500).send(e.message);
    }
});

itemRouter.post("/", async (req: Request, res: Response) => {
    try {
        let body = req.body;
        if (body.text instanceof Array && ('vector' in body)){

            lodash.zip(body.text, body.vector).map(async (element: any) => {
                const item = await ItemService.createItem(element[0], element[1]);
                await ItemService.addItem(index,item);
            });
            res.status(200).send('Inserted all records with existing vectors!')
        } else if (body.text instanceof Array) {
            const items: IndexItem[] = [];
            // await Promise.all(body.text.map(async (element: string) => {
            //     const item = await ItemService.createItem(element);
            //     items.push(item);
            // }));
            for (const txt of body.text) {
                const item = await ItemService.createItem(txt);
                items.push(item);
            }
            await ItemService.upsertItems(index, items);
            console.log(items);
            res.status(200).send(`Inserted all ${items.length} records!`)
        }
        else {
            console.log(`POST request containing single item. Inserting - ${body.text}`)
            const item : IndexItem = await ItemService.createItem(body.text);
            await ItemService.upsertItem(index, item);
            res.status(200).send(item);
        }
    }
    catch (e) {
        console.log(`Error: ${e.message}`)
        res.status(500).send(e.message);
    }
});