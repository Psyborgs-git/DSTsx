/**
 * Soft suggestion — logs a warning if `condition` is falsy but does NOT throw.
 *
 * Mirrors `dspy.Suggest` in Python.
 *
 * @example
 * ```ts
 * Suggest(result.get("confidence") === "high", "Low confidence in answer");
 * ```
 */
export function Suggest(condition: unknown, message?: string): void {
  if (!condition) {
    // Use a non-throwing warning so the pipeline continues.
    console.warn(`[DSTsx Suggest] ${message ?? "Condition not met"}`);
  }
}
