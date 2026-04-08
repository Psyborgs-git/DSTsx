import { describe, it, expect } from "vitest";
import { benchmark } from "../../src/utils/benchmark.js";

describe("benchmark()", () => {
  it("returns a BenchmarkResult", async () => {
    const result = await benchmark(async () => {}, { iterations: 5, warmup: 1 });
    expect(result.iterations).toBe(5);
    expect(result.totalMs).toBeGreaterThanOrEqual(0);
    expect(result.meanMs).toBeGreaterThanOrEqual(0);
    expect(result.medianMs).toBeGreaterThanOrEqual(0);
    expect(result.minMs).toBeGreaterThanOrEqual(0);
    expect(result.maxMs).toBeGreaterThanOrEqual(result.minMs);
    expect(result.stddevMs).toBeGreaterThanOrEqual(0);
    expect(result.opsPerSecond).toBeGreaterThan(0);
  });

  it("works with a sync function", async () => {
    let counter = 0;
    const result = await benchmark(() => { counter++; }, { iterations: 10, warmup: 2 });
    // 10 timed + 2 warmup
    expect(counter).toBe(12);
    expect(result.iterations).toBe(10);
  });

  it("runs with default options", async () => {
    const result = await benchmark(async () => {});
    // Defaults: 10 iterations, 2 warmup
    expect(result.iterations).toBe(10);
  });

  it("verbose mode prints to console without throwing", async () => {
    // Shouldn't throw even with verbose=true
    await expect(
      benchmark(async () => {}, { iterations: 3, warmup: 1, verbose: true }),
    ).resolves.toBeDefined();
  });

  it("minMs <= medianMs <= maxMs", async () => {
    const result = await benchmark(async () => {}, { iterations: 20, warmup: 2 });
    expect(result.minMs).toBeLessThanOrEqual(result.medianMs);
    expect(result.medianMs).toBeLessThanOrEqual(result.maxMs);
  });

  it("totalMs is approximately iterations * meanMs", async () => {
    const result = await benchmark(async () => {}, { iterations: 10, warmup: 2 });
    // Allow 1% floating-point tolerance
    expect(Math.abs(result.totalMs - result.iterations * result.meanMs)).toBeLessThan(0.01);
  });

  it("uses function name as default label", async () => {
    // Should not throw
    async function myTask() {}
    await expect(benchmark(myTask, { iterations: 3, warmup: 1 })).resolves.toBeDefined();
  });
});
