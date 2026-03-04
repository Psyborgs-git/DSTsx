import { describe, it, expect, beforeEach } from "vitest";
import { evaluate } from "../../src/evaluate/evaluate.js";
import { Example } from "../../src/primitives/Example.js";
import { Module } from "../../src/modules/Module.js";
import { Prediction } from "../../src/primitives/Prediction.js";
import { exactMatch, f1, bleu, rouge } from "../../src/evaluate/metrics.js";
import { settings } from "../../src/settings/Settings.js";

class EchoModule extends Module {
  async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    return new Prediction({ answer: String(inputs["answer"] ?? "") });
  }
}

describe("evaluate()", () => {
  beforeEach(() => settings.reset());

  it("returns 1.0 when all predictions are correct", async () => {
    const devset = [
      new Example({ question: "a", answer: "yes" }),
      new Example({ question: "b", answer: "yes" }),
    ];
    const result = await evaluate(new EchoModule(), devset, exactMatch());
    expect(result.score).toBe(1);
    expect(result.numPassed).toBe(2);
  });

  it("returns 0 when no predictions are correct", async () => {
    const devset = [new Example({ question: "a", answer: "no" })];
    // EchoModule returns answer=undefined → "undefined" !== "no"
    const mod = new Module() as unknown as Module;
    (mod as unknown as { forward: (...args: unknown[]) => Promise<Prediction> }).forward =
      async () => new Prediction({ answer: "wrong" });
    const result = await evaluate(mod, devset, exactMatch());
    expect(result.score).toBe(0);
  });

  it("parallelises when numThreads > 1", async () => {
    const devset = Array.from({ length: 6 }, (_, i) =>
      new Example({ answer: String(i) }),
    );
    const result = await evaluate(new EchoModule(), devset, exactMatch(), {
      numThreads: 3,
    });
    expect(result.total).toBe(6);
  });
});

describe("metrics", () => {
  const exYes = new Example({ answer: "yes" });
  const exHello = new Example({ answer: "hello world" });

  it("exactMatch — case-insensitive by default", () => {
    const metric = exactMatch();
    expect(metric(exYes, new Prediction({ answer: "YES" }))).toBe(true);
    expect(metric(exYes, new Prediction({ answer: "no" }))).toBe(false);
  });

  it("f1 — perfect overlap", () => {
    const metric = f1();
    expect(metric(exHello, new Prediction({ answer: "hello world" }))).toBe(1);
  });

  it("f1 — no overlap", () => {
    const metric = f1();
    expect(metric(exHello, new Prediction({ answer: "foo bar" }))).toBe(0);
  });

  it("bleu — identical strings give non-zero score", () => {
    const metric = bleu();
    const score = metric(exHello, new Prediction({ answer: "hello world" })) as number;
    expect(score).toBeGreaterThan(0);
  });

  it("rouge — identical strings give 1", () => {
    const metric = rouge();
    expect(metric(exHello, new Prediction({ answer: "hello world" }))).toBe(1);
  });
});
