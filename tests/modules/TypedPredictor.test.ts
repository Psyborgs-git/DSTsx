import { describe, it, expect, beforeEach } from "vitest";
import { TypedPredictor, TypedChainOfThought, TypedPrediction } from "../../src/modules/TypedPredictor.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { settings } from "../../src/settings/Settings.js";

describe("TypedPredictor", () => {
  beforeEach(() => settings.reset());

  it("parses JSON from LM response", async () => {
    settings.configure({ lm: new MockLM({}, '{"answer": "Paris"}') });
    const tp = new TypedPredictor("question -> answer");
    const result = await tp.forward({ question: "Capital of France?" });
    expect(result).toBeInstanceOf(TypedPrediction);
    expect((result.typed as Record<string, unknown>)["answer"]).toBe("Paris");
  });

  it("strips markdown code fences", async () => {
    settings.configure({ lm: new MockLM({}, "```json\n{\"answer\": \"Paris\"}\n```") });
    const tp = new TypedPredictor("question -> answer");
    const result = await tp.forward({ question: "Capital?" });
    expect((result.typed as Record<string, unknown>)["answer"]).toBe("Paris");
  });

  it("validates with schema if provided", async () => {
    const schema = {
      parse: (v: unknown) => {
        const obj = v as Record<string, unknown>;
        if (typeof obj["answer"] !== "string") throw new Error("invalid");
        return obj as { answer: string };
      },
    };
    settings.configure({ lm: new MockLM({}, '{"answer": "Paris"}') });
    const tp = new TypedPredictor("question -> answer", schema);
    const result = await tp.forward({ question: "Capital?" });
    expect(result.typed.answer).toBe("Paris");
  });

  it("throws after maxRetries on invalid JSON", async () => {
    settings.configure({ lm: new MockLM({}, "not json") });
    const tp = new TypedPredictor("question -> answer", undefined, { maxRetries: 1 });
    await expect(tp.forward({ question: "?" })).rejects.toThrow();
  });
});

describe("TypedChainOfThought", () => {
  beforeEach(() => settings.reset());

  it("strips rationale from result", async () => {
    settings.configure({ lm: new MockLM({}, '{"answer": "72"}') });
    const tcot = new TypedChainOfThought("question -> answer");
    const result = await tcot.forward({ question: "9*8?" });
    expect(result.get("rationale")).toBeUndefined();
  });
});
