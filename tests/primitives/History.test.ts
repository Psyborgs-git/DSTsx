import { describe, it, expect } from "vitest";
import { History } from "../../src/primitives/History.js";

describe("History", () => {
  it("constructor creates empty history", () => {
    const h = new History();
    expect(h.turns).toHaveLength(0);
  });

  it("append returns new History (immutable)", () => {
    const h1 = new History();
    const h2 = h1.append("user", "hello");
    expect(h1.turns).toHaveLength(0);
    expect(h2.turns).toHaveLength(1);
    expect(h2.turns[0]!.content).toBe("hello");
  });

  it("truncate keeps last N turns", () => {
    let h = new History();
    h = h.append("user", "a").append("assistant", "b").append("user", "c");
    const truncated = h.truncate(2);
    expect(truncated.turns).toHaveLength(2);
    expect(truncated.turns[0]!.content).toBe("b");
  });

  it("toMessages returns Message array", () => {
    const h = new History([{ role: "user", content: "hi" }]);
    const messages = h.toMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0]!.role).toBe("user");
  });

  it("toJSON/fromJSON round-trip", () => {
    const h = new History([
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ]);
    const json = h.toJSON();
    const restored = History.fromJSON(json);
    expect(restored.turns).toHaveLength(2);
    expect(restored.turns[1]!.content).toBe("hi");
  });
});
