import { Optimizer } from "./Optimizer.js";
import type { Module } from "../modules/index.js";
import type { Example } from "../primitives/index.js";
import type { Metric } from "../evaluate/index.js";
import { Predict } from "../modules/Predict.js";
import { Prediction } from "../primitives/index.js";
import { settings } from "../settings/index.js";

export interface InferRulesOptions {
  numRules?: number;
  verbose?: boolean;
}

/**
 * Extracts explicit rules from successful/failed examples and appends them
 * to predictor instructions.
 * Mirrors `dspy.InferRules`.
 */
export class InferRules extends Optimizer {
  readonly #numRules: number;
  readonly #verbose: boolean;

  constructor(opts: InferRulesOptions = {}) {
    super();
    this.#numRules = opts.numRules ?? 5;
    this.#verbose = opts.verbose ?? false;
  }

  async compile(
    student: Module,
    trainset: Example[],
    metric: Metric,
  ): Promise<Module> {
    const lm = settings.lm;
    if (!lm) throw new Error("No LM configured for InferRules");

    const successes: string[] = [];
    const failures: string[] = [];

    for (const example of trainset) {
      try {
        const pred = (await student.forward(example.toDict())) as Prediction;
        const raw = metric(example, pred);
        const score = raw instanceof Promise ? await raw : raw;
        const numericScore =
          typeof score === "boolean"
            ? (score ? 1 : 0)
            : typeof score === "number"
              ? score
              : score.score;

        const entry = `Input: ${JSON.stringify(example.toDict())} -> Output: ${JSON.stringify(pred.toDict())}`;
        if (numericScore > 0.5) {
          successes.push(entry);
        } else {
          failures.push(entry);
        }
      } catch {
        // Skip failed examples
      }
    }

    const result = student.clone();

    for (const [name, predictor] of result.namedPredictors()) {
      const pred = predictor as Predict;
      const prompt =
        `Given these successful examples:\n${successes.slice(0, 5).join("\n")}\n\n` +
        `And these failed examples:\n${failures.slice(0, 5).join("\n")}\n\n` +
        `Write ${this.#numRules} concise rules that explain what makes an answer correct. ` +
        `Return ONLY the numbered rules.`;

      try {
        const response = await lm.call(prompt);
        const rules = response.text.trim();
        if (this.#verbose)
          console.log(`[InferRules] Rules for ${name}:\n${rules}`);
        pred.instructions = (pred.instructions ?? "") + "\n\nRules:\n" + rules;
      } catch {
        // Keep original instructions if rule inference fails
      }
    }

    return result;
  }
}
