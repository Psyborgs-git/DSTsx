import { describe, it, expect, beforeAll } from "vitest";
import { EmbeddingRetriever } from "../../src/retrieve/backends/EmbeddingRetriever.js";
import { Embedder } from "../../src/models/Embedder.js";

/** Simple deterministic embedder using character frequency as embedding. */
function makeTestEmbedder(): Embedder {
  const fn = async (texts: string[]): Promise<number[][]> => {
    return texts.map((text) => {
      // 26-dim vector: count of each lowercase letter
      const vec = new Array<number>(26).fill(0);
      for (const ch of text.toLowerCase()) {
        const idx = ch.charCodeAt(0) - 97;
        if (idx >= 0 && idx < 26) vec[idx] = (vec[idx] ?? 0) + 1;
      }
      return vec;
    });
  };
  return new Embedder({ provider: "custom", model: "test", fn });
}

const passages = [
  "Paris is the capital of France.",
  "Rome is the capital of Italy.",
  "Berlin is the capital of Germany.",
  "Madrid is the capital of Spain.",
  "Tokyo is the capital of Japan.",
];

describe("EmbeddingRetriever", () => {
  let retriever: EmbeddingRetriever;

  beforeAll(() => {
    retriever = new EmbeddingRetriever({
      embedder: makeTestEmbedder(),
      passages,
    });
  });

  it("retrieves k passages", async () => {
    const results = await retriever.retrieve("france", 2);
    expect(results).toHaveLength(2);
  });

  it("returns passages as strings", async () => {
    const results = await retriever.retrieve("rome", 1);
    expect(typeof results[0]).toBe("string");
  });

  it("returns empty array for empty corpus", async () => {
    const empty = new EmbeddingRetriever({ embedder: makeTestEmbedder() });
    const results = await empty.retrieve("france", 3);
    expect(results).toHaveLength(0);
  });

  it("addPassages() extends the corpus", async () => {
    const r = new EmbeddingRetriever({ embedder: makeTestEmbedder(), passages: ["Paris"] });
    r.addPassages(["Rome is in Italy."]);
    const results = await r.retrieve("rome", 2);
    expect(results).toHaveLength(2);
  });

  it("setPassages() replaces the corpus", async () => {
    const r = new EmbeddingRetriever({ embedder: makeTestEmbedder(), passages: ["old content"] });
    r.setPassages(["new content", "other new content"]);
    const results = await r.retrieve("new", 2);
    expect(results).toHaveLength(2);
  });

  it("respects k limit", async () => {
    const results = await retriever.retrieve("capital", 1);
    expect(results).toHaveLength(1);
  });

  it("returns at most k passages even if corpus has more", async () => {
    const results = await retriever.retrieve("capital", 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });
});
