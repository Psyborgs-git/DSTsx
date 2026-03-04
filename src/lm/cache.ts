/**
 * A minimal LRU (Least Recently Used) cache used to memoize LM responses.
 *
 * Entries are evicted when `maxSize` is reached (oldest-first) or when their
 * TTL has expired.
 */
export class LRUCache<K, V> {
  readonly #maxSize: number;
  readonly #ttlMs: number;
  readonly #map = new Map<K, { value: V; expiresAt: number }>();

  constructor(maxSize = 512, ttlMs = 60_000 * 60) {
    this.#maxSize = maxSize;
    this.#ttlMs = ttlMs;
  }

  get(key: K): V | undefined {
    const entry = this.#map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.#map.delete(key);
      return undefined;
    }
    // Re-insert to mark as recently used.
    this.#map.delete(key);
    this.#map.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.#map.has(key)) this.#map.delete(key);
    else if (this.#map.size >= this.#maxSize) {
      // Evict the oldest entry (first inserted = first in Map iteration order).
      const oldest = this.#map.keys().next().value;
      if (oldest !== undefined) this.#map.delete(oldest);
    }
    this.#map.set(key, { value, expiresAt: Date.now() + this.#ttlMs });
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): void {
    this.#map.delete(key);
  }

  clear(): void {
    this.#map.clear();
  }

  get size(): number {
    return this.#map.size;
  }
}
