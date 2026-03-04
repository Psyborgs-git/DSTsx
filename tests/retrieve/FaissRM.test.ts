import { describe, it, expect } from "vitest";
import { FaissRM } from "../../src/retrieve/backends/FaissRM.js";

const passages = [
  "cats and kittens",
  "dogs and puppies",
  "typescript programming",
  "dspy language model",
];

// Simple bag-of-words embedding over a fixed vocabulary for deterministic tests.
const vocab = ["cats", "kittens", "dogs", "puppies", "typescript", "programming", "dspy", "language", "model"];

async function mockEmbed(text: string): Promise<number[]> {
  const lower = text.toLowerCase();
  return vocab.map((word) => (lower.includes(word) ? 1 : 0));
}

describe("FaissRM", () => {
  it("returns k passages", async () => {
    const rm = new FaissRM({ passages, embeddingFn: mockEmbed });
    const results = await rm.retrieve("typescript", 2);
    expect(results).toHaveLength(2);
  });

  it("retrieves the most relevant passage", async () => {
    const rm = new FaissRM({ passages, embeddingFn: mockEmbed });
    const results = await rm.retrieve("typescript programming", 1);
    expect(results[0]).toBe("typescript programming");
  });

  it("uses pre-computed embeddings when provided", async () => {
    let callCount = 0;
    const trackingEmbed = async (text: string) => {
      callCount++;
      return mockEmbed(text);
    };

    const precomputed = await Promise.all(passages.map(mockEmbed));
    const rm = new FaissRM({
      passages,
      embeddings: precomputed,
      embeddingFn: trackingEmbed,
    });

    await rm.retrieve("dogs", 1);
    // Only the query embedding should be computed (passages are pre-supplied)
    expect(callCount).toBe(1);
  });

  it("caches passage embeddings across multiple retrieve calls", async () => {
    let callCount = 0;
    const trackingEmbed = async (text: string) => {
      callCount++;
      return mockEmbed(text);
    };

    const rm = new FaissRM({ passages, embeddingFn: trackingEmbed });
    await rm.retrieve("cats", 1);
    const firstCallCount = callCount; // passages.length + 1 (query)
    await rm.retrieve("dogs", 1);

    // Second retrieve: only 1 more call for the new query (passages are cached)
    expect(callCount).toBe(firstCallCount + 1);
  });
});
