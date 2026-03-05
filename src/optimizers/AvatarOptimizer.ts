import { Optimizer } from "./Optimizer.js";
import { Predict } from "../modules/index.js";
import type { Module } from "../modules/index.js";
import type { Example } from "../primitives/index.js";
import type { Metric } from "../evaluate/index.js";
import { evaluate } from "../evaluate/index.js";
import { settings } from "../settings/index.js";

/** Options for AvatarOptimizer. */
export interface AvatarOptimizerOptions {
  /** Number of avatar candidates to try per predictor (default: 4). */
  numAvatars?: number | undefined;
  /** Max labeled demos (default: 8). */
  maxLabeledDemos?: number | undefined;
}

/**
 * AvatarOptimizer iteratively proposes and evaluates "avatar" role descriptions
 * (persona prefixes) for each Predict module.
 *
 * Mirrors `dspy.AvatarOptimizer` in Python.
 *
 * For each predictor, proposes `numAvatars` different role/persona descriptions
 * and selects the one that scores highest on the training set.
 */
export class AvatarOptimizer extends Optimizer {
  readonly #numAvatars: number;
  readonly #maxLabeledDemos: number;

  constructor(options: AvatarOptimizerOptions = {}) {
    super();
    this.#numAvatars = options.numAvatars ?? 4;
    this.#maxLabeledDemos = options.maxLabeledDemos ?? 8;
  }

  override async compile(student: Module, trainset: Example[], metric: Metric): Promise<Module> {
    const lm = settings.lm;
    if (!lm) throw new Error("AvatarOptimizer requires a configured LM.");

    let best = student.clone();
    const evalSet = trainset.slice(0, Math.min(this.#maxLabeledDemos, trainset.length));
    let bestScore = (await evaluate(best, evalSet, metric)).score;

    for (const [name, predictor] of best.namedPredictors()) {
      if (!(predictor instanceof Predict)) continue;

      const avatarCandidates: string[] = [];
      for (let i = 0; i < this.#numAvatars; i++) {
        const prompt =
          `You are an expert at designing AI personas.\n` +
          `Task field: "${name}"\n` +
          `Current instruction: "${predictor.instructions ?? ""}"\n\n` +
          `Write a concise role/persona prefix (1-2 sentences) for an AI assistant ` +
          `that excels at this task. Output only the persona description.`;
        const resp = await lm.call(prompt, { temperature: 0.9 });
        avatarCandidates.push(resp.text.trim());
      }

      for (const avatar of avatarCandidates) {
        const clone = best.clone();
        for (const [n, p] of clone.namedPredictors()) {
          if (n === name && p instanceof Predict) {
            const base = p.instructions ?? "";
            p.instructions = `${avatar}\n\n${base}`.trim();
          }
        }
        const { score } = await evaluate(clone, evalSet, metric);
        if (score > bestScore) {
          bestScore = score;
          best = clone;
        }
      }
    }

    return best;
  }
}
