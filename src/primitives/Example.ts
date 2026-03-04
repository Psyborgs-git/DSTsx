/**
 * An immutable record of named values used as a training example or a module
 * input.  Mirrors `dspy.Example` in Python.
 *
 * @example
 * ```ts
 * const ex = new Example({ question: "What is 2+2?", answer: "4" });
 * const withLabel = ex.with({ answer: "four" });
 * ```
 */
export class Example {
  readonly #data: Readonly<Record<string, unknown>>;

  constructor(data: Record<string, unknown>) {
    this.#data = Object.freeze({ ...data });
  }

  /** Return the value for `key`, or `undefined` if absent. */
  get(key: string): unknown {
    return this.#data[key];
  }

  /** Return a shallow-frozen copy of the underlying data record. */
  toDict(): Readonly<Record<string, unknown>> {
    return this.#data;
  }

  /**
   * Return a new Example with the provided key-value pairs merged in.
   */
  with(overrides: Record<string, unknown>): Example {
    return new Example({ ...this.#data, ...overrides });
  }

  /**
   * Return a new Example containing only the keys listed in `keys`.
   */
  inputs(keys: string[]): Example {
    return new Example(
      Object.fromEntries(keys.filter((k) => k in this.#data).map((k) => [k, this.#data[k]])),
    );
  }

  /**
   * Return a new Example containing only the keys NOT listed in `inputKeys`
   * (i.e. the label / output keys).
   */
  labels(inputKeys: string[]): Example {
    return new Example(
      Object.fromEntries(
        Object.entries(this.#data).filter(([k]) => !inputKeys.includes(k)),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  toJSON(): Record<string, unknown> {
    return { ...this.#data };
  }

  static fromDict(data: Record<string, unknown>): Example {
    return new Example(data);
  }
}
