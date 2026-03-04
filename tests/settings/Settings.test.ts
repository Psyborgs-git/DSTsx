import { describe, it, expect, beforeEach } from "vitest";
import { settings } from "../../src/settings/Settings.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";

describe("Settings", () => {
  beforeEach(() => settings.reset());

  it("configure() sets global lm", () => {
    const lm = new MockLM({}, "hello");
    settings.configure({ lm });
    expect(settings.lm).toBe(lm);
  });

  it("reset() clears all settings", () => {
    settings.configure({ lm: new MockLM({}, "x") });
    settings.reset();
    expect(settings.lm).toBeUndefined();
  });

  it("inspect() returns a frozen snapshot", () => {
    const lm = new MockLM({}, "x");
    settings.configure({ lm });
    const snap = settings.inspect();
    expect(snap.lm).toBe(lm);
    expect(Object.isFrozen(snap)).toBe(true);
  });

  it("context() overrides lm for the duration of the call", async () => {
    const globalLM = new MockLM({}, "global");
    const contextLM = new MockLM({}, "context");
    settings.configure({ lm: globalLM });

    let seenInContext: unknown;
    await settings.context({ lm: contextLM }, async () => {
      seenInContext = settings.lm;
    });

    expect(seenInContext).toBe(contextLM);
    // Global lm must be unchanged after context exits
    expect(settings.lm).toBe(globalLM);
  });

  it("context() is concurrency-safe — overlapping calls see independent overrides", async () => {
    const lmA = new MockLM({}, "A");
    const lmB = new MockLM({}, "B");
    settings.configure({ lm: lmA }); // global baseline

    const seen: { label: string; lm: unknown }[] = [];

    // Start two concurrent context() calls and interleave their microtasks.
    const taskA = settings.context({ lm: lmA }, async () => {
      await Promise.resolve(); // yield to let taskB start
      seen.push({ label: "A", lm: settings.lm });
    });

    const taskB = settings.context({ lm: lmB }, async () => {
      seen.push({ label: "B", lm: settings.lm });
    });

    await Promise.all([taskA, taskB]);

    const aResult = seen.find((s) => s.label === "A");
    const bResult = seen.find((s) => s.label === "B");

    expect(aResult?.lm).toBe(lmA);
    expect(bResult?.lm).toBe(lmB);
  });
});
