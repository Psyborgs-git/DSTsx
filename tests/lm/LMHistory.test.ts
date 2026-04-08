import { describe, it, expect, vi, beforeEach } from "vitest";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { settings } from "../../src/settings/Settings.js";
import { inspectHistory } from "../../src/utils/inspectHistory.js";

describe("LM call history", () => {
  let lm: MockLM;

  beforeEach(() => {
    lm = new MockLM({}, "answer: 42");
    settings.configure({ lm });
  });

  it("starts with empty history", () => {
    expect(lm.getHistory()).toEqual([]);
  });

  it("records a call after call()", async () => {
    await lm.call("What is 6*7?");
    const history = lm.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0]!.prompt).toBe("What is 6*7?");
    expect(history[0]!.response.text).toBe("answer: 42");
    expect(typeof history[0]!.timestamp).toBe("number");
  });

  it("records multiple calls in order", async () => {
    await lm.call("first");
    await lm.call("second");
    await lm.call("third");
    const history = lm.getHistory();
    expect(history).toHaveLength(3);
    expect(history[0]!.prompt).toBe("first");
    expect(history[2]!.prompt).toBe("third");
  });

  it("getHistory(n) returns only the last n records", async () => {
    await lm.call("a");
    await lm.call("b");
    await lm.call("c");
    const last2 = lm.getHistory(2);
    expect(last2).toHaveLength(2);
    expect(last2[0]!.prompt).toBe("b");
    expect(last2[1]!.prompt).toBe("c");
  });

  it("clearHistory() empties the buffer", async () => {
    await lm.call("something");
    lm.clearHistory();
    expect(lm.getHistory()).toEqual([]);
  });

  it("setHistorySize() limits the buffer", async () => {
    lm.setHistorySize(2);
    await lm.call("a");
    await lm.call("b");
    await lm.call("c");
    // Only last 2 should be retained
    const history = lm.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0]!.prompt).toBe("b");
    expect(history[1]!.prompt).toBe("c");
  });

  it("cached calls are NOT added to history", async () => {
    // First call — recorded
    await lm.call("same prompt");
    // Second call with same prompt — served from cache, should NOT re-record
    await lm.call("same prompt");
    expect(lm.getHistory()).toHaveLength(1);
  });

  it("records the config passed to the call", async () => {
    await lm.call("test", { temperature: 0.5, maxTokens: 50 });
    const record = lm.getHistory(1)[0]!;
    expect(record.config.temperature).toBe(0.5);
    expect(record.config.maxTokens).toBe(50);
  });
});

describe("inspectHistory()", () => {
  let lm: MockLM;

  beforeEach(() => {
    lm = new MockLM({}, "hello world");
    settings.configure({ lm });
    lm.clearHistory();
  });

  it("prints 'No LM configured' when no LM is set", () => {
    settings.configure({ lm: undefined as any });
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    inspectHistory();
    expect(spy.mock.calls.some((c) => String(c[0]).includes("No LM"))).toBe(true);
    spy.mockRestore();
  });

  it("accepts legacy numeric first argument", async () => {
    await lm.call("q");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    // Old API: inspectHistory(1) should still work
    inspectHistory(1);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("shows 'No call history recorded' when history is empty", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    inspectHistory({ n: 5 });
    const output = spy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("No call history");
    spy.mockRestore();
  });

  it("outputs call details in text format", async () => {
    await lm.call("What is 2+2?");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    inspectHistory({ n: 1, format: "text" });
    const output = spy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("What is 2+2?");
    spy.mockRestore();
  });

  it("outputs valid JSON in json format", async () => {
    await lm.call("hello");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    inspectHistory({ n: 1, format: "json" });
    const raw = spy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(() => JSON.parse(raw)).not.toThrow();
    const parsed = JSON.parse(raw);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].prompt).toBe("hello");
    spy.mockRestore();
  });

  it("filter option narrows displayed calls", async () => {
    // Record two calls on lm
    await lm.call("first-prompt");
    lm.clearCache();
    await lm.call("second-prompt");
    lm.clearCache();

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    // Only show the call where prompt is "second-prompt"
    inspectHistory({ n: Infinity, filter: (r) => r.prompt === "second-prompt" });
    const output = spy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("second-prompt");
    spy.mockRestore();
  });
});
