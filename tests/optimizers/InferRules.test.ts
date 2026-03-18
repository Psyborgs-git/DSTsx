import { describe, it, expect, beforeEach } from "vitest";
import { InferRules } from "../../src/optimizers/InferRules.js";
import { Predict } from "../../src/modules/Predict.js";
import { Module } from "../../src/modules/Module.js";
import { Prediction } from "../../src/primitives/Prediction.js";
import { Example } from "../../src/primitives/Example.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { settings } from "../../src/settings/Settings.js";
import { exactMatch } from "../../src/evaluate/metrics.js";

class SimpleQA extends Module {
  predict = new Predict("question -> answer");
  async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    return this.predict.forward(inputs);
  }
}

describe("InferRules", () => {
  beforeEach(() => settings.reset());

  it("appends inferred rules to predictor instructions", async () => {
    settings.configure({
      lm: new MockLM({}, "answer: correct\n1. Always be accurate\n2. Be concise"),
    });

    const trainset = [
      new Example({ question: "q1", answer: "correct" }),
    ];

    const optimizer = new InferRules({ numRules: 2 });
    const student = new SimpleQA();
    const optimized = await optimizer.compile(student, trainset, exactMatch());

    // Check that rules were appended to at least one predictor
    const predictors = optimized.namedPredictors();
    const hasRules = predictors.some(([, p]) => {
      const pred = p as Predict;
      return pred.instructions?.includes("Rules:");
    });
    expect(hasRules).toBe(true);
  });
});
