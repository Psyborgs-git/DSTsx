import { Module } from "./Module.js";
import { ChainOfThought } from "./ChainOfThought.js";
import { Predict } from "./Predict.js";
import { Prediction } from "../primitives/index.js";
import type { Signature } from "../signatures/index.js";

/**
 * Runs a signature `M` times and selects the best completion via a final
 * aggregation call.
 *
 * Mirrors `dspy.MultiChainComparison` in Python.
 */
export class MultiChainComparison extends Module {
  readonly M: number;
  readonly #cot: ChainOfThought;
  readonly #aggregator: Predict;

  constructor(signature: string | Signature, M = 3) {
    super();
    this.M = M;
    this.#cot = new ChainOfThought(signature);

    // Aggregator chooses from the M completions.
    this.#aggregator = new Predict(
      "completions -> answer",
    );
  }

  async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    const completions: string[] = [];
    for (let i = 0; i < this.M; i++) {
      const result = await this.#cot.forward(inputs);
      const outputKey = [...this.#cot.signature.outputs.keys()].find((k) => k !== "rationale");
      completions.push(String(result.get(outputKey ?? "answer") ?? ""));
    }

    return this.#aggregator.forward({
      completions: completions
        .map((c, i) => `Option ${i + 1}: ${c}`)
        .join("\n"),
    });
  }
}
