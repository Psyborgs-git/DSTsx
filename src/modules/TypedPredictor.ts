import { Predict } from "./Predict.js";
import { Prediction } from "../primitives/index.js";
import { Signature } from "../signatures/index.js";
import type { FieldMeta } from "../signatures/index.js";
import { JSONAdapter } from "../adapters/JSONAdapter.js";

/** Shared JSONAdapter instance used by TypedPredictor for JSON formatting/parsing. */
const jsonAdapter = new JSONAdapter();

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
 * TypedPredictor — like Predict but uses {@link JSONAdapter} to instruct the
 * LM to respond with a JSON object and parses the completion accordingly.
 * If an optional schema (e.g. Zod) is provided, validates and returns `.typed`.
 *
 * Delegates all JSON formatting/parsing to JSONAdapter — no inline JSON logic.
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
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.#maxRetries; attempt++) {
      try {
        const prediction = await super.forward(inputs);
        const dict = prediction.toDict() as Record<string, unknown>;

        // Delegate JSON parsing to JSONAdapter
        let parsed: Record<string, unknown>;
        const rawValues: string[] = [];
        for (const key of this.signature.outputs.keys()) {
          const val = dict[key];
          if (typeof val === "string" && val.length > 0) {
            rawValues.push(val);
          }
        }

        if (rawValues.length > 0) {
          // Try each raw output value through JSONAdapter.parse()
          let jsonParsed = false;
          for (const raw of rawValues) {
            try {
              parsed = jsonAdapter.parse(this.signature, raw);
              jsonParsed = true;
              break;
            } catch {
              // continue to next value
            }
          }
          if (!jsonParsed) {
            // Final fallback: try the full concatenated text
            parsed = jsonAdapter.parse(this.signature, rawValues.join("\n"));
          }
        } else {
          // No string output fields — use the dict as-is
          parsed = dict;
        }

        let typed: T;
        if (this.#schema) {
          typed = this.#schema.parse(parsed!);
        } else {
          typed = parsed! as T;
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

    throw lastError;
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
