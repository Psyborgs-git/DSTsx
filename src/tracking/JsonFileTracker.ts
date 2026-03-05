import { mkdirSync } from "node:fs";
import { appendFile } from "node:fs/promises";
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
    const content = this.#buffer.join("\n") + "\n";
    this.#buffer.length = 0;
    await appendFile(this.#path, content, "utf8");
  }
}
