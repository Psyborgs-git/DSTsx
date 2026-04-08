import { describe, it, expect, beforeAll } from "vitest";
import { MajorityVoting } from "../../src/modules/MajorityVoting.js";
import { Module } from "../../src/modules/Module.js";
import { Prediction } from "../../src/primitives/Prediction.js";
import { settings } from "../../src/settings/Settings.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { Predict } from "../../src/modules/Predict.js";

describe("MajorityVoting", () => {
  beforeAll(() => {
    // MockLM that alternates between answers
    let callIdx = 0;
    const responses = ["Paris", "Paris", "London", "Paris", "London"];
    settings.configure({
      lm: new MockLM(responses.map((r) => `answer: ${r}`)),
    });
  });

  it("constructs with default options", () => {
    const predict = new Predict("question -> answer");
    const mv = new MajorityVoting(predict);
    expect(mv.n).toBe(5);
    expect(mv.field).toBe("answer");
  });

  it("constructs with custom options", () => {
    const predict = new Predict("question -> answer");
    const mv = new MajorityVoting(predict, { n: 3, field: "answer" });
    expect(mv.n).toBe(3);
    expect(mv.field).toBe("answer");
  });

  it("returns a Prediction from forward()", async () => {
    class CounterModule extends Module {
      responses = ["a", "b", "a", "a", "b"];
      idx = 0;
      async forward(_inputs: Record<string, unknown>): Promise<Prediction> {
        const val = this.responses[this.idx++ % this.responses.length]!;
        return new Prediction({ answer: val });
      }
    }

    const mv = new MajorityVoting(new CounterModule(), { n: 5, field: "answer" });
    const result = await mv.forward({});
    // "a" appears 3 times, "b" appears 2 times → majority is "a"
    expect(result.get("answer")).toBe("a");
  });

  it("is a Module (duck typing)", () => {
    const predict = new Predict("question -> answer");
    const mv = new MajorityVoting(predict, { n: 3 });
    expect(typeof mv.forward).toBe("function");
    expect(typeof mv.namedPredictors).toBe("function");
  });
});
