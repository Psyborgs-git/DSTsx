import { describe, it, expect, beforeEach } from "vitest";
import { Example } from "../../src/primitives/Example.js";
import { Prediction } from "../../src/primitives/Prediction.js";
import { EnsembleOptimizer } from "../../src/optimizers/Ensemble.js";
import { Predict } from "../../src/modules/Predict.js";
import { Module } from "../../src/modules/Module.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { settings } from "../../src/settings/Settings.js";
import { exactMatch } from "../../src/evaluate/metrics.js";

class SimpleQA extends Module {
  predict = new Predict("question -> answer");

  async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    return this.predict.forward(inputs);
  }
}

describe("EnsembleOptimizer", () => {
  beforeEach(() => {
    settings.reset();
  });

  it("returns a module that forwards to student", async () => {
    settings.configure({ lm: new MockLM({}, "answer: hello") });

    const trainset = [new Example({ question: "q1", answer: "hello" })];
    const student = new SimpleQA();

    const optimizer = new EnsembleOptimizer();
    const optimized = await optimizer.compile(student, trainset, exactMatch());

    expect(optimized).toBeDefined();

    // The wrapper should forward calls to the student
    const result = await optimized.forward({ question: "test" });
    expect(result).toBeDefined();
    expect(result.get("answer")).toBe("hello");
  });

  it("custom reduceFunc is applied", async () => {
    settings.configure({ lm: new MockLM({}, "answer: original") });

    const trainset = [new Example({ question: "q1", answer: "a1" })];
    const student = new SimpleQA();

    const reduceFunc = (predictions: Prediction[]): Prediction => {
      const first = predictions[0]!;
      return new Prediction(
        { answer: `reduced:${first.get("answer")}` },
        [...first.completions],
      );
    };

    const optimizer = new EnsembleOptimizer({ reduceFunc });
    const optimized = await optimizer.compile(student, trainset, exactMatch());

    const result = await optimized.forward({ question: "test" });
    expect(result.get("answer")).toBe("reduced:original");
  });
});
