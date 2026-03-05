import { Optimizer } from "./Optimizer.js";
import { BootstrapFewShot } from "./BootstrapFewShot.js";
import type { Module } from "../modules/index.js";
import { Predict } from "../modules/index.js";
import type { Example } from "../primitives/index.js";
import type { Metric } from "../evaluate/index.js";
import { evaluate } from "../evaluate/index.js";
import { settings } from "../settings/index.js";

/** Options for GRPO. */
export interface GRPOOptions {
  /** Number of optimization steps (default: 20). */
  numSteps?: number | undefined;
  /** Number of candidates per group per step (default: 8). */
  groupSize?: number | undefined;
  /** Sampling temperature for candidate generation (default: 1.0). */
  temperature?: number | undefined;
  /** Max labeled demos (default: 16). */
  maxLabeledDemos?: number | undefined;
}

/**
 * Group Relative Policy Optimization optimizer.
 *
 * Mirrors `dspy.GRPO` in Python. Runs `numSteps` iterations where each step:
 * 1. Samples `groupSize` candidate instruction variants via the LM.
 * 2. Evaluates each against the training set.
 * 3. Updates the best instruction using group-relative scoring.
 *
 * Pure TypeScript — no external dependencies beyond the configured LM.
 */
export class GRPO extends Optimizer {
  readonly #numSteps: number;
  readonly #groupSize: number;
  readonly #temperature: number;
  readonly #maxLabeledDemos: number;

  constructor(options: GRPOOptions = {}) {
    super();
    this.#numSteps = options.numSteps ?? 20;
    this.#groupSize = options.groupSize ?? 8;
    this.#temperature = options.temperature ?? 1.0;
    this.#maxLabeledDemos = options.maxLabeledDemos ?? 16;
  }

  override async compile(student: Module, trainset: Example[], metric: Metric): Promise<Module> {
    const lm = settings.lm;
    if (!lm) throw new Error("GRPO requires a configured LM.");

    const bootstrap = new BootstrapFewShot({
      maxBootstrappedDemos: this.#maxLabeledDemos,
    });
    let best = await bootstrap.compile(student, trainset, metric);

    const evalSet = trainset.slice(0, Math.min(10, trainset.length));
    let bestScore = (await evaluate(best, evalSet, metric)).score;

    for (let step = 0; step < this.#numSteps; step++) {
      const candidates: { module: Module; score: number }[] = [];

      for (let g = 0; g < this.#groupSize; g++) {
        const candidate = best.clone();

        for (const [, predictor] of candidate.namedPredictors()) {
          if (predictor instanceof Predict) {
            const currentInstr = predictor.instructions ?? "";
            const prompt =
              `You are an expert prompt engineer.\n` +
              `Current instruction: "${currentInstr}"\n\n` +
              `Write an improved instruction for a language model. Output only the instruction text.`;
            const resp = await lm.call(prompt, { temperature: this.#temperature });
            predictor.instructions = resp.text.trim();
          }
        }

        const { score } = await evaluate(candidate, evalSet, metric);
        candidates.push({ module: candidate, score });
      }

      const scores = candidates.map((c) => c.score);
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const std =
        Math.sqrt(scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length) || 1;
      const advantages = scores.map((s) => (s - mean) / std);

      const bestIdx = advantages.indexOf(Math.max(...advantages));
      const topScore = candidates[bestIdx]?.score ?? 0;
      if (topScore > bestScore) {
        bestScore = topScore;
        best = candidates[bestIdx]!.module;
      }
    }

    return best;
  }
}
