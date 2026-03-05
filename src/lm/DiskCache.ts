import { createHash } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
  mkdirSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import type { LMResponse } from "./types.js";

interface CacheEntry {
  key: string;
  value: LMResponse;
  expiresAt: number | null;
}

/**
 * Disk-persistent JSON cache for LM responses.
 *
 * Cache entries are stored as individual JSON files named by a truncated
 * SHA-256 hash of the key.  Supports optional TTL and LRU eviction.
 */
export class DiskCache {
  readonly #cacheDir: string;
  readonly #maxSize: number;
  readonly #ttlMs: number | undefined;

  constructor(cacheDir: string, maxSize = 500, ttlMs?: number) {
    this.#cacheDir = cacheDir;
    this.#maxSize = maxSize;
    this.#ttlMs = ttlMs;
    mkdirSync(cacheDir, { recursive: true });
  }

  get(key: string): LMResponse | undefined {
    const path = this.#pathFor(key);
    try {
      const raw = readFileSync(path, "utf8");
      const entry = JSON.parse(raw) as CacheEntry;
      if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
        unlinkSync(path);
        return undefined;
      }
      return entry.value;
    } catch {
      return undefined;
    }
  }

  set(key: string, value: LMResponse): void {
    this.#evictIfNeeded();
    const entry: CacheEntry = {
      key,
      value,
      expiresAt: this.#ttlMs != null ? Date.now() + this.#ttlMs : null,
    };
    writeFileSync(this.#pathFor(key), JSON.stringify(entry), "utf8");
  }

  clear(): void {
    try {
      for (const file of readdirSync(this.#cacheDir)) {
        if (file.endsWith(".json")) {
          try {
            unlinkSync(join(this.#cacheDir, file));
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }
  }

  #pathFor(key: string): string {
    // 16 hex chars = 64 bits of the SHA-256 digest. The collision probability
    // over 10 M distinct prompts is ~2.7e-9, acceptable for a local LM cache.
    const hash = createHash("sha256").update(key).digest("hex").slice(0, 16);
    return join(this.#cacheDir, `${hash}.json`);
  }

  #evictIfNeeded(): void {
    let files: Array<{ name: string; mtime: number }>;
    try {
      files = readdirSync(this.#cacheDir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => {
          const p = join(this.#cacheDir, f);
          try {
            return { name: f, mtime: statSync(p).mtimeMs };
          } catch {
            return { name: f, mtime: 0 };
          }
        });
    } catch {
      return;
    }

    if (files.length < this.#maxSize) return;

    const sorted = files.sort((a, b) => a.mtime - b.mtime);
    const toDelete = sorted.slice(0, files.length - this.#maxSize + 1);
    for (const f of toDelete) {
      try {
        unlinkSync(join(this.#cacheDir, f.name));
      } catch {
        // ignore
      }
    }
  }
}
