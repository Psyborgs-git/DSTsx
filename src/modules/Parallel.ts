import { setTimeout } from "node:timers";
import { Module, firstPrediction, type ModuleOutput } from "./Module.js";
import type { Prediction } from "../primitives/index.js";

/**
 * Runs multiple modules in parallel and returns all their results as a
 * `Prediction[]`.
 *
 * Because `forward()` now returns `Prediction[]`, consumers can use the
 * results directly without needing the separate `run()` method.  `run()` is
 * retained as a more explicit, named alternative.
 */
export class Parallel extends Module {
  readonly #modules: Module[];
  readonly #timeoutMs: number | undefined;

  constructor(modules: Module[], options: { timeoutMs?: number } = {}) {
    super();
    this.#modules = modules;
    this.#timeoutMs = options.timeoutMs;
  }

  /**
   * Run all modules in parallel and return one {@link Prediction} per module.
   * If a module's `forward()` returns multiple predictions, the first is used.
   */
  async run(...args: unknown[]): Promise<Prediction[]> {
    const tasks = this.#modules.map((m) =>
      (m.forward as (...a: unknown[]) => Promise<ModuleOutput>)(...args),
    );

    let settled: Promise<ModuleOutput[]>;
    if (this.#timeoutMs !== undefined) {
      const timeoutMs = this.#timeoutMs;
      const withTimeout = tasks.map((t) =>
        Promise.race([
          t,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Parallel: timeout")), timeoutMs),
          ),
        ]),
      );
      settled = Promise.all(withTimeout);
    } else {
      settled = Promise.all(tasks);
    }

    return (await settled).map(firstPrediction);
  }

  /**
   * Execute all modules in parallel and return all predictions as an array
   * (one entry per module).
   */
  override async forward(...args: unknown[]): Promise<Prediction[]> {
    return this.run(...args);
  }
}

