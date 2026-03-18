import { Module } from "./Module.js";
import { Predict } from "./Predict.js";
import { Prediction } from "../primitives/index.js";
import { Code } from "../primitives/Code.js";
import { Signature } from "../signatures/index.js";
import type { Tool } from "./ReAct.js";

/**
 * Agent loop where actions are executable code, with persistent session state.
 * Mirrors `dspy.CodeAct`.
 */
export class CodeAct extends Module {
  readonly #predictor: Predict;
  readonly #tools: ReadonlyMap<string, Tool>;
  readonly #maxIter: number;
  readonly #sandbox: "worker" | "function" | "none";
  readonly #timeoutMs: number;

  constructor(
    signature: string | Signature,
    tools: Tool[] = [],
    maxIter = 5,
    sandbox: "worker" | "function" | "none" = "worker",
    timeoutMs = 10_000,
  ) {
    super();
    this.#tools = new Map(tools.map((t) => [t.name, t]));
    this.#maxIter = maxIter;
    this.#sandbox = sandbox;
    this.#timeoutMs = timeoutMs;

    const baseSig =
      typeof signature === "string" ? Signature.from(signature) : signature;
    const withTrajectory = baseSig.withInput("trajectory", {
      description: "Execution history so far",
      optional: true,
    });

    const toolDesc = tools
      .map((t) => `- ${t.name}: ${t.description}`)
      .join("\n");
    const instructions =
      `You are a code agent. Write JavaScript code to solve problems.\n` +
      (toolDesc ? `Available tools:\n${toolDesc}\n` : "") +
      `Respond with either:\n1. A JavaScript code block to execute\n2. Finish[answer] when done`;

    this.#predictor = new Predict(withTrajectory);
    this.#predictor.instructions = instructions;
  }

  async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    const trajectory: string[] = [];
    let finalAnswer = "";
    const codeBlocks: string[] = [];

    for (let i = 0; i < this.#maxIter; i++) {
      const augmented = { ...inputs, trajectory: trajectory.join("\n") };
      const result = await this.#predictor.forward(augmented);

      const outputKey =
        [...this.#predictor.signature.outputs.keys()][0] ?? "answer";
      const text = String(result.get(outputKey) ?? "");
      trajectory.push(text);

      const finishMatch = /Finish\[(.+)\]/i.exec(text);
      if (finishMatch) {
        finalAnswer = finishMatch[1] ?? "";
        break;
      }

      const codeMatch = /```(?:javascript|js)?\s*\n?([\s\S]*?)```/i.exec(text);
      if (codeMatch) {
        const code = (codeMatch[1] ?? "").trim();
        codeBlocks.push(code);
        try {
          const execResult = await this.#executeCode(code);
          trajectory.push(`Observation: ${execResult}`);
        } catch (err) {
          trajectory.push(
            `Error: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    const outputKey =
      [...this.#predictor.signature.outputs.keys()][0] ?? "answer";
    return new Prediction({
      [outputKey]: finalAnswer || trajectory.at(-1) || "",
      code: Code.from(codeBlocks.join("\n\n"), "javascript"),
      trajectory: trajectory.join("\n"),
    });
  }

  async #executeCode(code: string): Promise<string> {
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
        reject(new Error("CodeAct: worker execution timed out"));
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
        () => reject(new Error("CodeAct: execution timed out")),
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
