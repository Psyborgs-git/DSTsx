import { Module, firstPrediction, type ModuleOutput } from "./Module.js";
import { Predict } from "./Predict.js";
import { Prediction } from "../primitives/index.js";

export interface RefineOptions {
  /** Maximum refinement iterations (default: 2). */
  maxRefinements?: number;
  /** Field name for feedback in the inner module re-run (default: "feedback"). */
  feedbackField?: string;
  /** If returns true, stop refining early. */
  stopCondition?: (prediction: Prediction) => boolean;
}

/**
 * Self-critique / iterative refinement loop.
 *
 * Runs the inner module, then uses a Predict critic to score the output.
 * If the output is not satisfactory, feeds critique back and re-runs.
 */
export class Refine extends Module {
  readonly #inner: Module;
  readonly #maxRefinements: number;
  readonly #feedbackField: string;
  readonly #stopCondition: ((p: Prediction) => boolean) | undefined;
  readonly #critic: Predict;

  constructor(inner: Module, options: RefineOptions = {}) {
    super();
    this.#inner = inner;
    this.#maxRefinements = options.maxRefinements ?? 2;
    this.#feedbackField = options.feedbackField ?? "feedback";
    this.#stopCondition = options.stopCondition;
    this.#critic = new Predict("output -> critique, is_satisfactory");
  }

  override async forward(...args: unknown[]): Promise<Prediction> {
    const innerForward = this.#inner.forward.bind(this.#inner) as (
      ...a: unknown[]
    ) => Promise<ModuleOutput>;

    let prediction = firstPrediction(await innerForward(...args));

    for (let i = 0; i < this.#maxRefinements; i++) {
      if (this.#stopCondition?.(prediction)) break;

      const outputStr = JSON.stringify(prediction.toDict());
      let critique: Prediction;
      try {
        critique = await this.#critic.forward({ output: outputStr });
      } catch {
        break;
      }

      const isSatisfactory = String(
        critique.get("is_satisfactory") ?? "",
      )
        .toLowerCase()
        .trim();
      if (isSatisfactory === "yes" || isSatisfactory === "true") break;

      const feedback = String(critique.get("critique") ?? "");
      const newArgs = [...args];
      if (
        newArgs.length > 0 &&
        typeof newArgs[0] === "object" &&
        newArgs[0] !== null
      ) {
        newArgs[0] = {
          ...(newArgs[0] as Record<string, unknown>),
          [this.#feedbackField]: feedback,
        };
      }
      try {
        prediction = firstPrediction(await innerForward(...newArgs));
      } catch {
        break;
      }
    }

    return prediction;
  }
}
