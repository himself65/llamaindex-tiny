import { SimpleDirectoryReader } from "llamaindex-tiny";
import { join } from "node:path";

const documents = await new SimpleDirectoryReader().loadData(
  join(import.meta.dirname, "data"),
);

console.log("docs", documents);
