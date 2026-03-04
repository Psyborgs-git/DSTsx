import { ChainOfThought } from "./ChainOfThought.js";
import { Prediction } from "../primitives/index.js";
import type { Signature } from "../signatures/index.js";

/**
 * Chain-of-Thought with an optional user-supplied hint injected into the
 * prompt at inference time.
 *
 * Mirrors `dspy.ChainOfThoughtWithHint` in Python.
 *
 * @example
 * ```ts
 * const cot = new ChainOfThoughtWithHint("question -> answer");
 * const result = await cot.forward({
 *   question: "What is the capital of France?",
 *   hint: "Think about European countries.",
 * });
 * ```
 */
export class ChainOfThoughtWithHint extends ChainOfThought {
  constructor(signature: string | Signature, options: { rationaleDescription?: string } = {}) {
    const base = typeof signature === "string" ? signature : signature;
    super(base, options);
    // Add hint as an optional input field.
    const extendedSig = this.signature.withInput("hint", {
      description: "An optional hint to guide the reasoning",
      optional: true,
    });
    // Re-assign the signature via a workaround (Predict stores it as readonly).
    Object.assign(this, { signature: extendedSig });
  }

  async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    return super.forward(inputs);
  }
}
