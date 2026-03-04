import { LM } from "../LM.js";
import type { LMCallConfig, LMResponse, Message } from "../types.js";

/**
 * A deterministic mock LM adapter for use in unit tests.
 *
 * Responses are resolved from a lookup map keyed on the exact prompt string
 * (or the serialized messages array).  If no match is found the adapter falls
 * back to `defaultResponse` (or throws if none is configured).
 *
 * @example
 * ```ts
 * const lm = new MockLM({
 *   "What is 2+2?": "4",
 * });
 * settings.configure({ lm });
 * ```
 */
export class MockLM extends LM {
  readonly #responses: Map<string, string>;
  readonly #defaultResponse: string | undefined;

  constructor(
    responses: Record<string, string> = {},
    defaultResponse?: string,
  ) {
    super("mock");
    this.#responses = new Map(Object.entries(responses));
    this.#defaultResponse = defaultResponse;
  }

  protected override async _call(
    prompt: string | Message[],
    config: LMCallConfig,
  ): Promise<LMResponse> {
    const key = typeof prompt === "string" ? prompt : JSON.stringify(prompt);
    const text =
      this.#responses.get(key) ??
      this.#defaultResponse ??
      (() => {
        throw new Error(`MockLM: no response configured for prompt: "${key}"`);
      })();

    const n = config.n ?? 1;
    return {
      text,
      texts: Array.from({ length: n }, () => text),
      usage: null,
      raw: null,
    };
  }

  /** Register (or overwrite) a prompt → response mapping at runtime. */
  addResponse(prompt: string, response: string): void {
    this.#responses.set(prompt, response);
  }
}
