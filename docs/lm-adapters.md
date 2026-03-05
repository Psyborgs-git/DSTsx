# Language Model Adapters

All adapters extend the abstract `LM` class and share the same `call()` / `stream()` interface.

---

## Abstract `LM`

```ts
abstract class LM {
  readonly model: string;

  // Call the LM with a string prompt or chat messages
  async call(prompt: string | Message[], config?: LMCallConfig): Promise<LMResponse>;

  // Stream tokens via AsyncGenerator
  async *stream(prompt: string | Message[], config?: LMCallConfig): AsyncGenerator<StreamChunk>;

  // Counters (non-cached calls only)
  get requestCount(): number;
  get tokenUsage(): { promptTokens: number; completionTokens: number; totalTokens: number };

  // Clear in-memory LRU response cache
  clearCache(): void;
}
```

---

## `LMCallConfig`

```ts
interface LMCallConfig {
  model?:       string;                    // override model per call
  temperature?: number;                    // 0–2
  maxTokens?:   number;
  stop?:        string[];
  n?:           number;                    // number of completions (default 1)
  cacheKey?:    string;                    // manual cache key override
  extra?:       Record<string, unknown>;   // provider pass-through
}
```

---

## `LMResponse`

```ts
interface LMResponse {
  text:   string;           // primary completion
  texts:  string[];         // all completions when n > 1
  usage:  TokenUsage | null;
  raw:    unknown;          // raw provider response
}
```

---

## `Message`

```ts
interface Message {
  role:    "system" | "user" | "assistant";
  content: string;
}
```

---

## `StreamChunk`

```ts
interface StreamChunk {
  delta: string;   // incremental text
  done:  boolean;  // true on the final chunk
  raw:   unknown;  // raw provider chunk
}
```

---

## Adapters

### `OpenAI`

Requires: `npm install openai`

```ts
import { OpenAI } from "dstsx";

const lm = new OpenAI({
  model:      "gpt-4o",       // default "gpt-4o"
  apiKey:     "sk-...",       // or set OPENAI_API_KEY env var
  baseURL:    "https://...",  // optional custom endpoint
  maxRetries: 3,
  cacheDir:   "./.dstsx-cache", // optional disk persistence
});
```

---

### `Anthropic`

Requires: `npm install @anthropic-ai/sdk`

```ts
import { Anthropic } from "dstsx";

const lm = new Anthropic({
  model:      "claude-3-5-sonnet-20241022", // default
  apiKey:     "...",                        // or ANTHROPIC_API_KEY
  maxRetries: 3,
  cacheDir:   "./.dstsx-cache",
});
```

---

### `Cohere`

Requires: `npm install cohere-ai`

```ts
import { Cohere } from "dstsx";

const lm = new Cohere({
  model:  "command-r-plus", // default
  apiKey: "...",            // or COHERE_API_KEY
});
```

---

### `GoogleAI`

Requires: `npm install @google/generative-ai`

```ts
import { GoogleAI } from "dstsx";

const lm = new GoogleAI({
  model:  "gemini-1.5-pro", // default
  apiKey: "...",            // or GOOGLE_API_KEY
});
```

---

### `Ollama`

No extra package required — communicates with the Ollama REST API.

```ts
import { Ollama } from "dstsx";

const lm = new Ollama({
  model:   "llama3",                 // default
  baseURL: "http://localhost:11434", // default
});
```

---

### `LMStudio`

No extra package required — uses LM Studio's OpenAI-compatible `/v1` endpoint.

```ts
import { LMStudio } from "dstsx";

const lm = new LMStudio({
  model:   "local-model",
  baseURL: "http://localhost:1234/v1", // default
});
```

---

### `HuggingFace`

No extra package required — calls the HuggingFace Inference API directly.

```ts
import { HuggingFace } from "dstsx";

const lm = new HuggingFace({
  model:       "mistralai/Mistral-7B-Instruct-v0.3", // default
  apiKey:      "...",                                 // or HF_API_KEY
  endpointURL: "https://my-dedicated-endpoint.com",  // optional custom endpoint
});
```

---

### `MockLM`

Deterministic lookup-map LM for unit testing.

```ts
import { MockLM } from "dstsx";

const lm = new MockLM(
  {
    // prompt substring → response
    "What is 2+2?": "answer: 4",
  },
  "answer: unknown", // fallback when no match (optional; throws if omitted)
);

// Add responses at runtime
lm.addResponse("What is the capital of France?", "answer: Paris");
```

---

## LM Streaming

Stream LM responses token-by-token using `AsyncGenerator`. All adapters provide a default fallback that returns the full response as a single chunk. Real streaming is implemented for `OpenAI` and `Anthropic`.

```ts
import { settings, OpenAI, Predict } from "dstsx";

settings.configure({ lm: new OpenAI({ model: "gpt-4o" }) });

const qa = new Predict("question -> answer");

// Stream via Predict
for await (const chunk of qa.stream({ question: "Tell me a story." })) {
  process.stdout.write(chunk.delta);
  if (chunk.done) break;
}

// Stream directly from LM
const lm = new OpenAI({ model: "gpt-4o" });
for await (const chunk of lm.stream("What is TypeScript?")) {
  process.stdout.write(chunk.delta);
}
```

| Method | Available on | Description |
|---|---|---|
| `lm.stream(prompt, config?)` | `LM` (all adapters) | Stream from LM (fallback on unsupported) |
| `predict.stream(inputs)` | `Predict` | Stream from a Predict module |

---

## Disk-Persistent LM Cache

LM adapters accept a `cacheDir` option. Responses are persisted as JSON files named by a SHA-256 hash of the prompt, surviving process restarts.

```ts
import { OpenAI } from "dstsx";

const lm = new OpenAI({
  model:    "gpt-4o",
  cacheDir: "./.dstsx-cache", // optional disk persistence
});
```

The disk cache is checked **after** the in-memory LRU cache. On a hit the response is also written back into the in-memory cache.

### `DiskCache`

`DiskCache` is also exported for custom use:

```ts
import { DiskCache } from "dstsx";

const cache = new DiskCache(
  "./.dstsx-cache", // directory (created automatically)
  500,              // maxSize (files); default 500
  3_600_000,        // ttlMs; default undefined (no TTL)
);

cache.set("myKey", lmResponse);
const cached = cache.get("myKey");
cache.clear(); // delete all cache files
```

### `LRUCache`

In-memory LRU cache (used internally by all LM adapters):

```ts
import { LRUCache } from "dstsx";
```
