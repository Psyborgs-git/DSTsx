/**
 * A document with optional title and metadata.
 */
export class Document {
  readonly title: string | undefined;
  readonly body: string;
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

  toString(): string {
    return this.title ? `${this.title}\n\n${this.body}` : this.body;
  }

  toJSON(): {
    title: string | undefined;
    body: string;
    metadata: Record<string, unknown> | undefined;
  } {
    return { title: this.title, body: this.body, metadata: this.metadata };
  }
}
