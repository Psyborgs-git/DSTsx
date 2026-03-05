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
    this.signature = typeof signature === "string" ? Signature.from(signature) : signature;
    this.demos = [];
    this.instructions = this.signature.instructions;
  }

  // ---------------------------------------------------------------------------
  // Forward pass
  // ---------------------------------------------------------------------------

  async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    const lm = settings.lm;
    if (!lm) {
      throw new Error("No LM configured. Call settings.configure({ lm }) before using Predict.");
    }

    const prompt = this.#buildPrompt(inputs);
    const config = settings.lmConfig ?? {};
    const response = await lm.call(prompt, config);

    const outputs = this.#parseCompletion(response.text);
    const completions = response.texts.map((t) => this.#parseCompletion(t));

    return new Prediction(outputs, completions);
  }

  /**
   * Stream the LM response token by token.
   * Returns an `AsyncGenerator<StreamChunk>`.
   */
  async *stream(
    inputs: Record<string, unknown>,
  ): AsyncGenerator<import("../lm/types.js").StreamChunk> {
    const lm = settings.lm;
    if (!lm)
      throw new Error("No LM configured. Call settings.configure({ lm }) before using Predict.");
    const prompt = this.#buildPrompt(inputs);
    const config = settings.lmConfig ?? {};
    yield* lm.stream(prompt, config);
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
      this.demos = (state["demos"] as Record<string, unknown>[]).map((d) => new Example(d));
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
    // Use prefix if available, otherwise use the field name.
    for (const [name, meta] of this.signature.outputs) {
      const label = meta.prefix ?? `${name}:`;
      lines.push(label.endsWith(":") ? label : `${label}:`);
    }

    return lines.join("\n");
  }

  #formatExample(data: Record<string, unknown>): string {
    const formatField = (name: string, meta: { prefix?: string } | undefined): string => {
      const label = meta?.prefix ?? `${name}:`;
      const prefix = label.endsWith(":") ? label : `${label}:`;
      return `${prefix} ${String(data[name] ?? "")}`;
    };

    return [
      ...[...this.signature.inputs].map(([name, meta]) => formatField(name, meta)),
      ...[...this.signature.outputs].map(([name, meta]) => formatField(name, meta)),
    ].join("\n");
  }

  #formatInputs(inputs: Record<string, unknown>): string {
    return [...this.signature.inputs]
      .map(([name, meta]) => {
        const label = meta.prefix ?? `${name}:`;
        const prefix = label.endsWith(":") ? label : `${label}:`;
        return `${prefix} ${String(inputs[name] ?? "")}`;
      })
      .join("\n");
  }

  /**
   * Parse a raw completion string into a map of field name → value.
   *
   * Looks for `fieldName: <value>` or `prefix: <value>` patterns in the completion.
   * Handles common LLM formatting like **bold**, *italic*, etc.
   * Supports multi-line values by extracting content between field markers.
   */
  #parseCompletion(text: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const outputs = [...this.signature.outputs.entries()];

    // Build all possible field labels (name and prefix variants)
    const fieldLabels: Array<{ key: string; patterns: string[] }> = [];
    for (const [key, meta] of outputs) {
      const prefixBase = (meta.prefix ?? "").replace(/:$/, "").trim();
      const patterns = [key];
      if (prefixBase && prefixBase.toLowerCase() !== key.toLowerCase()) {
        patterns.push(prefixBase);
      }
      fieldLabels.push({ key, patterns });
    }

    // Create a combined regex to find all field markers
    const allPatterns = fieldLabels.flatMap((f) => f.patterns);
    const allPatternsEscaped = allPatterns.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

    // Pattern matches: optional markdown, label, optional markdown, colon
    // e.g., "**Answer:**", "Reasoning:", "*rationale:*"
    const markerPattern = `(?:\\*\\*|\\*|_)?(${allPatternsEscaped.join("|")})(?:\\*\\*|\\*|_)?:`;
    const markerRegex = new RegExp(markerPattern, "gi");

    // Find all marker positions
    const markers: Array<{ key: string; start: number; end: number }> = [];
    let markerMatch;
    while ((markerMatch = markerRegex.exec(text)) !== null) {
      const matchedLabel = markerMatch[1]!.toLowerCase();
      // Find which field this marker belongs to
      for (const { key, patterns } of fieldLabels) {
        if (patterns.some((p) => p.toLowerCase() === matchedLabel)) {
          markers.push({
            key,
            start: markerMatch.index,
            end: markerMatch.index + markerMatch[0].length,
          });
          break;
        }
      }
    }

    // Extract content between markers
    for (let i = 0; i < markers.length; i++) {
      const marker = markers[i]!;
      const contentStart = marker.end;
      const contentEnd = i + 1 < markers.length ? markers[i + 1]!.start : text.length;
      let content = text.slice(contentStart, contentEnd).trim();

      // Clean up common markdown artifacts at start/end of content
      // Remove leading ** or * or _ that got captured
      content = content.replace(/^(\*\*|\*|_)+\s*/, "");
      // Remove trailing ** or * or _ that might be present
      content = content.replace(/\s*(\*\*|\*|_)+$/, "");

      // Only set if we haven't already found a value for this key
      // (first occurrence wins)
      if (!(marker.key in result)) {
        result[marker.key] = content;
      }
    }

    // Fallback: if only one output field and no match was found, use the full
    // completion text.
    const outputKeys = outputs.map(([k]) => k);
    if (outputKeys.length === 1 && !(outputKeys[0]! in result)) {
      result[outputKeys[0]!] = text.trim();
    }

    return result;
  }
}
