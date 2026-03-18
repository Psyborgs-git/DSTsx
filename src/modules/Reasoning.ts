import { Module } from "./Module.js";
import { Predict } from "./Predict.js";
import { Prediction } from "../primitives/index.js";
import type { Signature } from "../signatures/index.js";

/**
 * Surfaces native reasoning tokens from models like o1, o3, DeepSeek-R1.
 * Mirrors `dspy.Reasoning`.
 */
export class Reasoning extends Module {
  readonly predict: Predict;

  constructor(signature: string | Signature) {
    super();
    this.predict = new Predict(signature);
  }

  async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    const result = await this.predict.forward(inputs);
    return result;
  }
}
