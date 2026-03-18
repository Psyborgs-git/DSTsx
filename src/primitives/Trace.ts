import type { Signature } from "../signatures/index.js";

/** Token-usage statistics returned by an LM call. */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * A single LM call record captured during program execution.
 * Mirrors the trace entries in `dspy.settings.trace`.
 */
export interface Trace {
  /** The signature used for this call. */
  signature: Signature;
  /** The resolved input values passed to the LM. */
  inputs: Record<string, unknown>;
  /** The parsed output values returned by the LM. */
  outputs: Record<string, unknown>;
  /** Token usage for this call (if reported by the provider). */
  usage: TokenUsage | null;
  /** Wall-clock latency in milliseconds. */
  latencyMs: number;
  /** ISO-8601 timestamp of the call. */
  timestamp: string;
  /** Native reasoning content if provided by model. */
  reasoning?: string | undefined;
}
