/**
 * A typed error thrown by {@link Assert} when a condition is not met.
 *
 * {@link Retry} catches this error and feeds the message back into the next
 * attempt as feedback.
 */
export class AssertionError extends Error {
  constructor(message = "Assertion failed") {
    super(message);
    this.name = "AssertionError";
  }
}

/**
 * Hard assertion — throws an {@link AssertionError} if `condition` is falsy.
 * Caught and retried by the {@link Retry} module.
 *
 * Mirrors `dspy.Assert` in Python.
 *
 * @example
 * ```ts
 * Assert(result.get("answer") !== "", "Answer must not be empty");
 * ```
 */
export function Assert(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new AssertionError(message ?? "Assertion failed");
  }
}
