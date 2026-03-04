import { describe, it, expect, beforeEach } from "vitest";
import { ProgramOfThought } from "../../src/modules/ProgramOfThought.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { settings } from "../../src/settings/Settings.js";

describe("ProgramOfThought", () => {
  beforeEach(() => settings.reset());

  it("generates and executes simple code returning a value", async () => {
    settings.configure({
      lm: new MockLM({}, "code: return 2 + 2"),
    });
    const pot = new ProgramOfThought("question -> answer");
    const result = await pot.forward({ question: "What is 2+2?" });
    expect(result.get("answer")).toBe("4");
    expect(result.get("code")).toBeDefined();
  });

  it("retries when first code attempt fails", async () => {
    settings.configure({
      lm: new MockLM({}, "code: return 99"),
    });
    const pot = new ProgramOfThought("question -> answer", 3);
    const result = await pot.forward({ question: "compute" });
    expect(result.get("answer")).toBe("99");
  });

  it("returns empty string on all failures", async () => {
    settings.configure({
      // Code that always throws an error
      lm: new MockLM({}, "code: throw new Error('always fails')"),
    });
    const pot = new ProgramOfThought("question -> answer", 2);
    const result = await pot.forward({ question: "broken" });
    // When all attempts fail, answer should be empty string
    expect(result.get("answer")).toBe("");
  });

  it("respects maxAttempts configuration", () => {
    const pot = new ProgramOfThought("question -> answer", 5, 10_000);
    expect(pot.maxAttempts).toBe(5);
    expect(pot.timeoutMs).toBe(10_000);
  });

  it("respects timeout", async () => {
    settings.configure({
      // Code that runs indefinitely via an async delay
      lm: new MockLM(
        {},
        "code: await new Promise(resolve => setTimeout(resolve, 60000)); return 1",
      ),
    });
    const pot = new ProgramOfThought("question -> answer", 1, 100);
    const result = await pot.forward({ question: "slow" });
    // Should timeout and result in empty string
    expect(result.get("answer")).toBe("");
  });

  it("returns code in prediction output", async () => {
    settings.configure({
      lm: new MockLM({}, "code: return 'hello'"),
    });
    const pot = new ProgramOfThought("question -> answer");
    const result = await pot.forward({ question: "greet" });
    expect(result.get("answer")).toBe("hello");
    expect(typeof result.get("code")).toBe("string");
  });
});
