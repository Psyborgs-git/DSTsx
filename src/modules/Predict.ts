import { Module } from "./Module.js";
import { Prediction, Example } from "../primitives/index.js";
import { Signature } from "../signatures/index.js";
import { settings } from "../settings/index.js";

/**
 * The fundamental DSTsx module — formats a prompt for the configured LM and
 * parses the completion back into a typed {@link Prediction}.
 *
 * Mirrors `dspy.Predict` in Python.
 *
 * @example
 * ```ts
 * const qa = new Predict("question -> answer");
 * const result = await qa.forward({ question: "What is 2 + 2?" });
 * console.log(result.get("answer")); // "4"
 * ```
 */
export class Predict extends Module {
  readonly signature: Signature;

  /** Few-shot demonstration examples (learnable parameter). */
  demos: Example[];

  /** System instruction override (learnable parameter). */
  instructions: string | undefined;

  constructor(signature: string | Signature) {
    super();
    this.signature =
      typeof signature === "string" ? Signature.from(signature) : signature;
    this.demos = [];
    this.instructions = this.signature.instructions;
  }

  // ---------------------------------------------------------------------------
  // Forward pass
  // ---------------------------------------------------------------------------

  async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    const lm = settings.lm;
    if (!lm) {
      throw new Error(
        "No LM configured. Call settings.configure({ lm }) before using Predict.",
      );
    }

    const prompt = this.#buildPrompt(inputs);
    const config = settings.lmConfig ?? {};
    const response = await lm.call(prompt, config);

    const outputs = this.#parseCompletion(response.text);
    const completions = response.texts.map((t) => this.#parseCompletion(t));

    return new Prediction(outputs, completions);
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  override dump(): Record<string, unknown> {
    return {
      signature: this.signature.toJSON(),
      demos: this.demos.map((d) => d.toJSON()),
      instructions: this.instructions,
    };
  }

  override load(state: Record<string, unknown>): void {
    if (Array.isArray(state["demos"])) {
      this.demos = (state["demos"] as Record<string, unknown>[]).map(
        (d) => new Example(d),
      );
    }
    if (typeof state["instructions"] === "string") {
      this.instructions = state["instructions"];
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  #buildPrompt(inputs: Record<string, unknown>): string {
    const lines: string[] = [];

    if (this.instructions) {
      lines.push(this.instructions, "");
    }

    if (this.demos.length > 0) {
      for (const demo of this.demos) {
        lines.push(this.#formatExample(demo.toDict()));
        lines.push("---");
      }
    }

    lines.push(this.#formatInputs(inputs));

    // Append output field prompts so the LM knows what to produce.
    for (const [name] of this.signature.outputs) {
      lines.push(`${name}:`);
    }

    return lines.join("\n");
  }

  #formatExample(data: Record<string, unknown>): string {
    return [...this.signature.inputs, ...this.signature.outputs]
      .map(([name]) => `${name}: ${String(data[name] ?? "")}`)
      .join("\n");
  }

  #formatInputs(inputs: Record<string, unknown>): string {
    return [...this.signature.inputs]
      .map(([name]) => `${name}: ${String(inputs[name] ?? "")}`)
      .join("\n");
  }

  /**
   * Parse a raw completion string into a map of field name → value.
   *
   * Looks for `fieldName: <value>` lines in the completion.
   */
  #parseCompletion(text: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const outputKeys = [...this.signature.outputs.keys()];

    for (const key of outputKeys) {
      const regex = new RegExp(`^${key}:\\s*(.*)$`, "mi");
      const match = regex.exec(text);
      if (match) {
        result[key] = (match[1] ?? "").trim();
      }
    }

    // Fallback: if only one output field and no match was found, use the full
    // completion text.
    if (outputKeys.length === 1 && !(outputKeys[0]! in result)) {
      result[outputKeys[0]!] = text.trim();
    }

    return result;
  }
}
