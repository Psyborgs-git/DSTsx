import { describe, it, expect, beforeEach } from "vitest";
import { SemanticF1 } from "../../src/evaluate/SemanticF1.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { settings } from "../../src/settings/Settings.js";

describe("SemanticF1", () => {
  beforeEach(() => settings.reset());

  it("computes F1 from LM-judged precision/recall", async () => {
    settings.configure({
      lm: new MockLM({}, "precision: 0.8\nrecall: 0.6\nreasoning: Good match"),
    });

    const sf1 = new SemanticF1();
    const result = await sf1.forward({
      ground_truth: "Paris is the capital of France",
      prediction: "Paris",
    });

    const f1 = Number(result.get("f1") ?? 0);
    expect(f1).toBeGreaterThan(0);
    expect(f1).toBeLessThanOrEqual(1);
  });

  it("asMetricFn returns a Metric function", async () => {
    settings.configure({
      lm: new MockLM({}, "precision: 1.0\nrecall: 1.0\nreasoning: Perfect"),
    });

    const sf1 = new SemanticF1();
    const metric = sf1.asMetricFn();
    expect(typeof metric).toBe("function");
  });
});
