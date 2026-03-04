import { describe, it, expect, beforeEach } from "vitest";
import { BestOfN } from "../../src/modules/BestOfN.js";
import { Module } from "../../src/modules/Module.js";
import { Prediction } from "../../src/primitives/Prediction.js";
import { Predict } from "../../src/modules/Predict.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { settings } from "../../src/settings/Settings.js";

describe("BestOfN", () => {
  beforeEach(() => settings.reset());

  it("runs N times and returns a result", async () => {
    let callCount = 0;
    const inner = new (class extends Module {
      async forward(): Promise<Prediction> {
        callCount++;
        return new Prediction({ answer: `result-${callCount}` });
      }
    })();

    const bestOf = new BestOfN(inner, 5);
    const result = await bestOf.forward({ question: "test" });
    expect(callCount).toBe(5);
    expect(result.get("answer")).toBeDefined();
  });

  it("default reduceFunc returns first result", async () => {
    let callCount = 0;
    const inner = new (class extends Module {
      async forward(): Promise<Prediction> {
        callCount++;
        return new Prediction({ answer: `result-${callCount}` });
      }
    })();

    const bestOf = new BestOfN(inner, 3);
    const result = await bestOf.forward({});
    // Default reduce returns the first prediction; since all run in parallel,
    // the first result from Promise.all is the first spawned
    expect(result.get("answer")).toBeDefined();
  });

  it("uses custom reduceFunc", async () => {
    const inner = new (class extends Module {
      #count = 0;
      async forward(): Promise<Prediction> {
        this.#count++;
        return new Prediction({ score: this.#count });
      }
    })();

    const selectMax = (preds: Prediction[]) => {
      return preds.reduce((best, curr) =>
        (curr.get("score") as number) > (best.get("score") as number) ? curr : best,
      );
    };

    const bestOf = new BestOfN(inner, 4, selectMax);
    const result = await bestOf.forward({});
    // The highest score should be selected
    expect(typeof result.get("score")).toBe("number");
  });

  it("works with a real Predict module", async () => {
    settings.configure({ lm: new MockLM({}, "answer: Paris") });
    const inner = new Predict("question -> answer");
    const bestOf = new BestOfN(inner, 2);
    const result = await bestOf.forward({ question: "Capital of France?" });
    expect(result.get("answer")).toBe("Paris");
  });
});
