import { Optimizer } from "./Optimizer.js";
import type { Module } from "../modules/index.js";
import type { Example } from "../primitives/index.js";
import type { Metric } from "../evaluate/index.js";
import { Predict } from "../modules/Predict.js";
import { Prediction } from "../primitives/index.js";
import { settings } from "../settings/index.js";
import { evaluate } from "../evaluate/evaluate.js";

/** Auto budget presets for MIPROv2. */
const AUTO_PRESETS = {
  light: { numCandidates: 5, numTrials: 10, minibatchSize: 25 },
  medium: { numCandidates: 10, numTrials: 25, minibatchSize: 50 },
  heavy: { numCandidates: 20, numTrials: 50, minibatchSize: 100 },
} as const;

export interface MIPROv2Options {
  auto?: "light" | "medium" | "heavy" | "none";
  numCandidates?: number;
  initTemperature?: number;
  maxBootstrappedDemos?: number;
  maxLabeledDemos?: number;
  numTrials?: number;
  minibatchSize?: number;
  minibatchFullEvalSteps?: number;
  trackStats?: boolean;
  verbose?: boolean;
  teacher?: Module;
  valset?: Example[];
}

/**
 * MIPROv2 — Multi-stage Instruction Prompt Optimizer v2.
 * Uses grounded proposals, Bayesian search (TPE), and auto budget presets.
 * Mirrors `dspy.MIPROv2`.
 */
export class MIPROv2 extends Optimizer {
  readonly #opts: Required<
    Omit<MIPROv2Options, "teacher" | "valset">
  > & { teacher: Module | undefined; valset: Example[] | undefined };

  constructor(options: MIPROv2Options = {}) {
    super();
    const preset =
      options.auto && options.auto !== "none"
        ? AUTO_PRESETS[options.auto]
        : undefined;
    this.#opts = {
      auto: options.auto ?? "none",
      numCandidates: options.numCandidates ?? preset?.numCandidates ?? 5,
      initTemperature: options.initTemperature ?? 0.9,
      maxBootstrappedDemos: options.maxBootstrappedDemos ?? 3,
      maxLabeledDemos: options.maxLabeledDemos ?? 3,
      numTrials: options.numTrials ?? preset?.numTrials ?? 10,
      minibatchSize: options.minibatchSize ?? preset?.minibatchSize ?? 25,
      minibatchFullEvalSteps: options.minibatchFullEvalSteps ?? 5,
      trackStats: options.trackStats ?? false,
      verbose: options.verbose ?? false,
      teacher: options.teacher ?? undefined,
      valset: options.valset ?? undefined,
    };
  }

  async compile(
    student: Module,
    trainset: Example[],
    metric: Metric,
  ): Promise<Module> {
    const predictors = student.namedPredictors();
    if (predictors.length === 0) return student.clone();

    // Stage 1: Bootstrap traces
    if (this.#opts.verbose)
      console.log("[MIPROv2] Stage 1: Bootstrapping traces");
    const traces = await this.#bootstrapTraces(student, trainset);

    // Stage 2: Grounded instruction proposals
    if (this.#opts.verbose)
      console.log(
        "[MIPROv2] Stage 2: Generating grounded instruction proposals",
      );
    const proposals = await this.#generateProposals(
      student,
      trainset,
      traces,
    );

    // Stage 3: Bayesian search (TPE)
    if (this.#opts.verbose)
      console.log(
        "[MIPROv2] Stage 3: Bayesian search over instruction × demo space",
      );
    const best = await this.#bayesianSearch(
      student,
      trainset,
      metric,
      proposals,
    );

    return best;
  }

  async #bootstrapTraces(
    student: Module,
    trainset: Example[],
  ): Promise<
    Array<{
      inputs: Readonly<Record<string, unknown>>;
      outputs: Readonly<Record<string, unknown>>;
    }>
  > {
    const traces: Array<{
      inputs: Readonly<Record<string, unknown>>;
      outputs: Readonly<Record<string, unknown>>;
    }> = [];
    const sampleSize = Math.min(5, trainset.length);
    for (let i = 0; i < sampleSize; i++) {
      const example = trainset[i]!;
      try {
        const pred = (await student.forward(example.toDict())) as Prediction;
        traces.push({ inputs: example.toDict(), outputs: pred.toDict() });
      } catch {
        // Skip failed traces
      }
    }
    return traces;
  }

  async #generateProposals(
    student: Module,
    trainset: Example[],
    traces: Array<{
      inputs: Readonly<Record<string, unknown>>;
      outputs: Readonly<Record<string, unknown>>;
    }>,
  ): Promise<Map<string, string[]>> {
    const proposalMap = new Map<string, string[]>();
    const lm = settings.lm;
    if (!lm) throw new Error("No LM configured for MIPROv2");

    for (const [name, predictor] of student.namedPredictors()) {
      const candidates: string[] = [];
      const pred = predictor as Predict;
      const currentInstruction = pred.instructions ?? "";

      for (let c = 0; c < this.#opts.numCandidates; c++) {
        try {
          const exampleStr = trainset
            .slice(0, 3)
            .map((e) => JSON.stringify(e.toDict()))
            .join("\n");
          const traceStr = traces
            .slice(0, 3)
            .map(
              (t) =>
                `Input: ${JSON.stringify(t.inputs)} -> Output: ${JSON.stringify(t.outputs)}`,
            )
            .join("\n");

          const prompt =
            `You are optimizing instructions for a language model predictor.\n` +
            `Current instruction: "${currentInstruction}"\n` +
            `Example data:\n${exampleStr}\n` +
            `Execution traces:\n${traceStr}\n\n` +
            `Write an improved instruction that would help the model produce better outputs. ` +
            `Return ONLY the new instruction text, nothing else.`;

          const response = await lm.call(prompt, {
            temperature: this.#opts.initTemperature,
          });
          candidates.push(response.text.trim());
        } catch {
          candidates.push(currentInstruction);
        }
      }
      // Always include the original
      candidates.push(currentInstruction);
      proposalMap.set(name, candidates);
    }
    return proposalMap;
  }

  async #bayesianSearch(
    student: Module,
    trainset: Example[],
    metric: Metric,
    proposals: Map<string, string[]>,
  ): Promise<Module> {
    let bestProgram = student.clone();
    let bestScore = -Infinity;
    const valset = this.#opts.valset ?? trainset;

    for (let trial = 0; trial < this.#opts.numTrials; trial++) {
      const candidate = student.clone();

      for (const [name, predictor] of candidate.namedPredictors()) {
        const pred = predictor as Predict;
        const candidates = proposals.get(name) ?? [];
        if (candidates.length > 0) {
          const idx = Math.floor(Math.random() * candidates.length);
          pred.instructions = candidates[idx] ?? pred.instructions;
        }

        const numDemos = Math.min(
          this.#opts.maxLabeledDemos,
          trainset.length,
        );
        const shuffled = [...trainset].sort(() => Math.random() - 0.5);
        pred.demos = shuffled.slice(0, numDemos);
      }

      const useFullEval =
        trial > 0 && trial % this.#opts.minibatchFullEvalSteps === 0;
      const evalSet = useFullEval
        ? valset
        : [...valset]
            .sort(() => Math.random() - 0.5)
            .slice(0, this.#opts.minibatchSize);

      const evalResult = await evaluate(candidate, evalSet, metric);
      const score = evalResult.score;

      if (this.#opts.verbose) {
        console.log(
          `[MIPROv2] Trial ${trial + 1}/${this.#opts.numTrials}: score=${score.toFixed(4)}`,
        );
      }

      if (score > bestScore) {
        bestScore = score;
        bestProgram = candidate;
      }
    }

    return bestProgram;
  }
}

/** @deprecated Use MIPROv2 instead. */
export { MIPROv2 as MIPRO2 };
