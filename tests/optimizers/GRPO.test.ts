import { describe, it, expect, beforeEach } from "vitest";
import { GRPO } from "../../src/optimizers/GRPO.js";
import { Predict } from "../../src/modules/Predict.js";
import { Module } from "../../src/modules/Module.js";
import { Prediction, Example } from "../../src/primitives/index.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { settings } from "../../src/settings/Settings.js";

class SimpleQA extends Module {
  predict = new Predict("question -> answer");
  override async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    return this.predict.forward(inputs);
  }
}

describe("GRPO", () => {
  beforeEach(() => settings.reset());

  it("throws when no LM is configured", async () => {
    const optimizer = new GRPO({ numSteps: 1, groupSize: 2 });
    await expect(
      optimizer.compile(new SimpleQA(), [new Example({ question: "q", answer: "a" })], () => true)
    ).rejects.toThrow(/LM/);
  });

  it("compiles and returns a Module", async () => {
    settings.configure({ lm: new MockLM({}, "answer: 4") });
    const trainset = [
      new Example({ question: "2+2?", answer: "4" }),
      new Example({ question: "1+3?", answer: "4" }),
    ];
    const metric = (_: Example, pred: Prediction) => pred.get("answer") === "4";
    const optimizer = new GRPO({ numSteps: 1, groupSize: 2 });
    const optimized = await optimizer.compile(new SimpleQA(), trainset, metric);
    expect(optimized).toBeInstanceOf(Module);
  });
});
