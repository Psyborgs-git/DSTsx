import { describe, it, expect, beforeEach } from "vitest";
import { Ensemble } from "../../src/modules/Ensemble.js";
import { Module } from "../../src/modules/Module.js";
import { Prediction } from "../../src/primitives/Prediction.js";
import { Predict } from "../../src/modules/Predict.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { settings } from "../../src/settings/Settings.js";

describe("Ensemble", () => {
  beforeEach(() => settings.reset());

  it("runs all modules and returns reduced result", async () => {
    const moduleA = new (class extends Module {
      async forward(): Promise<Prediction> {
        return new Prediction({ answer: "A" });
      }
    })();
    const moduleB = new (class extends Module {
      async forward(): Promise<Prediction> {
        return new Prediction({ answer: "B" });
      }
    })();

    const ensemble = new Ensemble([moduleA, moduleB]);
    const result = await ensemble.forward({});
    // Default reduce returns first result
    expect(result.get("answer")).toBe("A");
  });

  it("default reduceFunc returns first result", async () => {
    const modules = [1, 2, 3].map(
      (i) =>
        new (class extends Module {
          async forward(): Promise<Prediction> {
            return new Prediction({ value: i });
          }
        })(),
    );

    const ensemble = new Ensemble(modules);
    const result = await ensemble.forward({});
    expect(result.get("value")).toBe(1);
  });

  it("uses custom reduce function", async () => {
    const modules = [10, 20, 30].map(
      (score) =>
        new (class extends Module {
          async forward(): Promise<Prediction> {
            return new Prediction({ score });
          }
        })(),
    );

    const pickMax = (preds: Prediction[]) =>
      preds.reduce((best, curr) =>
        (curr.get("score") as number) > (best.get("score") as number) ? curr : best,
      );

    const ensemble = new Ensemble(modules, pickMax);
    const result = await ensemble.forward({});
    expect(result.get("score")).toBe(30);
  });

  it("works with real Predict modules", async () => {
    settings.configure({ lm: new MockLM({}, "answer: 42") });
    const modules = [
      new Predict("question -> answer"),
      new Predict("question -> answer"),
    ];
    const ensemble = new Ensemble(modules);
    const result = await ensemble.forward({ question: "What is 6*7?" });
    expect(result.get("answer")).toBe("42");
  });
});
