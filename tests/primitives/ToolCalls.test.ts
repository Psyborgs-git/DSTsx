import { describe, it, expect } from "vitest";
import { ToolCalls } from "../../src/primitives/ToolCalls.js";

describe("ToolCalls", () => {
  it("stores and retrieves calls", () => {
    const tc = new ToolCalls([
      { name: "search", args: { query: "test" }, result: "found" },
    ]);
    expect(tc.calls).toHaveLength(1);
    expect(tc.calls[0]!.name).toBe("search");
    expect(tc.calls[0]!.result).toBe("found");
  });

  it("calls array is frozen/immutable", () => {
    const tc = new ToolCalls([{ name: "t", args: {}, result: "" }]);
    expect(Object.isFrozen(tc.calls)).toBe(true);
  });

  it("toJSON/fromJSON round-trip", () => {
    const original = new ToolCalls([
      { name: "search", args: { q: "x" }, result: "y" },
      { name: "calc", args: { expr: "1+1" }, result: "2", error: undefined },
    ]);
    const json = original.toJSON();
    const restored = ToolCalls.fromJSON(json);
    expect(restored.calls).toHaveLength(2);
    expect(restored.calls[0]!.name).toBe("search");
  });
});
