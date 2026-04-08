/**
 * A typed error thrown by {@link Assert} when a condition is not met.
 *
 * {@link Retry} catches this error and feeds the message back into the next
 * attempt as feedback.
 *
 * The optional `context` field carries the LM call context at the time of
 * failure (inputs, outputs, and the current call trace) so that error messages
 * can be more actionable.
 */
export class AssertionError extends Error {
  /**
   * Optional LM call context captured at assertion time.
   * Populated when {@link Assert} is called with a `context` argument.
   */
  readonly context: AssertionContext | undefined;

  constructor(message = "Assertion failed", context?: AssertionContext) {
    super(message);
    this.name = "AssertionError";
    this.context = context;
  }
}

/**
 * Contextual information attached to an {@link AssertionError}.
 */
export interface AssertionContext {
  /** The inputs that were passed to the module that triggered the assertion. */
  inputs?: Record<string, unknown>;
  /** The outputs produced before the assertion fired. */
  outputs?: Record<string, unknown>;
  /**
   * A short trace string (e.g. module class name + method) indicating where
   * in the pipeline the assertion fired.
   */
  trace?: string;
}

/**
 * Hard assertion — throws an {@link AssertionError} if `condition` is falsy.
 * Caught and retried by the {@link Retry} module.
 *
 * Mirrors `dspy.Assert` in Python.
 *
 * @param condition - The condition to assert.
 * @param message   - Human-readable failure message.
 * @param context   - Optional LM context (inputs/outputs/trace) for richer errors.
 *
 * @example
 * ```ts
 * Assert(result.get("answer") !== "", "Answer must not be empty");
 *
 * // With context for richer error messages:
 * Assert(isValid, "Invalid output", { inputs: { question }, outputs: result.toDict(), trace: "QA.forward" });
 * ```
 */
export function Assert(
  condition: unknown,
  message?: string,
  context?: AssertionContext,
): asserts condition {
  if (!condition) {
    throw new AssertionError(message ?? "Assertion failed", context);
  }
}
