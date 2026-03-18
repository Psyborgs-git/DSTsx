import type { Signature } from "../signatures/index.js";
import type { Example } from "../primitives/index.js";
import type { Message } from "../lm/types.js";

/**
 * Abstract base class for prompt adapters.
 * Controls how signatures, demos, and inputs are formatted into LM messages
 * and how LM output is parsed back into typed field values.
 */
export abstract class Adapter {
  /** Convert a signature + demos + inputs into LM-ready messages. */
  abstract format(
    sig: Signature,
    demos: Example[],
    inputs: Record<string, unknown>,
  ): Message[];

  /** Parse raw LM output string into typed field values. */
  abstract parse(
    sig: Signature,
    output: string,
  ): Record<string, unknown>;
}
