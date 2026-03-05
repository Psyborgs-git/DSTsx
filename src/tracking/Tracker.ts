/** Event types emitted during optimization. */
export interface TrackerEvent {
  /** Type of event. */
  type: "step" | "trial" | "best" | "done";
  /** Current step number. */
  step?: number | undefined;
  /** Score at this event. */
  score?: number | undefined;
  /** Additional metadata. */
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Abstract base class for experiment trackers.
 *
 * Implement this to log optimization events to console, files, or external
 * experiment tracking services.
 */
export abstract class Tracker {
  /** Log a single event. */
  abstract log(event: TrackerEvent): void;
  /** Flush any buffered events (e.g. write to disk). */
  abstract flush(): Promise<void>;
}
