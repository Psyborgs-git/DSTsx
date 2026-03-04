import { Optimizer } from "./Optimizer.js";
import { BootstrapFewShotWithRandomSearch } from "./BootstrapFewShotWithRandomSearch.js";
import { COPRO } from "./COPRO.js";
import type { Module } from "../modules/index.js";
import type { Example } from "../primitives/index.js";
import type { Metric } from "../evaluate/index.js";

/** Options for MIPRO. */
export interface MIPROOptions {
  /** Number of instruction candidates per predictor (default: 5). */
  numCandidates?: number;
  /** Temperature for instruction generation (default: 0.9). */
  initTemperature?: number;
  /** Number of random bootstrap candidate programs to evaluate (default: 8). */
  numCandidatePrograms?: number;
  /** Emit verbose progress logs (default: false). */
  verbose?: boolean;
}

/**
 * Multi-stage Instruction Prompt Optimizer (MIPRO) — combines COPRO-style
 * instruction proposal with BootstrapFewShotWithRandomSearch to jointly
 * optimize instructions and demonstrations.
 *
 * Mirrors `dspy.MIPRO` in Python.
 */
export class MIPRO extends Optimizer {
  readonly #opts: Required<MIPROOptions>;

  constructor(options: MIPROOptions = {}) {
    super();
    this.#opts = {
      numCandidates: options.numCandidates ?? 5,
      initTemperature: options.initTemperature ?? 0.9,
      numCandidatePrograms: options.numCandidatePrograms ?? 8,
      verbose: options.verbose ?? false,
    };
  }

  async compile(student: Module, trainset: Example[], metric: Metric): Promise<Module> {
    if (this.#opts.verbose) console.log("[MIPRO] Phase 1: Instruction optimization (COPRO)");

    const copro = new COPRO({ breadth: this.#opts.numCandidates, depth: 2 });
    const instructionOptimized = await copro.compile(student, trainset, metric);

    if (this.#opts.verbose) console.log("[MIPRO] Phase 2: Demo optimization (BootstrapFewShotWithRandomSearch)");

    const bootstrap = new BootstrapFewShotWithRandomSearch({
      numCandidatePrograms: this.#opts.numCandidatePrograms,
    });
    return bootstrap.compile(instructionOptimized, trainset, metric);
  }
}
