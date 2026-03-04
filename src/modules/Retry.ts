import { Module } from "./Module.js";
import { Prediction } from "../primitives/index.js";
import { AssertionError } from "../assertions/index.js";

/**
 * Wraps any module and retries on {@link AssertionError} up to `maxAttempts`,
 * feeding the failure message back into the next attempt.
 *
 * Mirrors `dspy.Retry` in Python.
 */
export class Retry extends Module {
  readonly #inner: Module;
  readonly maxAttempts: number;

  constructor(inner: Module, maxAttempts = 3) {
    super();
    this.#inner = inner;
    this.maxAttempts = maxAttempts;
  }

  async forward(...args: unknown[]): Promise<Prediction> {
    let lastError: AssertionError | undefined;

    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      try {
        return await (this.#inner.forward as (...a: unknown[]) => Promise<Prediction>)(...args);
      } catch (err) {
        if (err instanceof AssertionError) {
          lastError = err;
          // If the inner module is a Predict-like module, inject the error
          // message as feedback via a "past_outputs" field.
          const firstArg = args[0];
          if (firstArg && typeof firstArg === "object") {
            (firstArg as Record<string, unknown>)["feedback"] = err.message;
          }
          continue;
        }
        throw err;
      }
    }

    throw lastError ?? new Error("Retry: all attempts exhausted");
  }
}
