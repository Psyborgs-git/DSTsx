# Settings & Context

The `settings` singleton controls global defaults and per-request isolation.

```ts
import { settings } from "dstsx";
```

---

## `settings.configure(options)`

Merge options into global settings (existing keys are overwritten; omitted keys unchanged).

```ts
settings.configure({
  lm:       new OpenAI({ model: "gpt-4o" }),
  rm:       new ColBERTv2("http://localhost:8893"),
  lmConfig: { temperature: 0.0, maxTokens: 512 },
  logLevel: "warn",      // "silent" | "error" | "warn" | "info" | "debug"
  cacheDir: "./.dstsx",  // disk cache root
  adapter:  new JSONAdapter(), // override default prompt adapter
  embedder: new Embedder({ provider: "openai", model: "text-embedding-3-small" }),
  onStatus: (msg) => console.log(`[${msg.type}] ${msg.text}`), // optimizer progress
});
```

---

## `settings.reset()`

Reset all global settings to defaults.

```ts
settings.reset();
```

---

## `settings.inspect()`

Return a deep-frozen snapshot of currently effective settings.

```ts
const snap = settings.inspect();
console.log(snap.lm?.model);
```

---

## `settings.context(overrides, fn)` — Per-request isolation

Run `fn` inside an `AsyncLocalStorage` scope. Concurrent requests each get their own isolated settings and never interfere.

```ts
// In an Express/Fastify handler:
app.post("/answer", async (req, res) => {
  const answer = await settings.context(
    { lm: new OpenAI({ model: "gpt-4o-mini" }) },
    () => program.forward({ question: req.body.question }),
  );
  res.json(answer.toJSON());
});
```

> **Implementation note**: `settings.context()` uses `AsyncLocalStorage` from `node:async_hooks`. The library requires Node.js (uses `process.env` and `AsyncLocalStorage` throughout).

---

## `SettingsOptions` type

```ts
interface SettingsOptions {
  lm?:       LM;
  rm?:       Retriever;
  lmConfig?: LMCallConfig;
  logLevel?: "silent" | "error" | "warn" | "info" | "debug";
  cacheDir?: string;
  adapter?:  Adapter;   // default prompt adapter (ChatAdapter if not set)
  embedder?: Embedder;  // default embedding model
  onStatus?: (msg: StatusMessage) => void; // callback for optimizer progress messages
}
```

---

## `settings.save(path)` and `settings.load(path)`

Serialize and restore serializable settings (non-serializable values like `lm`, `rm`, and `adapter` are excluded):

```ts
import { settings } from "dstsx";

// Save
settings.configure({ logLevel: "debug", cacheDir: "./.cache" });
settings.save("./settings.json");

// Later, restore in another process
settings.load("./settings.json");
```

---

## Per-request LM override — server example

```ts
import express from "express";
import { settings, OpenAI, Predict } from "dstsx";

const app     = express();
const qa      = new Predict("question -> answer");
const gpt4    = new OpenAI({ model: "gpt-4o" });
const gptMini = new OpenAI({ model: "gpt-4o-mini" });

settings.configure({ lm: gpt4 }); // global default

app.get("/fast", async (req, res) => {
  // Override LM for this request only — concurrent requests never interfere
  const result = await settings.context(
    { lm: gptMini },
    () => qa.forward({ question: req.query["q"] as string }),
  );
  res.json(result.toJSON());
});

app.listen(3000);
```
