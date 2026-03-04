import { describe, it, expect, beforeEach } from "vitest";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { settings } from "../../src/settings/Settings.js";
import { Predict } from "../../src/modules/Predict.js";

describe("LM Streaming", () => {
  beforeEach(() => settings.reset());

  it("base LM.stream() yields a single chunk with done=true", async () => {
    const lm = new MockLM({}, "hello world");
    const chunks: import("../../src/lm/types.js").StreamChunk[] = [];
    for await (const chunk of lm.stream("hello")) {
      chunks.push(chunk);
    }
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.delta).toBe("hello world");
    expect(chunks[0]?.done).toBe(true);
  });

  it("Predict.stream() yields chunks from the LM", async () => {
    settings.configure({ lm: new MockLM({}, "answer: Paris") });
    const predict = new Predict("question -> answer");
    const chunks: import("../../src/lm/types.js").StreamChunk[] = [];
    for await (const chunk of predict.stream({ question: "Capital of France?" })) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.at(-1)?.done).toBe(true);
  });

  it("Predict.stream() throws when no LM is configured", async () => {
    const predict = new Predict("question -> answer");
    const gen = predict.stream({ question: "q" });
    await expect(gen.next()).rejects.toThrow(/No LM configured/);
  });
});
