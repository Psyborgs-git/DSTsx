import { describe, it, expect, afterEach } from "vitest";
import { DiskCache } from "../../src/lm/DiskCache.js";
import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TEST_DIR = join(tmpdir(), "dstsx-test-cache-" + Date.now());

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

const mockResponse = {
  text: "hello",
  texts: ["hello"],
  usage: null,
  raw: null,
};

describe("DiskCache", () => {
  it("stores and retrieves values", () => {
    const cache = new DiskCache(TEST_DIR);
    cache.set("key1", mockResponse);
    expect(cache.get("key1")).toEqual(mockResponse);
  });

  it("returns undefined for missing keys", () => {
    const cache = new DiskCache(TEST_DIR);
    expect(cache.get("missing")).toBeUndefined();
  });

  it("expires entries based on TTL", async () => {
    const cache = new DiskCache(TEST_DIR, 500, 50);
    cache.set("key1", mockResponse);
    await new Promise((r) => setTimeout(r, 100));
    expect(cache.get("key1")).toBeUndefined();
  });

  it("clear() removes all entries", () => {
    const cache = new DiskCache(TEST_DIR);
    cache.set("k1", mockResponse);
    cache.set("k2", mockResponse);
    cache.clear();
    expect(cache.get("k1")).toBeUndefined();
    expect(cache.get("k2")).toBeUndefined();
  });
});
