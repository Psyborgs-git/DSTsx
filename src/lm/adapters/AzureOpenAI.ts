import { LM } from "../LM.js";
import type { LMCallConfig, LMResponse, Message } from "../types.js";

/** Options for the Azure OpenAI adapter. */
export interface AzureOpenAIOptions {
  /** Azure OpenAI API key. Defaults to `AZURE_OPENAI_API_KEY` env var. */
  apiKey?: string;
  /**
   * Azure OpenAI resource name (e.g. `my-resource`).
   * The endpoint becomes `https://<resourceName>.openai.azure.com`.
   * Ignored when `endpoint` is provided directly.
   */
  resourceName?: string;
  /**
   * Full Azure OpenAI endpoint URL.
   * Example: `https://my-resource.openai.azure.com`
   */
  endpoint?: string;
  /** Deployment / model name in Azure (default: `"gpt-4o"`). */
  deploymentName?: string;
  /** Azure OpenAI API version (default: `"2024-02-01"`). */
  apiVersion?: string;
  maxRetries?: number;
}

/**
 * LM adapter for Azure OpenAI Service.
 *
 * Requires the `openai` package as a peer dependency:
 * ```
 * npm install openai
 * ```
 *
 * @example
 * ```ts
 * const lm = new AzureOpenAI({
 *   resourceName:   "my-resource",
 *   deploymentName: "gpt-4o",
 *   apiKey:         process.env.AZURE_OPENAI_API_KEY,
 * });
 * ```
 */
export class AzureOpenAI extends LM {
  readonly #options: AzureOpenAIOptions;
  #client: unknown;

  constructor(options: AzureOpenAIOptions = {}) {
    super(options.deploymentName ?? "gpt-4o");
    this.#options = options;
  }

  async #getClient(): Promise<any> {
    if (!this.#client) {
      const openaiModule = await import("openai").catch(() => {
        throw new Error(
          "The `openai` package is required for the AzureOpenAI adapter.\n" +
            "Install it with: npm install openai",
        );
      });

      // The openai package v4+ exports AzureOpenAI as a named export
      const AzClient = (openaiModule as unknown as { AzureOpenAI?: unknown }).AzureOpenAI
        ?? (openaiModule as unknown as { default?: { AzureOpenAI?: unknown } }).default?.AzureOpenAI;

      if (!AzClient) {
        throw new Error(
          "AzureOpenAI class not found in the `openai` package. " +
            "Ensure you have openai >= 4.x installed: npm install openai",
        );
      }

      const endpoint =
        this.#options.endpoint ??
        (this.#options.resourceName
          ? `https://${this.#options.resourceName}.openai.azure.com`
          : process.env["AZURE_OPENAI_ENDPOINT"]);

      this.#client = new (AzClient as new (opts: Record<string, unknown>) => unknown)({
        apiKey: this.#options.apiKey ?? process.env["AZURE_OPENAI_API_KEY"] ?? "",
        endpoint,
        apiVersion: this.#options.apiVersion ?? "2024-02-01",
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
