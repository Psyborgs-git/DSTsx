import { Module } from "./Module.js";
import { Predict } from "./Predict.js";
import { Signature } from "../signatures/index.js";
import type { Prediction } from "../primitives/index.js";
import type { ModuleOutput } from "./Module.js";

/**
 * Wraps a plain async (or sync) function as a DSTsx {@link Module} that calls
 * a {@link Predict} under the hood.
 *
 * Mirrors the `@dspy.functional` / `@predictor` pattern in Python where a
 * function decorated with `@dspy.functional` becomes a compiled module.
 *
 * TypeScript doesn't have Python-style class decorators for arbitrary
 * functions, so this is a higher-order function instead:
 *
 * @example
 * ```ts
 * const qa = functional(
 *   async ({ question }: { question: string }) => ({ answer: string }),
 *   "question -> answer",
 * );
 *
 * // qa is a full Module:
 * const result = await qa.forward({ question: "What is 2+2?" });
 * console.log(result.get("answer"));
 * ```
 *
 * When no `signature` is provided, the function is called directly on
 * `forward()`'s inputs and its return value is used to build the Prediction.
 * When a `signature` is provided the function body is ignored and a Predict
 * module is created from the signature — matching DSPy's decorator semantics
 * where the function annotation (type hints) drive the prompt, not the body.
 */
export function functional(
  fn: (inputs: Record<string, unknown>) => unknown,
  signature?: string | Signature,
): FunctionalModule {
  return new FunctionalModule(fn, signature);
}

/**
 * The Module class returned by {@link functional}.
 * Exposes the inner `predict` for access by optimizers.
 */
export class FunctionalModule extends Module {
  /**
   * The underlying {@link Predict} (present when a signature is provided).
   * Optimizers can tune `predict.demos` and `predict.instructions`.
   */
  readonly predict: Predict | undefined;
  readonly #fn: (inputs: Record<string, unknown>) => unknown;
  readonly #useFn: boolean;

  constructor(
    fn: (inputs: Record<string, unknown>) => unknown,
    signature?: string | Signature,
  ) {
    super();
    this.#fn = fn;
    if (signature !== undefined) {
      this.predict = new Predict(signature);
      this.#useFn = false;
    } else {
      this.#useFn = true;
    }
  }

  async forward(inputs: Record<string, unknown>): Promise<ModuleOutput> {
    if (!this.#useFn && this.predict) {
      return this.predict.forward(inputs);
    }

    // Call the user function directly
    const raw = await Promise.resolve(this.#fn(inputs));

    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const { Prediction: Pred } = await import("../primitives/index.js");
      return new Pred(raw as Record<string, unknown>);
    }

    const { Prediction: Pred } = await import("../primitives/index.js");
    return new Pred({ result: raw });
  }
}
