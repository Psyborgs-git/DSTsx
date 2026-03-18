# Utilities

Miscellaneous helper functions and classes exported from `dstsx`.

---

## `streamify(module)`

Wraps any `Module` so its LM calls stream tokens as they arrive (if the underlying LM supports streaming).

```ts
import { streamify, Predict, settings, OpenAI } from "dstsx";

settings.configure({ lm: new OpenAI({ model: "gpt-4o" }) });

const writer = streamify(new Predict("topic -> essay"));

for await (const chunk of writer.stream({ topic: "The future of AI" })) {
  process.stdout.write(chunk.delta);
  if (chunk.done) break;
}
```

---

## `asyncify(module)`

Semantic wrapper for API compatibility with DSPy's `asyncify`. In Node.js, `Module.forward()` is already async, so this returns the module unchanged.

```ts
import { asyncify, Predict } from "dstsx";

const qa = asyncify(new Predict("question -> answer"));
const result = await qa.forward({ question: "What is 2 + 2?" });
```

---

## `inspectHistory(n?, format?)`

Pretty-prints statistics for the last `n` LM calls to `console.log`.

```ts
import { inspectHistory } from "dstsx";

await program.forward({ question: "What is gravity?" });

inspectHistory();          // text summary of the last call
inspectHistory(3);         // last 3 calls
inspectHistory(1, "json"); // JSON output
```

---

## `load(path)` and `registerModule(name, ctor)`

Load a compiled module from a JSON file. The module's class must be registered first.

```ts
import { load, registerModule } from "dstsx";

class MyQA extends Module {
  predict = new Predict("question -> answer");
  async forward(inputs: { question: string }) {
    return this.predict.forward(inputs);
  }
}

// Register the class for deserialization
registerModule("MyQA", MyQA);

// Load a previously compiled program
const loaded = await load("./qa_optimized.json");
```

The JSON file must contain a `__type` field matching the registered name:

```json
{
  "__type": "MyQA",
  "predict": { "demos": [...], "instructions": "..." }
}
```

### `ModuleRegistry`

The underlying `Map<string, new () => Module>` used by `load()`:

```ts
import { ModuleRegistry } from "dstsx";

ModuleRegistry.set("MyQA", MyQA);
const Ctor = ModuleRegistry.get("MyQA");
```

---

## `configureCache(opts)`

Configure global caching behavior.

```ts
import { configureCache } from "dstsx";

configureCache({
  cacheDir: "./.dstsx-cache", // disk cache directory
  maxSize:  500,              // max cached items
  ttlMs:    3_600_000,        // 1 hour TTL
  enabled:  true,             // set false to disable disk caching
});

// Disable disk caching
configureCache({ enabled: false });
```

### `CacheOptions`

```ts
interface CacheOptions {
  cacheDir?: string;
  maxSize?:  number;
  ttlMs?:    number;
  enabled?:  boolean;
}
```

---

## `StatusMessage` and `StatusMessageProvider`

Progress feedback for long optimizer runs.

```ts
import { statusProvider } from "dstsx";
import type { StatusMessage } from "dstsx";

// Listen for optimizer progress
statusProvider.onStatus((msg: StatusMessage) => {
  console.log(`[${msg.type}] Step ${msg.step}/${msg.total}: ${msg.text}`);
});
```

Or use `settings.configure({ onStatus })` as a convenience shorthand:

```ts
import { settings } from "dstsx";

settings.configure({
  onStatus: (msg) => console.log(`[${msg.type}] ${msg.text}`),
});
```

### `StatusMessage` interface

```ts
interface StatusMessage {
  type:      "info" | "warn" | "progress" | "done";
  text:      string;
  step?:     number;
  total?:    number;
  metadata?: Record<string, unknown>;
}
```

### `StatusMessageProvider`

An `EventEmitter` that emits `"status"` events:

```ts
import { StatusMessageProvider } from "dstsx";

const provider = new StatusMessageProvider();
provider.onStatus((msg) => console.log(msg.text));
provider.emitStatus({ type: "info", text: "Starting optimization" });
```

---

## `StreamListener`

Aggregates streaming token chunks for a specific field.

```ts
import { StreamListener, settings, OpenAI, Predict } from "dstsx";

settings.configure({ lm: new OpenAI({ model: "gpt-4o" }) });

const qa = new Predict("question -> answer");
const listener = new StreamListener("answer");

for await (const chunk of qa.stream({ question: "Tell me a story." })) {
  listener.observe(chunk);
  process.stdout.write(chunk.delta);
  if (chunk.done) break;
}

console.log(listener.accumulated); // full accumulated text
listener.reset();                  // clear the buffer
```

**Constructor:**

```ts
new StreamListener(field?: string)
```

---

## Logging helpers

```ts
import { enableLogging, disableLogging, suppressProviderLogs } from "dstsx";

enableLogging();        // set logLevel to "debug"
disableLogging();       // set logLevel to "silent"
suppressProviderLogs(); // set logLevel to "error" (suppress info/warn from provider SDKs)
```

These are convenience wrappers around `settings.configure({ logLevel })`.
