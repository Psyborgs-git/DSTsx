import { describe, it, expect, beforeEach } from "vitest";
import { Citations } from "../../src/modules/Citations.js";
import { Document } from "../../src/primitives/Document.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { settings } from "../../src/settings/Settings.js";
import { Prediction } from "../../src/primitives/Prediction.js";

describe("Citations (stable core)", () => {
  beforeEach(() => {
    settings.configure({ lm: new MockLM({}, "answer: Paris\ncitations: [0]") });
  });

  it("extends Module and has a forward() method", () => {
    const c = new Citations();
    expect(typeof c.forward).toBe("function");
  });

  it("forward() returns a Prediction", async () => {
    const c = new Citations();
    const result = await c.forward({
      context: "Paris is the capital of France.",
      question: "What is the capital of France?",
    });
    expect(result).toBeInstanceOf(Prediction);
  });

  it("accepts a string context", async () => {
    const c = new Citations();
    const result = await c.forward({
      context: "Rome is the capital of Italy.",
      question: "What is the capital of Italy?",
    });
    expect(result).toBeInstanceOf(Prediction);
  });

  it("accepts an array of Document objects as context", async () => {
    const docs = [
      new Document({ body: "Paris is the capital of France." }),
      new Document({ body: "Berlin is the capital of Germany." }),
    ];
    const c = new Citations();
    const result = await c.forward({ context: docs, question: "Capital of France?" });
    expect(result).toBeInstanceOf(Prediction);
  });

  it("is exported from the stable modules index", async () => {
    const mod = await import("../../src/modules/index.js");
    expect(typeof (mod as any).Citations).toBe("function");
  });

  it("is accessible from the experimental index (backward compat)", async () => {
    const mod = await import("../../src/experimental/index.js");
    expect(typeof (mod as any).Citations).toBe("function");
  });

  it("Document is accessible from the experimental index (backward compat)", async () => {
    const mod = await import("../../src/experimental/index.js");
    expect(typeof (mod as any).Document).toBe("function");
  });
});
