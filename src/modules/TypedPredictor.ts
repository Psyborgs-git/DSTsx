import { Predict } from "./Predict.js";
import { Prediction } from "../primitives/index.js";
import { Signature } from "../signatures/index.js";
import type { FieldMeta } from "../signatures/index.js";

/**
 * A Prediction that additionally carries a typed `.typed` field.
 */
export class TypedPrediction<T = unknown> extends Prediction {
  readonly typed: T;

  constructor(
    data: Record<string, unknown>,
    typed: T,
    completions: Record<string, unknown>[] = [],
  ) {
    super(data, completions);
    this.typed = typed;
  }
}

/**
 * TypedPredictor — like Predict but appends JSON formatting instructions and
 * parses the completion as JSON.  If an optional schema is provided,
 * validates and returns `.typed`.
 */
export class TypedPredictor<T = unknown> extends Predict {
  readonly #schema: { parse: (v: unknown) => T } | undefined;
  readonly #maxRetries: number;

  constructor(
    signature: string | Signature,
    schema?: { parse: (v: unknown) => T },
    options: { maxRetries?: number } = {},
  ) {
    super(signature);
    this.#schema = schema;
    this.#maxRetries = options.maxRetries ?? 3;
  }

  override async forward(inputs: Record<string, unknown>): Promise<TypedPrediction<T>> {
    const origInstructions = this.instructions;
    const jsonSuffix = "\n\nRespond with a JSON object matching the output schema.";
    this.instructions = (origInstructions ?? "") + jsonSuffix;

    let lastError: unknown;
    try {
      for (let attempt = 0; attempt <= this.#maxRetries; attempt++) {
        try {
          const prediction = await super.forward(inputs);
          const dict = prediction.toDict() as Record<string, unknown>;

          // Try each output field's value as potential JSON source
          let parsed: unknown;
          let found = false;
          let lastParseError: unknown;
          for (const key of this.signature.outputs.keys()) {
            const val = dict[key];
            if (typeof val === "string" && val.length > 0) {
              try {
                parsed = TypedPredictor.#parseJSON(val);
                found = true;
                break;
              } catch (parseErr) {
                lastParseError = parseErr;
              }
            }
          }

          if (!found) {
            if (lastParseError !== undefined) {
              // Had non-empty string field(s) but none parsed as JSON
              throw lastParseError;
            }
            // No string field values — fall back to the dict (e.g. multi-field with empty results)
            parsed = dict;
          }

          let typed: T;
          if (this.#schema) {
            typed = this.#schema.parse(parsed);
          } else {
            typed = parsed as T;
          }

          return new TypedPrediction<T>(
            dict,
            typed,
            prediction.completions as Record<string, unknown>[],
          );
        } catch (err) {
          lastError = err;
          // continue to next attempt
        }
      }
    } finally {
      this.instructions = origInstructions;
    }

    throw lastError;
  }

  static #parseJSON(raw: unknown): unknown {
    if (typeof raw !== "string") return raw;
    let text = raw.trim();
    // Strip markdown code fences
    const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/m.exec(text);
    if (fence) text = (fence[1] ?? "").trim();
    return JSON.parse(text);
  }
}

/**
 * TypedChainOfThought — like TypedPredictor but adds a hidden rationale field
 * so the LM reasons before producing the answer.
 */
export class TypedChainOfThought<T = unknown> extends TypedPredictor<T> {
  constructor(
    signature: string | Signature,
    schema?: { parse: (v: unknown) => T },
    options: { maxRetries?: number } = {},
  ) {
    const base = typeof signature === "string" ? Signature.from(signature) : signature;

    const withRationale = base.withOutput("rationale", {
      description: "Think step by step to reason through the problem",
      prefix: "Reasoning:",
    });

    // Ensure rationale is the FIRST output field
    const reordered = new Signature({
      inputs: withRationale.inputs as Map<string, FieldMeta>,
      outputs: new Map([
        ["rationale", withRationale.outputs.get("rationale")!],
        ...withRationale.outputs,
      ]),
      instructions: withRationale.instructions,
    });

    super(reordered, schema, options);
  }

  override async forward(inputs: Record<string, unknown>): Promise<TypedPrediction<T>> {
    const result = await super.forward(inputs);
    // Destructure rationale out so it doesn't appear in the returned prediction.
    const { rationale: _rationale, ...rest } = result.toDict() as Record<string, unknown>;
    void _rationale;
    return new TypedPrediction<T>(
      rest,
      result.typed,
      result.completions as Record<string, unknown>[],
    );
  }
}
