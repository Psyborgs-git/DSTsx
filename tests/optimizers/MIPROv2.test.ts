import { describe, it, expect, beforeEach } from "vitest";
import { MIPROv2 } from "../../src/optimizers/MIPROv2.js";
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

describe("MIPROv2", () => {
  beforeEach(() => settings.reset());

  it("returns an optimized module", async () => {
    settings.configure({ lm: new MockLM({}, "answer: 2") });

    const trainset = [
      new Example({ question: "1+1?", answer: "2" }),
      new Example({ question: "2+0?", answer: "2" }),
    ];

    const optimizer = new MIPROv2({ numCandidates: 1, numTrials: 2 });
    const student = new SimpleQA();
    const optimized = await optimizer.compile(student, trainset, exactMatch());

    expect(optimized).toBeDefined();
    expect(optimized).not.toBe(student);
  });

  it("auto presets set defaults", async () => {
    settings.configure({ lm: new MockLM({}, "answer: correct") });

    const trainset = [new Example({ question: "q", answer: "correct" })];
    const optimizer = new MIPROv2({ auto: "light", numTrials: 1, numCandidates: 1 });
    const student = new SimpleQA();
    const optimized = await optimizer.compile(student, trainset, exactMatch());

    expect(optimized).toBeDefined();
  });
});
