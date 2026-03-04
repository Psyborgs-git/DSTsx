import { BootstrapFewShot, type BootstrapFewShotOptions } from "./BootstrapFewShot.js";
import { evaluate } from "../evaluate/index.js";
import type { Module } from "../modules/index.js";
import { Predict } from "../modules/index.js";
import type { Example } from "../primitives/index.js";
import type { Metric } from "../evaluate/index.js";

/** Options for BootstrapFewShotWithRandomSearch. */
export interface BootstrapFewShotWithRandomSearchOptions extends BootstrapFewShotOptions {
  /** Number of candidate demo subsets to evaluate (default: 8). */
  numCandidatePrograms?: number;
  /** Held-out validation set. If omitted, the trainset is used for scoring. */
  valset?: Example[];
}

/**
 * Extends {@link BootstrapFewShot} by trying multiple random demo subsets and
 * selecting the combination with the highest validation score.
 *
 * Mirrors `dspy.BootstrapFewShotWithRandomSearch` in Python.
 */
export class BootstrapFewShotWithRandomSearch extends BootstrapFewShot {
  readonly #numCandidates: number;
  readonly #valset: Example[] | undefined;

  constructor(options: BootstrapFewShotWithRandomSearchOptions = {}) {
    super(options);
    this.#numCandidates = options.numCandidatePrograms ?? 8;
    this.#valset = options.valset;
  }

  override async compile(student: Module, trainset: Example[], metric: Metric): Promise<Module> {
    // First collect the bootstrapped demos via the parent class.
    const bootstrapped = await super.compile(student, trainset, metric);

    const allDemos: Example[] = [];
    for (const [, pred] of bootstrapped.namedPredictors()) {
      if (pred instanceof Predict) {
        allDemos.push(...pred.demos);
      }
    }

    if (allDemos.length === 0) return bootstrapped;

    const evalSet = this.#valset ?? trainset;
    let bestScore = -Infinity;
    let bestModule: Module = bootstrapped;

    for (let i = 0; i < this.#numCandidates; i++) {
      const candidate = bootstrapped.clone();

      const shuffle = [...allDemos].sort(() => Math.random() - 0.5);
      const k = Math.floor(Math.random() * allDemos.length) + 1;

      for (const [, pred] of candidate.namedPredictors()) {
        if (pred instanceof Predict) {
          pred.demos = shuffle.slice(0, k);
        }
      }

      const { score } = await evaluate(candidate, evalSet, metric);
      if (score > bestScore) {
        bestScore = score;
        bestModule = candidate;
      }
    }

    return bestModule;
  }
}
