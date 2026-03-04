import { Example } from "./Example.js";

/**
 * The output of a {@link Predict} (or any module) call.
 * Extends {@link Example} by adding `completions` for multi-output calls.
 *
 * Mirrors `dspy.Prediction` in Python.
 */
export class Prediction extends Example {
  /** All candidate completions when `n > 1` was requested. */
  readonly completions: ReadonlyArray<Record<string, unknown>>;

  constructor(data: Record<string, unknown>, completions: Record<string, unknown>[] = []) {
    super(data);
    this.completions = Object.freeze([...completions]);
  }

  /** Typed accessor — casts the value to `T` (caller is responsible for type safety). */
  getTyped<T>(key: string): T {
    return this.get(key) as T;
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      completions: this.completions,
    };
  }
}
