import { describe, it, expect } from "vitest";
import { XMLAdapter } from "../../src/adapters/XMLAdapter.js";
import { Signature } from "../../src/signatures/Signature.js";
import { Example } from "../../src/primitives/Example.js";

describe("XMLAdapter", () => {
  const adapter = new XMLAdapter();

  it("format() produces a system message with XML schema", () => {
    const sig = Signature.from("question -> answer");
    const messages = adapter.format(sig, [], { question: "What is 2+2?" });

    expect(messages.length).toBeGreaterThanOrEqual(2);
    expect(messages[0]!.role).toBe("system");
    expect(messages[0]!.content).toContain("<answer>");
    expect(messages[0]!.content).toContain("</answer>");
  });

  it("format() includes instructions in system message", () => {
    const sig = Signature.from("question -> answer", "Be concise.");
    const messages = adapter.format(sig, [], { question: "test" });
    expect(messages[0]!.content).toContain("Be concise.");
  });

  it("format() includes current input in last user message", () => {
    const sig = Signature.from("question -> answer");
    const messages = adapter.format(sig, [], { question: "Who is Alan Turing?" });
    const userMsg = messages.at(-1)!;
    expect(userMsg.role).toBe("user");
    expect(userMsg.content).toContain("Who is Alan Turing?");
  });

  it("format() includes XML demo responses", () => {
    const sig = Signature.from("question -> answer");
    const demos = [new Example({ question: "1+1?", answer: "2" })];
    const messages = adapter.format(sig, demos, { question: "2+2?" });

    const assistantMsgs = messages.filter((m) => m.role === "assistant");
    expect(assistantMsgs.length).toBe(1);
    expect(assistantMsgs[0]!.content).toContain("<answer>2</answer>");
  });

  it("parse() extracts field values from XML tags", () => {
    const sig = Signature.from("question -> answer");
    const result = adapter.parse(sig, "<response>\n  <answer>Paris</answer>\n</response>");
    expect(result["answer"]).toBe("Paris");
  });

  it("parse() handles multiple output fields", () => {
    const sig = Signature.from("question -> answer, explanation");
    const xml = `<response>\n  <answer>Paris</answer>\n  <explanation>France's capital</explanation>\n</response>`;
    const result = adapter.parse(sig, xml);
    expect(result["answer"]).toBe("Paris");
    expect(result["explanation"]).toBe("France's capital");
  });

  it("parse() is case-insensitive on tag names", () => {
    const sig = Signature.from("question -> answer");
    const result = adapter.parse(sig, "<ANSWER>Paris</ANSWER>");
    expect(result["answer"]).toBe("Paris");
  });

  it("parse() falls back to full text for single output field", () => {
    const sig = Signature.from("question -> answer");
    const result = adapter.parse(sig, "Just Paris");
    expect(result["answer"]).toBe("Just Paris");
  });

  it("parse() unescapes XML entities", () => {
    const sig = Signature.from("question -> answer");
    const result = adapter.parse(sig, "<answer>5 &gt; 3 &amp; 2 &lt; 4</answer>");
    expect(result["answer"]).toBe("5 > 3 & 2 < 4");
  });

  it("format() XML-escapes demo content", () => {
    const sig = Signature.from("question -> answer");
    const demos = [new Example({ question: "Is 5 > 3?", answer: "Yes, 5 > 3 & 4 > 2" })];
    const messages = adapter.format(sig, demos, { question: "test" });
    const assistantMsg = messages.find((m) => m.role === "assistant");
    expect(assistantMsg!.content).toContain("&gt;");
    expect(assistantMsg!.content).toContain("&amp;");
  });
});
