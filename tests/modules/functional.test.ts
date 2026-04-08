import { describe, it, expect, beforeAll } from "vitest";
import { functional, FunctionalModule } from "../../src/modules/functional.js";
import { Prediction } from "../../src/primitives/Prediction.js";
import { settings } from "../../src/settings/Settings.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";

describe("functional()", () => {
  it("returns a FunctionalModule", () => {
    const f = functional((inputs) => ({ result: "ok" }));
    expect(f).toBeInstanceOf(FunctionalModule);
  });

  it("is a Module (has forward/namedPredictors)", () => {
    const f = functional((inputs) => ({}));
    expect(typeof f.forward).toBe("function");
    expect(typeof f.namedPredictors).toBe("function");
  });

  it("calls the user function when no signature provided", async () => {
    const f = functional(async (inputs) => ({ answer: "42" }));
    const result = await f.forward({});
    expect(result).toBeInstanceOf(Prediction);
    expect((result as Prediction).get("answer")).toBe("42");
  });

  it("wraps non-object return in result field", async () => {
    const f = functional(async () => "hello");
    const result = await f.forward({});
    expect((result as Prediction).get("result")).toBe("hello");
  });

  it("creates a Predict module when signature is provided", () => {
    const f = functional((_) => ({}), "question -> answer");
    expect(f.predict).toBeDefined();
  });

  it("uses Predict.forward() when signature is provided", async () => {
    settings.configure({ lm: new MockLM({}, "answer: 42") });
    const f = functional((_) => ({}), "question -> answer");
    const result = await f.forward({ question: "What is 6*7?" });
    expect(result).toBeInstanceOf(Prediction);
    expect((result as Prediction).get("answer")).toBe("42");
  });

  it("namedPredictors includes inner predict module when signature given", () => {
    const f = functional((_) => ({}), "question -> answer");
    const predictors = f.namedPredictors();
    expect(predictors.length).toBeGreaterThan(0);
  });
});
