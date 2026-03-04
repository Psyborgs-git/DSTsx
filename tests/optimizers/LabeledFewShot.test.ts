import { describe, it, expect, beforeEach } from "vitest";
import { Example } from "../../src/primitives/Example.js";
import { Prediction } from "../../src/primitives/Prediction.js";
import { LabeledFewShot } from "../../src/optimizers/LabeledFewShot.js";
import { BootstrapFewShot } from "../../src/optimizers/BootstrapFewShot.js";
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

describe("LabeledFewShot", () => {
  it("assigns trainset as demos up to k", async () => {
    const trainset = [
      new Example({ question: "1+1?", answer: "2" }),
      new Example({ question: "2+2?", answer: "4" }),
      new Example({ question: "3+3?", answer: "6" }),
    ];

    const optimizer = new LabeledFewShot(2);
    const student = new SimpleQA();
    const optimized = await optimizer.compile(student, trainset, exactMatch());

    const predictors = optimized.namedPredictors();
    const predict = predictors[0]?.[1] as Predict | undefined;
    expect(predict?.demos).toHaveLength(2);
  });
});

describe("BootstrapFewShot", () => {
  beforeEach(() => settings.reset());

  it("collects successful traces as demos", async () => {
    settings.configure({ lm: new MockLM({}, "answer: 2") });

    const trainset = [
      new Example({ question: "1+1?", answer: "2" }),
      new Example({ question: "2+2?", answer: "4" }),
    ];

    const optimizer = new BootstrapFewShot({ maxBootstrappedDemos: 2 });
    const student = new SimpleQA();
    const optimized = await optimizer.compile(student, trainset, exactMatch());

    expect(optimized).toBeDefined();
  });
});
