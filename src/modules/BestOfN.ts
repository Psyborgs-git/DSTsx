import { Module, firstPrediction, type ModuleOutput } from "./Module.js";
import { Prediction } from "../primitives/index.js";

/**
 * Runs `N` copies of a module in parallel and selects the best output via a
 * provided `reduceFunc` (defaults to returning the first result).
 *
 * Mirrors `dspy.BestOfN` in Python.
 */
export class BestOfN extends Module {
  readonly N: number;
  readonly #inner: Module;
  readonly #reduce: (predictions: Prediction[]) => Prediction;

  constructor(
    inner: Module,
    N = 3,
    reduceFunc?: (predictions: Prediction[]) => Prediction,
  ) {
    super();
    this.#inner = inner;
    this.N = N;
    this.#reduce = reduceFunc ?? ((preds) => preds[0] ?? new Prediction({}));
  }

  async forward(...args: unknown[]): Promise<Prediction> {
    const results = await Promise.all(
      Array.from({ length: this.N }, () =>
        (this.#inner.forward as (...a: unknown[]) => Promise<ModuleOutput>)(...args),
      ),
    );
    return this.#reduce(results.map(firstPrediction));
  }
}
