import { Module } from "./Module.js";
import { Prediction } from "../primitives/index.js";
import { settings } from "../settings/index.js";

/**
 * Retrieve module that calls the globally configured retriever.
 *
 * Mirrors `dspy.Retrieve` in Python.
 *
 * @example
 * ```ts
 * settings.configure({ rm: new ColBERTv2("http://colbert.host") });
 * const retrieve = new Retrieve(3);
 * const result = await retrieve.forward("What is DSPy?");
 * console.log(result.get("passages")); // string[]
 * ```
 */
export class Retrieve extends Module {
  readonly k: number;

  constructor(k = 3) {
    super();
    this.k = k;
  }

  async forward(query: string): Promise<Prediction> {
    const rm = settings.rm;
    if (!rm) {
      throw new Error(
        "No retriever configured. Call settings.configure({ rm }) before using Retrieve.",
      );
    }
    const passages = await rm.retrieve(query, this.k);
    return new Prediction({ passages, query });
  }
}
