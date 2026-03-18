import { describe, it, expect, beforeEach } from "vitest";
import { Reasoning } from "../../src/modules/Reasoning.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { settings } from "../../src/settings/Settings.js";

describe("Reasoning", () => {
  beforeEach(() => settings.reset());

  it("delegates to internal Predict and returns Prediction", async () => {
    settings.configure({ lm: new MockLM({}, "answer: 42") });
    const reasoning = new Reasoning("question -> answer");
    const result = await reasoning.forward({ question: "What is 6*7?" });
    expect(result.get("answer")).toBe("42");
  });
});
