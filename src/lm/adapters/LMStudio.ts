import { LM } from "../LM.js";
import type { LMCallConfig, LMResponse, Message } from "../types.js";

/** Options for the LM Studio adapter. */
export interface LMStudioOptions {
  /** Base URL of the LM Studio server (default: http://localhost:1234/v1). */
  baseURL?: string;
  model?: string;
}

/**
 * LM adapter for LM Studio's OpenAI-compatible REST endpoint.
 */
export class LMStudio extends LM {
  readonly #baseURL: string;

  constructor(options: LMStudioOptions = {}) {
    super(options.model ?? "local-model");
    this.#baseURL = options.baseURL ?? "http://localhost:1234/v1";
  }

  protected override async _call(
    prompt: string | Message[],
    config: LMCallConfig,
  ): Promise<LMResponse> {
    const messages: Message[] =
      typeof prompt === "string" ? [{ role: "user", content: prompt }] : prompt;

    const response = await fetch(`${this.#baseURL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model ?? this.model,
        messages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stop: config.stop,
        n: config.n ?? 1,
        ...(config.extra ?? {}),
      }),
    });

    if (!response.ok) {
      throw new Error(`LMStudio request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    const texts = (data.choices ?? []).map((c) => c.message?.content ?? "");
    return {
      text: texts[0] ?? "",
      texts,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : null,
      raw: data,
    };
  }
}
