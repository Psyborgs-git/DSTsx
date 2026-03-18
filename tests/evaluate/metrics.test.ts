import { describe, it, expect } from "vitest";
import { answerExactMatch, answerPassageMatch } from "../../src/evaluate/metrics.js";
import { Example } from "../../src/primitives/Example.js";
import { Prediction } from "../../src/primitives/Prediction.js";

describe("answerExactMatch", () => {
  const metric = answerExactMatch();

  it("matches normalized strings", () => {
    const example = new Example({ answer: "The Cat" });
    const prediction = new Prediction({ answer: "the cat" });
    expect(metric(example, prediction)).toBe(true);
  });

  it("removes articles", () => {
    const example = new Example({ answer: "a dog" });
    const prediction = new Prediction({ answer: "dog" });
    expect(metric(example, prediction)).toBe(true);
  });

  it("strips punctuation", () => {
    const example = new Example({ answer: "hello, world!" });
    const prediction = new Prediction({ answer: "hello world" });
    expect(metric(example, prediction)).toBe(true);
  });

  it("returns false for different answers", () => {
    const example = new Example({ answer: "cat" });
    const prediction = new Prediction({ answer: "dog" });
    expect(metric(example, prediction)).toBe(false);
  });
});

describe("answerPassageMatch", () => {
  const metric = answerPassageMatch();

  it("returns 1 when answer appears in context", () => {
    const example = new Example({ context: "Paris is the capital of France.", answer: "a" });
    const prediction = new Prediction({ answer: "Paris" });
    expect(metric(example, prediction)).toBe(1);
  });

  it("returns 0 when answer is not in context", () => {
    const example = new Example({ context: "Paris is the capital.", answer: "a" });
    const prediction = new Prediction({ answer: "Berlin" });
    expect(metric(example, prediction)).toBe(0);
  });

  it("returns 0 for empty answer", () => {
    const example = new Example({ context: "Some text.", answer: "a" });
    const prediction = new Prediction({ answer: "" });
    expect(metric(example, prediction)).toBe(0);
  });
});
