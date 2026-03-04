import { describe, it, expect, beforeEach } from "vitest";
import { Retrieve } from "../../src/modules/Retrieve.js";
import { MockRetriever } from "../../src/retrieve/backends/MockRetriever.js";
import { settings } from "../../src/settings/Settings.js";

describe("Retrieve", () => {
  beforeEach(() => settings.reset());

  it("throws if no retriever configured", async () => {
    const retrieve = new Retrieve();
    await expect(retrieve.forward("test query")).rejects.toThrow(/No retriever configured/);
  });

  it("returns passages from the configured retriever", async () => {
    const passages = [
      "Paris is the capital of France.",
      "Berlin is the capital of Germany.",
      "Madrid is the capital of Spain.",
    ];
    settings.configure({ rm: new MockRetriever(passages) });

    const retrieve = new Retrieve(3);
    const result = await retrieve.forward("Paris");
    const returned = result.get("passages") as string[];
    expect(Array.isArray(returned)).toBe(true);
    expect(returned.length).toBeGreaterThan(0);
    expect(returned[0]).toContain("Paris");
  });

  it("respects k parameter", async () => {
    const passages = [
      "Passage 1",
      "Passage 2",
      "Passage 3",
      "Passage 4",
      "Passage 5",
    ];
    settings.configure({ rm: new MockRetriever(passages) });

    const retrieve = new Retrieve(2);
    const result = await retrieve.forward("anything");
    const returned = result.get("passages") as string[];
    expect(returned.length).toBeLessThanOrEqual(2);
  });

  it("default k is 3", () => {
    const retrieve = new Retrieve();
    expect(retrieve.k).toBe(3);
  });

  it("includes query in prediction output", async () => {
    settings.configure({
      rm: new MockRetriever(["some passage"]),
    });
    const retrieve = new Retrieve(1);
    const result = await retrieve.forward("my query");
    expect(result.get("query")).toBe("my query");
  });
});
