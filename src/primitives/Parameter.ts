/**
 * A typed container for module-level optimizable parameters.
 *
 * Mirrors `dspy.Parameter` in Python (a PyTorch-inspired parameter wrapper
 * that lets optimizers discover and update learnable values inside a Module).
 *
 * A `Parameter<T>` holds a single value (e.g. few-shot demo list, instruction
 * string) that an optimizer can read and overwrite during compilation.
 *
 * @example
 * ```ts
 * class MyModule extends Module {
 *   // Mark these as optimizable:
 *   instruction = new Parameter<string>("Answer concisely.");
 *   demos       = new Parameter<Example[]>([]);
 *
 *   async forward(inputs: Record<string, unknown>) {
 *     const instr = this.instruction.value;
 *     // ...
 *   }
 * }
 *
 * // Enumerate all Parameters in a module:
 * for (const [name, param] of myModule.namedParameters()) {
 *   console.log(name, param.value);
 * }
 * ```
 */
export class Parameter<T = unknown> {
  #value: T;

  constructor(initialValue: T) {
    this.#value = initialValue;
  }

  /** Read the current value. */
  get value(): T {
    return this.#value;
  }

  /** Update the value (called by optimizers). */
  set value(v: T) {
    this.#value = v;
  }

  /**
   * Return a shallow clone of this Parameter holding the same value.
   * Arrays are shallow-copied; other values are taken as-is.
   */
  clone(): Parameter<T> {
    const v = Array.isArray(this.#value)
      ? ([...this.#value] as unknown as T)
      : this.#value;
    return new Parameter<T>(v);
  }

  toJSON(): unknown {
    return this.#value;
  }
}
