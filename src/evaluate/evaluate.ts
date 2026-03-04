import type { Module } from "../modules/index.js";
import { Prediction } from "../primitives/index.js";
import type { Example } from "../primitives/index.js";
import type { Metric, EvaluationResult, ExampleResult } from "./types.js";

/** Options for the {@link evaluate} function. */
export interface EvaluateOptions {
  /**
   * Number of concurrent evaluations (default: 1 — sequential).
   * Set > 1 to parallelise calls.
   */
  numThreads?: number;
  /** When true, logs per-example results to the console. */
  displayProgress?: boolean;
}

/**
 * Evaluate a `program` (any {@link Module}) on a set of `examples` using a
 * `metric` function.
 *
 * Mirrors `dspy.Evaluate` in Python.
 *
 * @example
 * ```ts
 * const result = await evaluate(rag, devset, exactMatch("answer"));
 * console.log(`Score: ${result.score.toFixed(2)}`);
 * ```
 */
export async function evaluate(
  program: Module,
  examples: Example[],
  metric: Metric,
  options: EvaluateOptions = {},
): Promise<EvaluationResult> {
  const { numThreads = 1, displayProgress = false } = options;
  const results: ExampleResult[] = [];

  const runExample = async (example: Example): Promise<ExampleResult> => {
    const inputs = example.toDict() as Record<string, unknown>;
    let prediction: Prediction;
    try {
      prediction = await (program.forward as (inputs: Record<string, unknown>) => Promise<Prediction>)(inputs);
    } catch {
      prediction = new Prediction({});
    }
    const raw = metric(example, prediction);
    const score = typeof raw === "boolean" ? (raw ? 1 : 0) : raw;
    return { example, prediction, score, passed: score > 0 };
  };

  if (numThreads <= 1) {
    for (let i = 0; i < examples.length; i++) {
      const result = await runExample(examples[i]!);
      results.push(result);
      if (displayProgress) {
        console.log(`[${i + 1}/${examples.length}] score=${result.score.toFixed(2)}`);
      }
    }
  } else {
    // Process in batches of `numThreads`.
    for (let i = 0; i < examples.length; i += numThreads) {
      const batch = examples.slice(i, i + numThreads);
      const batchResults = await Promise.all(batch.map(runExample));
      results.push(...batchResults);
      if (displayProgress) {
        console.log(`[${i + batchResults.length}/${examples.length}]`);
      }
    }
  }

  const total = results.length;
  const numPassed = results.filter((r) => r.passed).length;
  const score = total > 0 ? results.reduce((s, r) => s + r.score, 0) / total : 0;

  return { score, numPassed, total, results };
}
