import { Module } from "./Module.js";
import type { Prediction } from "../primitives/index.js";

/**
 * Runs multiple modules in parallel and returns all their results.
 *
 * Note: `forward()` returns the first prediction for Module interface
 * compatibility.  Use `run()` to get all predictions.
 */
export class Parallel extends Module {
  readonly #modules: Module[];
  readonly #timeoutMs: number | undefined;

  constructor(modules: Module[], options: { timeoutMs?: number } = {}) {
    super();
    this.#modules = modules;
    this.#timeoutMs = options.timeoutMs;
  }

  /** Run all modules in parallel and return all predictions. */
  async run(...args: unknown[]): Promise<Prediction[]> {
    const tasks = this.#modules.map((m) =>
      (m.forward as (...a: unknown[]) => Promise<Prediction>)(...args),
    );

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
      return Promise.all(withTimeout);
    }

    return Promise.all(tasks);
  }

  /** For Module interface compatibility — returns first prediction. */
  override async forward(...args: unknown[]): Promise<Prediction> {
    const results = await this.run(...args);
    return results[0]!;
  }
}
