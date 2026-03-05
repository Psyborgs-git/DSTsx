import { LM } from "../LM.js";
import type { LMCallConfig, LMResponse, Message } from "../types.js";

/** Options for the Anthropic adapter. */
export interface AnthropicOptions {
  apiKey?: string;
  model?: string;
  maxRetries?: number;
}

/**
 * LM adapter for Anthropic Claude models.
 *
 * Requires the `@anthropic-ai/sdk` package as a peer dependency:
 * ```
 * npm install @anthropic-ai/sdk
 * ```
 */
export class Anthropic extends LM {
  readonly #options: AnthropicOptions;

  constructor(options: AnthropicOptions = {}) {
    super(options.model ?? "claude-3-5-sonnet-20241022");
    this.#options = options;
  }

  protected override async _call(
    prompt: string | Message[],
    config: LMCallConfig,
  ): Promise<LMResponse> {
    const { default: Anthropic } = await import("@anthropic-ai/sdk").catch(() => {
      throw new Error(
        "The `@anthropic-ai/sdk` package is required for the Anthropic adapter.\n" +
          "Install it with: npm install @anthropic-ai/sdk",
      );
    });

    const client = new Anthropic({
      apiKey: this.#options.apiKey ?? process.env["ANTHROPIC_API_KEY"],
      maxRetries: this.#options.maxRetries ?? 3,
    });

    const msgs: Message[] =
      typeof prompt === "string" ? [{ role: "user", content: prompt }] : prompt;

    const systemMsg = msgs.find((m) => m.role === "system");
    const userMsgs = msgs.filter((m) => m.role !== "system");

    const response = await client.messages.create({
      model: config.model ?? this.model,
      max_tokens: config.maxTokens ?? 1024,
      system: systemMsg?.content,
      messages: userMsgs.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      temperature: config.temperature,
      ...(config.extra ?? {}),
    });

    const text =
      response.content
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { type: string; text?: string }) => b.text ?? "")
        .join("") ?? "";

    return {
      text,
      texts: [text],
      usage: response.usage
        ? {
            promptTokens: response.usage.input_tokens,
            completionTokens: response.usage.output_tokens,
            totalTokens: response.usage.input_tokens + response.usage.output_tokens,
          }
        : null,
      raw: response,
    };
  }

  override async *stream(
    prompt: string | Message[],
    config: LMCallConfig = {},
  ): AsyncGenerator<import("../types.js").StreamChunk> {
    const { default: Anthropic } = await import("@anthropic-ai/sdk").catch(() => {
      throw new Error(
        "The `@anthropic-ai/sdk` package is required for the Anthropic adapter.\n" +
          "Install it with: npm install @anthropic-ai/sdk",
      );
    });

    const client = new Anthropic({
      apiKey: this.#options.apiKey ?? process.env["ANTHROPIC_API_KEY"],
      maxRetries: this.#options.maxRetries ?? 3,
    });

    const msgs: Message[] =
      typeof prompt === "string" ? [{ role: "user", content: prompt }] : prompt;

    const systemMsg = msgs.find((m) => m.role === "system");
    const userMsgs = msgs.filter((m) => m.role !== "system");

    const stream = client.messages.stream({
      model: config.model ?? this.model,
      max_tokens: config.maxTokens ?? 1024,
      system: systemMsg?.content,
      messages: userMsgs.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ...(config.extra ?? {}),
    });

    for await (const event of stream) {
      type AnthropicStreamEvent = { type?: string; delta?: { type?: string; text?: string } };
      const e = event as AnthropicStreamEvent;
      if (e.type === "content_block_delta" && e.delta?.type === "text_delta") {
        yield { delta: e.delta.text ?? "", done: false, raw: event };
      } else if (e.type === "message_stop") {
        yield { delta: "", done: true, raw: event };
        break;
      }
    }
  }
}
