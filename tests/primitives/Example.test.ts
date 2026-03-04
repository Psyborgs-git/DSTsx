import { describe, it, expect } from "vitest";
import { Example } from "../../src/primitives/Example.js";

describe("Example", () => {
  it("stores and retrieves values", () => {
    const ex = new Example({ question: "What is 2+2?", answer: "4" });
    expect(ex.get("question")).toBe("What is 2+2?");
    expect(ex.get("answer")).toBe("4");
  });

  it("returns undefined for missing keys", () => {
    const ex = new Example({ question: "x" });
    expect(ex.get("missing")).toBeUndefined();
  });

  it("with() returns a new Example with overrides", () => {
    const ex = new Example({ a: "1", b: "2" });
    const updated = ex.with({ b: "99" });
    expect(updated.get("b")).toBe("99");
    expect(ex.get("b")).toBe("2"); // original unchanged
  });

  it("inputs() filters to specified keys", () => {
    const ex = new Example({ question: "q", answer: "a", label: "l" });
    const inputsView = ex.inputs(["question"]);
    expect(Object.keys(inputsView.toDict())).toEqual(["question"]);
  });

  it("labels() returns keys not in inputKeys", () => {
    const ex = new Example({ question: "q", answer: "a" });
    const labelsView = ex.labels(["question"]);
    expect(Object.keys(labelsView.toDict())).toEqual(["answer"]);
  });

  it("toJSON() / fromDict() round-trip", () => {
    const ex = new Example({ x: "hello" });
    const json = ex.toJSON();
    const restored = Example.fromDict(json);
    expect(restored.get("x")).toBe("hello");
  });
});
