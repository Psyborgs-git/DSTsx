/** A single tool call entry. */
export interface ToolCallEntry {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
  error?: string | undefined;
}

/**
 * Structured tool call results.
 * Mirrors `dspy.ToolCalls`.
 */
export class ToolCalls {
  readonly calls: ReadonlyArray<ToolCallEntry>;

  constructor(calls: ToolCallEntry[]) {
    this.calls = Object.freeze([...calls]);
  }

  toJSON(): ToolCallEntry[] {
    return [...this.calls];
  }

  static fromJSON(data: ToolCallEntry[]): ToolCalls {
    return new ToolCalls(data);
  }
}
