import { Document, Settings } from "llamaindex-tiny";

Settings.chunkSize = 512;

const document = new Document(new Array(1000).fill("a").join(""), new Map());

console.log(document);
console.log("content", document.content);
