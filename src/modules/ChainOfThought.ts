import { Predict } from "./Predict.js";
import { Prediction } from "../primitives/index.js";
import { Signature } from "../signatures/index.js";
import type { FieldMeta } from "../signatures/index.js";

/**
 * Chain-of-Thought module — extends {@link Predict} by prepending a hidden
 * `rationale` output field so the LM reasons before producing the answer.
 *
 * Mirrors `dspy.ChainOfThought` in Python.
 *
 * @example
 * ```ts
 * const cot = new ChainOfThought("question -> answer");
 * const result = await cot.forward({ question: "What is 9 * 8?" });
 * console.log(result.get("answer")); // "72"
 * ```
 */
export class ChainOfThought extends Predict {
  constructor(
    signature: string | Signature,
    options: { rationaleDescription?: string } = {},
  ) {
    const base = typeof signature === "string" ? Signature.from(signature) : signature;

    const rationaleSig = base.withOutput("rationale", {
      description:
        options.rationaleDescription ??
        "Think step by step to reason through the problem",
      prefix: "Reasoning:",
    });

    // Ensure rationale is the FIRST output field.
    const reordered = new Signature({
      inputs: rationaleSig.inputs as Map<string, FieldMeta>,
      outputs: new Map([
        ["rationale", rationaleSig.outputs.get("rationale")!],
        ...rationaleSig.outputs,
      ]),
      instructions: rationaleSig.instructions,
    });

    super(reordered);
  }

  /** Returns the answer without the internal rationale. */
  override async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    const prediction = await super.forward(inputs);
    // Strip the rationale from the returned prediction so downstream modules
    // only see the actual output fields.
    const { rationale: _rationale, ...rest } = prediction.toDict() as Record<string, unknown>;
    void _rationale;
    return new Prediction(rest, prediction.completions as Record<string, unknown>[]);
  }
}
