import { Optimizer } from "./Optimizer.js";
import { Predict } from "../modules/index.js";
import type { Module } from "../modules/index.js";
import type { Example } from "../primitives/index.js";
import type { Metric } from "../evaluate/index.js";

/** Options for KNNFewShot. */
export interface KNNFewShotOptions {
  /** Number of nearest neighbors to use as demos (default: 3). */
  k?: number;
  /**
   * Embedding function that maps a text string to a dense vector.
   * Required for computing similarity between examples.
   */
  embeddingFn: (text: string) => Promise<number[]>;
  /**
   * Which field of each example to embed for similarity comparison
   * (default: first input field of the signature).
   */
  keyField?: string;
}

/**
 * Dynamic few-shot optimizer that selects demonstrations at inference time
 * using k-nearest-neighbour search over the training set.
 *
 * Unlike static few-shot optimizers this one injects demos into a
 * `Predict.forward` call by wrapping each predictor at compile time.
 *
 * Mirrors `dspy.KNNFewShot` in Python.
 */
export class KNNFewShot extends Optimizer {
  readonly #opts: Required<KNNFewShotOptions>;

  constructor(options: KNNFewShotOptions) {
    super();
    this.#opts = {
      k: options.k ?? 3,
      embeddingFn: options.embeddingFn,
      keyField: options.keyField ?? "",
    };
  }

  async compile(student: Module, trainset: Example[], _metric: Metric): Promise<Module> {
    const embeddingFn = this.#opts.embeddingFn;
    const k = this.#opts.k;

    // Pre-compute embeddings for all training examples.
    const trainEmbeddings = await Promise.all(
      trainset.map(async (ex) => {
        const key = this.#opts.keyField
          ? String(ex.get(this.#opts.keyField) ?? "")
          : Object.values(ex.toDict()).join(" ");
        return { ex, embedding: await embeddingFn(key) };
      }),
    );

    const optimized = Object.create(Object.getPrototypeOf(student) as object) as Module;
    Object.assign(optimized, student);

    // Wrap each Predict.forward to inject KNN demos at call time.
    for (const [, predictor] of optimized.namedPredictors()) {
      if (!(predictor instanceof Predict)) continue;

      const originalForward = predictor.forward.bind(predictor);

      predictor.forward = async (inputs: Record<string, unknown>) => {
        const queryText = Object.values(inputs).join(" ");
        const queryEmb = await embeddingFn(queryText);

        const scored = trainEmbeddings.map(({ ex, embedding }) => ({
          ex,
          score: cosineSimilarity(queryEmb, embedding),
        }));
        scored.sort((a, b) => b.score - a.score);
        predictor.demos = scored.slice(0, k).map((s) => s.ex);

        return originalForward(inputs);
      };
    }

    return optimized;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
    normA += (a[i] ?? 0) ** 2;
    normB += (b[i] ?? 0) ** 2;
  }
  return normA === 0 || normB === 0 ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
