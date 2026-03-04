import { LM } from "../LM.js";
import type { LMCallConfig, LMResponse, Message } from "../types.js";

/** Options for the Ollama adapter. */
export interface OllamaOptions {
  /** Base URL of the Ollama server (default: http://localhost:11434). */
  baseURL?: string;
  model?: string;
}

/**
 * LM adapter for locally running Ollama models.
 * Communicates via the Ollama REST API (OpenAI-compatible `/v1` endpoint).
 */
export class Ollama extends LM {
  readonly #baseURL: string;

  constructor(options: OllamaOptions = {}) {
    super(options.model ?? "llama3");
    this.#baseURL = options.baseURL ?? "http://localhost:11434";
  }

  protected override async _call(
    prompt: string | Message[],
    config: LMCallConfig,
  ): Promise<LMResponse> {
    const messages: Message[] =
      typeof prompt === "string" ? [{ role: "user", content: prompt }] : prompt;

    const response = await fetch(`${this.#baseURL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model ?? this.model,
        messages,
        stream: false,
        options: {
          temperature: config.temperature,
          num_predict: config.maxTokens,
          stop: config.stop,
          ...(config.extra ?? {}),
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };

    const text = data.message?.content ?? "";
    return {
      text,
      texts: [text],
      usage:
        data.prompt_eval_count != null
          ? {
              promptTokens: data.prompt_eval_count,
              completionTokens: data.eval_count ?? 0,
              totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
            }
          : null,
      raw: data,
    };
  }
}
