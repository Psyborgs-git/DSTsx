import type { LM } from "../lm/index.js";
import type { LMCallConfig } from "../lm/types.js";
import type { Retriever } from "../retrieve/index.js";

/** Configuration options for the global DSTsx settings. */
export interface SettingsOptions {
  /** Default language model used by all Predict modules. */
  lm?: LM;
  /** Default retrieval model used by the Retrieve module. */
  rm?: Retriever;
  /** Default LM call configuration (temperature, maxTokens, etc.). */
  lmConfig?: LMCallConfig;
  /** Log level for internal messages. */
  logLevel?: "silent" | "error" | "warn" | "info" | "debug";
  /** Directory for caching compiled programs (JSON). */
  cacheDir?: string;
}

/**
 * Global settings singleton for DSTsx.
 *
 * Configure the default LM and retriever before using any modules:
 * ```ts
 * import { settings } from "dstsx";
 * import { OpenAI } from "dstsx";
 *
 * settings.configure({ lm: new OpenAI({ model: "gpt-4o" }) });
 * ```
 *
 * Use {@link Settings.context} for per-request overrides in server environments:
 * ```ts
 * await settings.context({ lm: perRequestLM }, async () => {
 *   return program.forward({ question });
 * });
 * ```
 */
export class Settings {
  #current: SettingsOptions = {};

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------

  get lm(): LM | undefined {
    return this.#current.lm;
  }

  get rm(): Retriever | undefined {
    return this.#current.rm;
  }

  get lmConfig(): LMCallConfig | undefined {
    return this.#current.lmConfig;
  }

  get logLevel(): SettingsOptions["logLevel"] {
    return this.#current.logLevel ?? "warn";
  }

  get cacheDir(): string | undefined {
    return this.#current.cacheDir;
  }

  // ---------------------------------------------------------------------------
  // Mutation
  // ---------------------------------------------------------------------------

  /**
   * Merge `options` into the current settings.  Existing keys are overwritten;
   * omitted keys are unchanged.
   */
  configure(options: SettingsOptions): void {
    this.#current = { ...this.#current, ...options };
  }

  /**
   * Reset all settings to their defaults.
   */
  reset(): void {
    this.#current = {};
  }

  /**
   * Return a deep-frozen snapshot of the current settings (safe for logging).
   */
  inspect(): Readonly<SettingsOptions> {
    return Object.freeze({ ...this.#current });
  }

  /**
   * Run `fn` inside a temporary override context.
   *
   * The override is applied only for the duration of the async call and
   * restored afterward.  Useful for per-request LM overrides in servers.
   *
   * Note: Uses a simple save/restore pattern.  For concurrent request isolation
   * use the `AsyncLocalStorage`-based `withContext` pattern in a future release.
   */
  async context<T>(overrides: SettingsOptions, fn: () => Promise<T>): Promise<T> {
    const saved = { ...this.#current };
    this.configure(overrides);
    try {
      return await fn();
    } finally {
      this.#current = saved;
    }
  }
}

/** The global DSTsx settings singleton. */
export const settings = new Settings();
