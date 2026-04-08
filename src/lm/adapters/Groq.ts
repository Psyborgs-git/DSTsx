import { LM } from "../LM.js";
import type { LMCallConfig, LMResponse, Message } from "../types.js";

/** Options for the Groq adapter. */
export interface GroqOptions {
  /** Groq API key. Defaults to `GROQ_API_KEY` env var. */
  apiKey?: string;
  /** Model name (e.g. `"llama-3.1-70b-versatile"`). */
  model?: string;
  maxRetries?: number;
}

/**
 * LM adapter for Groq — an ultra-fast inference service with an
 * OpenAI-compatible API.
 *
 * Requires the `openai` package as a peer dependency:
 * ```
 * npm install openai
 * ```
 *
 * @example
 * ```ts
 * const lm = new Groq({ model: "llama-3.1-70b-versatile" });
 * // or via factory:
 * const lm = LM.from("groq/llama-3.1-70b-versatile");
 * ```
 */
export class Groq extends LM {
  readonly #options: GroqOptions;
  #client: unknown;

  private static readonly BASE_URL = "https://api.groq.com/openai/v1";

  constructor(options: GroqOptions = {}) {
    super(options.model ?? "llama-3.1-70b-versatile");
    this.#options = options;
  }

  async #getClient(): Promise<any> {
    if (!this.#client) {
      const { default: OpenAIClient } = await import("openai").catch(() => {
        throw new Error(
          "The `openai` package is required for the Groq adapter.\n" +
            "Install it with: npm install openai",
        );
      });

      this.#client = new OpenAIClient({
        apiKey: this.#options.apiKey ?? process.env["GROQ_API_KEY"] ?? "",
        baseURL: Groq.BASE_URL,
        maxRetries: this.#options.maxRetries ?? 3,
      });
    }
    return this.#client;
  }

  protected override async _call(
    prompt: string | Message[],
    config: LMCallConfig,
  ): Promise<LMResponse> {
    const client = await this.#getClient();

    const messages: Message[] =
      typeof prompt === "string" ? [{ role: "user", content: prompt }] : prompt;

    const response = await (client as any).chat.completions.create({
      model: config.model ?? this.model,
      messages,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stop: config.stop,
      n: config.n ?? 1,
      ...(config.extra ?? {}),
    });

    const texts = ((response as any).choices ?? []).map(
      (c: { message?: { content?: string | null } }) => c.message?.content ?? "",
    );

    const usageDetails = (response as any).usage as
      | { prompt_tokens: number; completion_tokens: number; total_tokens: number }
      | undefined;

    return {
      text: texts[0] ?? "",
      texts,
      usage: usageDetails
        ? {
            promptTokens: usageDetails.prompt_tokens,
            completionTokens: usageDetails.completion_tokens,
            totalTokens: usageDetails.total_tokens,
          }
        : null,
      raw: response,
    };
  }
}
