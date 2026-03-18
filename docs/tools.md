# Tools

Reusable utility tools for agent modules (`ReAct`, `NativeReAct`, `CodeAct`).

---

## `JSInterpreter`

Wraps a JavaScript execution sandbox as a reusable `Tool` for use in agent modules.

```ts
import { JSInterpreter, ReAct, settings, OpenAI } from "dstsx";

settings.configure({ lm: new OpenAI({ model: "gpt-4o" }) });

const interpreter = new JSInterpreter({ sandbox: "worker", timeoutMs: 5_000 });

const agent = new ReAct("question -> answer", [
  interpreter.asTool(),
]);

const result = await agent.forward({ question: "What is the 20th Fibonacci number?" });
console.log(result.get("answer"));
```

### `interpreter.asTool()`

Returns a `Tool`-compatible object:

```ts
{
  name:        "js_interpreter",
  description: "Execute JavaScript code and return the result",
  fn:          async (code: string) => string,
}
```

### `interpreter.execute(code)`

Execute JavaScript code directly and return the result as a string:

```ts
const result = await interpreter.execute("return 2 ** 10;");
console.log(result); // "1024"
```

**Constructor:**

```ts
new JSInterpreter(opts?: {
  sandbox?:   "worker" | "function", // default: "worker"
  timeoutMs?: number,                // default: 10_000
})
```

> ⚠️ **Security**: Always prefer the `"worker"` sandbox. Never execute untrusted code without review.

---

## `Embeddings`

In-memory vector store with cosine-similarity search. Can be used as a lightweight retriever without an external database.

```ts
import { Embeddings, Embedder } from "dstsx";

const embedder = new Embedder({
  provider: "openai",
  model:    "text-embedding-3-small",
  apiKey:   process.env.OPENAI_API_KEY,
});

const store = new Embeddings({
  embedFn: (texts) => embedder.embedBatch(texts),
});

// Build the index
await store.add([
  "Paris is the capital of France.",
  "Berlin is the capital of Germany.",
  "Tokyo is the capital of Japan.",
]);

// Search
const results = await store.search("What is the capital of France?", /* k= */ 2);
console.log(results);
// ["Paris is the capital of France.", "Berlin is the capital of Germany."]

// Clear the index
store.clear();
```

### Use as a retriever

```ts
const retriever = store.asRetriever();
const passages = await retriever.retrieve("capital of France", 3);
```

**Constructor:**

```ts
new Embeddings(opts: {
  embedFn: (texts: string[]) => Promise<number[][]>;
})
```

| Method | Description |
|---|---|
| `add(texts)` | Embed and store texts |
| `search(query, k)` | Return top-k most similar texts |
| `clear()` | Remove all stored embeddings |
| `asRetriever()` | Return a `{ retrieve(query, k) }` compatible object |
