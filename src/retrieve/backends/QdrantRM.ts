import { Retriever } from "../Retriever.js";

/** Options for the Qdrant retriever. */
export interface QdrantRMOptions {
  url?: string;
  apiKey?: string;
  collectionName: string;
  /** Property name that holds the passage text in the payload. */
  textField?: string;
  embeddingFn: (text: string) => Promise<number[]>;
}

/**
 * Retriever backed by Qdrant vector database.
 *
 * Requires the `@qdrant/js-client-rest` package:
 * ```
 * npm install @qdrant/js-client-rest
 * ```
 */
export class QdrantRM extends Retriever {
  readonly #options: QdrantRMOptions;

  constructor(options: QdrantRMOptions) {
    super();
    this.#options = options;
  }

  async retrieve(query: string, k: number): Promise<string[]> {
    const { QdrantClient } = await import("@qdrant/js-client-rest").catch(() => {
      throw new Error(
        "The `@qdrant/js-client-rest` package is required.\n" +
          "Install it with: npm install @qdrant/js-client-rest",
      );
    });

    const client = new QdrantClient({
      url: this.#options.url ?? "http://localhost:6333",
      apiKey: this.#options.apiKey,
    });

    const embedding = await this.#options.embeddingFn(query);
    const textField = this.#options.textField ?? "text";

    const result = await client.search(this.#options.collectionName, {
      vector: embedding,
      limit: k,
      with_payload: [textField],
    });

    return result
      .map((hit: { payload?: Record<string, unknown> }) =>
        String(hit.payload?.[textField] ?? ""),
      )
      .filter(Boolean);
  }
}
