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
  readonly #codeGenerator: Predict;
  readonly #corrector: Predict;
  readonly #outputKey: string;

  constructor(signature: string | Signature, maxAttempts = 3, timeoutMs = 5_000) {
    super();
    this.maxAttempts = maxAttempts;
    this.timeoutMs = timeoutMs;

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
                "Write JavaScript code to compute the answer. Use a `return` statement for the final value.",
            }
          : { code, error: lastError };

      const generated =
        attempt === 0
          ? await this.#codeGenerator.forward(genInputs)
          : await this.#corrector.forward(genInputs);

      code = String(generated.get("code") ?? generated.get("fixed_code") ?? "");

      try {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const fn = new Function(`return (async () => { ${code} })()`) as () => Promise<unknown>;
        result = await this.#executeWithTimeout(fn(), this.timeoutMs);
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
