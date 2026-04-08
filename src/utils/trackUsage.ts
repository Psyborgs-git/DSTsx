import { AsyncLocalStorage } from "node:async_hooks";
import type { TokenUsage } from "../primitives/Trace.js";

/**
 * Aggregate token usage collected inside a {@link trackUsage} scope.
 */
export interface AggregatedUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedPromptTokens: number;
  /** Number of individual LM calls that contributed usage. */
  callCount: number;
}

/** @internal */
interface UsageAccumulator extends AggregatedUsage {
  // nothing extra
}

/** @internal */
export const usageStore = new AsyncLocalStorage<UsageAccumulator>();

/**
 * Record token usage from a single LM call into the active accumulator (if any).
 *
 * Called automatically by the Predict module when running inside a
 * {@link trackUsage} scope.
 *
 * @internal
 */
export function recordUsage(
  usage: TokenUsage & { cachedPromptTokens?: number } | null | undefined,
): void {
  if (!usage) return;
  const acc = usageStore.getStore();
  if (!acc) return;
  acc.promptTokens += usage.promptTokens;
  acc.completionTokens += usage.completionTokens;
  acc.totalTokens += usage.totalTokens;
  acc.cachedPromptTokens += usage.cachedPromptTokens ?? 0;
  acc.callCount += 1;
}

/**
 * Run `fn` inside a usage-tracking context and return both the result and the
 * aggregated token usage for all LM calls made during `fn`.
 *
 * Mirrors `dspy.track_usage()` in Python.
 *
 * @example
 * ```ts
 * const { result, usage } = await trackUsage(async () => {
 *   return program.forward({ question: "What is the capital of France?" });
 * });
 * console.log(`Total tokens: ${usage.totalTokens}`);
 * console.log(`Answer: ${result.get("answer")}`);
 * ```
 */
export async function trackUsage<T>(fn: () => Promise<T>): Promise<{ result: T; usage: AggregatedUsage }> {
  const acc: UsageAccumulator = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    cachedPromptTokens: 0,
    callCount: 0,
  };
  const result = await usageStore.run(acc, fn);
  return { result, usage: { ...acc } };
}
