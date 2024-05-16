import { readdir, stat, readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { createHash } from 'node:crypto'
import memoize from 'memoize'

export async function * walk (dirPath: string): AsyncIterable<string> {
  const entries = await readdir(dirPath)
  for (const entry of entries) {
    const fullPath = `${dirPath}/${entry}`
    const stats = await stat(fullPath)
    if (stats.isDirectory()) {
      yield * walk(fullPath)
    } else {
      yield fullPath
    }
  }
}

abstract class BaseNode {
  readonly abstract id: string
  abstract content: string
}

type JSONObject = { [key: string]: JSONValue }
type JSONArray = JSONValue[]
type JSONValue = string | number | boolean | null | JSONObject | JSONArray
export type Metadata = Map<string, JSONValue>

export class Document extends BaseNode {
  get id (): string {
    return Document.hash(this.content, this.metadata)
  }

  constructor (
    public content: string,
    public metadata: Metadata = new Map()
  ) {
    super()
  }

  static hash = memoize((
    content: string,
    metadata: Metadata
  ) => {
    return createHash('sha256').
      update(content).
      update(JSON.stringify([...metadata.entries()])).
      digest('hex')
  }, { cacheKey: JSON.stringify })
}

interface BaseReader {
  loadData (path: string): Promise<Document>
}

class PlainTextReader implements BaseReader {
  // do nothing, just read the file
  async loadData (path: string) {
    const txt = await readFile(path, 'utf8')
    return new Document(txt)
  }
}

export class SimpleDirectoryReader {
  map: Map<string, BaseReader> = new Map()
  fallback = new PlainTextReader()

  async loadData (path: string): Promise<Document[]> {
    const docs: Document[] = []
    for await (const file of walk(path)) {
      const ext = extname(file)
      const reader = this.map.get(ext) ?? this.fallback
      const content = await reader.loadData(file)
      docs.push(content)
    }
    return docs
  }
}
