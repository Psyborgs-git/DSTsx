import type { Example, Prediction } from "../primitives/index.js";
import type { Trace } from "../primitives/Trace.js";

/** Extended metric result supporting feedback for optimizers like GEPA. */
export type MetricResult = number | boolean | { score: number; feedback: string };

/**
 * A metric function receives an example, a prediction, and optionally the
 * execution trace, and returns a score, pass/fail, or score+feedback.
 */
export type Metric = (
  example: Example,
  prediction: Prediction,
  trace?: Trace[],
) => MetricResult | Promise<MetricResult>;

export interface ExampleResult {
  example: Example;
  prediction: Prediction;
  score: number;
  passed: boolean;
}

export interface EvaluationResult {
  score: number;
  numPassed: number;
  total: number;
  results: ExampleResult[];
}
