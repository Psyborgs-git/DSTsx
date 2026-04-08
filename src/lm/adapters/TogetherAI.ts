import { LM } from "../LM.js";
import type { LMCallConfig, LMResponse, Message } from "../types.js";

/** Options for the Together AI adapter. */
export interface TogetherAIOptions {
  /** Together AI API key. Defaults to `TOGETHER_API_KEY` env var. */
  apiKey?: string;
  /** Model name (e.g. `"meta-llama/Llama-3-70b-chat-hf"`). */
  model?: string;
  maxRetries?: number;
}

/**
 * LM adapter for Together AI — an OpenAI-compatible inference endpoint
 * hosting many open-source models.
 *
 * Requires the `openai` package as a peer dependency:
 * ```
 * npm install openai
 * ```
 *
 * @example
 * ```ts
 * const lm = new TogetherAI({ model: "meta-llama/Llama-3-70b-chat-hf" });
 * // or via factory:
 * const lm = LM.from("together/meta-llama/Llama-3-70b-chat-hf");
 * ```
 */
export class TogetherAI extends LM {
  readonly #options: TogetherAIOptions;
  #client: unknown;

  private static readonly BASE_URL = "https://api.together.xyz/v1";

  constructor(options: TogetherAIOptions = {}) {
    super(options.model ?? "meta-llama/Llama-3-70b-chat-hf");
    this.#options = options;
  }

  async #getClient(): Promise<any> {
    if (!this.#client) {
      const { default: OpenAIClient } = await import("openai").catch(() => {
        throw new Error(
          "The `openai` package is required for the TogetherAI adapter.\n" +
            "Install it with: npm install openai",
        );
      });

      this.#client = new OpenAIClient({
        apiKey: this.#options.apiKey ?? process.env["TOGETHER_API_KEY"] ?? "",
        baseURL: TogetherAI.BASE_URL,
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
