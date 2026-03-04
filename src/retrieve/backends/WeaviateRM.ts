import { Retriever } from "../Retriever.js";

/** Options for the Weaviate retriever. */
export interface WeaviateRMOptions {
  url: string;
  apiKey?: string;
  /** The Weaviate class/collection to query. */
  className: string;
  /** Property name that holds the passage text. */
  textProperty?: string;
  embeddingFn: (text: string) => Promise<number[]>;
}

/**
 * Retriever backed by Weaviate vector database.
 *
 * Requires the `weaviate-client` package:
 * ```
 * npm install weaviate-client
 * ```
 */
export class WeaviateRM extends Retriever {
  readonly #options: WeaviateRMOptions;

  constructor(options: WeaviateRMOptions) {
    super();
    this.#options = options;
  }

  async retrieve(query: string, k: number): Promise<string[]> {
    const weaviate = await import("weaviate-client").catch(() => {
      throw new Error(
        "The `weaviate-client` package is required.\n" +
          "Install it with: npm install weaviate-client",
      );
    });

    const client = await weaviate.default.connectToCustom({
      httpHost: this.#options.url,
      ...(this.#options.apiKey ? { authCredentials: new weaviate.default.ApiKey(this.#options.apiKey) } : {}),
    });

    const embedding = await this.#options.embeddingFn(query);
    const textProp = this.#options.textProperty ?? "text";

    const result = await client.collections
      .get(this.#options.className)
      .query.nearVector(embedding, { limit: k, returnProperties: [textProp] });

    return (result.objects ?? [])
      .map((obj: { properties?: Record<string, unknown> }) =>
        String(obj.properties?.[textProp] ?? ""),
      )
      .filter(Boolean);
  }
}
