import { Retriever } from "../Retriever.js";

/** Options for the FAISS retriever. */
export interface FaissRMOptions {
  /** Array of passage strings (the corpus). */
  passages: string[];
  /**
   * Pre-computed embeddings (one per passage, in the same order as `passages`).
   * When omitted, embeddings are computed lazily on the first `retrieve()` call
   * using `embeddingFn` and cached for subsequent calls.
   */
  embeddings?: number[][];
  /**
   * Function that maps a text string to a dense embedding vector.
   * Required for computing the query embedding (and passage embeddings when
   * `embeddings` is not pre-supplied).
   */
  embeddingFn: (text: string) => Promise<number[]>;
}

/**
 * In-process FAISS-style retriever using cosine similarity over dense
 * embeddings.  No external server required.
 *
 * For large corpora, consider using the `faiss-node` package instead.
 */
export class FaissRM extends Retriever {
  readonly #passages: string[];
  readonly #precomputedEmbeddings: number[][] | undefined;
  readonly #embeddingFn: (text: string) => Promise<number[]>;
  /** Lazily populated passage-embedding cache. */
  #cachedEmbeddings: number[][] | undefined;

  constructor(options: FaissRMOptions) {
    super();
    this.#passages = options.passages;
    this.#precomputedEmbeddings = options.embeddings;
    this.#embeddingFn = options.embeddingFn;
  }

  async retrieve(query: string, k: number): Promise<string[]> {
    // Always use embeddingFn for the query so we get a meaningful embedding.
    const queryEmbedding = await this.#embeddingFn(query);

    // Passage embeddings: use pre-computed ones, or compute & cache lazily.
    if (!this.#cachedEmbeddings) {
      this.#cachedEmbeddings = this.#precomputedEmbeddings
        ? [...this.#precomputedEmbeddings]
        : await Promise.all(this.#passages.map((p) => this.#embeddingFn(p)));
    }

    const scored = this.#cachedEmbeddings.map((emb, i) => ({
      index: i,
      score: this.#cosineSimilarity(queryEmbedding, emb),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).map((s) => this.#passages[s.index] ?? "");
  }

  #cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += (a[i] ?? 0) * (b[i] ?? 0);
      normA += (a[i] ?? 0) ** 2;
      normB += (b[i] ?? 0) ** 2;
    }
    return normA === 0 || normB === 0 ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
