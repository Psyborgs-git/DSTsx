import { describe, it, expect } from "vitest";
import { ChatAdapter } from "../../src/adapters/ChatAdapter.js";
import { Signature } from "../../src/signatures/Signature.js";
import { Example } from "../../src/primitives/Example.js";

describe("ChatAdapter", () => {
  const adapter = new ChatAdapter();

  it("format() produces messages with system + user turns", () => {
    const sig = Signature.from("question -> answer", "Be concise.");
    const messages = adapter.format(sig, [], { question: "What is 2+2?" });

    expect(messages.length).toBeGreaterThanOrEqual(2);
    expect(messages[0]!.role).toBe("system");
    expect(messages[0]!.content).toContain("Be concise");
    expect(messages.at(-1)!.role).toBe("user");
    expect(messages.at(-1)!.content).toContain("What is 2+2?");
  });

  it("format() includes demos as user/assistant pairs", () => {
    const sig = Signature.from("question -> answer");
    const demos = [new Example({ question: "1+1?", answer: "2" })];
    const messages = adapter.format(sig, demos, { question: "2+2?" });

    const assistantMsgs = messages.filter((m) => m.role === "assistant");
    expect(assistantMsgs.length).toBeGreaterThanOrEqual(1);
    expect(assistantMsgs[0]!.content).toContain("2");
  });

  it("parse() extracts field values from text", () => {
    const sig = Signature.from("question -> answer");
    const result = adapter.parse(sig, "answer: Paris");
    expect(result["answer"]).toBe("Paris");
  });

  it("parse() falls back to full text for single output", () => {
    const sig = Signature.from("question -> answer");
    const result = adapter.parse(sig, "Just Paris");
    expect(result["answer"]).toBe("Just Paris");
  });

  it("parse() handles markdown formatting", () => {
    const sig = Signature.from("question -> answer");
    const result = adapter.parse(sig, "**answer:** Paris");
    expect(result["answer"]).toBe("Paris");
  });
});
