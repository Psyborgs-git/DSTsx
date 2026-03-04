import { Retriever } from "../Retriever.js";

/**
 * In-memory retriever for unit testing.
 *
 * Returns passages that contain the query string (case-insensitive), or the
 * first `k` passages if no matches are found.
 */
export class MockRetriever extends Retriever {
  readonly #passages: string[];

  constructor(passages: string[]) {
    super();
    this.#passages = passages;
  }

  async retrieve(query: string, k: number): Promise<string[]> {
    const lower = query.toLowerCase();
    const matches = this.#passages.filter((p) => p.toLowerCase().includes(lower));
    const results = matches.length > 0 ? matches : this.#passages;
    return results.slice(0, k);
  }
}
