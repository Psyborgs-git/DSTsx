import { settings } from "../settings/index.js";

export interface CacheOptions {
  cacheDir?: string;
  maxSize?: number;
  ttlMs?: number;
  enabled?: boolean;
}

/**
 * Configure the global caching behavior.
 * Mirrors `dspy.configure_cache`.
 */
export function configureCache(opts: CacheOptions): void {
  if (opts.enabled === false) {
    settings.configure({ cacheDir: "" });
    return;
  }
  if (opts.cacheDir !== undefined) {
    settings.configure({ cacheDir: opts.cacheDir });
  }
}
