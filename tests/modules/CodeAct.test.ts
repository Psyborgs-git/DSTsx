import { describe, it, expect, beforeEach } from "vitest";
import { CodeAct } from "../../src/modules/CodeAct.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { settings } from "../../src/settings/Settings.js";

describe("CodeAct", () => {
  beforeEach(() => settings.reset());

  it("returns answer when LM emits Finish[answer]", async () => {
    settings.configure({ lm: new MockLM({}, "Finish[42]") });
    const codeAct = new CodeAct("question -> answer");
    const result = await codeAct.forward({ question: "What is 6*7?" });
    expect(result.get("answer")).toBe("42");
  });

  it("includes code in prediction output", async () => {
    settings.configure({
      lm: new MockLM({}, "```javascript\nreturn 42;\n```\nFinish[42]"),
    });
    const codeAct = new CodeAct("question -> answer", [], 2, "function", 5_000);
    const result = await codeAct.forward({ question: "test" });
    expect(result.get("trajectory")).toBeDefined();
  });
});
