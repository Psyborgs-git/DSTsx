import type { Module } from "../modules/Module.js";
import type { StreamChunk } from "../lm/types.js";

/**
 * Wrap any Module so its LM calls stream tokens as they arrive.
 * Mirrors `dspy.streamify`.
 */
export function streamify<T extends Module>(
  module: T,
): T & {
  stream(inputs: Record<string, unknown>): AsyncGenerator<StreamChunk>;
} {
  const wrapped = module as T & {
    stream(inputs: Record<string, unknown>): AsyncGenerator<StreamChunk>;
  };

  if (
    !("stream" in wrapped) ||
    typeof (wrapped as unknown as Record<string, unknown>)["stream"] !== "function"
  ) {
    (wrapped as unknown as Record<string, unknown>)["stream"] = async function* (
      inputs: Record<string, unknown>,
    ): AsyncGenerator<StreamChunk> {
      const result = await module.forward(inputs);
      const text = Array.isArray(result)
        ? JSON.stringify(result.map((r) => r.toDict()))
        : "toDict" in result
          ? JSON.stringify(result.toDict())
          : JSON.stringify(result);
      yield { delta: text, done: true, raw: result };
    };
  }

  return wrapped;
}
