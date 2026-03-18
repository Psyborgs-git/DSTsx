import { Module } from "../modules/Module.js";
import { Predict } from "../modules/Predict.js";
import { Prediction } from "../primitives/index.js";

/**
 * A Predict module that outputs answer + cited passage indices.
 */
export class Citations extends Module {
  readonly #predict: Predict;

  constructor() {
    super();
    this.#predict = new Predict("context, question -> answer, citations");
    this.#predict.instructions =
      "Answer the question based on the context. Cite passage indices used.";
  }

  async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    return this.#predict.forward(inputs);
  }
}
