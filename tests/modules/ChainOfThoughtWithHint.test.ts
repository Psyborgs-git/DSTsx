import { describe, it, expect, beforeEach } from "vitest";
import { ChainOfThoughtWithHint } from "../../src/modules/ChainOfThoughtWithHint.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { settings } from "../../src/settings/Settings.js";

describe("ChainOfThoughtWithHint", () => {
  beforeEach(() => settings.reset());

  it("adds a hint input field to the signature", () => {
    const cot = new ChainOfThoughtWithHint("question -> answer");
    expect(cot.signature.inputs.has("hint")).toBe(true);
    expect(cot.signature.inputs.get("hint")?.optional).toBe(true);
  });

  it("retains the rationale output field from ChainOfThought", () => {
    const cot = new ChainOfThoughtWithHint("question -> answer");
    expect(cot.signature.outputs.has("rationale")).toBe(true);
    expect(cot.signature.outputs.has("answer")).toBe(true);
  });

  it("forward() works without a hint", async () => {
    settings.configure({
      lm: new MockLM({}, "rationale: simple math\nanswer: 4"),
    });
    const cot = new ChainOfThoughtWithHint("question -> answer");
    const result = await cot.forward({ question: "What is 2+2?" });
    expect(typeof result.get("answer")).toBe("string");
  });

  it("forward() works with a hint provided", async () => {
    settings.configure({
      lm: new MockLM({}, "rationale: hint helped\nanswer: Paris"),
    });
    const cot = new ChainOfThoughtWithHint("question -> answer");
    const result = await cot.forward({
      question: "What is the capital of France?",
      hint: "Think about European countries.",
    });
    expect(typeof result.get("answer")).toBe("string");
  });

  it("signature preserves original input fields alongside hint", () => {
    const cot = new ChainOfThoughtWithHint("question, context -> answer");
    expect(cot.signature.inputs.has("question")).toBe(true);
    expect(cot.signature.inputs.has("context")).toBe(true);
    expect(cot.signature.inputs.has("hint")).toBe(true);
  });
});
