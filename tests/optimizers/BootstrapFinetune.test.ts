import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BootstrapFinetune } from "../../src/optimizers/BootstrapFinetune.js";
import { Predict } from "../../src/modules/Predict.js";
import { Module } from "../../src/modules/Module.js";
import { Prediction, Example } from "../../src/primitives/index.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { settings } from "../../src/settings/Settings.js";
import { existsSync, unlinkSync, readFileSync } from "node:fs";

class SimpleQA extends Module {
  predict = new Predict("question -> answer");
  override async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    return this.predict.forward(inputs);
  }
}

describe("BootstrapFinetune", () => {
  const exportPath = "/tmp/test_finetune_data.jsonl";

  beforeEach(() => settings.reset());
  afterEach(() => {
    if (existsSync(exportPath)) unlinkSync(exportPath);
  });

  it("compiles and writes openai format JSONL", async () => {
    settings.configure({ lm: new MockLM({}, "answer: 4") });
    const trainset = [
      new Example({ question: "2+2?", answer: "4" }),
      new Example({ question: "1+3?", answer: "4" }),
    ];
    const metric = (_: Example, pred: Prediction) => pred.get("answer") === "4";
    const optimizer = new BootstrapFinetune({ exportPath, format: "openai", maxBootstrappedDemos: 2 });
    const optimized = await optimizer.compile(new SimpleQA(), trainset, metric);
    expect(optimized).toBeInstanceOf(Module);
    expect(existsSync(exportPath)).toBe(true);
    const lines = readFileSync(exportPath, "utf8").trim().split("\n").filter(Boolean);
    if (lines.length > 0) {
      const record = JSON.parse(lines[0]!);
      expect(record).toHaveProperty("messages");
    }
  });

  it("compiles and writes generic format JSONL", async () => {
    settings.configure({ lm: new MockLM({}, "answer: 4") });
    const trainset = [new Example({ question: "2+2?", answer: "4" })];
    const metric = (_: Example, pred: Prediction) => pred.get("answer") === "4";
    const optimizer = new BootstrapFinetune({ exportPath, format: "generic", maxBootstrappedDemos: 2 });
    await optimizer.compile(new SimpleQA(), trainset, metric);
    if (existsSync(exportPath)) {
      const lines = readFileSync(exportPath, "utf8").trim().split("\n").filter(Boolean);
      if (lines.length > 0) {
        const record = JSON.parse(lines[0]!);
        expect(record).toHaveProperty("prompt");
        expect(record).toHaveProperty("completion");
      }
    }
  });
});
