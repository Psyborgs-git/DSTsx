# Models

First-class model wrappers beyond LMs — currently `Embedder`.

---

## `Embedder`

A first-class embedding model that supports multiple providers. Mirrors `dspy.Embedder`.

```ts
import { Embedder } from "dstsx";

const embedder = new Embedder({
  provider: "openai",
  model:    "text-embedding-3-small",
  apiKey:   process.env.OPENAI_API_KEY, // or set OPENAI_API_KEY env var
});

// Embed a single text
const vector: number[] = await embedder.embed("What is the capital of France?");

// Embed a batch
const vectors: number[][] = await embedder.embedBatch([
  "What is the capital of France?",
  "What is the capital of Germany?",
]);
```

**Constructor:**

```ts
new Embedder(opts: EmbedderOptions)
```

### `EmbedderOptions`

```ts
interface EmbedderOptions {
  provider:   "openai" | "cohere" | "huggingface" | "ollama" | "custom";
  model:      string;
  apiKey?:    string;
  baseURL?:   string;     // custom endpoint
  batchSize?: number;     // default: 100
  cacheDir?:  string;     // disk cache directory
  fn?:        (texts: string[]) => Promise<number[][]>; // required for "custom"
}
```

---

## Supported Providers

### OpenAI

Requires: `npm install openai`

```ts
const embedder = new Embedder({
  provider: "openai",
  model:    "text-embedding-3-small",
  apiKey:   "sk-...",
});
```

### Cohere

Requires: `npm install cohere-ai`

```ts
const embedder = new Embedder({
  provider: "cohere",
  model:    "embed-english-v3.0",
  apiKey:   "...",
});
```

### Ollama

No extra package required.

```ts
const embedder = new Embedder({
  provider: "ollama",
  model:    "nomic-embed-text",
  baseURL:  "http://localhost:11434", // default
});
```

### HuggingFace

No extra package required — uses the HuggingFace Inference API.

```ts
const embedder = new Embedder({
  provider: "huggingface",
  model:    "sentence-transformers/all-MiniLM-L6-v2",
  apiKey:   "hf_...",
});
```

### Custom

Provide your own embedding function:

```ts
const embedder = new Embedder({
  provider: "custom",
  model:    "my-model",
  fn:       async (texts) => {
    // Return a 2D array of embedding vectors
    return texts.map((t) => myEmbedFn(t));
  },
});
```

---

## Using with Settings

Set a global default embedder for use by `KNNFewShot` and `Embeddings`:

```ts
import { settings, Embedder } from "dstsx";

settings.configure({
  embedder: new Embedder({ provider: "openai", model: "text-embedding-3-small" }),
});
```

---

## Using with `Embeddings` (vector store)

```ts
import { Embedder, Embeddings } from "dstsx";

const embedder = new Embedder({ provider: "openai", model: "text-embedding-3-small" });

const store = new Embeddings({
  embedFn: (texts) => embedder.embedBatch(texts),
});

await store.add(["Paris is the capital of France.", "Berlin is the capital of Germany."]);
const results = await store.search("capital of France", 1);
```
