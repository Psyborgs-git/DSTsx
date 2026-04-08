/**
 * Result returned by {@link benchmark}.
 */
export interface BenchmarkResult {
  /** Number of iterations that were run. */
  iterations: number;
  /** Total elapsed time in milliseconds. */
  totalMs: number;
  /** Mean time per iteration in milliseconds. */
  meanMs: number;
  /** Median time per iteration in milliseconds. */
  medianMs: number;
  /** Minimum iteration time in milliseconds. */
  minMs: number;
  /** Maximum iteration time in milliseconds. */
  maxMs: number;
  /** Standard deviation of iteration times in milliseconds. */
  stddevMs: number;
  /** Throughput in operations per second. */
  opsPerSecond: number;
}

/**
 * Options for {@link benchmark}.
 */
export interface BenchmarkOptions {
  /**
   * Number of times to run `fn` (default: 10).
   */
  iterations?: number;
  /**
   * Number of warm-up iterations to discard before timing starts (default: 2).
   * Warm-up calls allow the JS engine to JIT-compile the function.
   */
  warmup?: number;
  /**
   * A label to print at the start of the benchmark.  When omitted the
   * function name is used.
   */
  label?: string;
  /**
   * When `true`, print a summary to stdout after the run (default: `false`).
   */
  verbose?: boolean;
}

/**
 * Measure the execution time of an async (or sync) function over multiple
 * iterations and return timing statistics.
 *
 * This is a lightweight micro-benchmark helper — **not** a replacement for a
 * full benchmark suite.  It is suitable for comparing relative performance of
 * LM pipeline variants within DSTsx.
 *
 * @example
 * ```ts
 * const result = await benchmark(
 *   async () => {
 *     const pred = new Predict("question -> answer");
 *     await pred.forward({ question: "What is 2 + 2?" });
 *   },
 *   { iterations: 20, warmup: 3, label: "Predict.forward", verbose: true },
 * );
 *
 * console.log(`Mean: ${result.meanMs.toFixed(2)} ms`);
 * ```
 */
export async function benchmark(
  fn: () => unknown | Promise<unknown>,
  options: BenchmarkOptions = {},
): Promise<BenchmarkResult> {
  const {
    iterations = 10,
    warmup = 2,
    label = (fn.name || "anonymous"),
    verbose = false,
  } = options;

  if (verbose) {
    console.log(`[benchmark] ${label} — warming up (${warmup} iterations)…`);
  }

  // Warm-up
  for (let i = 0; i < warmup; i++) {
    await fn();
  }

  if (verbose) {
    console.log(`[benchmark] ${label} — measuring (${iterations} iterations)…`);
  }

  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }

  const totalMs = times.reduce((a, b) => a + b, 0);
  const meanMs = totalMs / times.length;

  const sorted = [...times].sort((a, b) => a - b);
  const midIdx = Math.floor(sorted.length / 2);
  const medianMs =
    sorted.length % 2 === 1
      ? sorted[midIdx]!
      : (sorted[midIdx - 1]! + sorted[midIdx]!) / 2;

  const minMs = sorted[0]!;
  const maxMs = sorted[sorted.length - 1]!;

  const variance =
    times.reduce((acc, t) => acc + (t - meanMs) ** 2, 0) / times.length;
  const stddevMs = Math.sqrt(variance);

  const opsPerSecond = 1000 / meanMs;

  const result: BenchmarkResult = {
    iterations,
    totalMs,
    meanMs,
    medianMs,
    minMs,
    maxMs,
    stddevMs,
    opsPerSecond,
  };

  if (verbose) {
    console.log(
      `[benchmark] ${label}\n` +
        `  iterations : ${iterations}\n` +
        `  total      : ${totalMs.toFixed(2)} ms\n` +
        `  mean       : ${meanMs.toFixed(2)} ms\n` +
        `  median     : ${medianMs.toFixed(2)} ms\n` +
        `  min / max  : ${minMs.toFixed(2)} ms / ${maxMs.toFixed(2)} ms\n` +
        `  stddev     : ${stddevMs.toFixed(2)} ms\n` +
        `  ops/sec    : ${opsPerSecond.toFixed(2)}`,
    );
  }

  return result;
}
