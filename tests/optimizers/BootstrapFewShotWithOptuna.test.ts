import { describe, it, expect, beforeEach } from "vitest";
import { BootstrapFewShotWithOptuna } from "../../src/optimizers/BootstrapFewShotWithOptuna.js";
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

describe("BootstrapFewShotWithOptuna", () => {
  beforeEach(() => settings.reset());

  it("compiles and returns an optimized module", async () => {
    settings.configure({ lm: new MockLM({}, "answer: 4") });
    const trainset = [
      new Example({ question: "2+2?", answer: "4" }),
      new Example({ question: "1+3?", answer: "4" }),
    ];
    const metric = (_: Example, pred: Prediction) => pred.get("answer") === "4";
    const optimizer = new BootstrapFewShotWithOptuna({
      numTrials: 3,
      maxBootstrappedDemos: 2,
    });
    const student = new SimpleQA();
    const optimized = await optimizer.compile(student, trainset, metric);
    expect(optimized).toBeInstanceOf(Module);
  });
});
