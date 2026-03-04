import { Optimizer } from "./Optimizer.js";
import type { Module } from "../modules/index.js";
import { Predict } from "../modules/index.js";
import type { Example } from "../primitives/index.js";
import type { Metric } from "../evaluate/index.js";

/**
 * The simplest optimizer — directly assigns labeled examples as `demos` on
 * every `Predict` sub-module without running the LM at all.
 *
 * Mirrors `dspy.LabeledFewShot` in Python.
 */
export class LabeledFewShot extends Optimizer {
  readonly #k: number;

  /**
   * @param k - Maximum number of demos to assign per predictor (default: 16).
   */
  constructor(k = 16) {
    super();
    this.#k = k;
  }

  async compile(student: Module, trainset: Example[], _metric: Metric): Promise<Module> {
    const optimized = student.clone();

    for (const [, predictor] of optimized.namedPredictors()) {
      if (predictor instanceof Predict) {
        predictor.demos = trainset.slice(0, this.#k);
      }
    }

    return optimized;
  }
}
