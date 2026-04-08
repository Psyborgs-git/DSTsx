import { describe, it, expect, beforeAll } from "vitest";
import { Evaluate } from "../../src/evaluate/EvaluateClass.js";
import { Module } from "../../src/modules/Module.js";
import { Prediction } from "../../src/primitives/Prediction.js";
import { Example } from "../../src/primitives/Example.js";
import { exactMatch } from "../../src/evaluate/metrics.js";

class EchoModule extends Module {
  async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    return new Prediction({ answer: inputs["answer"] ?? inputs["question"] });
  }
}

const devset = [
  new Example({ question: "What is 2+2?", answer: "4" }),
  new Example({ question: "What is 3+3?", answer: "6" }),
  new Example({ question: "What is 4+4?", answer: "8" }),
];

describe("Evaluate class", () => {
  it("constructs with required config", () => {
    const evaluator = new Evaluate({
      devset,
      metric: exactMatch("answer"),
    });
    expect(evaluator.devset).toBe(devset);
    expect(evaluator.metric).toBeDefined();
  });

  it("run() evaluates a program and returns EvaluationResult", async () => {
    const evaluator = new Evaluate({
      devset,
      metric: exactMatch("answer"),
    });
    const result = await evaluator.run(new EchoModule());
    expect(result.total).toBe(3);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.results)).toBe(true);
  });

  it("call() is an alias for run()", async () => {
    const evaluator = new Evaluate({
      devset,
      metric: exactMatch("answer"),
    });
    const result = await evaluator.call(new EchoModule());
    expect(result.total).toBe(3);
  });

  it("returns score of 1.0 when all answers match", async () => {
    const devsetExact = [
      new Example({ question: "Q1", answer: "A" }),
      new Example({ question: "Q2", answer: "B" }),
    ];

    class PerfectModule extends Module {
      async forward(inputs: Record<string, unknown>): Promise<Prediction> {
        return new Prediction({ answer: inputs["answer"] });
      }
    }

    const evaluator = new Evaluate({
      devset: devsetExact,
      metric: exactMatch("answer"),
    });
    const result = await evaluator.run(new PerfectModule());
    expect(result.score).toBe(1.0);
    expect(result.numPassed).toBe(2);
  });

  it("supports numThreads option", async () => {
    const evaluator = new Evaluate({
      devset,
      metric: exactMatch("answer"),
      numThreads: 2,
    });
    const result = await evaluator.run(new EchoModule());
    expect(result.total).toBe(3);
  });

  it("options object only has defined keys (exactOptionalPropertyTypes)", () => {
    const evaluator = new Evaluate({ devset, metric: exactMatch("answer") });
    // numThreads and displayProgress should not be set to undefined
    expect("numThreads" in evaluator.options).toBe(false);
    expect("displayProgress" in evaluator.options).toBe(false);
  });
});
