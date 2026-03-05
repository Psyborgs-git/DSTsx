import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Optimizer } from "./Optimizer.js";
import { BootstrapFewShot } from "./BootstrapFewShot.js";
import { Predict } from "../modules/index.js";
import type { Module } from "../modules/index.js";
import type { Example } from "../primitives/index.js";
import type { Metric } from "../evaluate/index.js";

/** Output format for the exported fine-tuning data. */
export type FinetuneFormat = "openai" | "generic";

/** Options for BootstrapFinetune. */
export interface BootstrapFinetuneOptions {
  /** Path to write the JSONL fine-tuning file (default: "./finetune_data.jsonl"). */
  exportPath?: string | undefined;
  /** Format of the exported data (default: "openai"). */
  format?: FinetuneFormat | undefined;
  /** Bootstrap options passed to BootstrapFewShot internally. */
  maxBootstrappedDemos?: number | undefined;
}

/**
 * Collects LM traces via BootstrapFewShot and exports them as a JSONL file
 * suitable for fine-tuning.
 *
 * - `"openai"` format: `{ messages: [{role, content}, ...] }` per line
 * - `"generic"` format: `{ prompt: string, completion: string }` per line
 *
 * @example
 * ```ts
 * const optimizer = new BootstrapFinetune({
 *   exportPath: "./finetune_data.jsonl",
 *   format: "openai",
 * });
 * const recipe = await optimizer.compile(program, trainset, metric);
 * ```
 */
export class BootstrapFinetune extends Optimizer {
  readonly #exportPath: string;
  readonly #format: FinetuneFormat;
  readonly #maxBootstrappedDemos: number;
  readonly #bootstrap: BootstrapFewShot;

  constructor(options: BootstrapFinetuneOptions = {}) {
    super();
    this.#exportPath = options.exportPath ?? "./finetune_data.jsonl";
    this.#format = options.format ?? "openai";
    this.#maxBootstrappedDemos = options.maxBootstrappedDemos ?? 4;
    this.#bootstrap = new BootstrapFewShot({
      maxBootstrappedDemos: this.#maxBootstrappedDemos,
    });
  }

  override async compile(student: Module, trainset: Example[], metric: Metric): Promise<Module> {
    const compiled = await this.#bootstrap.compile(student, trainset, metric);

    const records: string[] = [];
    for (const [, predictor] of compiled.namedPredictors()) {
      if (predictor instanceof Predict) {
        for (const demo of predictor.demos) {
          const dict = demo.toDict() as Record<string, unknown>;
          const inputFields = [...predictor.signature.inputs.keys()];
          const outputFields = [...predictor.signature.outputs.keys()];

          const inputStr = inputFields.map((k) => `${k}: ${String(dict[k] ?? "")}`).join("\n");
          const outputStr = outputFields.map((k) => `${k}: ${String(dict[k] ?? "")}`).join("\n");

          if (this.#format === "openai") {
            records.push(
              JSON.stringify({
                messages: [
                  { role: "user", content: inputStr },
                  { role: "assistant", content: outputStr },
                ],
              }),
            );
          } else {
            records.push(JSON.stringify({ prompt: inputStr, completion: outputStr }));
          }
        }
      }
    }

    const dir = dirname(this.#exportPath);
    mkdirSync(dir, { recursive: true });
    writeFileSync(this.#exportPath, records.join("\n"), "utf8");

    return compiled;
  }
}
