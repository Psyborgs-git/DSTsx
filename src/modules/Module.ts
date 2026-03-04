import type { Prediction } from "../primitives/index.js";

/**
 * Abstract base class for all DSTsx modules.
 *
 * A Module is a composable, serializable unit that encapsulates one or more
 * language model calls.  Subclasses implement {@link Module.forward} to define
 * their behaviour.
 *
 * Mirrors `dspy.Module` in Python.
 *
 * @example
 * ```ts
 * class MyRAG extends Module {
 *   retrieve = new Retrieve(3);
 *   generate = new ChainOfThought("context, question -> answer");
 *
 *   async forward(question: string): Promise<Prediction> {
 *     const { passages } = await this.retrieve.forward(question);
 *     return this.generate.forward({ context: passages.join("\n"), question });
 *   }
 * }
 * ```
 */
export abstract class Module {
  /**
   * Execute the module.
   *
   * Subclasses define their own parameter signatures; the base type uses
   * `unknown` so that TypeScript accepts any subclass override.
   */
  abstract forward(...args: unknown[]): Promise<Prediction>;

  /**
   * Recursively discover all {@link Predict} sub-modules by walking the own
   * enumerable properties of this instance.
   */
  namedPredictors(): Array<[string, Module]> {
    const results: Array<[string, Module]> = [];
    for (const [key, value] of Object.entries(this)) {
      if (value instanceof Module) {
        results.push([key, value]);
        results.push(...value.namedPredictors().map(([k, v]): [string, Module] => [`${key}.${k}`, v]));
      }
    }
    return results;
  }

  /**
   * Serialize the module's learnable parameters (e.g. `Predict.demos`) to a
   * plain JSON-compatible object.
   */
  dump(): Record<string, unknown> {
    const state: Record<string, unknown> = {};
    for (const [name, predictor] of this.namedPredictors()) {
      state[name] = predictor.dump();
    }
    return state;
  }

  /**
   * Restore learnable parameters from a plain object previously produced by
   * {@link Module.dump}.
   */
  load(state: Record<string, unknown>): void {
    for (const [name, predictor] of this.namedPredictors()) {
      const sub = state[name];
      if (sub && typeof sub === "object") {
        predictor.load(sub as Record<string, unknown>);
      }
    }
  }

  /**
   * Create a deep clone of this module.
   *
   * Returns a new module with the same prototype.  All sub-{@link Module}
   * properties are recursively cloned so that mutating the clone's learnable
   * parameters (e.g. `Predict.demos`) does **not** affect the original.
   * Array properties are shallow-copied (their elements are not cloned).
   * All other properties are copied by reference.
   */
  clone(): this {
    const cloned = Object.create(Object.getPrototypeOf(this) as object) as this;
    for (const key of Object.keys(this)) {
      const value = (this as Record<string, unknown>)[key];
      if (value instanceof Module) {
        (cloned as Record<string, unknown>)[key] = value.clone();
      } else if (Array.isArray(value)) {
        (cloned as Record<string, unknown>)[key] = [...value];
      } else {
        (cloned as Record<string, unknown>)[key] = value;
      }
    }
    return cloned;
  }
}
