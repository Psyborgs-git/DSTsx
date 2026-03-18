import { describe, it, expect, beforeEach } from "vitest";
import { RLM } from "../../src/modules/RLM.js";
import { Predict } from "../../src/modules/Predict.js";
import { Prediction } from "../../src/primitives/Prediction.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { settings } from "../../src/settings/Settings.js";

describe("RLM", () => {
  beforeEach(() => settings.reset());

  it("returns a prediction from k samples", async () => {
    settings.configure({ lm: new MockLM({}, "answer: 42") });

    const inner = new Predict("question -> answer");
    const rewardFn = (pred: Prediction) => {
      return String(pred.get("answer") ?? "") === "42" ? 1.0 : 0.0;
    };

    const rlm = new RLM(inner, rewardFn, 3);
    const result = await rlm.forward({ question: "test" });
    expect(result.get("answer")).toBe("42");
  });

  it("reset() clears statistics", () => {
    const inner = new Predict("q -> a");
    const rlm = new RLM(inner, () => 0.5);
    rlm.reset(); // should not throw
  });
});
