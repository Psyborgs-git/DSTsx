import type { Tool } from "../modules/ReAct.js";

/**
 * Wraps a JavaScript execution sandbox as a reusable Tool.
 * Mirrors `dspy.PythonInterpreter` but for JavaScript.
 */
export class JSInterpreter {
  readonly #sandbox: "worker" | "function";
  readonly #timeoutMs: number;

  constructor(opts?: { sandbox?: "worker" | "function"; timeoutMs?: number }) {
    this.#sandbox = opts?.sandbox ?? "worker";
    this.#timeoutMs = opts?.timeoutMs ?? 10_000;
  }

  /** Returns a Tool-compatible interface for use in ReAct/CodeAct. */
  asTool(): Tool {
    return {
      name: "js_interpreter",
      description: "Execute JavaScript code and return the result",
      fn: async (code: string) => this.execute(code),
    };
  }

  /**
   * Execute JavaScript code and return the result as a string.
   *
   * **Security warning:** This evaluates arbitrary code. Always prefer the
   * `"worker"` sandbox mode and never run untrusted input without review.
   */
  async execute(code: string): Promise<string> {
    if (this.#sandbox === "worker") {
      return this.#executeInWorker(code);
    }
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function(
      `return (async () => { ${code} })()`,
    ) as () => Promise<unknown>;
    const result = await this.#withTimeout(fn(), this.#timeoutMs);
    return String(result ?? "");
  }

  async #executeInWorker(code: string): Promise<string> {
    const { Worker } = await import("node:worker_threads");
    const WORKER_CODE = `
const { workerData, parentPort } = require('node:worker_threads');
(async () => {
  try {
    const fn = new Function('return (async () => { ' + workerData.code + ' })()');
    const result = await fn();
    parentPort.postMessage({ result: String(result ?? '') });
  } catch (err) {
    parentPort.postMessage({ error: err.message ?? String(err) });
  }
})();
`;
    return new Promise((resolve, reject) => {
      const worker = new Worker(WORKER_CODE, {
        eval: true,
        workerData: { code },
      });
      const timer = setTimeout(() => {
        void worker.terminate();
        reject(new Error("JSInterpreter: execution timed out"));
      }, this.#timeoutMs);
      worker.on("message", (msg: { result?: string; error?: string }) => {
        clearTimeout(timer);
        void worker.terminate();
        if (msg.error) reject(new Error(msg.error));
        else resolve(msg.result ?? "");
      });
      worker.on("error", (err: Error) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  #withTimeout(promise: Promise<unknown>, ms: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("JSInterpreter: execution timed out")),
        ms,
      );
      promise.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e: unknown) => {
          clearTimeout(timer);
          reject(e);
        },
      );
    });
  }
}
