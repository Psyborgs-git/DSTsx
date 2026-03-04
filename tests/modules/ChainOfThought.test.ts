import { describe, it, expect, beforeEach } from "vitest";
import { ChainOfThought } from "../../src/modules/ChainOfThought.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { settings } from "../../src/settings/Settings.js";

describe("ChainOfThought", () => {
  beforeEach(() => settings.reset());

  it("prepends a rationale output field to the signature", () => {
    const cot = new ChainOfThought("question -> answer");
    expect(cot.signature.outputs.has("rationale")).toBe(true);
    expect(cot.signature.outputs.has("answer")).toBe(true);
  });

  it("strips the rationale from the returned Prediction", async () => {
    settings.configure({
      lm: new MockLM({}, "rationale: Because 2+2=4\nanswer: 4"),
    });
    const cot = new ChainOfThought("question -> answer");
    const result = await cot.forward({ question: "What is 2+2?" });
    // rationale should NOT be exposed
    expect(result.get("rationale")).toBeUndefined();
    // answer should be present
    expect(typeof result.get("answer")).toBe("string");
  });
});
