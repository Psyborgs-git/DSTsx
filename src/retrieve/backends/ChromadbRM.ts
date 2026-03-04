import { Retriever } from "../Retriever.js";

/** Options for the ChromaDB retriever. */
export interface ChromadbRMOptions {
  /** ChromaDB server URL (default: http://localhost:8000). */
  url?: string;
  collectionName: string;
  embeddingFn?: (texts: string[]) => Promise<number[][]>;
}

/**
 * Retriever backed by ChromaDB.
 *
 * Requires the `chromadb` package:
 * ```
 * npm install chromadb
 * ```
 */
export class ChromadbRM extends Retriever {
  readonly #options: ChromadbRMOptions;

  constructor(options: ChromadbRMOptions) {
    super();
    this.#options = options;
  }

  async retrieve(query: string, k: number): Promise<string[]> {
    const { ChromaClient } = await import("chromadb").catch(() => {
      throw new Error(
        "The `chromadb` package is required.\n" +
          "Install it with: npm install chromadb",
      );
    });

    const client = new ChromaClient({ path: this.#options.url ?? "http://localhost:8000" });
    const collection = await client.getCollection({ name: this.#options.collectionName });

    const results = await collection.query({
      queryTexts: [query],
      nResults: k,
    });

    return (results.documents?.[0] ?? []).filter((d: unknown): d is string => d !== null);
  }
}
