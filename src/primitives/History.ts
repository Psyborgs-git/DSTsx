import type { Message } from "../lm/types.js";

/** A single conversation turn. */
export interface Turn {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Multi-turn conversation context.
 * Immutable — all mutation methods return a new History.
 * Mirrors `dspy.History`.
 */
export class History {
  readonly turns: ReadonlyArray<Turn>;

  constructor(turns?: Turn[]) {
    this.turns = Object.freeze([...(turns ?? [])]);
  }

  /** Append a turn and return a new History. */
  append(role: Turn["role"], content: string): History {
    return new History([...this.turns, { role, content }]);
  }

  /** Keep only the last `maxTurns` turns. */
  truncate(maxTurns: number): History {
    return new History([...this.turns].slice(-maxTurns));
  }

  /** Convert to LM message format. */
  toMessages(): Message[] {
    return this.turns.map((t) => ({ role: t.role, content: t.content }));
  }

  toJSON(): Turn[] {
    return [...this.turns];
  }

  static fromJSON(data: Turn[]): History {
    return new History(data);
  }
}
