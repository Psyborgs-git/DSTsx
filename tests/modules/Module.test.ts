import { describe, it, expect, beforeEach } from "vitest";
import { Module } from "../../src/modules/Module.js";
import { Predict } from "../../src/modules/Predict.js";
import { Prediction } from "../../src/primitives/Prediction.js";
import { Example } from "../../src/primitives/Example.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { settings } from "../../src/settings/Settings.js";

class SimpleQA extends Module {
  predict = new Predict("question -> answer");
  async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    return this.predict.forward(inputs);
  }
}

class NestedQA extends Module {
  inner = new SimpleQA();
  async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    return this.inner.forward(inputs);
  }
}

describe("Module.clone()", () => {
  beforeEach(() => settings.reset());

  it("returns a different object", () => {
    const mod = new SimpleQA();
    const clone = mod.clone();
    expect(clone).not.toBe(mod);
  });

  it("clones are independent — mutating demos on clone does not affect original", () => {
    const mod = new SimpleQA();
    const demo = new Example({ question: "q", answer: "a" });
    const clone = mod.clone();

    // Mutate the clone's demos
    clone.predict.demos = [demo];

    // Original must be unchanged
    expect(mod.predict.demos).toHaveLength(0);
  });

  it("deep-clones nested modules", () => {
    const mod = new NestedQA();
    const demo = new Example({ question: "q", answer: "a" });
    const clone = mod.clone();

    clone.inner.predict.demos = [demo];

    expect(mod.inner.predict.demos).toHaveLength(0);
  });

  it("preserves the prototype chain", () => {
    const mod = new SimpleQA();
    const clone = mod.clone();
    expect(clone).toBeInstanceOf(SimpleQA);
    expect(clone).toBeInstanceOf(Module);
  });

  it("namedPredictors() on clone returns cloned instances", () => {
    const mod = new SimpleQA();
    const clone = mod.clone();
    const modPreds = mod.namedPredictors().map(([, p]) => p);
    const clonePreds = clone.namedPredictors().map(([, p]) => p);
    for (const cp of clonePreds) {
      expect(modPreds).not.toContain(cp);
    }
  });
});
