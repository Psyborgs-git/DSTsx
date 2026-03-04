import { Optimizer } from "./Optimizer.js";
import { BootstrapFewShot } from "./BootstrapFewShot.js";
import { Predict } from "../modules/index.js";
import type { Module } from "../modules/index.js";
import type { Example } from "../primitives/index.js";
import type { Metric } from "../evaluate/index.js";
import { evaluate } from "../evaluate/index.js";

/** Options for SIMBA. */
export interface SIMBAOptions {
  /** Number of optimization iterations (default: 10). */
  numIter?: number | undefined;
  /** Mini-batch size for each evaluation (default: 8). */
  batchSize?: number | undefined;
  /** Max bootstrapped demos (default: 4). */
  maxBootstrappedDemos?: number | undefined;
}

/**
 * SIMBA (Stochastic Introspective Mini-Batch Ascent) optimizer.
 *
 * A lightweight stochastic optimizer that:
 * 1. Selects a random mini-batch from the training set each iteration.
 * 2. Proposes a candidate (via demo subset sampling).
 * 3. Accepts the candidate if it improves on the current best.
 * 4. Returns the overall best module found.
 */
export class SIMBA extends Optimizer {
  readonly #numIter: number;
  readonly #batchSize: number;
  readonly #maxBootstrappedDemos: number;

  constructor(options: SIMBAOptions = {}) {
    super();
    this.#numIter = options.numIter ?? 10;
    this.#batchSize = options.batchSize ?? 8;
    this.#maxBootstrappedDemos = options.maxBootstrappedDemos ?? 4;
  }

  override async compile(student: Module, trainset: Example[], metric: Metric): Promise<Module> {
    const bootstrap = new BootstrapFewShot({
      maxBootstrappedDemos: this.#maxBootstrappedDemos,
    });
    let best = await bootstrap.compile(student, trainset, metric);

    const evalBatch = trainset.slice(0, Math.min(this.#batchSize, trainset.length));
    let bestScore = (await evaluate(best, evalBatch, metric)).score;

    for (let iter = 0; iter < this.#numIter; iter++) {
      const shuffled = [...trainset].sort(() => Math.random() - 0.5);
      const batch = shuffled.slice(0, Math.min(this.#batchSize, shuffled.length));

      const candidate = best.clone();
      for (const [, predictor] of candidate.namedPredictors()) {
        if (predictor instanceof Predict && predictor.demos.length > 1) {
          const dropIdx = Math.floor(Math.random() * predictor.demos.length);
          predictor.demos = predictor.demos.filter((_, i) => i !== dropIdx);
        }
      }

      const { score } = await evaluate(candidate, batch, metric);
      if (score >= bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    return best;
  }
}
