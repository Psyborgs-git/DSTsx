/**
 * LM provider factory — registers all built-in providers with {@link LM.from}.
 *
 * This module is imported as a side-effect by the top-level barrel so that
 * `LM.from("openai/gpt-4o")` works out of the box.  It can also be imported
 * explicitly if you only need the LM sub-package:
 *
 * ```ts
 * import "@jaex/dstsx/lm/factory";
 * import { LM } from "@jaex/dstsx";
 *
 * const lm = LM.from("openai/gpt-4o");
 * ```
 */

import { LM } from "./LM.js";
import type { LMFactoryOptions } from "./LM.js";
import { OpenAI } from "./adapters/OpenAI.js";
import { Anthropic } from "./adapters/Anthropic.js";
import { Cohere } from "./adapters/Cohere.js";
import { GoogleAI } from "./adapters/GoogleAI.js";
import { Ollama } from "./adapters/Ollama.js";
import { LMStudio } from "./adapters/LMStudio.js";
import { HuggingFace } from "./adapters/HuggingFace.js";
import { AzureOpenAI } from "./adapters/AzureOpenAI.js";
import { TogetherAI } from "./adapters/TogetherAI.js";
import { Groq } from "./adapters/Groq.js";

LM.registerProvider("openai", (model, opts) => new OpenAI({ ...(model ? { model } : {}), ...opts }));
LM.registerProvider("anthropic", (model, opts) => new Anthropic({ ...(model ? { model } : {}), ...opts }));
LM.registerProvider("cohere", (model, opts) => new Cohere({ ...(model ? { model } : {}), ...opts }));
LM.registerProvider("google", (model, opts) => new GoogleAI({ ...(model ? { model } : {}), ...opts }));
LM.registerProvider("gemini", (model, opts) => new GoogleAI({ ...(model ? { model } : {}), ...opts }));
LM.registerProvider("ollama", (model, opts) => new Ollama({ ...(model ? { model } : {}), ...opts }));
LM.registerProvider("lmstudio", (model, opts) => new LMStudio({ ...(model ? { model } : {}), ...opts }));
LM.registerProvider("huggingface", (model, opts) => new HuggingFace({ ...(model ? { model } : {}), ...opts }));
LM.registerProvider("hf", (model, opts) => new HuggingFace({ ...(model ? { model } : {}), ...opts }));
LM.registerProvider("azure", (model, opts) => new AzureOpenAI({ ...(model ? { deploymentName: model } : {}), ...opts }));
LM.registerProvider("azure_openai", (model, opts) => new AzureOpenAI({ ...(model ? { deploymentName: model } : {}), ...opts }));
LM.registerProvider("together", (model, opts) => new TogetherAI({ ...(model ? { model } : {}), ...opts }));
LM.registerProvider("together_ai", (model, opts) => new TogetherAI({ ...(model ? { model } : {}), ...opts }));
LM.registerProvider("groq", (model, opts) => new Groq({ ...(model ? { model } : {}), ...opts }));

/**
 * Convenience function — mirrors Python's `dspy.LM("provider/model")`.
 *
 * Equivalent to calling `LM.from(modelString, options)`.
 *
 * @example
 * ```ts
 * import { lmFrom, settings } from "@jaex/dstsx";
 *
 * settings.configure({ lm: lmFrom("openai/gpt-4o") });
 * ```
 */
export function lmFrom(modelString: string, options: LMFactoryOptions = {}): LM {
  return LM.from(modelString, options);
}

export type { LMFactoryOptions };
