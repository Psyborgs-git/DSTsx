import { Retriever } from "../Retriever.js";
import type { Document } from "../../primitives/Document.js";

/**
 * Options for {@link DocumentRetriever}.
 */
export interface DocumentRetrieverOptions {
  /**
   * The initial corpus of {@link Document} objects to search over.
   * Documents can also be added later with {@link DocumentRetriever.addDocuments}.
   */
  documents?: Document[];
  /**
   * Which field to use for full-text matching.
   * - `"body"` (default) — match against the document body
   * - `"title"` — match against the title (falls back to body when title is undefined)
   * - `"all"` — concatenate title + body for matching
   */
  searchField?: "body" | "title" | "all";
}

/**
 * A simple in-memory retriever that works with {@link Document} objects.
 *
 * Ranks documents by the number of query tokens that appear in the search
 * field (BM25-inspired term-frequency scoring without the IDF component).
 * Suitable for small corpora; for large corpora use {@link EmbeddingRetriever}
 * or an external vector database.
 *
 * Promoted from experimental to stable in Phase 4.
 *
 * @example
 * ```ts
 * const docs = [
 *   new Document({ title: "TypeScript", body: "TypeScript is a typed superset of JavaScript." }),
 *   new Document({ title: "Python",     body: "Python is a dynamic programming language." }),
 * ];
 *
 * const retriever = new DocumentRetriever({ documents: docs });
 * settings.configure({ rm: retriever });
 *
 * const results = await retriever.retrieve("typed language", 1);
 * // ["TypeScript is a typed superset of JavaScript."]
 * ```
 */
export class DocumentRetriever extends Retriever {
  #documents: Document[] = [];
  readonly #searchField: "body" | "title" | "all";

  constructor(options: DocumentRetrieverOptions = {}) {
    super();
    this.#searchField = options.searchField ?? "body";
    if (options.documents) {
      this.#documents = [...options.documents];
    }
  }

  /**
   * Add documents to the corpus.
   */
  addDocuments(docs: Document[]): void {
    this.#documents.push(...docs);
  }

  /**
   * Replace the entire corpus.
   */
  setDocuments(docs: Document[]): void {
    this.#documents = [...docs];
  }

  /** Read-only view of the current corpus. */
  get documents(): readonly Document[] {
    return this.#documents;
  }

  /**
   * Retrieve the top-k documents most relevant to `query`.
   *
   * Returns the string representation of each matched document
   * (`document.toString()`).
   */
  async retrieve(query: string, k: number): Promise<string[]> {
    if (this.#documents.length === 0) return [];

    const queryTokens = DocumentRetriever.#tokenize(query);
    if (queryTokens.length === 0) {
      // No tokens — return first k documents unchanged
      return this.#documents.slice(0, k).map((d) => d.toString());
    }

    const scored = this.#documents.map((doc) => {
      const text = this.#getSearchText(doc);
      const docTokens = DocumentRetriever.#tokenize(text);
      const score = DocumentRetriever.#termFrequencyScore(queryTokens, docTokens);
      return { doc, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).map((s) => s.doc.toString());
  }

  /** Retrieve the raw {@link Document} objects instead of their string form. */
  async retrieveDocuments(query: string, k: number): Promise<Document[]> {
    if (this.#documents.length === 0) return [];

    const queryTokens = DocumentRetriever.#tokenize(query);
    if (queryTokens.length === 0) {
      return this.#documents.slice(0, k);
    }

    const scored = this.#documents.map((doc) => {
      const text = this.#getSearchText(doc);
      const docTokens = DocumentRetriever.#tokenize(text);
      const score = DocumentRetriever.#termFrequencyScore(queryTokens, docTokens);
      return { doc, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).map((s) => s.doc);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  #getSearchText(doc: Document): string {
    switch (this.#searchField) {
      case "title":
        return doc.title ?? doc.body;
      case "all":
        return [doc.title, doc.body].filter(Boolean).join(" ");
      default:
        return doc.body;
    }
  }

  /** Lowercase word-boundary tokenizer — letters and digits only. */
  static #tokenize(text: string): string[] {
    const tokens: string[] = [];
    // Extract sequences of word characters, then lowercase
    const re = /\w+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      tokens.push(m[0]!.toLowerCase());
    }
    return tokens;
  }

  /** Term-frequency score: sum of per-query-token occurrence counts in doc. */
  static #termFrequencyScore(queryTokens: string[], docTokens: string[]): number {
    // Build a frequency map from doc tokens for O(q) lookup
    const freq = new Map<string, number>();
    for (const t of docTokens) {
      freq.set(t, (freq.get(t) ?? 0) + 1);
    }
    let score = 0;
    for (const qt of queryTokens) {
      score += freq.get(qt) ?? 0;
    }
    return score;
  }
}
