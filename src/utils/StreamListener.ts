import type { StreamChunk } from "../lm/types.js";

/**
 * Aggregates streaming chunks for a specific field.
 * Mirrors `dspy.StreamListener`.
 */
export class StreamListener {
  readonly #field: string | undefined;
  #buffer = "";

  constructor(field?: string) {
    this.#field = field;
  }

  /** Get the field this listener is observing. */
  get field(): string | undefined {
    return this.#field;
  }

  /** Observe a streaming chunk. */
  observe(chunk: StreamChunk): void {
    this.#buffer += chunk.delta;
  }

  /** Get accumulated text so far. */
  get accumulated(): string {
    return this.#buffer;
  }

  /** Reset the buffer. */
  reset(): void {
    this.#buffer = "";
  }
}
