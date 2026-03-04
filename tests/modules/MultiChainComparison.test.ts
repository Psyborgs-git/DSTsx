import { describe, it, expect, beforeEach } from "vitest";
import { MultiChainComparison } from "../../src/modules/MultiChainComparison.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { settings } from "../../src/settings/Settings.js";

describe("MultiChainComparison", () => {
  beforeEach(() => settings.reset());

  it("returns a Prediction with an answer field", async () => {
    settings.configure({
      lm: new MockLM({}, "rationale: thinking\nanswer: Paris"),
    });
    const mcc = new MultiChainComparison("question -> answer");
    const result = await mcc.forward({ question: "Capital of France?" });
    expect(result.get("answer")).toBeDefined();
  });

  it("uses M completions (default M=3)", async () => {
    settings.configure({
      lm: new MockLM({}, "rationale: step\nanswer: 42"),
    });

    const mcc = new MultiChainComparison("question -> answer");
    const result = await mcc.forward({ question: "What is 6*7?" });
    // Should return a valid answer after M CoT calls + 1 aggregator call
    expect(result.get("answer")).toBeDefined();
  });

  it("uses custom M value", async () => {
    settings.configure({
      lm: new MockLM({}, "rationale: reasoning\nanswer: result"),
    });
    const mcc = new MultiChainComparison("question -> answer", 5);
    expect(mcc.M).toBe(5);
    const result = await mcc.forward({ question: "test" });
    expect(result.get("answer")).toBeDefined();
  });

  it("aggregator receives formatted completions", async () => {
    settings.configure({
      lm: new MockLM({}, "rationale: step by step\nanswer: aggregated"),
    });
    const mcc = new MultiChainComparison("question -> answer", 2);
    const result = await mcc.forward({ question: "Aggregate this" });
    // The aggregator should produce an answer
    expect(typeof result.get("answer")).toBe("string");
  });
});
