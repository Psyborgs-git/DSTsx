import type { Module, ModuleOutput } from "../modules/Module.js";
import { Prediction } from "../primitives/index.js";
import { AssertionError } from "./Assert.js";

/**
 * Options for {@link backtrackHandler}.
 */
export interface BacktrackOptions {
  /**
   * Maximum number of retry attempts after an {@link AssertionError} is
   * caught (default: 3).
   */
  maxRetries?: number;
  /**
   * Callback invoked on each failed attempt, useful for logging.
   */
  onRetry?: (attempt: number, error: AssertionError, inputs: Record<string, unknown>) => void;
}

/**
 * Wraps a module so that any {@link AssertionError} thrown during `forward()`
 * causes the call to be retried with a `past_outputs` + `feedback` field
 * appended to the inputs — allowing the LM to self-correct.
 *
 * Mirrors `dspy.backtrack_handler` in Python.
 *
 * @example
 * ```ts
 * const safe = backtrackHandler(new Predict("question -> answer"), { maxRetries: 3 });
 *
 * // When forward() throws an AssertionError, it will retry with:
 * //   { question, past_outputs: "<prev answer>", feedback: "<assertion msg>" }
 * const result = await safe.forward({ question: "What is 2+2?" });
 * ```
 */
export function backtrackHandler<M extends Module>(
  module: M,
  options: BacktrackOptions = {},
): M {
  const { maxRetries = 3, onRetry } = options;

  // Create a proxy that intercepts `forward`
  const handler: ProxyHandler<M> = {
    get(target, prop, receiver) {
      if (prop !== "forward") {
        return Reflect.get(target, prop, receiver) as unknown;
      }

      return async (...args: unknown[]): Promise<ModuleOutput> => {
        const inputs =
          args.length === 1 && typeof args[0] === "object" && args[0] !== null
            ? (args[0] as Record<string, unknown>)
            : { _args: args };

        let lastError: AssertionError | undefined;
        let augmented = { ...inputs };

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            // Call the original forward through the target so sub-properties
            // are resolved correctly.
            const result = await (
              target.forward as (...a: unknown[]) => Promise<ModuleOutput>
            )(...(args.length === 1 && typeof args[0] === "object" ? [augmented] : args));
            return result;
          } catch (err) {
            if (err instanceof AssertionError) {
              lastError = err;
              // Only invoke onRetry when there are remaining retry attempts
              if (attempt < maxRetries) {
                onRetry?.(attempt + 1, err, augmented);
              }

              // Augment inputs with feedback for the next attempt
              const pastOutputs = augmented["past_outputs"] ?? "";
              augmented = {
                ...augmented,
                past_outputs: pastOutputs,
                feedback: err.message,
              };
            } else {
              // Re-throw non-assertion errors immediately
              throw err;
            }
          }
        }

        // All retries exhausted — return an empty prediction rather than
        // propagating the error, matching Python DSPy's soft failure mode.
        console.warn(
          `[DSTsx backtrackHandler] All ${maxRetries} retries exhausted. ` +
            `Last error: ${lastError?.message ?? "unknown"}`,
        );
        return new Prediction({});
      };
    },
  };

  return new Proxy(module, handler);
}

/**
 * Transform a module so that every `forward()` call benefits from
 * assertion-driven self-correction via `backtrackHandler`.
 *
 * Mirrors `dspy.assert_transform_module()` in Python.
 *
 * @example
 * ```ts
 * class MyProgram extends Module {
 *   predict = new Predict("question -> answer");
 *
 *   async forward(inputs: Record<string, unknown>) {
 *     const result = await this.predict.forward(inputs);
 *     Assert(result.get("answer") !== "", "Answer must not be empty");
 *     return result;
 *   }
 * }
 *
 * const safe = assertTransformModule(new MyProgram(), { maxRetries: 2 });
 * const result = await safe.forward({ question: "..." });
 * ```
 */
export function assertTransformModule<M extends Module>(
  module: M,
  options: BacktrackOptions = {},
): M {
  return backtrackHandler(module, options);
}
