import { LM } from "../LM.js";
import type { LMCallConfig, LMResponse, Message } from "../types.js";

/** Options for the Cohere adapter. */
export interface CohereOptions {
  apiKey?: string;
  model?: string;
}

/**
 * LM adapter for Cohere Command models.
 *
 * Requires the `cohere-ai` package as a peer dependency:
 * ```
 * npm install cohere-ai
 * ```
 */
export class Cohere extends LM {
  readonly #options: CohereOptions;

  constructor(options: CohereOptions = {}) {
    super(options.model ?? "command-r-plus");
    this.#options = options;
  }

  protected override async _call(
    prompt: string | Message[],
    config: LMCallConfig,
  ): Promise<LMResponse> {
    const { CohereClient } = await import("cohere-ai").catch(() => {
      throw new Error(
        "The `cohere-ai` package is required for the Cohere adapter.\n" +
          "Install it with: npm install cohere-ai",
      );
    });

    const client = new CohereClient({
      token: this.#options.apiKey ?? process.env["COHERE_API_KEY"],
    });

    const text = typeof prompt === "string" ? prompt : this.#messagesToText(prompt);

    const response = await client.chat({
      model: config.model ?? this.model,
      message: text,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      ...(config.extra ?? {}),
    });

    const responseText = response.text ?? "";
    return {
      text: responseText,
      texts: [responseText],
      usage: response.meta?.tokens
        ? {
            promptTokens: response.meta.tokens.inputTokens ?? 0,
            completionTokens: response.meta.tokens.outputTokens ?? 0,
            totalTokens:
              (response.meta.tokens.inputTokens ?? 0) +
              (response.meta.tokens.outputTokens ?? 0),
          }
        : null,
      raw: response,
    };
  }

  #messagesToText(messages: Message[]): string {
    return messages.map((m) => `${m.role}: ${m.content}`).join("\n");
  }
}
