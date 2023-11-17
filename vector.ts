import { pipeline } from "@xenova/transformers";
import { IndexItem, LocalIndex } from "vectra";
import path from "path";

import * as dotenv from "dotenv";
import express from "express";
import { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";

import * as ItemService from './itemService'
import { itemRouter, queryRouter } from "./itemsRouter";

type Item = IndexItem;
dotenv.config();

let __dirname = path.resolve(process.env.INDEX_LOCATION || "");

let phrases: string[] = ['That is a very happy person', 
                      'That is a Happy Dog',
                      'Today is a sunny day']

const searchstr: string = "That is a happy person!"

const modelname = process.env.MODEL || "Xenova/bge-large-en-v1.5";

console.log(`Using model: ${modelname}`);

const pipe = await pipeline("feature-extraction", modelname);

let index: LocalIndex;


if (!process.env.INDEX_LOCATION) {
    console.log("INDEX_LOCATION not set! Using default -> " + __dirname);
    index = new LocalIndex(path.join(__dirname,"..", "index"));
    console.log(`Index location: ${path.join(__dirname,"..", "index")}`);
}
else {
    index = new LocalIndex(path.join(__dirname, "index"));
    console.log(`Index location: ${path.join(__dirname, "index")}`);
}

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
app.use("/query", queryRouter);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});