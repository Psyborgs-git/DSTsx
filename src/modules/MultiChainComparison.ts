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
    const outputKey = [...this.#cot.signature.outputs.keys()].find((k) => k !== "rationale") ?? "answer";

    for (let i = 0; i < this.M; i++) {
      const result = await this.#cot.forward(inputs);
      completions.push(String(result.get(outputKey) ?? ""));
    }

    const aggregated = await this.#aggregator.forward({
      completions: completions
        .map((c, i) => `Option ${i + 1}: ${c}`)
        .join("\n"),
    });

    // Extract the actual answer from the selected option
    const rawAnswer = String(aggregated.get("answer") ?? "");
    // If the model returned "Option N", extract the content of that option
    const optionMatch = /^Option\s*(\d+)/i.exec(rawAnswer);
    if (optionMatch) {
      const optionIdx = parseInt(optionMatch[1]!, 10) - 1;
      if (optionIdx >= 0 && optionIdx < completions.length) {
        return new Prediction({ answer: completions[optionIdx] ?? rawAnswer });
      }
    }

    return new Prediction({ answer: rawAnswer });
  }
}
