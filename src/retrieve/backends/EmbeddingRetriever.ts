import { Retriever } from "../Retriever.js";
import type { Embedder } from "../../models/Embedder.js";

/**
 * Options for {@link EmbeddingRetriever}.
 */
export interface EmbeddingRetrieverOptions {
  /**
   * The embedding model used to embed both the corpus and queries.
   */
  embedder: Embedder;
  /**
   * The corpus of passages to search over.
   * Can be set at construction time or via {@link EmbeddingRetriever.addPassages}.
   */
  passages?: string[];
}

/**
 * An in-memory retriever that finds the top-k passages most similar to a
 * query by comparing embedding vectors via cosine similarity.
 *
 * Uses the configured {@link Embedder} to embed both the corpus and queries.
 * No external database required — suitable for small to medium corpora.
 *
 * @example
 * ```ts
 * const embedder = new Embedder({ provider: "openai", model: "text-embedding-3-small" });
 * const retriever = new EmbeddingRetriever({
 *   embedder,
 *   passages: ["Paris is the capital of France.", "Rome is the capital of Italy."],
 * });
 *
 * settings.configure({ rm: retriever });
 * ```
 */
export class EmbeddingRetriever extends Retriever {
  readonly #embedder: Embedder;
  #passages: string[] = [];
  #embeddings: number[][] = [];
  #dirty = true;

  constructor(options: EmbeddingRetrieverOptions) {
    super();
    this.#embedder = options.embedder;
    if (options.passages) {
      this.#passages = [...options.passages];
    }
  }

  /**
   * Add passages to the corpus.  The embedding index will be rebuilt on the
   * next {@link EmbeddingRetriever.retrieve} call.
   */
  addPassages(passages: string[]): void {
    this.#passages.push(...passages);
    this.#dirty = true;
  }

  /**
   * Replace the entire corpus.
   */
  setPassages(passages: string[]): void {
    this.#passages = [...passages];
    this.#dirty = true;
  }

  /**
   * Retrieve the top-k passages most similar to `query`.
   */
  async retrieve(query: string, k: number): Promise<string[]> {
    if (this.#passages.length === 0) return [];

    // Rebuild corpus embeddings lazily
    if (this.#dirty) {
      this.#embeddings = await this.#embedder.embedBatch(this.#passages);
      this.#dirty = false;
    }

    const queryEmbedding = await this.#embedder.embed(query);

    // Score each passage by cosine similarity
    const scored = this.#passages.map((passage, i) => ({
      passage,
      score: EmbeddingRetriever.#cosineSimilarity(queryEmbedding, this.#embeddings[i]!),
    }));

    // Sort descending by similarity and take top k
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).map((s) => s.passage);
  }

  static #cosineSimilarity(a: number[], b: number[]): number {
    const len = Math.min(a.length, b.length);
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < len; i++) {
      dot += a[i]! * b[i]!;
      normA += a[i]! * a[i]!;
      normB += b[i]! * b[i]!;
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}
