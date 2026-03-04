import { describe, it, expect, beforeEach } from "vitest";
import { Example } from "../../src/primitives/Example.js";
import { Prediction } from "../../src/primitives/Prediction.js";
import { BootstrapFewShotWithRandomSearch } from "../../src/optimizers/BootstrapFewShotWithRandomSearch.js";
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

describe("BootstrapFewShotWithRandomSearch", () => {
  beforeEach(() => {
    settings.reset();
  });

  it("returns a module", async () => {
    settings.configure({ lm: new MockLM({}, "answer: 2") });

    const trainset = [
      new Example({ question: "1+1?", answer: "2" }),
      new Example({ question: "2+2?", answer: "2" }),
    ];

    const optimizer = new BootstrapFewShotWithRandomSearch({
      numCandidatePrograms: 2,
      maxBootstrappedDemos: 2,
    });
    const student = new SimpleQA();
    const optimized = await optimizer.compile(student, trainset, exactMatch());

    expect(optimized).toBeDefined();
    expect(optimized).not.toBe(student);
  });

  it("selects best candidate", async () => {
    settings.configure({ lm: new MockLM({}, "answer: yes") });

    const trainset = [
      new Example({ question: "q1", answer: "yes" }),
      new Example({ question: "q2", answer: "yes" }),
      new Example({ question: "q3", answer: "yes" }),
    ];

    const optimizer = new BootstrapFewShotWithRandomSearch({
      numCandidatePrograms: 3,
      maxBootstrappedDemos: 4,
    });
    const student = new SimpleQA();
    const optimized = await optimizer.compile(student, trainset, exactMatch());

    expect(optimized).toBeDefined();
    // The optimized module should have demos assigned
    const predict = optimized.namedPredictors()[0]?.[1] as Predict;
    expect(predict.demos.length).toBeGreaterThan(0);
  });

  it("works with valset", async () => {
    settings.configure({ lm: new MockLM({}, "answer: correct") });

    const trainset = [
      new Example({ question: "train1", answer: "correct" }),
      new Example({ question: "train2", answer: "correct" }),
    ];
    const valset = [
      new Example({ question: "val1", answer: "correct" }),
    ];

    const optimizer = new BootstrapFewShotWithRandomSearch({
      numCandidatePrograms: 2,
      maxBootstrappedDemos: 2,
      valset,
    });
    const student = new SimpleQA();
    const optimized = await optimizer.compile(student, trainset, exactMatch());

    expect(optimized).toBeDefined();
  });
});
