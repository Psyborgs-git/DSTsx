import { EventEmitter } from "node:events";

/** Status message emitted during long optimizer runs. */
export interface StatusMessage {
  type: "info" | "warn" | "progress" | "done";
  text: string;
  step?: number | undefined;
  total?: number | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * EventEmitter for status messages during optimization.
 * Mirrors `dspy.StatusMessageProvider`.
 */
export class StatusMessageProvider extends EventEmitter {
  emitStatus(msg: StatusMessage): boolean {
    return super.emit("status", msg);
  }

  onStatus(listener: (msg: StatusMessage) => void): this {
    return super.on("status", listener);
  }
}

/** Global status message provider. */
export const statusProvider = new StatusMessageProvider();
