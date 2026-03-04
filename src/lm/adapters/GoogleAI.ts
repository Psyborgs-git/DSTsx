import { LM } from "../LM.js";
import type { LMCallConfig, LMResponse, Message } from "../types.js";

/** Options for the Google Generative AI adapter. */
export interface GoogleAIOptions {
  apiKey?: string;
  model?: string;
}

/**
 * LM adapter for Google Gemini models via `@google/generative-ai`.
 *
 * Requires the `@google/generative-ai` package as a peer dependency:
 * ```
 * npm install @google/generative-ai
 * ```
 */
export class GoogleAI extends LM {
  readonly #options: GoogleAIOptions;

  constructor(options: GoogleAIOptions = {}) {
    super(options.model ?? "gemini-1.5-pro");
    this.#options = options;
  }

  protected override async _call(
    prompt: string | Message[],
    config: LMCallConfig,
  ): Promise<LMResponse> {
    const { GoogleGenerativeAI } = await import("@google/generative-ai").catch(() => {
      throw new Error(
        "The `@google/generative-ai` package is required for the GoogleAI adapter.\n" +
          "Install it with: npm install @google/generative-ai",
      );
    });

    const client = new GoogleGenerativeAI(
      this.#options.apiKey ?? process.env["GOOGLE_API_KEY"] ?? "",
    );
    const genModel = client.getGenerativeModel({ model: config.model ?? this.model });

    const text = typeof prompt === "string" ? prompt : this.#messagesToText(prompt);
    const result = await genModel.generateContent({
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxTokens,
        stopSequences: config.stop,
        candidateCount: config.n ?? 1,
      },
    });

    const texts = (result.response.candidates ?? []).map(
      (c: { content?: { parts?: Array<{ text?: string }> } }) =>
        c.content?.parts?.map((p) => p.text ?? "").join("") ?? "",
    );

    return {
      text: texts[0] ?? "",
      texts,
      usage: null,
      raw: result,
    };
  }

  #messagesToText(messages: Message[]): string {
    return messages.map((m) => `${m.role}: ${m.content}`).join("\n");
  }
}
