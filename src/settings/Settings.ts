import { AsyncLocalStorage } from "node:async_hooks";
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
 * Per-async-context storage.  Each async call tree started via
 * {@link Settings.context} gets its own isolated snapshot of settings.
 * Concurrent requests never see each other's overrides.
 */
const contextStore = new AsyncLocalStorage<SettingsOptions>();

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
 * Use {@link Settings.context} for per-request overrides in server environments.
 * Each invocation gets an isolated async context via `AsyncLocalStorage`, so
 * concurrent overlapping requests never interfere with each other:
 * ```ts
 * await settings.context({ lm: perRequestLM }, async () => {
 *   return program.forward({ question });
 * });
 * ```
 */
export class Settings {
  #global: SettingsOptions = {};

  // ---------------------------------------------------------------------------
  // Effective settings: async-context overrides take precedence over globals.
  // ---------------------------------------------------------------------------

  get #current(): SettingsOptions {
    const ctx = contextStore.getStore();
    return ctx !== undefined ? { ...this.#global, ...ctx } : this.#global;
  }

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
   * Merge `options` into the global settings.  Existing keys are overwritten;
   * omitted keys are unchanged.  This does NOT affect currently running
   * {@link Settings.context} scopes.
   */
  configure(options: SettingsOptions): void {
    this.#global = { ...this.#global, ...options };
  }

  /**
   * Reset all global settings to their defaults.
   */
  reset(): void {
    this.#global = {};
  }

  /**
   * Return a deep-frozen snapshot of the currently effective settings
   * (respects any active async-context overrides).
   */
  inspect(): Readonly<SettingsOptions> {
    return Object.freeze({ ...this.#current });
  }

  /**
   * Run `fn` inside an async-context-local settings scope.
   *
   * The `overrides` are merged on top of the current global settings and
   * stored in an `AsyncLocalStorage` context.  Concurrent calls each get
   * their own isolated snapshot — they never overwrite each other's settings.
   *
   * @example
   * ```ts
   * // In an Express/Fastify handler:
   * await settings.context({ lm: perRequestLM }, () => program.forward(inputs));
   * ```
   */
  async context<T>(overrides: SettingsOptions, fn: () => Promise<T>): Promise<T> {
    const merged = { ...this.#global, ...overrides };
    return contextStore.run(merged, fn);
  }
}

/** The global DSTsx settings singleton. */
export const settings = new Settings();
