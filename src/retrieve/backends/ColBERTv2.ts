import { Retriever } from "../Retriever.js";

/** Options for the ColBERTv2 retriever. */
export interface ColBERTv2Options {
  /** Base URL of the ColBERT server. */
  url: string;
  /** Number of passages to request from the server (defaults to k). */
  passages?: number;
}

/**
 * Retriever that queries a ColBERTv2 REST endpoint.
 *
 * Mirrors `dspy.ColBERTv2` in Python.
 */
export class ColBERTv2 extends Retriever {
  readonly #url: string;

  constructor(options: ColBERTv2Options | string) {
    super();
    this.#url = typeof options === "string" ? options : options.url;
  }

  async retrieve(query: string, k: number): Promise<string[]> {
    const url = new URL("/search", this.#url);
    url.searchParams.set("query", query);
    url.searchParams.set("k", String(k));

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`ColBERTv2 request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { topk?: Array<{ content?: string }> };
    return (data.topk ?? []).map((p) => p.content ?? "").filter(Boolean);
  }
}
