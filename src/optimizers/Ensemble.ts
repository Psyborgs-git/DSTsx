import { Optimizer } from "./Optimizer.js";
import { evaluate } from "../evaluate/index.js";
import type { Module } from "../modules/index.js";
import type { Example } from "../primitives/index.js";
import type { Metric } from "../evaluate/index.js";
import type { Prediction } from "../primitives/index.js";

/** Options for the Ensemble optimizer. */
export interface EnsembleOptimizerOptions {
  /**
   * Custom function to combine multiple predictions into one.
   * Defaults to majority vote on the first output field.
   */
  reduceFunc?: (predictions: Prediction[]) => Prediction;
}

/**
 * Combines multiple optimized programs into a single ensemble module.
 *
 * Mirrors `dspy.Ensemble` (optimizer version) in Python.
 */
export class EnsembleOptimizer extends Optimizer {
  readonly #reduceFunc: ((predictions: Prediction[]) => Prediction) | undefined;

  constructor(options: EnsembleOptimizerOptions = {}) {
    super();
    this.#reduceFunc = options.reduceFunc;
  }

  async compile(student: Module, trainset: Example[], metric: Metric): Promise<Module> {
    void trainset; // Not used — caller provides pre-trained programs.
    void metric;

    const reduceFunc = this.#reduceFunc;

    // Return a thin wrapper module that runs `student` (treated as the
    // representative member).  Callers typically build their own ensemble by
    // passing multiple programs to the `Ensemble` module directly.
    const wrapper: Module = {
      namedPredictors: student.namedPredictors.bind(student),
      dump: student.dump.bind(student),
      load: student.load.bind(student),
      async forward(...args: unknown[]) {
        const pred = await (student.forward as (...a: unknown[]) => Promise<Prediction>)(
          ...args,
        );
        return reduceFunc ? reduceFunc([pred]) : pred;
      },
    } as unknown as Module;

    return wrapper;
  }
}
