/** A single chat message (role + content). */
export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Configuration passed to every LM call. */
export interface LMCallConfig {
  /** Model identifier (e.g. "gpt-4o", "claude-3-opus-20240229"). */
  model?: string;
  /** Sampling temperature (0–2). */
  temperature?: number;
  /** Maximum tokens to generate. */
  maxTokens?: number;
  /** Stop sequences. */
  stop?: string[];
  /** Number of completions to generate (default 1). */
  n?: number;
  /** Opt-in to prompt caching API if the provider supports it (e.g. Anthropic `cache_control`). */
  promptCaching?: boolean;
  /**
   * Optional cache key override.  When provided the cache uses this key
   * instead of hashing the prompt.
   */
  cacheKey?: string;
  /** Pass-through extra options to the underlying provider SDK. */
  extra?: Record<string, unknown>;
}

/** The response returned by an LM adapter. */
export interface LMResponse {
  /** The primary (first) completion text. */
  text: string;
  /** All completion texts when `n > 1`. */
  texts: string[];
  /** Token usage (null when the provider does not report it). */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    /** Cached input tokens read by the provider (e.g. OpenAI cached_tokens, Anthropic cache_read_input_tokens). */
    cachedPromptTokens?: number;
  } | null;
  /** Raw provider response (opaque). */
  raw: unknown;
  /** Native reasoning content if provided by model (e.g. o1, o3, DeepSeek-R1). */
  reasoning?: string | undefined;
}

/** A single chunk emitted during token streaming. */
export interface StreamChunk {
  /** The incremental text delta for this chunk. */
  delta: string;
  /** True on the final chunk. */
  done: boolean;
  /** Raw provider chunk (opaque). */
  raw: unknown;
}

/**
 * A single entry in the LM call history, recorded for every non-cached
 * request made through {@link LM.call}.
 */
export interface LMCallRecord {
  /** The prompt that was sent (string or message array). */
  prompt: string | Message[];
  /** The call configuration used. */
  config: LMCallConfig;
  /** The response returned by the provider. */
  response: LMResponse;
  /**
   * Unix timestamp (ms) at which the response was received,
   * i.e. `Date.now()` after the provider call completed.
   */
  timestamp: number;
}
