import { describe, it, expect } from "vitest";
import { JSONAdapter } from "../../src/adapters/JSONAdapter.js";
import { Signature } from "../../src/signatures/Signature.js";

describe("JSONAdapter", () => {
  const adapter = new JSONAdapter();

  it("format() includes JSON schema in system prompt", () => {
    const sig = Signature.from("question -> answer");
    const messages = adapter.format(sig, [], { question: "test" });

    const system = messages.find((m) => m.role === "system");
    expect(system).toBeDefined();
    expect(system!.content).toContain("JSON");
  });

  it("parse() extracts from JSON response", () => {
    const sig = Signature.from("question -> answer");
    const result = adapter.parse(sig, '{"answer": "Paris"}');
    expect(result["answer"]).toBe("Paris");
  });

  it("parse() handles markdown-fenced JSON", () => {
    const sig = Signature.from("question -> answer");
    const result = adapter.parse(sig, '```json\n{"answer": "Paris"}\n```');
    expect(result["answer"]).toBe("Paris");
  });

  it("parse() throws on invalid JSON", () => {
    const sig = Signature.from("question -> answer");
    expect(() => adapter.parse(sig, "not json")).toThrow();
  });
});
