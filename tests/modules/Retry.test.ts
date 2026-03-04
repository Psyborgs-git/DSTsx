import { describe, it, expect, beforeEach } from "vitest";
import { Retry } from "../../src/modules/Retry.js";
import { Predict } from "../../src/modules/Predict.js";
import { Module } from "../../src/modules/Module.js";
import { Prediction } from "../../src/primitives/Prediction.js";
import { AssertionError } from "../../src/assertions/Assert.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { settings } from "../../src/settings/Settings.js";

describe("Retry", () => {
  beforeEach(() => settings.reset());

  it("succeeds on first attempt", async () => {
    settings.configure({ lm: new MockLM({}, "answer: 42") });
    const inner = new Predict("question -> answer");
    const retry = new Retry(inner, 3);
    const result = await retry.forward({ question: "What is 6*7?" });
    expect(result.get("answer")).toBe("42");
  });

  it("retries on AssertionError and succeeds", async () => {
    let attempt = 0;
    const inner = new (class extends Module {
      async forward(_inputs: Record<string, unknown>): Promise<Prediction> {
        attempt++;
        if (attempt < 3) {
          throw new AssertionError("Answer must not be empty");
        }
        return new Prediction({ answer: "success" });
      }
    })();

    const retry = new Retry(inner, 5);
    const result = await retry.forward({ question: "test" });
    expect(result.get("answer")).toBe("success");
    expect(attempt).toBe(3);
  });

  it("throws after maxAttempts exhausted", async () => {
    const inner = new (class extends Module {
      async forward(): Promise<Prediction> {
        throw new AssertionError("always fails");
      }
    })();

    const retry = new Retry(inner, 2);
    await expect(retry.forward({ question: "test" })).rejects.toThrow(AssertionError);
    await expect(retry.forward({ question: "test" })).rejects.toThrow("always fails");
  });

  it("non-AssertionError passes through immediately", async () => {
    const inner = new (class extends Module {
      async forward(): Promise<Prediction> {
        throw new TypeError("unexpected error");
      }
    })();

    const retry = new Retry(inner, 5);
    await expect(retry.forward({ question: "test" })).rejects.toThrow(TypeError);
    await expect(retry.forward({ question: "test" })).rejects.toThrow("unexpected error");
  });

  it("injects feedback into inputs on retry", async () => {
    const receivedFeedback: (string | undefined)[] = [];
    let attempt = 0;

    const inner = new (class extends Module {
      async forward(inputs: Record<string, unknown>): Promise<Prediction> {
        receivedFeedback.push(inputs["feedback"] as string | undefined);
        attempt++;
        if (attempt < 2) {
          throw new AssertionError("bad output");
        }
        return new Prediction({ answer: "ok" });
      }
    })();

    const retry = new Retry(inner, 3);
    await retry.forward({ question: "test" });

    // First attempt should have no feedback
    expect(receivedFeedback[0]).toBeUndefined();
    // Second attempt should have feedback from the error message
    expect(receivedFeedback[1]).toBe("bad output");
  });
});
