import { Retriever } from "../Retriever.js";

/** Options for the FAISS retriever. */
export interface FaissRMOptions {
  /** Array of passage strings (the corpus). */
  passages: string[];
  /** Pre-computed embeddings (one per passage). If omitted, an `embeddingFn` is required. */
  embeddings?: number[][];
  embeddingFn?: (text: string) => Promise<number[]>;
}

/**
 * In-process FAISS-style retriever using cosine similarity over pre-computed
 * embeddings.  No external server required.
 *
 * For large corpora, consider using the `faiss-node` package instead.
 */
export class FaissRM extends Retriever {
  readonly #passages: string[];
  readonly #embeddings: number[][] | undefined;
  readonly #embeddingFn: ((text: string) => Promise<number[]>) | undefined;

  constructor(options: FaissRMOptions) {
    super();
    this.#passages = options.passages;
    this.#embeddings = options.embeddings;
    this.#embeddingFn = options.embeddingFn;
  }

  async retrieve(query: string, k: number): Promise<string[]> {
    const embeddingFn = this.#embeddingFn;
    if (!this.#embeddings && !embeddingFn) {
      throw new Error("FaissRM requires either pre-computed embeddings or an embeddingFn.");
    }

    const queryEmbedding = embeddingFn ? await embeddingFn(query) : this.#embeddings![0]!;
    const embeddings = this.#embeddings ?? [];

    const scored = embeddings.map((emb, i) => ({
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
