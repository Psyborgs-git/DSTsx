import { Optimizer } from "./Optimizer.js";
import type { Module } from "../modules/index.js";
import type { Example } from "../primitives/index.js";
import type { Metric } from "../evaluate/index.js";

export interface BetterTogetherOptions {
  promptOptimizer: Optimizer;
  finetuneOptimizer: Optimizer;
  sequence?: Array<"prompt" | "finetune">;
}

/**
 * Bridge between prompt optimization and fine-tuning.
 * Mirrors `dspy.BetterTogether`.
 */
export class BetterTogether extends Optimizer {
  readonly #promptOptimizer: Optimizer;
  readonly #finetuneOptimizer: Optimizer;
  readonly #sequence: Array<"prompt" | "finetune">;

  constructor(opts: BetterTogetherOptions) {
    super();
    this.#promptOptimizer = opts.promptOptimizer;
    this.#finetuneOptimizer = opts.finetuneOptimizer;
    this.#sequence = opts.sequence ?? ["prompt", "finetune", "prompt"];
  }

  async compile(
    student: Module,
    trainset: Example[],
    metric: Metric,
  ): Promise<Module> {
    let program = student.clone();
    for (const stage of this.#sequence) {
      if (stage === "prompt") {
        program = await this.#promptOptimizer.compile(
          program,
          trainset,
          metric,
        );
      } else {
        program = await this.#finetuneOptimizer.compile(
          program,
          trainset,
          metric,
        );
      }
    }
    return program;
  }
}
