import { Module } from "./Module.js";
import { Predict } from "./Predict.js";
import { Prediction } from "../primitives/index.js";
import type { Document } from "../primitives/Document.js";

/**
 * A Predict module that answers questions from a document context and
 * returns cited passage indices alongside the answer.
 *
 * Promoted from experimental to stable in Phase 4.
 *
 * @example
 * ```ts
 * const citer = new Citations();
 *
 * const result = await citer.forward({
 *   context: "Paris is the capital of France. Berlin is the capital of Germany.",
 *   question: "What is the capital of France?",
 * });
 *
 * console.log(result.get("answer"));    // "Paris"
 * console.log(result.get("citations")); // "[0]" or similar
 * ```
 */
export class Citations extends Module {
  readonly #predict: Predict;

  constructor() {
    super();
    this.#predict = new Predict("context, question -> answer, citations");
    this.#predict.instructions =
      "Answer the question based on the context. " +
      "In the `citations` field list the zero-based indices of the passages " +
      "you used, e.g. [0, 2].";
  }

  /**
   * Run the citations module.
   *
   * `inputs` should contain:
   * - `context` — a string (or array of {@link Document} objects) of source passages
   * - `question` — the question to answer
   */
  async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    // Accept Document[] or string for the context field
    const raw = inputs["context"];
    const context =
      Array.isArray(raw)
        ? (raw as Document[]).map((d, i) => `[${i}] ${d.toString()}`).join("\n\n")
        : String(raw ?? "");

    return this.#predict.forward({ ...inputs, context });
  }
}
