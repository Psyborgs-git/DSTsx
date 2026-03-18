import { Module } from "./Module.js";
import { Prediction } from "../primitives/index.js";

/**
 * Reinforcement Learning Module — samples multiple completions and selects
 * the highest-scoring one via a reward function.
 * Mirrors `dspy.RLM`.
 */
export class RLM extends Module {
  readonly #inner: Module;
  readonly #rewardFn: (pred: Prediction) => number;
  readonly #k: number;
  #rewardStats: { total: number; count: number } = { total: 0, count: 0 };

  constructor(
    inner: Module,
    rewardFn: (pred: Prediction) => number,
    k = 5,
  ) {
    super();
    this.#inner = inner;
    this.#rewardFn = rewardFn;
    this.#k = k;
  }

  async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    const candidates: Array<{ pred: Prediction; score: number }> = [];

    for (let i = 0; i < this.#k; i++) {
      const pred = (await this.#inner.forward(inputs)) as Prediction;
      const score = this.#rewardFn(pred);
      candidates.push({ pred, score });
      this.#rewardStats.total += score;
      this.#rewardStats.count += 1;
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.pred ?? new Prediction({});
  }

  /** Clear accumulated reward statistics. */
  reset(): void {
    this.#rewardStats = { total: 0, count: 0 };
  }
}
