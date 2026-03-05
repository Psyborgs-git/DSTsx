import { LM } from "../LM.js";
import type { LMCallConfig, LMResponse, Message } from "../types.js";

/** Options for the OpenAI adapter. */
export interface OpenAIOptions {
  apiKey?: string;
  baseURL?: string;
  /** Default model, can be overridden per-call. */
  model?: string;
  maxRetries?: number;
  stream?: boolean;
}

/**
 * LM adapter for OpenAI chat-completion and text-completion models.
 *
 * Requires the `openai` package as a peer dependency:
 * ```
 * npm install openai
 * ```
 */
export class OpenAI extends LM {
  readonly #options: OpenAIOptions;

  constructor(options: OpenAIOptions = {}) {
    super(options.model ?? "gpt-4o");
    this.#options = options;
  }

  protected override async _call(
    prompt: string | Message[],
    config: LMCallConfig,
  ): Promise<LMResponse> {
    // Dynamically import so consumers who don't use OpenAI aren't forced to
    // install the package.
    const { default: OpenAIClient } = await import("openai").catch(() => {
      throw new Error(
        "The `openai` package is required for the OpenAI adapter.\n" +
          "Install it with: npm install openai",
      );
    });

    const client = new OpenAIClient({
      apiKey: this.#options.apiKey ?? process.env["OPENAI_API_KEY"],
      baseURL: this.#options.baseURL,
      maxRetries: this.#options.maxRetries ?? 3,
    });

    const messages: Message[] =
      typeof prompt === "string"
        ? [{ role: "user", content: prompt }]
        : prompt;

    const response = await client.chat.completions.create({
      model: config.model ?? this.model,
      messages,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stop: config.stop,
      n: config.n ?? 1,
      ...(config.extra ?? {}),
    });

    const texts = (response.choices ?? []).map(
      (c: { message?: { content?: string | null } }) => c.message?.content ?? "",
    );

    return {
      text: texts[0] ?? "",
      texts,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : null,
      raw: response,
    };
  }

  override async *stream(
    prompt: string | Message[],
    config: LMCallConfig = {},
  ): AsyncGenerator<import("../types.js").StreamChunk> {
    const { default: OpenAIClient } = await import("openai").catch(() => {
      throw new Error(
        "The `openai` package is required for the OpenAI adapter.\n" +
          "Install it with: npm install openai",
      );
    });

    const client = new OpenAIClient({
      apiKey: this.#options.apiKey ?? process.env["OPENAI_API_KEY"],
      baseURL: this.#options.baseURL,
      maxRetries: this.#options.maxRetries ?? 3,
    });

    const messages: Message[] =
      typeof prompt === "string" ? [{ role: "user", content: prompt }] : prompt;

    const stream = await client.chat.completions.create({
      model: config.model ?? this.model,
      messages,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stop: config.stop,
      stream: true as const,
      ...(config.extra ?? {}),
    });

    for await (const chunk of stream) {
      type StreamChoice = { delta?: { content?: string | null }; finish_reason?: string | null };
      type StreamResponse = { choices?: StreamChoice[] };
      const c = (chunk as StreamResponse).choices?.[0];
      const delta = c?.delta?.content ?? "";
      const done = c?.finish_reason != null;
      yield { delta, done, raw: chunk };
      if (done) break;
    }
  }
}
