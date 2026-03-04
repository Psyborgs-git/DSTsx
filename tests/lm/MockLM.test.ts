import { describe, it, expect } from "vitest";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { LRUCache } from "../../src/lm/cache.js";

describe("MockLM", () => {
  it("returns a configured response", async () => {
    const lm = new MockLM({ "hello": "world" });
    const resp = await lm.call("hello");
    expect(resp.text).toBe("world");
    expect(resp.texts).toEqual(["world"]);
  });

  it("returns the default response when no match", async () => {
    const lm = new MockLM({}, "default");
    const resp = await lm.call("anything");
    expect(resp.text).toBe("default");
  });

  it("throws when no response and no default", async () => {
    const lm = new MockLM({});
    await expect(lm.call("unknown")).rejects.toThrow(/MockLM/);
  });

  it("caches repeated calls", async () => {
    const lm = new MockLM({ "q": "a" });
    await lm.call("q");
    await lm.call("q"); // should be served from cache
    expect(lm.requestCount).toBe(1); // only one real call
  });

  it("addResponse registers a new mapping", async () => {
    const lm = new MockLM({});
    lm.addResponse("new prompt", "new answer");
    const resp = await lm.call("new prompt");
    expect(resp.text).toBe("new answer");
  });

  it("returns n copies in texts when n > 1", async () => {
    const lm = new MockLM({ "q": "a" });
    const resp = await lm.call("q", { n: 3 });
    expect(resp.texts).toHaveLength(3);
  });
});

describe("LRUCache", () => {
  it("stores and retrieves values", () => {
    const cache = new LRUCache<string, string>(10, 60_000);
    cache.set("k", "v");
    expect(cache.get("k")).toBe("v");
  });

  it("evicts the oldest entry when full", () => {
    const cache = new LRUCache<number, number>(2);
    cache.set(1, 1);
    cache.set(2, 2);
    cache.set(3, 3);
    expect(cache.get(1)).toBeUndefined(); // evicted
    expect(cache.get(2)).toBe(2);
  });

  it("returns undefined for expired entries", async () => {
    const cache = new LRUCache<string, string>(10, 1); // 1ms TTL
    cache.set("k", "v");
    await new Promise((r) => setTimeout(r, 10));
    expect(cache.get("k")).toBeUndefined();
  });
});
