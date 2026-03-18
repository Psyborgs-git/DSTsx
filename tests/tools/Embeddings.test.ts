import { describe, it, expect } from "vitest";
import { Embeddings } from "../../src/tools/Embeddings.js";

describe("Embeddings", () => {
  // Simple mock embedding function
  const mockEmbedFn = async (texts: string[]): Promise<number[][]> => {
    return texts.map((t) => {
      // Simple hash-based mock embeddings
      const hash = [...t].reduce((acc, c) => acc + c.charCodeAt(0), 0);
      return [Math.sin(hash), Math.cos(hash), hash / 1000];
    });
  };

  it("add and search returns results", async () => {
    const embeddings = new Embeddings({ embedFn: mockEmbedFn });
    await embeddings.add(["hello world", "goodbye world", "hello there"]);
    const results = await embeddings.search("hello", 2);
    expect(results).toHaveLength(2);
  });

  it("clear removes all embeddings", async () => {
    const embeddings = new Embeddings({ embedFn: mockEmbedFn });
    await embeddings.add(["test"]);
    embeddings.clear();
    const results = await embeddings.search("test", 1);
    expect(results).toHaveLength(0);
  });

  it("asRetriever returns a retriever-compatible object", async () => {
    const embeddings = new Embeddings({ embedFn: mockEmbedFn });
    await embeddings.add(["test passage"]);
    const retriever = embeddings.asRetriever();
    const results = await retriever.retrieve("test", 1);
    expect(results).toHaveLength(1);
  });
});
