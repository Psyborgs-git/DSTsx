import { LM } from "../LM.js";
import type { LMCallConfig, LMResponse, Message } from "../types.js";
import { settings } from "../../settings/index.js";

/** Options for the Anthropic adapter. */
export interface AnthropicOptions {
  apiKey?: string;
  model?: string;
  maxRetries?: number;
  /** Whether to enable prompt caching up-front. */
  promptCaching?: boolean;
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
  #client: any;

  constructor(options: AnthropicOptions = {}) {
    super(options.model ?? "claude-3-5-sonnet-20241022");
    this.#options = options;
  }

  async #getClient(): Promise<any> {
    if (!this.#client) {
      const { default: Client } = await import("@anthropic-ai/sdk").catch(() => {
        throw new Error(
          "The `@anthropic-ai/sdk` package is required for the Anthropic adapter.\n" +
            "Install it with: npm install @anthropic-ai/sdk",
        );
      });
      this.#client = new Client({
        apiKey: this.#options.apiKey ?? process.env["ANTHROPIC_API_KEY"],
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

    const doCache = config.promptCaching ?? settings.lmConfig?.promptCaching ?? this.#options.promptCaching ?? false;

    const msgs: Message[] =
      typeof prompt === "string" ? [{ role: "user", content: prompt }] : prompt;

    const systemMsg = msgs.find((m) => m.role === "system");
    const userMsgs = msgs.filter((m) => m.role !== "system");

    let systemPayload: string | Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }> | undefined;
    if (systemMsg) {
      systemPayload = doCache
        ? [{ type: "text", text: systemMsg.content, cache_control: { type: "ephemeral" } }]
        : systemMsg.content;
    }

    const messagesPayload = userMsgs.map((m, idx) => {
      const isLast = idx === userMsgs.length - 1;
      return {
        role: m.role as "user" | "assistant",
        content: (doCache && isLast)
          ? [{ type: "text" as const, text: m.content, cache_control: { type: "ephemeral" as const } }]
          : m.content,
      };
    });

    const response = await client.messages.create({
      model: config.model ?? this.model,
      max_tokens: config.maxTokens ?? 1024,
      system: systemPayload,
      messages: messagesPayload,
      temperature: config.temperature,
      ...(config.extra ?? {}),
    });

    const text =
      response.content
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { type: string; text?: string }) => b.text ?? "")
        .join("") ?? "";

    const usage = response.usage as { 
      input_tokens: number; 
      output_tokens: number; 
      cache_read_input_tokens?: number | null; 
      cache_creation_input_tokens?: number | null; 
    };

    const cachedInput = (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);

    return {
      text,
      texts: [text],
      usage: usage
        ? {
            promptTokens: usage.input_tokens,
            completionTokens: usage.output_tokens,
            totalTokens: usage.input_tokens + usage.output_tokens,
            ...(cachedInput > 0 ? { cachedPromptTokens: cachedInput } : {}),
          }
        : null,
      raw: response,
    };
  }

  override async *stream(
    prompt: string | Message[],
    config: LMCallConfig = {},
  ): AsyncGenerator<import("../types.js").StreamChunk> {
    const client = await this.#getClient();

    const doCache = config.promptCaching ?? settings.lmConfig?.promptCaching ?? this.#options.promptCaching ?? false;

    const msgs: Message[] =
      typeof prompt === "string" ? [{ role: "user", content: prompt }] : prompt;

    const systemMsg = msgs.find((m) => m.role === "system");
    const userMsgs = msgs.filter((m) => m.role !== "system");

    let systemPayload: string | Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }> | undefined;
    if (systemMsg) {
      systemPayload = doCache
        ? [{ type: "text", text: systemMsg.content, cache_control: { type: "ephemeral" } }]
        : systemMsg.content;
    }

    const messagesPayload = userMsgs.map((m, idx) => {
      const isLast = idx === userMsgs.length - 1;
      return {
        role: m.role as "user" | "assistant",
        content: (doCache && isLast)
          ? [{ type: "text" as const, text: m.content, cache_control: { type: "ephemeral" as const } }]
          : m.content,
      };
    });

    const stream = client.messages.stream({
      model: config.model ?? this.model,
      max_tokens: config.maxTokens ?? 1024,
      system: systemPayload,
      messages: messagesPayload,
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
