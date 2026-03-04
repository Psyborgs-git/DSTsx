import type { FieldMeta } from "./types.js";

/**
 * Creates an input field descriptor for a {@link Signature}.
 *
 * @example
 * ```ts
 * const sig = new Signature({
 *   inputs:  new Map([["question", InputField({ description: "The question to answer" })]]),
 *   outputs: new Map([["answer",   OutputField({ description: "A concise answer" })]]),
 * });
 * ```
 */
export function InputField(meta: FieldMeta = {}): FieldMeta {
  return { type: "string", ...meta };
}

/**
 * Creates an output field descriptor for a {@link Signature}.
 */
export function OutputField(meta: FieldMeta = {}): FieldMeta {
  return { type: "string", ...meta };
}
