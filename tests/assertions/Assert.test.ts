import { describe, it, expect } from "vitest";
import { Assert, AssertionError } from "../../src/assertions/Assert.js";

describe("Assert", () => {
  it("does not throw for truthy values", () => {
    expect(() => Assert(true)).not.toThrow();
    expect(() => Assert(1)).not.toThrow();
    expect(() => Assert("text")).not.toThrow();
    expect(() => Assert({})).not.toThrow();
    expect(() => Assert([])).not.toThrow();
  });

  it("throws AssertionError for falsy values", () => {
    expect(() => Assert(false)).toThrow(AssertionError);
    expect(() => Assert(0)).toThrow(AssertionError);
    expect(() => Assert("")).toThrow(AssertionError);
    expect(() => Assert(null)).toThrow(AssertionError);
    expect(() => Assert(undefined)).toThrow(AssertionError);
  });

  it("uses custom message when provided", () => {
    expect(() => Assert(false, "custom msg")).toThrow("custom msg");
  });

  it('default message is "Assertion failed"', () => {
    expect(() => Assert(false)).toThrow("Assertion failed");
  });
});

describe("AssertionError", () => {
  it("is an instance of Error", () => {
    const err = new AssertionError("test");
    expect(err).toBeInstanceOf(Error);
  });

  it('has name "AssertionError"', () => {
    const err = new AssertionError();
    expect(err.name).toBe("AssertionError");
  });

  it('defaults message to "Assertion failed"', () => {
    const err = new AssertionError();
    expect(err.message).toBe("Assertion failed");
  });
});
