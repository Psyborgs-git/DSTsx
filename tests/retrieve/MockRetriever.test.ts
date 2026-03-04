import { describe, it, expect } from "vitest";
import { MockRetriever } from "../../src/retrieve/backends/MockRetriever.js";

describe("MockRetriever", () => {
  const passages = [
    "The capital of France is Paris.",
    "TypeScript is a typed superset of JavaScript.",
    "Paris is known as the City of Light.",
    "The Eiffel Tower is in Paris, France.",
  ];

  it("returns matching passages (substring match)", async () => {
    const retriever = new MockRetriever(passages);
    const results = await retriever.retrieve("TypeScript", 10);
    expect(results).toEqual(["TypeScript is a typed superset of JavaScript."]);
  });

  it("performs case-insensitive matching", async () => {
    const retriever = new MockRetriever(passages);
    const results = await retriever.retrieve("paris", 10);
    expect(results).toHaveLength(3);
    expect(results).toContain("The capital of France is Paris.");
    expect(results).toContain("Paris is known as the City of Light.");
    expect(results).toContain("The Eiffel Tower is in Paris, France.");
  });

  it("returns first k passages when no match", async () => {
    const retriever = new MockRetriever(passages);
    const results = await retriever.retrieve("nonexistent-xyz", 2);
    expect(results).toEqual(passages.slice(0, 2));
  });

  it("respects k parameter", async () => {
    const retriever = new MockRetriever(passages);
    const results = await retriever.retrieve("paris", 2);
    expect(results).toHaveLength(2);
  });

  it("returns empty when k is 0", async () => {
    const retriever = new MockRetriever(passages);
    const results = await retriever.retrieve("paris", 0);
    expect(results).toHaveLength(0);
  });
});
