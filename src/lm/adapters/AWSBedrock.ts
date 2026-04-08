import { LM } from "../LM.js";
import type { LMCallConfig, LMResponse, Message } from "../types.js";

/** Options for the AWS Bedrock adapter. */
export interface AWSBedrockOptions {
  /**
   * AWS region where the Bedrock endpoint is hosted.
   * Defaults to `AWS_DEFAULT_REGION` / `AWS_REGION` environment variable,
   * then falls back to `"us-east-1"`.
   */
  region?: string;
  /**
   * AWS access key ID.  Defaults to `AWS_ACCESS_KEY_ID` environment variable.
   * When omitted the AWS SDK uses its default credential-provider chain
   * (instance profiles, env vars, `~/.aws/credentials`, etc.).
   */
  accessKeyId?: string;
  /**
   * AWS secret access key.  Defaults to `AWS_SECRET_ACCESS_KEY` environment
   * variable.  Only relevant when `accessKeyId` is also provided.
   */
  secretAccessKey?: string;
  /**
   * AWS session token for temporary credentials.
   * Defaults to `AWS_SESSION_TOKEN` environment variable.
   */
  sessionToken?: string;
  /**
   * Bedrock model ID (e.g. `"anthropic.claude-3-5-sonnet-20241022-v2:0"`).
   * Cross-region inference profile ARNs are also supported.
   * Defaults to `"anthropic.claude-3-haiku-20240307-v1:0"`.
   */
  model?: string;
  /**
   * Guardrail identifier to apply to each call (optional).
   */
  guardrailIdentifier?: string;
  /** Guardrail version to apply (optional, e.g. `"DRAFT"` or `"1"`). */
  guardrailVersion?: string;
}

/**
 * LM adapter for Amazon Bedrock using the Converse API.
 *
 * The Converse API provides a unified chat-like interface for all models
 * hosted on Bedrock (Claude, Llama, Titan, etc.).
 *
 * Requires the `@aws-sdk/client-bedrock-runtime` package as a peer dependency:
 * ```
 * npm install @aws-sdk/client-bedrock-runtime
 * ```
 *
 * Authentication follows the standard AWS credential provider chain.
 * The simplest approach is to set the environment variables:
 * ```
 * AWS_ACCESS_KEY_ID=...
 * AWS_SECRET_ACCESS_KEY=...
 * AWS_DEFAULT_REGION=us-east-1
 * ```
 *
 * @example
 * ```ts
 * const lm = new AWSBedrock({
 *   model:  "anthropic.claude-3-5-sonnet-20241022-v2:0",
 *   region: "us-east-1",
 * });
 * settings.configure({ lm });
 * ```
 */
export class AWSBedrock extends LM {
  readonly #options: AWSBedrockOptions;
  #client: unknown;

  constructor(options: AWSBedrockOptions = {}) {
    super(options.model ?? "anthropic.claude-3-haiku-20240307-v1:0");
    this.#options = options;
  }

  async #getClient(): Promise<unknown> {
    if (!this.#client) {
      const sdkModule = await import("@aws-sdk/client-bedrock-runtime").catch(() => {
        throw new Error(
          "The `@aws-sdk/client-bedrock-runtime` package is required for the AWSBedrock adapter.\n" +
            "Install it with: npm install @aws-sdk/client-bedrock-runtime",
        );
      });

      const { BedrockRuntimeClient } = sdkModule as {
        BedrockRuntimeClient: new (config: Record<string, unknown>) => unknown;
      };

      const region =
        this.#options.region ??
        process.env["AWS_DEFAULT_REGION"] ??
        process.env["AWS_REGION"] ??
        "us-east-1";

      const clientConfig: Record<string, unknown> = { region };

      // Explicit credentials take precedence over the provider chain
      if (this.#options.accessKeyId && this.#options.secretAccessKey) {
        clientConfig["credentials"] = {
          accessKeyId: this.#options.accessKeyId,
          secretAccessKey: this.#options.secretAccessKey,
          ...(this.#options.sessionToken
            ? { sessionToken: this.#options.sessionToken }
            : {}),
        };
      } else if (
        process.env["AWS_ACCESS_KEY_ID"] &&
        process.env["AWS_SECRET_ACCESS_KEY"]
      ) {
        clientConfig["credentials"] = {
          accessKeyId: process.env["AWS_ACCESS_KEY_ID"],
          secretAccessKey: process.env["AWS_SECRET_ACCESS_KEY"],
          ...(process.env["AWS_SESSION_TOKEN"]
            ? { sessionToken: process.env["AWS_SESSION_TOKEN"] }
            : {}),
        };
      }
      // Otherwise let the SDK use its default credential provider chain.

      this.#client = new BedrockRuntimeClient(clientConfig);
    }
    return this.#client;
  }

  protected override async _call(
    prompt: string | Message[],
    config: LMCallConfig,
  ): Promise<LMResponse> {
    const sdkModule = await import("@aws-sdk/client-bedrock-runtime").catch(() => {
      throw new Error(
        "The `@aws-sdk/client-bedrock-runtime` package is required for the AWSBedrock adapter.\n" +
          "Install it with: npm install @aws-sdk/client-bedrock-runtime",
      );
    });

    const { ConverseCommand } = sdkModule as {
      ConverseCommand: new (input: Record<string, unknown>) => unknown;
    };

    const client = await this.#getClient();

    // Build the Converse API message list
    const messages: Message[] =
      typeof prompt === "string" ? [{ role: "user", content: prompt }] : prompt;

    // Separate system messages from conversation turns
    const systemMessages = messages.filter((m) => m.role === "system");
    const conversationMessages = messages.filter((m) => m.role !== "system");

    const converseMessages = conversationMessages.map((m) => ({
      role: m.role,
      content: [{ text: m.content }],
    }));

    const commandInput: Record<string, unknown> = {
      modelId: config.model ?? this.model,
      messages: converseMessages,
      inferenceConfig: {
        ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
        ...(config.maxTokens !== undefined ? { maxTokens: config.maxTokens } : {}),
        ...(config.stop?.length ? { stopSequences: config.stop } : {}),
      },
    };

    if (systemMessages.length > 0) {
      commandInput["system"] = systemMessages.map((m) => ({ text: m.content }));
    }

    if (this.#options.guardrailIdentifier) {
      commandInput["guardrailConfig"] = {
        guardrailIdentifier: this.#options.guardrailIdentifier,
        guardrailVersion: this.#options.guardrailVersion ?? "DRAFT",
      };
    }

    const command = new ConverseCommand(commandInput);
    const response = await (
      client as { send: (cmd: unknown) => Promise<unknown> }
    ).send(command);

    const resp = response as {
      output?: {
        message?: {
          content?: Array<{ text?: string }>;
        };
      };
      usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
      };
    };

    const text =
      resp.output?.message?.content
        ?.map((c) => c.text ?? "")
        .join("") ?? "";

    const usage = resp.usage
      ? {
          promptTokens: resp.usage.inputTokens ?? 0,
          completionTokens: resp.usage.outputTokens ?? 0,
          totalTokens: resp.usage.totalTokens ?? 0,
        }
      : null;

    return {
      text,
      texts: [text],
      usage,
      raw: response,
    };
  }
}
