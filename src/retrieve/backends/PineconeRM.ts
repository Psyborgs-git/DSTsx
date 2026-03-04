import { Retriever } from "../Retriever.js";

/** Options for the Pinecone retriever. */
export interface PineconeRMOptions {
  apiKey?: string;
  indexName: string;
  namespace?: string;
  embeddingFn: (text: string) => Promise<number[]>;
}

/**
 * Retriever backed by Pinecone vector database.
 *
 * Requires the `@pinecone-database/pinecone` package:
 * ```
 * npm install @pinecone-database/pinecone
 * ```
 */
export class PineconeRM extends Retriever {
  readonly #options: PineconeRMOptions;

  constructor(options: PineconeRMOptions) {
    super();
    this.#options = options;
  }

  async retrieve(query: string, k: number): Promise<string[]> {
    const { Pinecone } = await import("@pinecone-database/pinecone").catch(() => {
      throw new Error(
        "The `@pinecone-database/pinecone` package is required.\n" +
          "Install it with: npm install @pinecone-database/pinecone",
      );
    });

    const client = new Pinecone({
      apiKey: this.#options.apiKey ?? process.env["PINECONE_API_KEY"] ?? "",
    });

    const index = client.index(this.#options.indexName);
    const embedding = await this.#options.embeddingFn(query);

    const queryResponse = await index.namespace(this.#options.namespace ?? "").query({
      vector: embedding,
      topK: k,
      includeMetadata: true,
    });

    return (queryResponse.matches ?? [])
      .map((m: { metadata?: Record<string, unknown> }) =>
        String(m.metadata?.["text"] ?? m.metadata?.["content"] ?? ""),
      )
      .filter(Boolean);
  }
}
