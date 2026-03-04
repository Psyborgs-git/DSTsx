import { LM } from "../LM.js";
import type { LMCallConfig, LMResponse, Message } from "../types.js";

/** Options for the HuggingFace Inference API adapter. */
export interface HuggingFaceOptions {
  apiKey?: string;
  model?: string;
  /** Override the inference endpoint URL (for dedicated endpoints). */
  endpointURL?: string;
}

/**
 * LM adapter for HuggingFace Inference API text-generation models.
 *
 * Uses the HuggingFace HTTP inference API directly (no SDK required).
 */
export class HuggingFace extends LM {
  readonly #options: HuggingFaceOptions;

  constructor(options: HuggingFaceOptions = {}) {
    super(options.model ?? "mistralai/Mistral-7B-Instruct-v0.3");
    this.#options = options;
  }

  protected override async _call(
    prompt: string | Message[],
    config: LMCallConfig,
  ): Promise<LMResponse> {
    const apiKey = this.#options.apiKey ?? process.env["HF_API_KEY"];
    const model = config.model ?? this.model;
    const url =
      this.#options.endpointURL ??
      `https://api-inference.huggingface.co/models/${model}`;

    const inputText =
      typeof prompt === "string" ? prompt : this.#messagesToText(prompt);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        inputs: inputText,
        parameters: {
          temperature: config.temperature,
          max_new_tokens: config.maxTokens,
          stop: config.stop,
          ...(config.extra ?? {}),
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HuggingFace request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as
      | Array<{ generated_text?: string }>
      | { generated_text?: string };

    const generated = Array.isArray(data)
      ? (data[0]?.generated_text ?? "")
      : (data.generated_text ?? "");

    return {
      text: generated,
      texts: [generated],
      usage: null,
      raw: data,
    };
  }

  #messagesToText(messages: Message[]): string {
    return messages.map((m) => `${m.role}: ${m.content}`).join("\n");
  }
}
