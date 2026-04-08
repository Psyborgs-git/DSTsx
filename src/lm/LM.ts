import { LRUCache } from "./cache.js";
import { DiskCache } from "./DiskCache.js";
import type { LMCallConfig, LMResponse, Message, StreamChunk } from "./types.js";

/**
 * Options accepted by the {@link LM.from} unified factory.
 *
 * All fields are optional — any option not provided falls back to the
 * provider's own defaults or its environment variables.
 */
export interface LMFactoryOptions {
  /** Provider API key (e.g. `OPENAI_API_KEY`). */
  apiKey?: string;
  /** Override the provider base URL (useful for proxies / local servers). */
  baseURL?: string;
  /** Default temperature for every call. */
  temperature?: number;
  /** Default max tokens per call. */
  maxTokens?: number;
  /** Number of retries on transient errors (where supported). */
  maxRetries?: number;
}

/** Signature for a provider factory registered with {@link LM.registerProvider}. */
export type LMProviderFactory = (model: string, options: LMFactoryOptions) => LM;

/**
 * Abstract base class for all language model adapters.
 *
 * Subclasses must implement {@link LM._call} which performs the actual
 * provider-specific API call.
 *
 * The base class handles:
 * - LRU response caching
 * - Request counting
 * - Token usage aggregation
 *
 * Use the {@link LM.from} factory to create an LM from a `"provider/model"`
 * string (mirrors `dspy.LM("openai/gpt-4o")` in Python):
 * ```ts
 * import { LM } from "@jaex/dstsx";
 * // Register built-in providers first:
 * import "@jaex/dstsx/lm/factory";  // or import { lmFrom } from "@jaex/dstsx"
 *
 * const lm = LM.from("openai/gpt-4o");
 * const lm2 = LM.from("anthropic/claude-3-5-sonnet-20241022");
 * ```
 */
export abstract class LM {
  /** Human-readable name / identifier for this model instance. */
  readonly model: string;

  #cache: LRUCache<string, LMResponse>;
  #diskCache: DiskCache | undefined;
  #requestCount = 0;
  #tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedPromptTokens: 0 };

  // ---------------------------------------------------------------------------
  // Static provider registry — powers LM.from()
  // ---------------------------------------------------------------------------

  static readonly #registry = new Map<string, LMProviderFactory>();

  /**
   * Register a custom LM provider so it can be used with {@link LM.from}.
   *
   * @example
   * ```ts
   * LM.registerProvider("myprovider", (model, opts) => new MyCustomLM({ model, ...opts }));
   * const lm = LM.from("myprovider/my-model");
   * ```
   */
  static registerProvider(provider: string, factory: LMProviderFactory): void {
    LM.#registry.set(provider.toLowerCase(), factory);
  }

  /**
   * Create an LM instance from a `"provider/model"` string.
   *
   * Mirrors `dspy.LM("openai/gpt-4o")` in Python.
   *
   * Built-in providers are registered by importing `"@jaex/dstsx"` (which
   * includes the factory side-effects).  Custom providers can be added with
   * {@link LM.registerProvider}.
   *
   * @example
   * ```ts
   * const lm  = LM.from("openai/gpt-4o");
   * const lm2 = LM.from("anthropic/claude-3-5-sonnet-20241022", { apiKey: "..." });
   * const lm3 = LM.from("ollama/llama3");
   * const lm4 = LM.from("groq/llama-3-70b-versatile");
   * ```
   */
  static from(modelString: string, options: LMFactoryOptions = {}): LM {
    const slashIdx = modelString.indexOf("/");
    const provider = slashIdx >= 0 ? modelString.slice(0, slashIdx) : modelString;
    const model = slashIdx >= 0 ? modelString.slice(slashIdx + 1) : "";
    const factory = LM.#registry.get(provider.toLowerCase());
    if (!factory) {
      const known = [...LM.#registry.keys()].join(", ") || "none registered yet";
      throw new Error(
        `Unknown LM provider: "${provider}". ` +
          `Registered providers: ${known}.\n` +
          `Use LM.registerProvider() to add a custom provider, or import the ` +
          `factory barrel to register built-ins: import "@jaex/dstsx".`,
      );
    }
    return factory(model, options);
  }

  constructor(
    model: string,
    cacheOptions: { maxSize?: number; ttlMs?: number; cacheDir?: string } = {},
  ) {
    this.model = model;
    this.#cache = new LRUCache(cacheOptions.maxSize, cacheOptions.ttlMs);
    this.#diskCache =
      cacheOptions.cacheDir !== undefined
        ? new DiskCache(cacheOptions.cacheDir, cacheOptions.maxSize, cacheOptions.ttlMs)
        : undefined;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Call the language model with either a plain string prompt or a list of
   * chat messages.
   */
  async call(
    prompt: string | Message[],
    config: LMCallConfig = {},
  ): Promise<LMResponse> {
    const cacheKey = config.cacheKey ?? this.#buildCacheKey(prompt, config);
    const cached = this.#cache.get(cacheKey);
    if (cached) return cached;

    // Check disk cache (second-level)
    if (this.#diskCache) {
      const diskCached = this.#diskCache.get(cacheKey);
      if (diskCached) {
        this.#cache.set(cacheKey, diskCached);
        return diskCached;
      }
    }

    const response = await this._call(prompt, config);
    this.#cache.set(cacheKey, response);

    // Persist to disk cache
    if (this.#diskCache) {
      this.#diskCache.set(cacheKey, response);
    }

    this.#requestCount += 1;
    if (response.usage) {
      this.#tokenUsage.promptTokens += response.usage.promptTokens;
      this.#tokenUsage.completionTokens += response.usage.completionTokens;
      this.#tokenUsage.totalTokens += response.usage.totalTokens;
      if (response.usage.cachedPromptTokens) {
        this.#tokenUsage.cachedPromptTokens += response.usage.cachedPromptTokens;
      }
    }
    return response;
  }

  /** Total number of (non-cached) API calls made. */
  get requestCount(): number {
    return this.#requestCount;
  }

  /** Accumulated token usage across all (non-cached) calls. */
  get tokenUsage(): Readonly<{ promptTokens: number; completionTokens: number; totalTokens: number; cachedPromptTokens: number }> {
    return { ...this.#tokenUsage };
  }

  /** Clear the in-memory response cache. */
  clearCache(): void {
    this.#cache.clear();
  }

  /**
   * Stream the language model response token by token.
   *
   * Returns an `AsyncIterable<StreamChunk>`. The last chunk has `done: true`.
   * Subclasses override this to provide real streaming; the base implementation
   * falls back to calling {@link LM.call} and yielding the full response as a
   * single chunk.
   */
  async *stream(
    prompt: string | Message[],
    config: LMCallConfig = {},
  ): AsyncGenerator<StreamChunk> {
    const response = await this.call(prompt, config);
    yield { delta: response.text, done: true, raw: response.raw };
  }

  // ---------------------------------------------------------------------------
  // Abstract interface for subclasses
  // ---------------------------------------------------------------------------

  /**
   * Perform the actual provider API call.  Subclasses must implement this.
   */
  protected abstract _call(
    prompt: string | Message[],
    config: LMCallConfig,
  ): Promise<LMResponse>;

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  #buildCacheKey(prompt: string | Message[], config: LMCallConfig): string {
    const promptStr = typeof prompt === "string" ? prompt : JSON.stringify(prompt);
    const configStr = JSON.stringify({
      model: config.model ?? this.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      stop: config.stop,
      n: config.n,
    });
    return `${promptStr}|||${configStr}`;
  }
}
