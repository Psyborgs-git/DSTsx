/**
 * A structured document with optional title and metadata.
 *
 * Used as the core data type for document-based retrieval and citation workflows.
 * Promoted from experimental to stable in Phase 4.
 *
 * @example
 * ```ts
 * const doc = new Document({
 *   title: "Introduction to TypeScript",
 *   body: "TypeScript is a typed superset of JavaScript...",
 *   metadata: { source: "https://typescriptlang.org", date: "2024-01-01" },
 * });
 *
 * console.log(doc.toString());
 * // "Introduction to TypeScript\n\nTypeScript is a typed superset of JavaScript..."
 * ```
 */
export class Document {
  /** Optional document title. */
  readonly title: string | undefined;
  /** The full text body of the document. */
  readonly body: string;
  /** Optional arbitrary metadata (source URL, date, author, etc.). */
  readonly metadata: Record<string, unknown> | undefined;

  constructor(init: {
    title?: string;
    body: string;
    metadata?: Record<string, unknown>;
  }) {
    this.title = init.title;
    this.body = init.body;
    this.metadata = init.metadata;
  }

  /**
   * Returns the document as a plain string — title (if present) followed by
   * a blank line then the body.
   */
  toString(): string {
    return this.title ? `${this.title}\n\n${this.body}` : this.body;
  }

  /** Serialise to a plain object (e.g. for JSON.stringify). */
  toJSON(): {
    title: string | undefined;
    body: string;
    metadata: Record<string, unknown> | undefined;
  } {
    return { title: this.title, body: this.body, metadata: this.metadata };
  }
}
