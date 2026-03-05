import { BootstrapFewShot } from "./BootstrapFewShot.js";
import { Predict } from "../modules/index.js";
import type { Module } from "../modules/index.js";
import type { Example } from "../primitives/index.js";
import { Prediction } from "../primitives/index.js";
import type { Metric } from "../evaluate/index.js";

export interface BootstrapFewShotWithOptunaOptions {
  maxBootstrappedDemos?: number;
  maxLabeledDemos?: number;
  /** Number of TPE trials (default: 20). */
  numTrials?: number;
  valset?: Example[];
}

/**
 * Bayesian optimizer using a simplified TPE (Tree-structured Parzen Estimator).
 *
 * Extends BootstrapFewShot: first collects candidate demos via the parent,
 * then runs `numTrials` iterations sampling demo subsets using TPE to find
 * the best-scoring configuration.
 */
export class BootstrapFewShotWithOptuna extends BootstrapFewShot {
  readonly #numTrials: number;
  readonly #valset: Example[] | undefined;

  constructor(options: BootstrapFewShotWithOptunaOptions = {}) {
    super(options);
    this.#numTrials = options.numTrials ?? 20;
    this.#valset = options.valset;
  }

  override async compile(
    student: Module,
    trainset: Example[],
    metric: Metric,
  ): Promise<Module> {
    // Step 1: collect bootstrapped demos via parent
    const bootstrapped = await super.compile(student, trainset, metric);

    // Gather all demos from the bootstrapped module
    const allDemos: Example[] = [];
    for (const [, predictor] of bootstrapped.namedPredictors()) {
      if (predictor instanceof Predict) {
        allDemos.push(...predictor.demos);
      }
    }

    if (allDemos.length === 0) {
      return bootstrapped;
    }

    const evalSet = this.#valset ?? trainset;
    const maxDemos = Math.max(1, allDemos.length);

    /** Fraction of trials to consider "good" in TPE sampling. */
    const TOP_TRIALS_FRACTION = 0.25;
    /** Probability of sampling from the "good" trials pool vs random. */
    const GOOD_TRIAL_SAMPLING_PROBABILITY = 0.7;

    interface Trial {
      indices: number[];
      score: number;
    }
    const trials: Trial[] = [];

    const evaluate = async (candidate: Module): Promise<number> => {
      let score = 0;
      for (const example of evalSet) {
        try {
          const inputs = example.toDict() as Record<string, unknown>;
          const prediction = await (
            candidate.forward as (i: Record<string, unknown>) => Promise<Prediction>
          )(inputs);
          const raw = metric(example, prediction);
          score += typeof raw === "boolean" ? (raw ? 1 : 0) : raw;
        } catch {
          // skip failed examples
        }
      }
      return evalSet.length > 0 ? score / evalSet.length : 0;
    };

    const sampleIndices = (
      goodTrials: Trial[],
      badTrials: Trial[],
      n: number,
    ): number[] => {
      const useGood = goodTrials.length > 0 && Math.random() < GOOD_TRIAL_SAMPLING_PROBABILITY;
      const pool =
        useGood ? goodTrials : badTrials.length > 0 ? badTrials : null;

      if (pool !== null && pool.length > 0) {
        const base = pool[Math.floor(Math.random() * pool.length)]!;
        const result = new Set(base.indices);
        if (Math.random() < 0.5 && result.size < maxDemos) {
          result.add(Math.floor(Math.random() * maxDemos));
        } else if (result.size > 1) {
          const arr = [...result];
          result.delete(arr[Math.floor(Math.random() * arr.length)]!);
        }
        return [...result].slice(0, n);
      }

      // Random sample
      const indices = Array.from({ length: maxDemos }, (_, i) => i);
      return indices.sort(() => Math.random() - 0.5).slice(0, Math.min(n, maxDemos));
    };

    let bestScore = -Infinity;
    let bestModule = bootstrapped;

    for (let t = 0; t < this.#numTrials; t++) {
      const sortedTrials = [...trials].sort((a, b) => b.score - a.score);
      const topK = Math.max(1, Math.floor(sortedTrials.length * TOP_TRIALS_FRACTION));
      const goodTrials = sortedTrials.slice(0, topK);
      const badTrials = sortedTrials.slice(topK);

      // Use 50% of all available demos per trial. This is the starting
      // point for TPE exploration; mutations in sampleIndices() may grow or
      // shrink the subset by ±1 around this baseline.
      const numDemos = Math.max(1, Math.floor(maxDemos * 0.5));
      const indices = sampleIndices(goodTrials, badTrials, numDemos);
      const selectedDemos = indices
        .map((i) => allDemos[i])
        .filter((d): d is Example => d !== undefined);

      const candidate = bootstrapped.clone();
      for (const [, predictor] of candidate.namedPredictors()) {
        if (predictor instanceof Predict) {
          predictor.demos = selectedDemos;
        }
      }

      const score = await evaluate(candidate);
      trials.push({ indices, score });

      if (score > bestScore) {
        bestScore = score;
        bestModule = candidate;
      }
    }

    return bestModule;
  }
}
