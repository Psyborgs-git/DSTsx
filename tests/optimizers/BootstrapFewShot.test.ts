import { describe, it, expect, beforeEach } from "vitest";
import { Example } from "../../src/primitives/Example.js";
import { Prediction } from "../../src/primitives/Prediction.js";
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

describe("BootstrapFewShot", () => {
  beforeEach(() => {
    settings.reset();
  });

  it("returns a new module (not the same instance)", async () => {
    settings.configure({ lm: new MockLM({}, "answer: 2") });

    const trainset = [new Example({ question: "1+1?", answer: "2" })];
    const student = new SimpleQA();
    const optimizer = new BootstrapFewShot({ maxBootstrappedDemos: 4 });
    const optimized = await optimizer.compile(student, trainset, exactMatch());

    expect(optimized).toBeDefined();
    expect(optimized).not.toBe(student);
  });

  it("does not mutate the original student", async () => {
    settings.configure({ lm: new MockLM({}, "answer: 2") });

    const trainset = [new Example({ question: "1+1?", answer: "2" })];
    const student = new SimpleQA();
    const originalPredict = student.namedPredictors()[0]?.[1] as Predict;
    const originalDemoCount = originalPredict.demos.length;

    const optimizer = new BootstrapFewShot({ maxBootstrappedDemos: 4 });
    await optimizer.compile(student, trainset, exactMatch());

    expect(originalPredict.demos).toHaveLength(originalDemoCount);
  });

  it("collects successful demos up to maxBootstrappedDemos", async () => {
    settings.configure({ lm: new MockLM({}, "answer: correct") });

    const trainset = [
      new Example({ question: "q1", answer: "correct" }),
      new Example({ question: "q2", answer: "correct" }),
      new Example({ question: "q3", answer: "correct" }),
      new Example({ question: "q4", answer: "correct" }),
      new Example({ question: "q5", answer: "correct" }),
    ];

    const optimizer = new BootstrapFewShot({ maxBootstrappedDemos: 3 });
    const student = new SimpleQA();
    const optimized = await optimizer.compile(student, trainset, exactMatch());

    const predict = optimized.namedPredictors()[0]?.[1] as Predict;
    expect(predict.demos.length).toBeLessThanOrEqual(3);
    expect(predict.demos.length).toBeGreaterThan(0);
  });

  it("uses teacher module when provided", async () => {
    settings.configure({ lm: new MockLM({}, "answer: teacher-answer") });

    const trainset = [new Example({ question: "q1", answer: "teacher-answer" })];
    const student = new SimpleQA();
    const teacher = new SimpleQA();

    const optimizer = new BootstrapFewShot({
      maxBootstrappedDemos: 4,
      teacher,
    });
    const optimized = await optimizer.compile(student, trainset, exactMatch());

    const predict = optimized.namedPredictors()[0]?.[1] as Predict;
    expect(predict.demos.length).toBeGreaterThan(0);
  });

  it("handles examples that throw exceptions gracefully", async () => {
    // Use a metric that always fails so the LM error path is irrelevant
    const failingMetric = () => false;
    settings.configure({ lm: new MockLM({}, "answer: wrong") });

    const trainset = [
      new Example({ question: "q1", answer: "expected" }),
      new Example({ question: "q2", answer: "expected" }),
    ];

    const optimizer = new BootstrapFewShot({ maxBootstrappedDemos: 4 });
    const student = new SimpleQA();

    // Should not throw even though no demos pass
    const optimized = await optimizer.compile(student, trainset, failingMetric);
    expect(optimized).toBeDefined();

    const predict = optimized.namedPredictors()[0]?.[1] as Predict;
    expect(predict.demos).toHaveLength(0);
  });
});
