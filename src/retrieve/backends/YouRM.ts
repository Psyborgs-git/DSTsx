import { Retriever } from "../Retriever.js";

/** Options for the You.com retriever. */
export interface YouRMOptions {
  apiKey?: string;
  /** Number of snippets per web result to include (default: 1). */
  numWeb?: number;
}

/**
 * Retriever backed by the You.com search API.
 */
export class YouRM extends Retriever {
  readonly #options: YouRMOptions;

  constructor(options: YouRMOptions = {}) {
    super();
    this.#options = options;
  }

  async retrieve(query: string, k: number): Promise<string[]> {
    const apiKey = this.#options.apiKey ?? process.env["YDC_API_KEY"];
    const url = new URL("https://api.ydc-index.io/search");
    url.searchParams.set("query", query);
    url.searchParams.set("num_web_results", String(k));

    const response = await fetch(url.toString(), {
      headers: {
        ...(apiKey ? { "X-API-Key": apiKey } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`YouRM request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      hits?: Array<{ snippets?: string[] }>;
    };

    return (data.hits ?? [])
      .flatMap((hit) => hit.snippets ?? [])
      .slice(0, k);
  }
}
