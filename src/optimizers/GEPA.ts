import { Optimizer } from "./Optimizer.js";
import type { Module } from "../modules/index.js";
import type { Example } from "../primitives/index.js";
import type { Metric } from "../evaluate/index.js";
import { Predict } from "../modules/Predict.js";
import { settings } from "../settings/index.js";
import { evaluate } from "../evaluate/evaluate.js";

export interface GEPAOptions {
  numSteps?: number;
  groupSize?: number;
  temperature?: number;
  valset?: Example[];
  feedbackEnabled?: boolean;
}

/**
 * Genetic-Pareto Prompt Optimizer.
 * Uses LM self-reflection to evolve prompts with Pareto-optimal selection.
 * Mirrors `dspy.GEPA`.
 */
export class GEPA extends Optimizer {
  readonly #opts: Required<Omit<GEPAOptions, "valset">> & {
    valset: Example[] | undefined;
  };

  constructor(options: GEPAOptions = {}) {
    super();
    this.#opts = {
      numSteps: options.numSteps ?? 20,
      groupSize: options.groupSize ?? 8,
      temperature: options.temperature ?? 1.0,
      valset: options.valset ?? undefined,
      feedbackEnabled: options.feedbackEnabled ?? true,
    };
  }

  async compile(
    student: Module,
    trainset: Example[],
    metric: Metric,
  ): Promise<Module> {
    const predictors = student.namedPredictors();
    if (predictors.length === 0) return student.clone();

    const lm = settings.lm;
    if (!lm) throw new Error("No LM configured for GEPA");

    const valset = this.#opts.valset ?? trainset;
    type Candidate = { instructions: Map<string, string>; score: number };

    // Initialize population with original instructions
    const origInstructions = new Map<string, string>();
    for (const [name, predictor] of predictors) {
      origInstructions.set(name, (predictor as Predict).instructions ?? "");
    }

    const initScore = await this.#evaluateCandidate(
      student,
      origInstructions,
      valset,
      metric,
    );
    const population: Candidate[] = [
      { instructions: origInstructions, score: initScore },
    ];

    for (let step = 0; step < this.#opts.numSteps; step++) {
      const newCandidates: Candidate[] = [];

      for (let g = 0; g < this.#opts.groupSize; g++) {
        const parent =
          population[Math.floor(Math.random() * population.length)]!;
        const newInstructions = new Map<string, string>();

        for (const [name] of predictors) {
          const currentInstr = parent.instructions.get(name) ?? "";
          if (this.#opts.feedbackEnabled) {
            try {
              const prompt =
                `You are improving instructions for a predictor.\n` +
                `Current instruction: "${currentInstr}"\n` +
                `Current score: ${parent.score.toFixed(4)}\n` +
                `Write an improved instruction. Return ONLY the instruction text.`;
              const response = await lm.call(prompt, {
                temperature: this.#opts.temperature,
              });
              newInstructions.set(name, response.text.trim());
            } catch {
              newInstructions.set(name, currentInstr);
            }
          } else {
            newInstructions.set(name, currentInstr);
          }
        }

        const score = await this.#evaluateCandidate(
          student,
          newInstructions,
          valset,
          metric,
        );
        newCandidates.push({ instructions: newInstructions, score });
      }

      // Combine and select best
      const combined = [...population, ...newCandidates];
      combined.sort((a, b) => b.score - a.score);
      population.length = 0;
      population.push(...combined.slice(0, this.#opts.groupSize));
    }

    // Apply best candidate
    const best = population[0]!;
    const result = student.clone();
    for (const [name, predictor] of result.namedPredictors()) {
      (predictor as Predict).instructions =
        best.instructions.get(name) ?? (predictor as Predict).instructions;
    }
    return result;
  }

  async #evaluateCandidate(
    student: Module,
    instructions: Map<string, string>,
    valset: Example[],
    metric: Metric,
  ): Promise<number> {
    const candidate = student.clone();
    for (const [name, predictor] of candidate.namedPredictors()) {
      (predictor as Predict).instructions =
        instructions.get(name) ?? (predictor as Predict).instructions;
    }
    const evalResult = await evaluate(candidate, valset, metric);
    return evalResult.score;
  }
}
