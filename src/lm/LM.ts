import { LRUCache } from "./cache.js";
import { DiskCache } from "./DiskCache.js";
import type { LMCallConfig, LMResponse, Message } from "./types.js";

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
 */
export abstract class LM {
  /** Human-readable name / identifier for this model instance. */
  readonly model: string;

  #cache: LRUCache<string, LMResponse>;
  #diskCache: DiskCache | undefined;
  #requestCount = 0;
  #tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

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
    }
    return response;
  }

  /** Total number of (non-cached) API calls made. */
  get requestCount(): number {
    return this.#requestCount;
  }

  /** Accumulated token usage across all (non-cached) calls. */
  get tokenUsage(): Readonly<{ promptTokens: number; completionTokens: number; totalTokens: number }> {
    return { ...this.#tokenUsage };
  }

  /** Clear the in-memory response cache. */
  clearCache(): void {
    this.#cache.clear();
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
