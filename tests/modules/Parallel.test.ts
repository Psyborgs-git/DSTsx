import { describe, it, expect, beforeEach } from "vitest";
import { Parallel } from "../../src/modules/Parallel.js";
import { Predict } from "../../src/modules/Predict.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { settings } from "../../src/settings/Settings.js";

describe("Parallel", () => {
  beforeEach(() => settings.reset());

  it("runs all modules and returns predictions via run()", async () => {
    settings.configure({ lm: new MockLM({}, "answer: 42") });
    const m1 = new Predict("question -> answer");
    const m2 = new Predict("question -> answer");
    const parallel = new Parallel([m1, m2]);
    const results = await parallel.run({ question: "What is 6*7?" });
    expect(results).toHaveLength(2);
  });

  it("forward() returns first prediction", async () => {
    settings.configure({ lm: new MockLM({}, "answer: 42") });
    const m1 = new Predict("question -> answer");
    const parallel = new Parallel([m1]);
    const result = await parallel.forward({ question: "?" });
    expect(result.get("answer")).toBe("42");
  });
});
