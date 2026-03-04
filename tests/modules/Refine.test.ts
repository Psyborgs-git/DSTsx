import { describe, it, expect, beforeEach } from "vitest";
import { Refine } from "../../src/modules/Refine.js";
import { Predict } from "../../src/modules/Predict.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { settings } from "../../src/settings/Settings.js";

describe("Refine", () => {
  beforeEach(() => settings.reset());

  it("returns inner prediction when critic says yes", async () => {
    settings.configure({
      lm: new MockLM(
        {},
        "answer: Paris\ncritique: looks good\nis_satisfactory: yes",
      ),
    });
    const inner = new Predict("question -> answer");
    const refine = new Refine(inner, { maxRefinements: 2 });
    const result = await refine.forward({ question: "Capital of France?" });
    expect(result.get("answer")).toBeDefined();
  });

  it("respects stopCondition", async () => {
    settings.configure({ lm: new MockLM({}, "answer: ok") });
    const inner = new Predict("question -> answer");
    const refine = new Refine(inner, {
      maxRefinements: 3,
      stopCondition: (p) => p.get("answer") === "ok",
    });
    const result = await refine.forward({ question: "test?" });
    expect(result.get("answer")).toBe("ok");
  });
});
