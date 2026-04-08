import { describe, it, expect } from "vitest";
import { Assert, AssertionError } from "../../src/assertions/Assert.js";

describe("Enhanced AssertionError with context", () => {
  it("throws AssertionError with no context by default", () => {
    expect(() => Assert(false, "bad")).toThrow(AssertionError);
    expect(() => Assert(false, "bad")).toThrow("bad");
  });

  it("AssertionError.context is undefined when not provided", () => {
    let caught: AssertionError | undefined;
    try {
      Assert(false, "fail");
    } catch (e) {
      caught = e as AssertionError;
    }
    expect(caught).toBeInstanceOf(AssertionError);
    expect(caught?.context).toBeUndefined();
  });

  it("AssertionError carries inputs context", () => {
    let caught: AssertionError | undefined;
    try {
      Assert(false, "bad output", { inputs: { question: "What?" } });
    } catch (e) {
      caught = e as AssertionError;
    }
    expect(caught).toBeInstanceOf(AssertionError);
    expect(caught?.context?.inputs).toEqual({ question: "What?" });
    expect(caught?.context?.outputs).toBeUndefined();
  });

  it("AssertionError carries inputs + outputs + trace context", () => {
    let caught: AssertionError | undefined;
    try {
      Assert(false, "invalid", {
        inputs: { question: "Who?" },
        outputs: { answer: "nobody" },
        trace: "QA.forward",
      });
    } catch (e) {
      caught = e as AssertionError;
    }
    expect(caught?.context?.inputs).toEqual({ question: "Who?" });
    expect(caught?.context?.outputs).toEqual({ answer: "nobody" });
    expect(caught?.context?.trace).toBe("QA.forward");
  });

  it("Assert passes without throwing when condition is truthy", () => {
    expect(() =>
      Assert(true, "should not throw", { inputs: { x: 1 } }),
    ).not.toThrow();
  });

  it("AssertionError.name is 'AssertionError'", () => {
    let caught: AssertionError | undefined;
    try {
      Assert(false, "oops", { trace: "Test.run" });
    } catch (e) {
      caught = e as AssertionError;
    }
    expect(caught?.name).toBe("AssertionError");
  });

  it("AssertionError can be constructed directly with context", () => {
    const err = new AssertionError("direct", { inputs: { x: 42 }, trace: "manual" });
    expect(err.message).toBe("direct");
    expect(err.context?.inputs).toEqual({ x: 42 });
    expect(err.context?.trace).toBe("manual");
  });
});
