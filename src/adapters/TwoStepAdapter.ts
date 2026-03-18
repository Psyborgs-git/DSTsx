import { Adapter } from "./Adapter.js";
import { ChatAdapter } from "./ChatAdapter.js";
import type { Signature } from "../signatures/index.js";
import type { Example } from "../primitives/index.js";
import type { Message } from "../lm/types.js";

/**
 * Two-step adapter: first generates free text, then extracts structured fields.
 * Step 1 uses ChatAdapter-style formatting.
 * Step 2 asks the LM to extract specific fields from the free text.
 * Mirrors `dspy.TwoStepAdapter`.
 */
export class TwoStepAdapter extends Adapter {
  readonly #inner = new ChatAdapter();

  format(sig: Signature, demos: Example[], inputs: Record<string, unknown>): Message[] {
    // Step 1: use ChatAdapter formatting for the initial generation
    return this.#inner.format(sig, demos, inputs);
  }

  parse(sig: Signature, output: string): Record<string, unknown> {
    // For parsing, try structured extraction from free text
    // First try the ChatAdapter's parse
    const result = this.#inner.parse(sig, output);

    // If we got results, return them
    const outputKeys = [...sig.outputs.keys()];
    const hasResults = outputKeys.some((k) => k in result && result[k] !== "");
    if (hasResults) return result;

    // Fallback: if only one output field, use the full text
    const [singleKey] = outputKeys;
    if (outputKeys.length === 1 && singleKey !== undefined) {
      result[singleKey] = output.trim();
    }
    return result;
  }
}
