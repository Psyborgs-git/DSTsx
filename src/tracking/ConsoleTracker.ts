import { Tracker } from "./Tracker.js";
import type { TrackerEvent } from "./Tracker.js";

/**
 * A simple tracker that logs events to the console.
 */
export class ConsoleTracker extends Tracker {
  override log(event: TrackerEvent): void {
    const parts: string[] = [`[${event.type.toUpperCase()}]`];
    if (event.step !== undefined) parts.push(`step=${event.step}`);
    if (event.score !== undefined) parts.push(`score=${event.score.toFixed(4)}`);
    if (event.metadata) parts.push(JSON.stringify(event.metadata));
    console.log(parts.join(" "));
  }

  override async flush(): Promise<void> {
    // No buffering — nothing to flush.
  }
}
