/**
 * In-memory embedding storage and search utility.
 * Mirrors `dspy.Embeddings`.
 */
export class Embeddings {
  readonly #embedFn: (texts: string[]) => Promise<number[][]>;
  #texts: string[] = [];
  #vectors: number[][] = [];

  constructor(opts: { embedFn: (texts: string[]) => Promise<number[][]> }) {
    this.#embedFn = opts.embedFn;
  }

  /** Add texts to the index. */
  async add(texts: string[]): Promise<void> {
    const vectors = await this.#embedFn(texts);
    this.#texts.push(...texts);
    this.#vectors.push(...vectors);
  }

  /** Search for the k most similar texts. */
  async search(query: string, k: number): Promise<string[]> {
    if (this.#vectors.length === 0) return [];
    const [queryVec] = await this.#embedFn([query]);
    if (!queryVec) return [];

    const scores = this.#vectors.map((vec, idx) => ({
      idx,
      score: this.#cosineSimilarity(queryVec, vec),
    }));
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, k).map((s) => this.#texts[s.idx] ?? "");
  }

  /** Clear all stored embeddings. */
  clear(): void {
    this.#texts = [];
    this.#vectors = [];
  }

  /** Returns a retrieve-compatible adapter. */
  asRetriever(): { retrieve(query: string, k: number): Promise<string[]> } {
    return {
      retrieve: (query: string, k: number) => this.search(query, k),
    };
  }

  #cosineSimilarity(a: number[], b: number[]): number {
    const len = Math.min(a.length, b.length);
    if (len === 0) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < len; i++) {
      dot += (a[i] ?? 0) * (b[i] ?? 0);
      normA += (a[i] ?? 0) ** 2;
      normB += (b[i] ?? 0) ** 2;
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}
