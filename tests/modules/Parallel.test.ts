import { describe, it, expect, beforeEach } from "vitest";
import { Parallel } from "../../src/modules/Parallel.js";
import { Predict } from "../../src/modules/Predict.js";
import { Prediction } from "../../src/primitives/Prediction.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { settings } from "../../src/settings/Settings.js";

describe("Parallel", () => {
  beforeEach(() => settings.reset());

  it("run() returns one Prediction per module", async () => {
    settings.configure({ lm: new MockLM({}, "answer: 42") });
    const m1 = new Predict("question -> answer");
    const m2 = new Predict("question -> answer");
    const parallel = new Parallel([m1, m2]);
    const results = await parallel.run({ question: "What is 6*7?" });
    expect(results).toHaveLength(2);
    expect(results[0]).toBeInstanceOf(Prediction);
    expect(results[1]).toBeInstanceOf(Prediction);
  });

  it("forward() returns all predictions as an array", async () => {
    settings.configure({ lm: new MockLM({}, "answer: 42") });
    const m1 = new Predict("question -> answer");
    const m2 = new Predict("question -> answer");
    const parallel = new Parallel([m1, m2]);
    const result = await parallel.forward({ question: "?" });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect((result as Prediction[])[0]!.get("answer")).toBe("42");
    expect((result as Prediction[])[1]!.get("answer")).toBe("42");
  });

  it("run() and forward() return the same predictions", async () => {
    settings.configure({ lm: new MockLM({}, "answer: hi") });
    const m1 = new Predict("question -> answer");
    const parallel = new Parallel([m1]);
    const fromRun = await parallel.run({ question: "?" });
    const fromForward = await parallel.forward({ question: "?" }) as Prediction[];
    expect(fromForward).toHaveLength(fromRun.length);
    expect(fromForward[0]!.get("answer")).toBe(fromRun[0]!.get("answer"));
  });
});
