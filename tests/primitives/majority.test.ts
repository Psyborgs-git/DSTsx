import { describe, it, expect } from "vitest";
import { majority } from "../../src/primitives/majority.js";
import { Prediction } from "../../src/primitives/Prediction.js";

describe("majority", () => {
  it("picks most common value", () => {
    const preds = [
      new Prediction({ answer: "Paris" }),
      new Prediction({ answer: "London" }),
      new Prediction({ answer: "Paris" }),
    ];
    const winner = majority()(preds);
    expect(winner.get("answer")).toBe("Paris");
  });

  it("uses first occurrence on ties", () => {
    const preds = [
      new Prediction({ answer: "A" }),
      new Prediction({ answer: "B" }),
    ];
    const winner = majority()(preds);
    expect(winner.get("answer")).toBe("A");
  });

  it("uses custom field name", () => {
    const preds = [
      new Prediction({ label: "yes" }),
      new Prediction({ label: "yes" }),
      new Prediction({ label: "no" }),
    ];
    const winner = majority("label")(preds);
    expect(winner.get("label")).toBe("yes");
  });

  it("throws on empty array", () => {
    expect(() => majority()([])).toThrow();
  });
});
