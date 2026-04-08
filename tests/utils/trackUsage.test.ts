import { describe, it, expect } from "vitest";
import { trackUsage, recordUsage } from "../../src/utils/trackUsage.js";

describe("trackUsage()", () => {
  it("returns the result of the wrapped function", async () => {
    const { result } = await trackUsage(async () => 42);
    expect(result).toBe(42);
  });

  it("returns zero usage when no calls are recorded", async () => {
    const { usage } = await trackUsage(async () => "noop");
    expect(usage.promptTokens).toBe(0);
    expect(usage.completionTokens).toBe(0);
    expect(usage.totalTokens).toBe(0);
    expect(usage.callCount).toBe(0);
  });

  it("accumulates usage from recordUsage() calls inside the scope", async () => {
    const { usage } = await trackUsage(async () => {
      recordUsage({ promptTokens: 100, completionTokens: 50, totalTokens: 150 });
      recordUsage({ promptTokens: 200, completionTokens: 80, totalTokens: 280 });
    });
    expect(usage.promptTokens).toBe(300);
    expect(usage.completionTokens).toBe(130);
    expect(usage.totalTokens).toBe(430);
    expect(usage.callCount).toBe(2);
  });

  it("tracks cachedPromptTokens", async () => {
    const { usage } = await trackUsage(async () => {
      recordUsage({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        cachedPromptTokens: 30,
      });
    });
    expect(usage.cachedPromptTokens).toBe(30);
  });

  it("isolates usage between nested calls", async () => {
    const outer = await trackUsage(async () => {
      recordUsage({ promptTokens: 100, completionTokens: 50, totalTokens: 150 });

      const inner = await trackUsage(async () => {
        recordUsage({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
      });

      // Inner scope is isolated
      return inner.usage.promptTokens;
    });

    // Inner scope reported 10 tokens
    expect(outer.result).toBe(10);
  });

  it("handles null/undefined usage gracefully", async () => {
    const { usage } = await trackUsage(async () => {
      recordUsage(null);
      recordUsage(undefined);
    });
    expect(usage.promptTokens).toBe(0);
    expect(usage.callCount).toBe(0);
  });

  it("works with async operations", async () => {
    const { usage } = await trackUsage(async () => {
      await new Promise<void>((r) => setTimeout(r, 5));
      recordUsage({ promptTokens: 50, completionTokens: 25, totalTokens: 75 });
    });
    expect(usage.promptTokens).toBe(50);
  });
});
