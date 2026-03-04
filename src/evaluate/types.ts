import type { Example, Prediction } from "../primitives/index.js";
import type { Trace } from "../primitives/Trace.js";

/**
 * A metric function receives an example, a prediction, and optionally the
 * execution trace, and returns a score (number) or a pass/fail (boolean).
 *
 * Mirrors `dspy.Metric` in Python.
 */
export type Metric = (
  example: Example,
  prediction: Prediction,
  trace?: Trace[],
) => number | boolean;

/** Per-example evaluation result. */
export interface ExampleResult {
  example: Example;
  prediction: Prediction;
  score: number;
  passed: boolean;
}

/** Aggregated result returned by {@link evaluate}. */
export interface EvaluationResult {
  /** Average metric score across all examples. */
  score: number;
  /** Number of examples that passed (score > 0 / true). */
  numPassed: number;
  /** Total number of examples. */
  total: number;
  /** Per-example breakdown. */
  results: ExampleResult[];
}
