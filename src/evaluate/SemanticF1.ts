import { Module } from "../modules/Module.js";
import { Predict } from "../modules/Predict.js";
import { Prediction } from "../primitives/index.js";
import type { Metric } from "./types.js";

/**
 * LM-based semantic F1 metric for RAG and long-form outputs.
 * Mirrors `dspy.SemanticF1`.
 */
export class SemanticF1 extends Module {
  readonly threshold: number;
  readonly #predict: Predict;

  constructor(opts?: { threshold?: number }) {
    super();
    this.threshold = opts?.threshold ?? 0.5;
    this.#predict = new Predict(
      "question?, ground_truth, prediction -> precision, recall, reasoning",
    );
    this.#predict.instructions =
      "Evaluate the prediction against the ground truth. " +
      "Return precision (0-1), recall (0-1), and brief reasoning.";
  }

  async forward(inputs: {
    question?: string;
    ground_truth: string;
    prediction: string;
  }): Promise<Prediction> {
    const result = await this.#predict.forward({
      question: inputs.question ?? "",
      ground_truth: inputs.ground_truth,
      prediction: inputs.prediction,
    });

    const precision =
      parseFloat(String(result.get("precision") ?? "0")) || 0;
    const recall = parseFloat(String(result.get("recall") ?? "0")) || 0;
    const f1 =
      precision + recall > 0
        ? (2 * precision * recall) / (precision + recall)
        : 0;

    return new Prediction({
      precision: String(precision),
      recall: String(recall),
      f1: String(f1),
      reasoning: result.get("reasoning") ?? "",
    });
  }

  /** Returns a Metric function compatible with evaluate() and all optimizers. */
  asMetricFn(): Metric {
    return async (example, pred) => {
      const result = await this.forward({
        question: String(example.get("question") ?? ""),
        ground_truth: String(example.get("answer") ?? ""),
        prediction: String(pred.get("answer") ?? ""),
      });
      const f1 = Number(result.get("f1") ?? 0);
      return f1 >= this.threshold ? 1 : f1;
    };
  }
}
