import { Module } from "./Module.js";
import { BestOfN } from "./BestOfN.js";
import { majority } from "../primitives/majority.js";
import { Prediction } from "../primitives/index.js";

/**
 * Options for {@link MajorityVoting}.
 */
export interface MajorityVotingOptions {
  /**
   * Number of parallel calls (default: 5).
   */
  n?: number;
  /**
   * The output field on which to apply majority voting (default: `"answer"`).
   */
  field?: string;
}

/**
 * Runs an inner module `N` times in parallel and returns the prediction whose
 * `field` value appears most frequently (majority vote).  Ties are broken by
 * first occurrence.
 *
 * Mirrors `dspy.MajorityVoting` in Python.
 *
 * @example
 * ```ts
 * const cot = new ChainOfThought("question -> answer");
 * const voter = new MajorityVoting(cot, { n: 5, field: "answer" });
 *
 * const result = await voter.forward({ question: "What is 2+2?" });
 * console.log(result.get("answer")); // most frequent answer across 5 calls
 * ```
 */
export class MajorityVoting extends Module {
  readonly n: number;
  readonly field: string;
  readonly #inner: BestOfN;

  constructor(inner: Module, options: MajorityVotingOptions = {}) {
    super();
    this.n = options.n ?? 5;
    this.field = options.field ?? "answer";
    this.#inner = new BestOfN(inner, this.n, majority(this.field));
  }

  async forward(...args: unknown[]): Promise<Prediction> {
    return this.#inner.forward(...args);
  }
}
