import { Optimizer } from "./Optimizer.js";
import type { Module } from "../modules/index.js";
import { Predict } from "../modules/index.js";
import type { Example } from "../primitives/index.js";
import { Prediction } from "../primitives/index.js";
import type { Metric } from "../evaluate/index.js";

/** Options for BootstrapFewShot. */
export interface BootstrapFewShotOptions {
  /** Maximum number of bootstrapped demos per predictor (default: 4). */
  maxBootstrappedDemos?: number;
  /** Maximum number of labeled demos per predictor (default: 16). */
  maxLabeledDemos?: number;
  /** Optional teacher module; defaults to the student. */
  teacher?: Module;
}

/**
 * Collects successful execution traces by running the student (or a teacher)
 * on the training set and uses them as few-shot demonstrations.
 *
 * Mirrors `dspy.BootstrapFewShot` in Python.
 */
export class BootstrapFewShot extends Optimizer {
  readonly #opts: Required<BootstrapFewShotOptions>;

  constructor(options: BootstrapFewShotOptions = {}) {
    super();
    this.#opts = {
      maxBootstrappedDemos: options.maxBootstrappedDemos ?? 4,
      maxLabeledDemos: options.maxLabeledDemos ?? 16,
      teacher: options.teacher ?? (null as unknown as Module),
    };
  }

  async compile(student: Module, trainset: Example[], metric: Metric): Promise<Module> {
    const teacher = this.#opts.teacher ?? student;

    const demos: Example[] = [];

    for (const example of trainset) {
      if (demos.length >= this.#opts.maxBootstrappedDemos) break;

      try {
        const inputs = example.toDict() as Record<string, unknown>;
        const prediction = await (teacher.forward as (i: Record<string, unknown>) => Promise<Prediction>)(inputs);
        const raw = metric(example, prediction);
        const passed = typeof raw === "boolean" ? raw : raw > 0;
        if (passed) {
          demos.push(example.with(prediction.toDict() as Record<string, unknown>));
        }
      } catch {
        // Skip examples that throw (e.g. assertion failures).
      }
    }

    const optimized = student.clone();

    for (const [, predictor] of optimized.namedPredictors()) {
      if (predictor instanceof Predict) {
        predictor.demos = demos.slice(0, this.#opts.maxBootstrappedDemos);
      }
    }

    return optimized;
  }
}
