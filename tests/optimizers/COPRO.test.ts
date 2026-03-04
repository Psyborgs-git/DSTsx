import { describe, it, expect, beforeEach } from "vitest";
import { Example } from "../../src/primitives/Example.js";
import { Prediction } from "../../src/primitives/Prediction.js";
import { COPRO } from "../../src/optimizers/COPRO.js";
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

describe("COPRO", () => {
  beforeEach(() => {
    settings.reset();
  });

  it("returns an optimized module", async () => {
    settings.configure({ lm: new MockLM({}, "answer: 2") });

    const trainset = [
      new Example({ question: "1+1?", answer: "2" }),
      new Example({ question: "2+2?", answer: "2" }),
    ];

    const optimizer = new COPRO({ breadth: 1, depth: 1 });
    const student = new SimpleQA();
    const optimized = await optimizer.compile(student, trainset, exactMatch());

    expect(optimized).toBeDefined();
  });

  it("uses LM to generate instruction candidates", async () => {
    settings.configure({ lm: new MockLM({}, "answer: 2") });

    const trainset = [new Example({ question: "1+1?", answer: "2" })];

    const optimizer = new COPRO({ breadth: 2, depth: 1 });
    const student = new SimpleQA();
    const optimized = await optimizer.compile(student, trainset, exactMatch());

    // The optimizer should produce a valid module after generating candidates
    expect(optimized).toBeDefined();
  });

  it("throws if no LM configured", async () => {
    // No LM configured — settings.reset() already cleared it
    const trainset = [new Example({ question: "q", answer: "a" })];

    const optimizer = new COPRO({ breadth: 1, depth: 1 });
    const student = new SimpleQA();

    await expect(optimizer.compile(student, trainset, exactMatch())).rejects.toThrow(
      /COPRO requires a configured LM/,
    );
  });
});
