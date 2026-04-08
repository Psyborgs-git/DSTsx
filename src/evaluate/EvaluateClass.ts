import { evaluate } from "./evaluate.js";
import type { Module } from "../modules/index.js";
import type { Example } from "../primitives/index.js";
import type { Metric, EvaluationResult } from "./types.js";
import type { EvaluateOptions } from "./evaluate.js";

/**
 * Class-based wrapper around {@link evaluate} that binds a dataset and metric
 * once and can be called on multiple programs.
 *
 * Mirrors the `dspy.Evaluate` class in Python (`dspy.Evaluate(devset, metric=...)`).
 *
 * @example
 * ```ts
 * const evaluator = new Evaluate({
 *   devset:          myExamples,
 *   metric:          exactMatch("answer"),
 *   numThreads:      4,
 *   displayProgress: true,
 * });
 *
 * // Evaluate different programs on the same dataset:
 * const score1 = await evaluator.run(baselineProgram);
 * const score2 = await evaluator.run(optimizedProgram);
 * console.log(`Baseline: ${score1.score.toFixed(2)}`);
 * console.log(`Optimized: ${score2.score.toFixed(2)}`);
 * ```
 */
export class Evaluate {
  readonly devset: Example[];
  readonly metric: Metric;
  readonly options: EvaluateOptions;

  constructor(config: {
    /** The evaluation dataset. */
    devset: Example[];
    /** Scoring function for each (example, prediction) pair. */
    metric: Metric;
    /** Number of concurrent evaluations (default: 1). */
    numThreads?: number;
    /** Log per-example results to the console (default: false). */
    displayProgress?: boolean;
  }) {
    this.devset = config.devset;
    this.metric = config.metric;
    this.options = {};
    if (config.numThreads !== undefined) this.options.numThreads = config.numThreads;
    if (config.displayProgress !== undefined) this.options.displayProgress = config.displayProgress;
  }

  /**
   * Evaluate `program` on the configured dataset.
   *
   * Returns the full {@link EvaluationResult} including per-example details.
   */
  async run(program: Module): Promise<EvaluationResult> {
    return evaluate(program, this.devset, this.metric, this.options);
  }

  /**
   * Shorthand alias for {@link Evaluate.run}.
   * Matches Python's `evaluator(program)` call syntax.
   */
  async call(program: Module): Promise<EvaluationResult> {
    return this.run(program);
  }
}
