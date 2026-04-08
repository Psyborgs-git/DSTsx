import { describe, it, expect, vi } from "vitest";
import { backtrackHandler, assertTransformModule } from "../../src/assertions/backtrack.js";
import { Assert, AssertionError } from "../../src/assertions/Assert.js";
import { Module } from "../../src/modules/Module.js";
import { Prediction } from "../../src/primitives/Prediction.js";

class AlwaysFailModule extends Module {
  callCount = 0;
  async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    this.callCount++;
    Assert(false, "Always fails");
    return new Prediction({});
  }
}

class FailThenSucceedModule extends Module {
  callCount = 0;
  async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    this.callCount++;
    if (this.callCount < 3) {
      Assert(false, `Attempt ${this.callCount} failed`);
    }
    return new Prediction({ answer: `Success on attempt ${this.callCount}` });
  }
}

class NonAssertionErrorModule extends Module {
  async forward(_inputs: Record<string, unknown>): Promise<Prediction> {
    throw new TypeError("Type error, not assertion");
  }
}

describe("backtrackHandler()", () => {
  it("returns the module unchanged if no assertion errors occur", async () => {
    class PassModule extends Module {
      async forward(_inputs: Record<string, unknown>): Promise<Prediction> {
        return new Prediction({ answer: "ok" });
      }
    }
    const m = new PassModule();
    const wrapped = backtrackHandler(m);
    const result = await wrapped.forward({});
    expect(result.get("answer")).toBe("ok");
  });

  it("retries on AssertionError and returns empty Prediction after exhausting retries", async () => {
    const m = new AlwaysFailModule();
    const wrapped = backtrackHandler(m, { maxRetries: 2 });
    const result = await wrapped.forward({});
    expect(result).toBeInstanceOf(Prediction);
    // Module was called maxRetries + 1 times (initial + 2 retries)
    expect(m.callCount).toBe(3);
  });

  it("succeeds when module eventually stops failing", async () => {
    const m = new FailThenSucceedModule();
    const wrapped = backtrackHandler(m, { maxRetries: 3 });
    const result = await wrapped.forward({});
    expect(result.get("answer")).toContain("Success");
  });

  it("re-throws non-assertion errors immediately", async () => {
    const m = new NonAssertionErrorModule();
    const wrapped = backtrackHandler(m, { maxRetries: 3 });
    await expect(wrapped.forward({})).rejects.toThrow(TypeError);
  });

  it("calls onRetry callback on each retry", async () => {
    const onRetry = vi.fn();
    const m = new AlwaysFailModule();
    const wrapped = backtrackHandler(m, { maxRetries: 2, onRetry });
    await wrapped.forward({});
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(AssertionError), expect.any(Object));
  });

  it("augments inputs with feedback on retry", async () => {
    const receivedInputs: Record<string, unknown>[] = [];
    class RecordingModule extends Module {
      callCount = 0;
      async forward(inputs: Record<string, unknown>): Promise<Prediction> {
        receivedInputs.push({ ...inputs });
        this.callCount++;
        if (this.callCount < 2) Assert(false, "fail with feedback");
        return new Prediction({ answer: "ok" });
      }
    }
    const m = new RecordingModule();
    const wrapped = backtrackHandler(m, { maxRetries: 2 });
    await wrapped.forward({ question: "test" });
    // Second call should have feedback
    expect(receivedInputs[1]).toHaveProperty("feedback", "fail with feedback");
  });
});

describe("assertTransformModule()", () => {
  it("is an alias for backtrackHandler", async () => {
    const m = new FailThenSucceedModule();
    const transformed = assertTransformModule(m, { maxRetries: 3 });
    const result = await transformed.forward({});
    expect(result.get("answer")).toContain("Success");
  });
});
