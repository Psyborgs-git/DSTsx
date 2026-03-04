import { Module } from "./Module.js";
import { Prediction } from "../primitives/index.js";

/**
 * Combines multiple modules into one via a voting or custom reduce function.
 *
 * Mirrors `dspy.Ensemble` (optimizer version) when used as a module.
 */
export class Ensemble extends Module {
  readonly #modules: Module[];
  readonly #reduce: (predictions: Prediction[]) => Prediction;

  constructor(
    modules: Module[],
    reduceFunc?: (predictions: Prediction[]) => Prediction,
  ) {
    super();
    this.#modules = modules;
    this.#reduce = reduceFunc ?? ((preds) => preds[0] ?? new Prediction({}));
  }

  async forward(...args: unknown[]): Promise<Prediction> {
    const results = await Promise.all(
      this.#modules.map((m) =>
        (m.forward as (...a: unknown[]) => Promise<Prediction>)(...args),
      ),
    );
    return this.#reduce(results);
  }
}
