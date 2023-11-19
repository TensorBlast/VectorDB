import { pipeline, env } from "@xenova/transformers";
import { IndexItem, LocalIndex } from "vectra";
import path from "path";

import * as dotenv from "dotenv";
import express from "express";
import { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";

import { itemRouter, queryRouter } from "./itemsRouter";

var args = process.argv.slice(2);

if (args.length >= 1) {
    if (args[0] === "--help") {
        console.log("Usage: node vector.ts [--dotenv] [location]");
        process.exit(0);
    }
    else {
        if (args[0] == "--dotenv") {
            try {
                const dotenvlocation = args[1];
                console.log(`VectorDB using dotenv from argument - ${dotenvlocation}`);
                process.env.DOTENV = dotenvlocation;
                dotenv.config({path: dotenvlocation});
            }
            catch (e) {
                console.log("--dotenv should be followed by path!");
                console.log(e.message());
                process.exit(1);
            }
        }
        else {
            console.log(`Unknown argument to VectorDB: ${args[0]}`);
            console.log("VectorDB using default dotenv");
            dotenv.config();
        }
    }
}
else if (process.env.DOTENV !== undefined) {
    console.log("VectorDB using dotenv from Environment Variable DOTENV: " + process.env.DOTENV);
    dotenv.config({path: process.env.DOTENV});
}
else {
    console.log("VectorDB usinf default dotenv");
    dotenv.config();
}

import * as ItemService from './itemService';
import { escape } from "lodash";

type Item = IndexItem;

env.localModelPath = process.env.MODELPATH || "";

let dirname = path.resolve(process.env.INDEX_LOCATION || "");

let phrases: string[] = ['That is a very happy person', 
                      'That is a Happy Dog',
                      'Today is a sunny day']

const searchstr: string = "That is a happy person!"

let modelname = process.env.MODELNAME || "Xenova/bge-large-en-v1.5";

if (env.localModelPath !== "") {
    console.log("APP: Local model path: " + env.localModelPath);
    env.allowRemoteModels = false;
}

const pipe = await pipeline("feature-extraction", modelname);

let index: LocalIndex;


if (!process.env.INDEX_LOCATION) {
    console.log("APP: INDEX_LOCATION not set! Using default -> " + __dirname);
    index = new LocalIndex(path.join(dirname,"..", "index"));
    console.log(`Index location: ${path.join(dirname,"..", "index")}`);
}
else {
    index = new LocalIndex(path.join(dirname, "index"));
    console.log(`APP: Index location: ${path.join(dirname, "index")}`);
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
