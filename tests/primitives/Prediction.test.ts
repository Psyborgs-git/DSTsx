import { describe, it, expect } from "vitest";
import { Prediction } from "../../src/primitives/Prediction.js";

describe("Prediction", () => {
  it("stores data values", () => {
    const pred = new Prediction({ answer: "42" });
    expect(pred.get("answer")).toBe("42");
  });

  it("stores multiple completions", () => {
    const completions = [{ answer: "A" }, { answer: "B" }];
    const pred = new Prediction({ answer: "A" }, completions);
    expect(pred.completions).toHaveLength(2);
    expect(pred.completions[1]).toEqual({ answer: "B" });
  });

  it("getTyped() casts the value", () => {
    const pred = new Prediction({ count: 3 });
    expect(pred.getTyped<number>("count")).toBe(3);
  });

  it("toJSON() includes completions", () => {
    const pred = new Prediction({ answer: "yes" }, [{ answer: "no" }]);
    const json = pred.toJSON();
    expect(json["completions"]).toHaveLength(1);
  });

  it("inherits with() from Example", () => {
    const pred = new Prediction({ answer: "old" });
    const updated = pred.with({ answer: "new" });
    expect(updated.get("answer")).toBe("new");
  });
});
