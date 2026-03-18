import { describe, it, expect, beforeEach } from "vitest";
import { ProgramOfThought } from "../../src/modules/ProgramOfThought.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { settings } from "../../src/settings/Settings.js";

describe("ProgramOfThought sandbox modes", () => {
  beforeEach(() => settings.reset());

  it("has sandbox property (default: 'worker')", () => {
    const pot = new ProgramOfThought("question -> answer");
    expect(pot.sandbox).toBe("worker");
  });

  it("accepts sandbox: 'none'", () => {
    const pot = new ProgramOfThought("question -> answer", 3, 5000, "none");
    expect(pot.sandbox).toBe("none");
  });

  it("accepts sandbox: 'worker'", () => {
    const pot = new ProgramOfThought("question -> answer", 3, 5000, "worker");
    expect(pot.sandbox).toBe("worker");
  });

  it("sandbox='function' executes code correctly", async () => {
    settings.configure({ lm: new MockLM({}, "code: return 2 + 2") });
    const pot = new ProgramOfThought("question -> answer", 1, 5000, "function");
    const result = await pot.forward({ question: "2+2?" });
    expect(result.get("answer")).toBe("4");
  });

  it("sandbox='worker' executes code in a worker thread", async () => {
    settings.configure({ lm: new MockLM({}, "code: return 2 + 2") });
    const pot = new ProgramOfThought("question -> answer", 1, 10000, "worker");
    const result = await pot.forward({ question: "2+2?" });
    expect(result.get("answer")).toBe("4");
  }, 15000);

  it("sandbox='none' executes code without timeout", async () => {
    settings.configure({ lm: new MockLM({}, "code: return 'hello'") });
    const pot = new ProgramOfThought("question -> answer", 1, 5000, "none");
    const result = await pot.forward({ question: "say hello" });
    expect(result.get("answer")).toBe("hello");
  });
});
