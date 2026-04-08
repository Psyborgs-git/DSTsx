import { Signature } from "./Signature.js";
import { InputField, OutputField } from "./Field.js";
import type { FieldMeta } from "./types.js";

/**
 * Field specifier for {@link makeSignature}.
 * Either a short `"input"` / `"output"` direction string,
 * or a full descriptor object.
 */
export type FieldSpec =
  | { direction: "input"; meta?: FieldMeta }
  | { direction: "output"; meta?: FieldMeta }
  | "input"
  | "output";

/**
 * Create a {@link Signature} from a plain object mapping field names to
 * direction specifiers.
 *
 * Mirrors Python's `dspy.make_signature()` helper.
 *
 * @example
 * ```ts
 * // Simple form:
 * const sig = makeSignature(
 *   { context: "input", question: "input", answer: "output" },
 *   "Answer the question using the context.",
 * );
 *
 * // With metadata:
 * const sig2 = makeSignature({
 *   context:  { direction: "input",  meta: { description: "Relevant passages" } },
 *   question: { direction: "input",  meta: { description: "User question" } },
 *   answer:   { direction: "output", meta: { description: "Concise answer" } },
 * });
 * ```
 */
export function makeSignature(
  fields: Record<string, FieldSpec>,
  instructions?: string,
): Signature {
  const inputs = new Map<string, FieldMeta>();
  const outputs = new Map<string, FieldMeta>();

  for (const [name, spec] of Object.entries(fields)) {
    const direction = typeof spec === "string" ? spec : spec.direction;
    const meta = typeof spec === "string" ? {} : (spec.meta ?? {});
    if (direction === "input") {
      inputs.set(name, InputField(meta));
    } else {
      outputs.set(name, OutputField(meta));
    }
  }

  return new Signature({ inputs, outputs, instructions });
}
