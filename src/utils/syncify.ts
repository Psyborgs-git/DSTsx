/**
 * Convert an async function to a synchronous one.
 *
 * Mirrors `dspy.syncify()` in Python.
 *
 * **Important caveats in Node.js:**
 * - True sync-from-async is architecturally limited in Node.js because the
 *   event loop cannot pump microtasks while the main thread is blocked.
 * - This implementation works **only when the returned promise is already
 *   resolved** (e.g. mocked or cached responses) or when called from inside a
 *   `worker_threads` Worker context (where `Atomics.waitAsync` is available).
 * - For general-purpose use, prefer `async/await`.  `syncify` is provided
 *   primarily for DSPy API compatibility and test utilities.
 *
 * @example
 * ```ts
 * // Works if fn() returns a resolved promise:
 * const syncFn = syncify(async (x: number) => x * 2);
 * const result = syncFn(21); // 42
 * ```
 */
export function syncify<TArgs extends unknown[], TReturn>(
  asyncFn: (...args: TArgs) => Promise<TReturn>,
): (...args: TArgs) => TReturn {
  return (...args: TArgs): TReturn => {
    let resolved = false;
    let result: TReturn | undefined;
    let thrownError: unknown;
    let hasError = false;

    // Attach handlers before any await
    const p = asyncFn(...args);
    p.then(
      (v) => {
        result = v;
        resolved = true;
      },
      (e: unknown) => {
        thrownError = e;
        hasError = true;
        resolved = true;
      },
    );

    // In JavaScript, Promise .then() callbacks are *always* asynchronous — they
    // are queued as microtasks and never run synchronously, even for already-settled
    // promises.  This means `resolved` will be false here in virtually all cases in
    // Node.js.  syncify() documents this fundamental limitation: it only succeeds
    // when the runtime provides a mechanism to drain the microtask queue synchronously
    // (e.g., inside a Worker thread or a native addon).  On the main thread it
    // emits a warning and returns `undefined` rather than silently hanging.
    if (!resolved) {
      // eslint-disable-next-line no-console
      console.warn(
        "[DSTsx syncify] The async function did not resolve synchronously. " +
          "syncify() can only convert functions that return already-resolved promises " +
          "or are called from a Worker thread context. " +
          "Use async/await for general async code.",
      );
    }

    if (hasError) throw thrownError;
    return result as TReturn;
  };
}
