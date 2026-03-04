import { Optimizer } from "./Optimizer.js";
import { Predict } from "../modules/index.js";
import type { Module } from "../modules/index.js";
import type { Example } from "../primitives/index.js";
import type { Metric } from "../evaluate/index.js";
import { evaluate } from "../evaluate/index.js";
import { settings } from "../settings/index.js";

/** Options for COPRO. */
export interface COPROOptions {
  /** Number of instruction candidates to generate per predictor (default: 5). */
  breadth?: number;
  /** Number of refinement rounds (default: 3). */
  depth?: number;
}

/**
 * Collaborative Prompt Optimizer (COPRO) — uses the LM to propose improved
 * instructions for each `Predict` sub-module and selects the best via
 * metric evaluation.
 *
 * Mirrors `dspy.COPRO` in Python.
 */
export class COPRO extends Optimizer {
  readonly #breadth: number;
  readonly #depth: number;

  constructor(options: COPROOptions = {}) {
    super();
    this.#breadth = options.breadth ?? 5;
    this.#depth = options.depth ?? 3;
  }

  async compile(student: Module, trainset: Example[], metric: Metric): Promise<Module> {
    const lm = settings.lm;
    if (!lm) throw new Error("COPRO requires a configured LM.");

    let best = student;
    let bestScore = (await evaluate(student, trainset.slice(0, 10), metric)).score;

    for (let round = 0; round < this.#depth; round++) {
      for (const [name, predictor] of best.namedPredictors()) {
        if (!(predictor instanceof Predict)) continue;

        const candidates: string[] = [];
        for (let i = 0; i < this.#breadth; i++) {
          const prompt = this.#buildInstructionPrompt(predictor.instructions ?? "", name);
          const resp = await lm.call(prompt, { temperature: 0.9 });
          candidates.push(resp.text.trim());
        }

        for (const candidate of candidates) {
          const clone = Object.create(Object.getPrototypeOf(best) as object) as Module;
          Object.assign(clone, best);

          for (const [n, p] of clone.namedPredictors()) {
            if (n === name && p instanceof Predict) {
              p.instructions = candidate;
            }
          }

          const { score } = await evaluate(clone, trainset.slice(0, 10), metric);
          if (score > bestScore) {
            bestScore = score;
            best = clone;
          }
        }
      }
    }

    return best;
  }

  #buildInstructionPrompt(currentInstruction: string, fieldName: string): string {
    return (
      `You are an expert prompt engineer.\n` +
      `Current instruction for the "${fieldName}" field: "${currentInstruction}"\n\n` +
      `Write an improved, concise instruction for this field that will produce ` +
      `better outputs from a language model. Output only the instruction text.`
    );
  }
}
