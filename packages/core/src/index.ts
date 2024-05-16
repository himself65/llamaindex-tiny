import memoize from "memoize";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { extname } from "node:path";

export async function* walk(dirPath: string): AsyncIterable<string> {
  const entries = await readdir(dirPath);
  for (const entry of entries) {
    const fullPath = `${dirPath}/${entry}`;
    const stats = await stat(fullPath);
    if (stats.isDirectory()) {
      yield* walk(fullPath);
    } else {
      yield fullPath;
    }
  }
}

interface BaseNode {
  readonly id: string;
  content: string;
}

type JSONObject = { [key: string]: JSONValue };
type JSONArray = JSONValue[];
type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
export type Metadata = Map<string, JSONValue>;

export const Settings = {
  chunkSize: undefined as number | undefined,
};

function chunkSizeCheck(
  originalGetter: () => string,
  context: ClassGetterDecoratorContext,
) {
  return function (this: Document) {
    const content = originalGetter.call(this);
    if (Settings.chunkSize !== undefined) {
      if (content.length > Settings.chunkSize) {
        console.warn(
          `Document (${this.id.substring(
            0,
            8,
          )}) is larger than chunk size: ${content.length}`,
        );
        console.warn(`Truncating content...`);
        console.warn("If you want to disable this warning:");
        console.warn("  1. Set Settings.chunkSize = undefined");
        console.warn("  2. Set Settings.chunkSize to a larger value");
        console.warn(
          "  3. Change the way of splitting content into different chunks",
        );
        return content.slice(0, Settings.chunkSize);
      }
    }
    return content;
  };
}

export class Document implements BaseNode {
  get id(): string {
    return Document.hash(this.text, this.metadata);
  }

  @chunkSizeCheck
  get content(): string {
    const leading = JSON.stringify([...this.metadata.entries()]);
    return `${leading ? `${leading}\n` : ""}${this.text}`;
  }

  constructor(
    private text: string,
    public metadata: Metadata = new Map(),
  ) {}

  static hash = memoize(
    (content: string, metadata: Metadata) => {
      return createHash("sha256")
        .update(content)
        .update(JSON.stringify([...metadata.entries()]))
        .digest("hex");
    },
    { cacheKey: JSON.stringify },
  );
}

interface BaseReader {
  loadData(path: string): Promise<Document>;
}

class PlainTextReader implements BaseReader {
  // do nothing, just read the file
  async loadData(path: string) {
    const txt = await readFile(path, "utf8");
    return new Document(txt);
  }
}

export class SimpleDirectoryReader {
  map: Map<string, BaseReader> = new Map();
  fallback = new PlainTextReader();

  async loadData(path: string): Promise<Document[]> {
    const docs: Document[] = [];
    for await (const file of walk(path)) {
      const ext = extname(file);
      const reader = this.map.get(ext) ?? this.fallback;
      const content = await reader.loadData(file);
      docs.push(content);
    }
    return docs;
  }
}
