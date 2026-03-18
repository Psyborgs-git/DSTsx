import { describe, it, expect, beforeEach } from "vitest";
import { GEPA } from "../../src/optimizers/GEPA.js";
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

describe("GEPA", () => {
  beforeEach(() => settings.reset());

  it("returns an optimized module", async () => {
    settings.configure({ lm: new MockLM({}, "answer: correct") });

    const trainset = [
      new Example({ question: "q1", answer: "correct" }),
      new Example({ question: "q2", answer: "correct" }),
    ];

    const optimizer = new GEPA({ numSteps: 1, groupSize: 2 });
    const student = new SimpleQA();
    const optimized = await optimizer.compile(student, trainset, exactMatch());

    expect(optimized).toBeDefined();
    expect(optimized).not.toBe(student);
  });
});
