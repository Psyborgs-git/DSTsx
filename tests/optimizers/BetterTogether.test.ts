import { describe, it, expect, beforeEach } from "vitest";
import { BetterTogether } from "../../src/optimizers/BetterTogether.js";
import { LabeledFewShot } from "../../src/optimizers/LabeledFewShot.js";
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

describe("BetterTogether", () => {
  beforeEach(() => settings.reset());

  it("chains prompt and finetune stages", async () => {
    settings.configure({ lm: new MockLM({}, "answer: correct") });

    const trainset = [
      new Example({ question: "q1", answer: "correct" }),
    ];

    const promptOpt = new LabeledFewShot(1);
    const finetuneOpt = new LabeledFewShot(1); // Using same for test simplicity

    const optimizer = new BetterTogether({
      promptOptimizer: promptOpt,
      finetuneOptimizer: finetuneOpt,
      sequence: ["prompt", "finetune"],
    });

    const student = new SimpleQA();
    const optimized = await optimizer.compile(student, trainset, exactMatch());

    expect(optimized).toBeDefined();
    expect(optimized).not.toBe(student);
  });
});
