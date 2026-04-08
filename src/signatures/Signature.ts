import type { FieldMeta, SignatureMeta } from "./types.js";
import { InputField, OutputField } from "./Field.js";

/**
 * A Signature defines the typed interface (inputs and outputs) for a single
 * language-model call.  It mirrors `dspy.Signature` in the Python library.
 *
 * Signatures can be created from a shorthand string:
 * ```ts
 * const sig = Signature.from("question -> answer");
 * const sig2 = Signature.from("context, question -> answer, confidence");
 * ```
 *
 * Or constructed explicitly:
 * ```ts
 * const sig = new Signature({
 *   inputs:  new Map([["question", InputField({ description: "The question" })]]),
 *   outputs: new Map([["answer",   OutputField({ description: "The answer"  })]]),
 *   instructions: "Answer concisely.",
 * });
 * ```
 */
export class Signature {
  readonly inputs: ReadonlyMap<string, FieldMeta>;
  readonly outputs: ReadonlyMap<string, FieldMeta>;
  readonly instructions: string | undefined;

  constructor(meta: SignatureMeta) {
    this.inputs = meta.inputs;
    this.outputs = meta.outputs;
    this.instructions = meta.instructions;
  }

  // ---------------------------------------------------------------------------
  // Factory helpers
  // ---------------------------------------------------------------------------

  /**
   * Parse a shorthand signature string of the form:
   *   `"field1, field2? -> out1, out2"`
   *
   * A trailing `?` marks the field as optional.
   */
  static from(shorthand: string, instructions?: string): Signature {
    const [inputPart, outputPart] = shorthand.split("->").map((s) => s.trim());
    if (outputPart === undefined) {
      throw new Error(
        `Invalid signature shorthand "${shorthand}". Expected "inputs -> outputs".`,
      );
    }

    const parseFields = (part: string): Map<string, FieldMeta> => {
      const map = new Map<string, FieldMeta>();
      for (const raw of part.split(",")) {
        const trimmed = raw.trim();
        const isOptional = trimmed.endsWith("?");
        const name = trimmed.replace(/\?$/, "");
        if (name.length === 0) continue;
        map.set(name, InputField(isOptional ? { optional: true } : {}));
      }
      return map;
    };

    const inputs = parseFields(inputPart ?? "");
    const outputs = parseFields(outputPart);

    // Re-tag output fields using OutputField so callers can distinguish them.
    for (const [key, val] of outputs) {
      outputs.set(key, OutputField(val));
    }

    return new Signature({ inputs, outputs, instructions });
  }

  // ---------------------------------------------------------------------------
  // Mutation helpers (return new Signature; never mutates)
  // ---------------------------------------------------------------------------

  /**
   * Return a new Signature with additional or overridden fields / instructions.
   */
  with(overrides: Partial<SignatureMeta>): Signature {
    return new Signature({
      inputs: overrides.inputs ?? new Map(this.inputs),
      outputs: overrides.outputs ?? new Map(this.outputs),
      instructions: overrides.instructions ?? this.instructions,
    });
  }

  /**
   * Append an extra input field and return a new Signature.
   */
  withInput(name: string, meta: FieldMeta = {}): Signature {
    const inputs = new Map(this.inputs);
    inputs.set(name, InputField(meta));
    return this.with({ inputs });
  }

  /**
   * Append an extra output field and return a new Signature.
   */
  withOutput(name: string, meta: FieldMeta = {}): Signature {
    const outputs = new Map(this.outputs);
    outputs.set(name, OutputField(meta));
    return this.with({ outputs });
  }

  /**
   * Append an input or output field and return a new Signature.
   *
   * Mirrors `dspy.Signature.append()` in Python.
   *
   * @param name    - Field name.
   * @param meta    - Field metadata.
   * @param type    - `"input"` or `"output"` (default: `"output"`).
   */
  append(name: string, meta: FieldMeta = {}, type: "input" | "output" = "output"): Signature {
    return type === "input" ? this.withInput(name, meta) : this.withOutput(name, meta);
  }

  /**
   * Remove a field by name and return a new Signature.
   *
   * Mirrors `dspy.Signature.delete()` in Python.
   * Searches inputs first, then outputs.
   *
   * @throws {Error} if the field is not found.
   */
  delete(name: string): Signature {
    if (this.inputs.has(name)) {
      const inputs = new Map(this.inputs);
      inputs.delete(name);
      return this.with({ inputs });
    }
    if (this.outputs.has(name)) {
      const outputs = new Map(this.outputs);
      outputs.delete(name);
      return this.with({ outputs });
    }
    throw new Error(`Signature.delete: field "${name}" not found`);
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  toJSON(): object {
    return {
      inputs: Object.fromEntries(this.inputs),
      outputs: Object.fromEntries(this.outputs),
      instructions: this.instructions,
    };
  }

  static fromJSON(json: Record<string, unknown>): Signature {
    const toMap = (obj: unknown): Map<string, FieldMeta> => {
      if (typeof obj !== "object" || obj === null) return new Map();
      return new Map(Object.entries(obj as Record<string, FieldMeta>));
    };
    return new Signature({
      inputs: toMap(json["inputs"]),
      outputs: toMap(json["outputs"]),
      instructions:
        typeof json["instructions"] === "string" ? json["instructions"] : undefined,
    });
  }
}
