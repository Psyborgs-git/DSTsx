import { describe, it, expect, vi } from "vitest";
import { syncify } from "../../src/utils/syncify.js";

describe("syncify()", () => {
  it("returns a function", () => {
    const asyncFn = async (x: number) => x * 2;
    const syncFn = syncify(asyncFn);
    expect(typeof syncFn).toBe("function");
  });

  it("wrapped function is callable with arguments", () => {
    const asyncAdd = async (a: number, b: number) => a + b;
    const syncAdd = syncify(asyncAdd);
    // syncify is best-effort — call shouldn't throw
    expect(() => syncAdd(3, 4)).not.toThrow();
  });

  it("logs a warning when the async function doesn't resolve synchronously", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const asyncFn = async (x: number) => x * 2;
    const syncFn = syncify(asyncFn);
    syncFn(21);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("[DSTsx syncify]"));
    warnSpy.mockRestore();
  });

  it("returns undefined when promise does not resolve synchronously (documented limitation)", () => {
    const asyncFn = async () => 42;
    const syncFn = syncify(asyncFn);
    // In V8/Node.js, microtasks are always deferred — even for immediately-resolved promises.
    // syncify documents this limitation; the return is undefined in those cases.
    const result = syncFn();
    expect(result).toBeUndefined();
  });

  it("does not throw even for functions that would reject", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const asyncFail = async () => { throw new Error("async error"); };
    const syncFail = syncify(asyncFail);
    // Does not throw synchronously since the rejection is pending
    expect(() => syncFail()).not.toThrow();
    warnSpy.mockRestore();
  });
});
