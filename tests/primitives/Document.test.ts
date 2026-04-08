import { describe, it, expect } from "vitest";
import { Document } from "../../src/primitives/Document.js";
import { DocumentRetriever } from "../../src/retrieve/backends/DocumentRetriever.js";

// ─── Document ────────────────────────────────────────────────────────────────

describe("Document (stable core)", () => {
  it("constructs with body only", () => {
    const doc = new Document({ body: "Hello world" });
    expect(doc.body).toBe("Hello world");
    expect(doc.title).toBeUndefined();
    expect(doc.metadata).toBeUndefined();
  });

  it("constructs with title and metadata", () => {
    const doc = new Document({
      title: "My Doc",
      body: "Content here",
      metadata: { source: "web" },
    });
    expect(doc.title).toBe("My Doc");
    expect(doc.metadata).toEqual({ source: "web" });
  });

  it("toString() without title returns body", () => {
    const doc = new Document({ body: "Just the body" });
    expect(doc.toString()).toBe("Just the body");
  });

  it("toString() with title prepends title + blank line", () => {
    const doc = new Document({ title: "Title", body: "Body text" });
    expect(doc.toString()).toBe("Title\n\nBody text");
  });

  it("toJSON() serialises correctly", () => {
    const doc = new Document({ title: "T", body: "B", metadata: { k: 1 } });
    expect(doc.toJSON()).toEqual({ title: "T", body: "B", metadata: { k: 1 } });
  });

  it("is exported from the stable primitives index", async () => {
    const mod = await import("../../src/primitives/index.js");
    expect(typeof mod.Document).toBe("function");
  });

  it("is accessible via the main barrel", async () => {
    const mod = await import("../../src/index.js");
    expect(typeof (mod as any).Document).toBe("function");
  });
});

// ─── DocumentRetriever ───────────────────────────────────────────────────────

describe("DocumentRetriever", () => {
  const docs = [
    new Document({ title: "TypeScript", body: "TypeScript is a typed superset of JavaScript." }),
    new Document({ title: "Python",     body: "Python is a dynamic programming language." }),
    new Document({ title: "Go",         body: "Go is a statically typed compiled language." }),
  ];

  it("returns empty array when corpus is empty", async () => {
    const rm = new DocumentRetriever();
    expect(await rm.retrieve("query", 3)).toEqual([]);
  });

  it("returns documents ranked by query term overlap", async () => {
    const rm = new DocumentRetriever({ documents: docs });
    const results = await rm.retrieve("typed language", 2);
    // Both TypeScript and Go mention "typed" — should be top-2
    expect(results.length).toBe(2);
    expect(results.some((r) => r.includes("TypeScript"))).toBe(true);
    expect(results.some((r) => r.includes("Go"))).toBe(true);
  });

  it("returns at most k results", async () => {
    const rm = new DocumentRetriever({ documents: docs });
    const results = await rm.retrieve("language", 1);
    expect(results).toHaveLength(1);
  });

  it("returns string representations via toString()", async () => {
    const rm = new DocumentRetriever({ documents: docs });
    const results = await rm.retrieve("Python dynamic", 1);
    // Top result should be the Python doc
    expect(results[0]).toContain("Python");
    expect(results[0]).toContain("dynamic");
  });

  it("addDocuments() appends to the corpus", async () => {
    const rm = new DocumentRetriever({ documents: docs });
    rm.addDocuments([new Document({ body: "Rust is a systems programming language." })]);
    const results = await rm.retrieve("Rust systems", 1);
    expect(results[0]).toContain("Rust");
  });

  it("setDocuments() replaces the corpus", async () => {
    const rm = new DocumentRetriever({ documents: docs });
    rm.setDocuments([new Document({ body: "Only this doc now." })]);
    expect(rm.documents).toHaveLength(1);
    const results = await rm.retrieve("doc", 1);
    expect(results[0]).toContain("Only this doc now");
  });

  it("retrieveDocuments() returns Document objects", async () => {
    const rm = new DocumentRetriever({ documents: docs });
    const result = await rm.retrieveDocuments("Python", 1);
    expect(result[0]).toBeInstanceOf(Document);
    expect(result[0]!.title).toBe("Python");
  });

  it("searchField 'title' searches titles", async () => {
    const rm = new DocumentRetriever({ documents: docs, searchField: "title" });
    const results = await rm.retrieve("Go", 1);
    expect(results[0]).toContain("Go");
  });

  it("searchField 'all' searches title + body", async () => {
    const rm = new DocumentRetriever({ documents: docs, searchField: "all" });
    const results = await rm.retrieve("Python dynamic", 1);
    expect(results[0]).toContain("Python");
  });

  it("empty query returns first-k documents", async () => {
    const rm = new DocumentRetriever({ documents: docs });
    const results = await rm.retrieve("", 2);
    expect(results).toHaveLength(2);
  });

  it("is exported from retrieve backends index", async () => {
    const mod = await import("../../src/retrieve/backends/index.js");
    expect(typeof mod.DocumentRetriever).toBe("function");
  });
});
