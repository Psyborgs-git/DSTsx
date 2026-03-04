import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Tracker } from "./Tracker.js";
import type { TrackerEvent } from "./Tracker.js";

/**
 * A tracker that appends JSON-encoded events as lines to a file.
 *
 * @example
 * ```ts
 * const tracker = new JsonFileTracker("./runs/experiment1.jsonl");
 * const optimizer = new GRPO({ numSteps: 10 });
 * ```
 */
export class JsonFileTracker extends Tracker {
  readonly #path: string;
  readonly #buffer: string[] = [];

  constructor(path: string) {
    super();
    this.#path = path;
    mkdirSync(dirname(path), { recursive: true });
  }

  override log(event: TrackerEvent): void {
    this.#buffer.push(JSON.stringify({ ...event, ts: new Date().toISOString() }));
  }

  override async flush(): Promise<void> {
    if (this.#buffer.length === 0) return;
    appendFileSync(this.#path, this.#buffer.join("\n") + "\n", "utf8");
    this.#buffer.length = 0;
  }
}
