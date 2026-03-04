import type { Module } from "../modules/index.js";
import type { Example } from "../primitives/index.js";
import type { Metric } from "../evaluate/index.js";

/**
 * Abstract base class for all DSTsx optimizers (teleprompters).
 *
 * An optimizer takes a student program and a training set, then returns a new
 * (optimized) program with better prompts / few-shot examples.
 *
 * Mirrors `dspy.Teleprompter` in Python.
 */
export abstract class Optimizer {
  /**
   * Compile (optimize) a `student` program.
   *
   * @param student  - The module to optimize (must not be mutated).
   * @param trainset - Examples used to generate / score candidates.
   * @param metric   - Function that scores a prediction.
   * @returns        - A new, optimized copy of `student`.
   */
  abstract compile(
    student: Module,
    trainset: Example[],
    metric: Metric,
  ): Promise<Module>;
}
