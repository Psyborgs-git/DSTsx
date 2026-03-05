import { Module } from "./Module.js";
import { Predict } from "./Predict.js";
import { Prediction } from "../primitives/index.js";
import { Signature, InputField, OutputField } from "../signatures/index.js";

/**
 * Generates JavaScript code to answer a question, executes it in a sandboxed
 * manner, and returns the result.
 *
 * Mirrors `dspy.ProgramOfThought` in Python.
 *
 * ⚠️  Security: code runs inside the same process via `new Function()` with a
 * configurable wall-clock timeout (default 5 s).  The timeout prevents
 * indefinite hangs but does **not** prevent access to Node.js APIs or the
 * global scope.  Do NOT use with untrusted inputs in production without
 * an additional sandboxing layer (e.g. a Worker thread with a restricted
 * `MessageChannel`).
 */
export class ProgramOfThought extends Module {
  readonly maxAttempts: number;
  /** Wall-clock timeout (ms) for each code execution attempt. */
  readonly timeoutMs: number;
  readonly sandbox: "worker" | "function" | "none";
  readonly #codeGenerator: Predict;
  readonly #corrector: Predict;
  readonly #outputKey: string;

  constructor(signature: string | Signature, maxAttempts = 3, timeoutMs = 5_000, sandbox: "worker" | "function" | "none" = "function") {
    super();
    this.maxAttempts = maxAttempts;
    this.timeoutMs = timeoutMs;
    this.sandbox = sandbox;

    const base = typeof signature === "string" ? Signature.from(signature) : signature;

    // Build the generator signature programmatically to avoid a double `->`:
    // inputs from base + optional `instructions` -> `code`
    const genSig = new Signature({
      inputs: new Map([
        ...base.inputs,
        [
          "instructions",
          InputField({
            description: "Task instructions for code generation",
            optional: true,
          }),
        ],
      ]),
      outputs: new Map([
        [
          "code",
          OutputField({
            description:
              "JavaScript code that computes and returns the answer via a `return` statement",
          }),
        ],
      ]),
      instructions: base.instructions,
    });

    this.#codeGenerator = new Predict(genSig);
    this.#corrector = new Predict("code, error -> fixed_code");
    this.#outputKey = [...base.outputs.keys()][0] ?? "answer";
  }

  async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    let code = "";
    let result: unknown;
    let lastError = "";

    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      const genInputs =
        attempt === 0
          ? {
              ...inputs,
              instructions:
                "Write JavaScript code to compute the answer. IMPORTANT: Use a `return` statement (not console.log) for the final value. Do not include markdown code fences.",
            }
          : { code, error: lastError };

      const generated =
        attempt === 0
          ? await this.#codeGenerator.forward(genInputs)
          : await this.#corrector.forward(genInputs);

      code = String(generated.get("code") ?? generated.get("fixed_code") ?? "");

      // Strip markdown code fences if present (```javascript ... ``` or ``` ... ```)
      code = code.replace(/^```(?:\w+)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

      try {
        if (this.sandbox === "worker") {
          result = await this.#executeInWorker(code, this.timeoutMs);
        } else if (this.sandbox === "none") {
          // eslint-disable-next-line @typescript-eslint/no-implied-eval
          const fn = new Function(`return (async () => { ${code} })()`) as () => Promise<unknown>;
          result = await fn();
        } else {
          // "function" — default, with timeout
          // eslint-disable-next-line @typescript-eslint/no-implied-eval
          const fn = new Function(`return (async () => { ${code} })()`) as () => Promise<unknown>;
          result = await this.#executeWithTimeout(fn(), this.timeoutMs);
        }
        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        result = undefined;
      }
    }

    return new Prediction({
      [this.#outputKey]: result !== undefined ? String(result) : "",
      code,
    });
  }

  async #executeInWorker(code: string, timeoutMs: number): Promise<string> {
    const { Worker } = await import("node:worker_threads");
    const WORKER_CODE = `
const { workerData, parentPort } = require('node:worker_threads');
const { code } = workerData;
(async () => {
  try {
    const fn = new Function('return (async () => { ' + code + ' })()');
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
        reject(new Error("ProgramOfThought: worker execution timed out"));
      }, timeoutMs);
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

  /**
   * Race `promise` against a wall-clock timer.
   * The underlying async work is not cancelled on timeout (no true abort), but
   * the returned Promise rejects promptly.
   */
  #executeWithTimeout(promise: Promise<unknown>, timeoutMs: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error(
              `ProgramOfThought: code execution timed out after ${timeoutMs}ms`,
            ),
          ),
        timeoutMs,
      );
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err: unknown) => {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
  }
}

