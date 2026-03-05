import { describe, it, expect, afterEach } from "vitest";
import { ConsoleTracker } from "../../src/tracking/ConsoleTracker.js";
import { JsonFileTracker } from "../../src/tracking/JsonFileTracker.js";
import { existsSync, unlinkSync, readFileSync } from "node:fs";

describe("Tracking", () => {
  const testPath = "/tmp/test_tracker.jsonl";

  afterEach(() => {
    if (existsSync(testPath)) unlinkSync(testPath);
  });

  it("ConsoleTracker.log() runs without error", () => {
    const tracker = new ConsoleTracker();
    expect(() => tracker.log({ type: "step", step: 1, score: 0.5 })).not.toThrow();
  });

  it("ConsoleTracker.flush() resolves", async () => {
    const tracker = new ConsoleTracker();
    await expect(tracker.flush()).resolves.toBeUndefined();
  });

  it("JsonFileTracker writes events on flush", async () => {
    const tracker = new JsonFileTracker(testPath);
    tracker.log({ type: "step", step: 1, score: 0.75 });
    tracker.log({ type: "best", score: 0.9 });
    await tracker.flush();
    expect(existsSync(testPath)).toBe(true);
    const lines = readFileSync(testPath, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]!);
    expect(first.type).toBe("step");
    expect(first.score).toBe(0.75);
  });

  it("JsonFileTracker.flush() is idempotent on empty buffer", async () => {
    const tracker = new JsonFileTracker(testPath);
    await tracker.flush(); // Should not throw on empty buffer
  });
});
