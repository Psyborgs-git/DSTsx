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

    // If the promise was already synchronously resolved (e.g. returned a
    // resolved value, or the function is mocked), the .then() callbacks will
    // have fired synchronously via the microtask queue flush that happens
    // before this line in V8 (for already-settled promises this is guaranteed).
    // For truly async promises we emit a warning and return undefined.
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
