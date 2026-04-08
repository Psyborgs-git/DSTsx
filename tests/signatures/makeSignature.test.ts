import { describe, it, expect } from "vitest";
import { Signature } from "../../src/signatures/Signature.js";
import { makeSignature } from "../../src/signatures/makeSignature.js";

describe("Signature.append()", () => {
  it("appends an output field", () => {
    const sig = Signature.from("question -> answer");
    const sig2 = sig.append("reasoning", { description: "step-by-step reasoning" }, "output");
    expect(sig2.outputs.has("reasoning")).toBe(true);
    expect(sig2.outputs.get("reasoning")?.description).toBe("step-by-step reasoning");
  });

  it("appends an input field", () => {
    const sig = Signature.from("question -> answer");
    const sig2 = sig.append("context", { description: "Relevant context" }, "input");
    expect(sig2.inputs.has("context")).toBe(true);
    expect(sig2.inputs.has("question")).toBe(true); // original preserved
  });

  it("defaults to output direction", () => {
    const sig = Signature.from("question -> answer");
    const sig2 = sig.append("confidence");
    expect(sig2.outputs.has("confidence")).toBe(true);
  });

  it("returns a new Signature (immutable)", () => {
    const sig = Signature.from("question -> answer");
    const sig2 = sig.append("reasoning");
    expect(sig).not.toBe(sig2);
    expect(sig.outputs.has("reasoning")).toBe(false); // original unchanged
  });
});

describe("Signature.delete()", () => {
  it("deletes an output field", () => {
    const sig = Signature.from("question -> answer, reasoning");
    const sig2 = sig.delete("reasoning");
    expect(sig2.outputs.has("reasoning")).toBe(false);
    expect(sig2.outputs.has("answer")).toBe(true);
  });

  it("deletes an input field", () => {
    const sig = Signature.from("context, question -> answer");
    const sig2 = sig.delete("context");
    expect(sig2.inputs.has("context")).toBe(false);
    expect(sig2.inputs.has("question")).toBe(true);
  });

  it("returns a new Signature (immutable)", () => {
    const sig = Signature.from("question -> answer");
    const sig2 = sig.delete("answer");
    expect(sig).not.toBe(sig2);
    expect(sig.outputs.has("answer")).toBe(true); // original preserved
  });

  it("throws for unknown field", () => {
    const sig = Signature.from("question -> answer");
    expect(() => sig.delete("nonexistent")).toThrow(/field "nonexistent" not found/);
  });
});

describe("makeSignature()", () => {
  it("creates a Signature from simple direction strings", () => {
    const sig = makeSignature({
      context: "input",
      question: "input",
      answer: "output",
    });
    expect(sig.inputs.has("context")).toBe(true);
    expect(sig.inputs.has("question")).toBe(true);
    expect(sig.outputs.has("answer")).toBe(true);
  });

  it("accepts metadata via object spec", () => {
    const sig = makeSignature({
      question: { direction: "input", meta: { description: "The user question" } },
      answer: { direction: "output", meta: { description: "Concise answer" } },
    });
    expect(sig.inputs.get("question")?.description).toBe("The user question");
    expect(sig.outputs.get("answer")?.description).toBe("Concise answer");
  });

  it("supports custom instructions", () => {
    const sig = makeSignature(
      { question: "input", answer: "output" },
      "Answer briefly.",
    );
    expect(sig.instructions).toBe("Answer briefly.");
  });

  it("produces equivalent Signatures to Signature.from()", () => {
    const fromStr = Signature.from("question -> answer");
    const fromMake = makeSignature({ question: "input", answer: "output" });
    expect([...fromStr.inputs.keys()]).toEqual([...fromMake.inputs.keys()]);
    expect([...fromStr.outputs.keys()]).toEqual([...fromMake.outputs.keys()]);
  });
});
