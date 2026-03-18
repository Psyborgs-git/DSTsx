import { Module } from "../modules/Module.js";
import { Predict } from "../modules/Predict.js";
import { Prediction } from "../primitives/index.js";
import type { Metric } from "./types.js";

/**
 * Evaluates completeness and groundedness of predictions.
 * Mirrors `dspy.CompleteAndGrounded`.
 */
export class CompleteAndGrounded extends Module {
  readonly #completeness: Predict;
  readonly #groundedness: Predict;

  constructor() {
    super();
    this.#completeness = new Predict(
      "context, ground_truth, prediction -> completeness_score, completeness_reasoning",
    );
    this.#completeness.instructions =
      "Rate the completeness of the prediction against ground_truth (0-1).";

    this.#groundedness = new Predict(
      "context, prediction -> groundedness_score, groundedness_reasoning",
    );
    this.#groundedness.instructions =
      "Rate how well the prediction is grounded in the context (0-1).";
  }

  async forward(inputs: {
    context: string;
    ground_truth: string;
    prediction: string;
  }): Promise<Prediction> {
    const compResult = await this.#completeness.forward({
      context: inputs.context,
      ground_truth: inputs.ground_truth,
      prediction: inputs.prediction,
    });

    const groundResult = await this.#groundedness.forward({
      context: inputs.context,
      prediction: inputs.prediction,
    });

    const completenessScore =
      parseFloat(String(compResult.get("completeness_score") ?? "0")) || 0;
    const groundednessScore =
      parseFloat(String(groundResult.get("groundedness_score") ?? "0")) || 0;
    const combined = (completenessScore + groundednessScore) / 2;

    return new Prediction({
      completeness_score: String(completenessScore),
      completeness_reasoning:
        compResult.get("completeness_reasoning") ?? "",
      groundedness_score: String(groundednessScore),
      groundedness_reasoning:
        groundResult.get("groundedness_reasoning") ?? "",
      score: String(combined),
    });
  }

  /** Returns a Metric function compatible with evaluate() and all optimizers. */
  asMetricFn(): Metric {
    return async (example, pred) => {
      const result = await this.forward({
        context: String(example.get("context") ?? ""),
        ground_truth: String(example.get("answer") ?? ""),
        prediction: String(pred.get("answer") ?? ""),
      });
      return Number(result.get("score") ?? 0);
    };
  }
}
