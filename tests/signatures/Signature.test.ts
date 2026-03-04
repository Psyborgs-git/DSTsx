import { describe, it, expect } from "vitest";
import { Signature } from "../../src/signatures/Signature.js";
import { InputField, OutputField } from "../../src/signatures/Field.js";

describe("Signature", () => {
  describe("from() — shorthand parser", () => {
    it("parses a simple shorthand signature", () => {
      const sig = Signature.from("question -> answer");
      expect([...sig.inputs.keys()]).toEqual(["question"]);
      expect([...sig.outputs.keys()]).toEqual(["answer"]);
    });

    it("parses multiple inputs and outputs", () => {
      const sig = Signature.from("context, question -> answer, confidence");
      expect([...sig.inputs.keys()]).toEqual(["context", "question"]);
      expect([...sig.outputs.keys()]).toEqual(["answer", "confidence"]);
    });

    it("marks optional fields", () => {
      const sig = Signature.from("question, hint? -> answer");
      expect(sig.inputs.get("hint")?.optional).toBe(true);
      expect(sig.inputs.get("question")?.optional).toBeUndefined();
    });

    it("throws on missing -> separator", () => {
      expect(() => Signature.from("question")).toThrow(/Invalid signature/);
    });

    it("stores instructions", () => {
      const sig = Signature.from("q -> a", "Answer concisely.");
      expect(sig.instructions).toBe("Answer concisely.");
    });
  });

  describe("with()", () => {
    it("returns a new Signature with overridden instructions", () => {
      const original = Signature.from("q -> a");
      const updated = original.with({ instructions: "Be brief." });
      expect(updated.instructions).toBe("Be brief.");
      expect(original.instructions).toBeUndefined();
    });
  });

  describe("withInput() / withOutput()", () => {
    it("appends an input field", () => {
      const sig = Signature.from("q -> a").withInput("context");
      expect(sig.inputs.has("context")).toBe(true);
    });

    it("appends an output field", () => {
      const sig = Signature.from("q -> a").withOutput("confidence");
      expect(sig.outputs.has("confidence")).toBe(true);
    });
  });

  describe("toJSON() / fromJSON()", () => {
    it("round-trips through JSON", () => {
      const original = Signature.from("question -> answer", "Be brief.");
      const json = original.toJSON() as Record<string, unknown>;
      const restored = Signature.fromJSON(json);
      expect([...restored.inputs.keys()]).toEqual([...original.inputs.keys()]);
      expect([...restored.outputs.keys()]).toEqual([...original.outputs.keys()]);
      expect(restored.instructions).toBe(original.instructions);
    });
  });

  describe("InputField / OutputField", () => {
    it("creates field metadata with defaults", () => {
      const field = InputField({ description: "The question" });
      expect(field.type).toBe("string");
      expect(field.description).toBe("The question");
    });

    it("OutputField merges provided meta", () => {
      const field = OutputField({ type: "number", optional: true });
      expect(field.type).toBe("number");
      expect(field.optional).toBe(true);
    });
  });
});
