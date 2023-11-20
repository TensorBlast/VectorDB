import { pipeline, env } from "@xenova/transformers";
import { IndexItem, LocalIndex } from "vectra";
import path from "path";
import express from "express";
import { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import * as dotenv from 'dotenv'
import setenv from "./setenv";
import { itemRouter, queryRouter, setIndex } from "./itemsRouter";
import * as ItemService from "./itemService";

import { command, run, string, positional, flag, option } from 'cmd-ts';
export var dotenvpath: string = "";

const dotenvflag = option({
    long: 'dotenv',
    short: 'd',
    type: string,
    description: 'Path to dotenv file',
    defaultValue: ()=>{ return '.env'}
});

const vectordb = command({
    name: 'vectordb',
    args: {
        dotenvflag
    },
    handler: ({ dotenvflag }) => {
        console.log(`Starting Vector DB! (Environment Path Set: ${dotenvflag})`);
        start(dotenvflag);
    }
});

run(vectordb, process.argv.slice(2));

const start = async (dotenvflag) => {
    dotenvpath = dotenvflag;
    await main();
}

async function main() {
    await setenv(dotenvpath);

    await ItemService.setpipeService();

    await setIndex();

    type Item = IndexItem;

    env.localModelPath = process.env.MODELPATH || "";

    let dirname = path.resolve(process.env.INDEX || "");

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


    if (!process.env.INDEX) {
        console.log("APP: INDEX_LOCATION not set! Using default -> " + dirname);
        index = new LocalIndex(path.join(dirname,"..", "index"));
        console.log(`APP: Index location: ${path.join(dirname,"..", "index")}`);
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
};
