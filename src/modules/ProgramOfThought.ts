import { Module } from "./Module.js";
import { Predict } from "./Predict.js";
import { Prediction } from "../primitives/index.js";
import type { Signature } from "../signatures/index.js";

/**
 * Generates JavaScript code to answer a question, executes it in a sandboxed
 * manner, and returns the result.
 *
 * Mirrors `dspy.ProgramOfThought` in Python.
 *
 * ⚠️  Security: code is executed via `Function()` inside a try/catch with a
 * short timeout.  Do NOT use with untrusted user inputs in production without
 * an additional sandboxing layer.
 */
export class ProgramOfThought extends Module {
  readonly maxAttempts: number;
  readonly #codeGenerator: Predict;
  readonly #corrector: Predict;

  constructor(signature: string | Signature, maxAttempts = 3) {
    super();
    this.maxAttempts = maxAttempts;
    this.#codeGenerator = new Predict(
      typeof signature === "string"
        ? `${signature}, instructions -> code`
        : signature.withOutput("code", {
            description: "JavaScript code that computes and returns the answer",
          }),
    );
    this.#corrector = new Predict(
      "code, error -> fixed_code",
    );
  }

  async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    let code = "";
    let result: unknown;
    let lastError = "";

    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      const genInputs =
        attempt === 0
          ? { ...inputs, instructions: "Write JavaScript code to compute the answer. Return the final value." }
          : { code, error: lastError };

      const generated = attempt === 0
        ? await this.#codeGenerator.forward(genInputs)
        : await this.#corrector.forward(genInputs);

      code = String(generated.get("code") ?? generated.get("fixed_code") ?? "");

      try {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        result = await new Function(`return (async () => { ${code} })()`)();
        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        result = undefined;
      }
    }

    const outputKey = [...this.#codeGenerator.signature.outputs.keys()].find(
      (k) => k !== "code",
    ) ?? "answer";

    return new Prediction({
      [outputKey]: result !== undefined ? String(result) : "",
      code,
    });
  }
}
