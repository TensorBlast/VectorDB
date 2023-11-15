import { pipeline } from "@xenova/transformers";
import { IndexItem, LocalIndex } from "vectra";
import path from "path";

import * as dotenv from "dotenv";
import express from "express";
import { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";


import { createHash } from "crypto";

import * as ItemService from './itemService'
import { itemRouter } from "./itemsRouter";

type Item = IndexItem;
dotenv.config();

const __dirname = path.resolve();

let phrases: string[] = ['That is a very happy person', 
                      'That is a Happy Dog',
                      'Today is a sunny day']

const searchstr: string = "That is a happy person!"

const modelname = "Xenova/bge-large-en-v1.5";

const pipe = await pipeline("feature-extraction", modelname);



const index = new LocalIndex(path.join(__dirname,"..", "index"));
console.log(`Index location: ${path.join(__dirname,"..", "index")}`);

if (!await index.isIndexCreated()) {
    await index.createIndex();
}

await ItemService.addItems(index, phrases);

let it = await ItemService.createItem(searchstr);
const result = await ItemService.query(index, it, 3);

if (!process.env.PORT) {
    process.exit(1);
}

const PORT: number = parseInt(process.env.PORT as string, 10);
const app = express();


app.use(helmet());
app.use(cors());
app.use(express.json());


app.get("/", async (req: Request, res: Response) => {
    res.status(200).send("VectorDB is running!")});

app.use("/items", itemRouter);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});