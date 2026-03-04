# DSTsx

> A TypeScript-first port of [DSPy](https://github.com/stanfordnlp/dspy) — Declarative Self-improving Language Programs.

[![npm version](https://img.shields.io/npm/v/dstsx.svg)](https://www.npmjs.com/package/dstsx)
[![license](https://img.shields.io/npm/l/dstsx.svg)](LICENSE)
[![tests](https://img.shields.io/badge/tests-185%20passing-brightgreen.svg)](#)

DSTsx lets you build **typed, composable LM pipelines** in TypeScript and then **optimize** their prompts and few-shot examples automatically—no manual prompt engineering required.

---

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Core Concepts](#core-concepts)
4. [API Reference](#api-reference)
   - [Signatures](#signatures)
   - [Primitives — Example, Prediction, Trace](#primitives--example-prediction-trace)
   - [Language Model Adapters](#language-model-adapters)
   - [Settings & Context](#settings--context)
   - [Modules](#modules)
   - [Retrievers](#retrievers)
   - [Optimizers](#optimizers)
   - [Evaluation](#evaluation)
   - [Assertions & Suggestions](#assertions--suggestions)
5. [V2 APIs](#v2-apis)
   - [TypedPredictor & TypedChainOfThought](#typedpredictor--typedchainofthought)
   - [Parallel Module](#parallel-module)
   - [Refine Module](#refine-module)
   - [majority() Helper](#majority-helper)
   - [BootstrapFewShotWithOptuna](#bootstrapfewshotwithoptuna)
   - [Disk-Persistent LM Cache](#disk-persistent-lm-cache)
   - [MCP Integration](#mcp-integration)
6. [End-to-End Examples](#end-to-end-examples)
7. [V2 Roadmap](#v2-roadmap)

---

## Installation

```bash
npm install dstsx
```

Install provider SDK peer dependencies only for the adapters you use:

```bash
# OpenAI
npm install openai

# Anthropic
npm install @anthropic-ai/sdk

# Cohere
npm install cohere-ai

# Google Generative AI
npm install @google/generative-ai

# Vector store retrievers (pick what you need)
npm install @pinecone-database/pinecone
npm install chromadb
npm install @qdrant/js-client-rest
npm install weaviate-client

# MCP (Model Context Protocol) integration — optional
npm install @modelcontextprotocol/sdk
```

---

## Quick Start

```ts
import { settings, OpenAI, Predict } from "dstsx";

// 1. Configure the global LM
settings.configure({ lm: new OpenAI({ model: "gpt-4o" }) });

// 2. Define a module
const qa = new Predict("question -> answer");

// 3. Run it
const result = await qa.forward({ question: "What is the capital of France?" });
console.log(result.get("answer")); // "Paris"
```

---

## Core Concepts

| Concept | Description |
|---|---|
| **Signature** | Typed interface (inputs → outputs) for one LM call |
| **Example** | Immutable key-value training record |
| **Prediction** | Module output extending Example with `completions` |
| **Trace** | Record of a single LM call (inputs, outputs, usage, latency) |
| **LM** | Abstract language model adapter |
| **Module** | Composable unit containing one or more LM calls |
| **Retriever** | Abstract vector-store backend |
| **Optimizer** | Automatically tunes demos/instructions of a Module |
| **Metric** | Scoring function for Evaluate and Optimizers |

---

## API Reference

### Signatures

Signatures declare the **typed input/output interface** for a single LM call.

#### `Signature.from(shorthand, instructions?)`

Parse a shorthand string. Use `->` to separate inputs from outputs; suffix `?` for optional fields.

```ts
import { Signature } from "dstsx";

// Simple shorthand
const sig = Signature.from("question -> answer");

// Multiple fields, optional field, instructions
const sig2 = Signature.from(
  "context, question -> answer, confidence?",
  "Answer based only on the provided context."
);
```

#### `new Signature(meta)`

Construct a signature explicitly with full field metadata.

```ts
import { Signature, InputField, OutputField } from "dstsx";

const sig = new Signature({
  inputs: new Map([
    ["context",  InputField({ description: "Background passages" })],
    ["question", InputField({ description: "The question to answer" })],
  ]),
  outputs: new Map([
    ["answer", OutputField({ description: "Concise factual answer", type: "string" })],
  ]),
  instructions: "Answer using only the context provided.",
});
```

#### `InputField(meta?)` / `OutputField(meta?)`

Builder helpers that return a `FieldMeta` descriptor.

```ts
import { InputField, OutputField } from "dstsx";

const field = InputField({
  description: "The user's question",
  prefix: "Q:",           // optional prompt prefix
  format: "markdown",     // optional format hint
  optional: true,         // field may be absent
  type: "string",         // "string" | "number" | "boolean" | "string[]" | "object"
});
```

#### `FieldMeta` interface

```ts
interface FieldMeta {
  description?: string;
  prefix?: string;
  format?: string;
  optional?: boolean;
  type?: "string" | "number" | "boolean" | "string[]" | "object";
}
```

#### Signature mutation helpers (return new Signature, never mutate)

```ts
const base = Signature.from("question -> answer");

// Add or override fields / instructions
const extended = base.with({ instructions: "Be concise." });

// Add a single input field
const withCtx = base.withInput("context", { description: "Background text" });

// Add a single output field
const withConf = base.withOutput("confidence", { type: "number" });
```

#### Serialization

```ts
const json = sig.toJSON();             // → plain object
const sig2 = Signature.fromJSON(json); // → Signature
```

---

### Primitives — Example, Prediction, Trace

#### `Example`

Immutable record of named values used as training data or module inputs.

```ts
import { Example } from "dstsx";

const ex = new Example({ question: "What is 2+2?", answer: "4" });

ex.get("question");          // "What is 2+2?"
ex.toDict();                 // { question: "What is 2+2?", answer: "4" }
ex.toJSON();                 // same as toDict()

// Non-mutating copy with overrides
const updated = ex.with({ answer: "four" });

// Filtered views
const inputOnly  = ex.inputs(["question"]);   // Example { question: ... }
const labelOnly  = ex.labels(["question"]);   // Example { answer: ... }

// Deserialize
const ex2 = Example.fromDict({ question: "Hi", answer: "Hello" });
```

#### `Prediction`

Extends `Example` and adds `completions` for multi-output calls (`n > 1`).

```ts
import { Prediction } from "dstsx";

const pred = new Prediction(
  { answer: "42" },
  [{ answer: "42" }, { answer: "forty-two" }],  // completions
);

pred.get("answer");              // "42"
pred.getTyped<string>("answer"); // "42" — typed cast
pred.completions;                // ReadonlyArray of all candidates
pred.toJSON();                   // { answer: "42", completions: [...] }
```

#### `Trace`

Recorded per LM call. See [History](#history) for how to read traces.

```ts
interface Trace {
  signature:  Signature;
  inputs:     Record<string, unknown>;
  outputs:    Record<string, unknown>;
  usage:      { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  latencyMs:  number;
  timestamp:  string; // ISO-8601
}
```

---

### Language Model Adapters

All adapters extend `LM` and share the same `call()` interface.

#### Abstract `LM`

```ts
abstract class LM {
  readonly model: string;

  // Call the LM with a string prompt or chat messages
  async call(prompt: string | Message[], config?: LMCallConfig): Promise<LMResponse>;

  // Counters (non-cached calls only)
  get requestCount(): number;
  get tokenUsage(): { promptTokens: number; completionTokens: number; totalTokens: number };

  // Clear in-memory LRU response cache
  clearCache(): void;
}
```

##### `LMCallConfig`

```ts
interface LMCallConfig {
  model?:       string;      // override model per call
  temperature?: number;      // 0–2
  maxTokens?:   number;
  stop?:        string[];
  n?:           number;      // number of completions (default 1)
  cacheKey?:    string;      // manual cache key override
  extra?:       Record<string, unknown>; // provider pass-through
}
```

##### `LMResponse`

```ts
interface LMResponse {
  text:   string;            // primary completion
  texts:  string[];          // all completions when n > 1
  usage:  TokenUsage | null;
  raw:    unknown;           // raw provider response
}
```

---

#### `OpenAI`

Requires: `npm install openai`

```ts
import { OpenAI } from "dstsx";

const lm = new OpenAI({
  model:      "gpt-4o",          // default "gpt-4o"
  apiKey:     "sk-...",          // or set OPENAI_API_KEY env var
  baseURL:    "https://...",     // optional custom endpoint
  maxRetries: 3,
});
```

---

#### `Anthropic`

Requires: `npm install @anthropic-ai/sdk`

```ts
import { Anthropic } from "dstsx";

const lm = new Anthropic({
  model:      "claude-3-5-sonnet-20241022", // default
  apiKey:     "...",                        // or ANTHROPIC_API_KEY
  maxRetries: 3,
});
```

---

#### `Cohere`

Requires: `npm install cohere-ai`

```ts
import { Cohere } from "dstsx";

const lm = new Cohere({
  model:  "command-r-plus", // default
  apiKey: "...",            // or COHERE_API_KEY
});
```

---

#### `GoogleAI`

Requires: `npm install @google/generative-ai`

```ts
import { GoogleAI } from "dstsx";

const lm = new GoogleAI({
  model:  "gemini-1.5-pro", // default
  apiKey: "...",            // or GOOGLE_API_KEY
});
```

---

#### `Ollama`

No extra package required — communicates with the Ollama REST API.

```ts
import { Ollama } from "dstsx";

const lm = new Ollama({
  model:   "llama3",                   // default
  baseURL: "http://localhost:11434",   // default
});
```

---

#### `LMStudio`

No extra package required — uses LM Studio's OpenAI-compatible `/v1` endpoint.

```ts
import { LMStudio } from "dstsx";

const lm = new LMStudio({
  model:   "local-model",
  baseURL: "http://localhost:1234/v1", // default
});
```

---

#### `HuggingFace`

No extra package required — calls the HuggingFace Inference API directly.

```ts
import { HuggingFace } from "dstsx";

const lm = new HuggingFace({
  model:       "mistralai/Mistral-7B-Instruct-v0.3", // default
  apiKey:      "...",                                 // or HF_API_KEY
  endpointURL: "https://my-dedicated-endpoint.com",  // optional
});
```

---

#### `MockLM`

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

### Settings & Context

The `settings` singleton controls global defaults.

```ts
import { settings } from "dstsx";
```

#### `settings.configure(options)`

Merge options into global settings (existing keys are overwritten; omitted keys unchanged).

```ts
settings.configure({
  lm:       new OpenAI({ model: "gpt-4o" }),
  rm:       new ColBERTv2("http://localhost:8893"),
  lmConfig: { temperature: 0.0, maxTokens: 512 },
  logLevel: "warn",      // "silent" | "error" | "warn" | "info" | "debug"
  cacheDir: "./.dstsx",  // for future disk caching
});
```

#### `settings.reset()`

Reset all global settings to defaults.

```ts
settings.reset();
```

#### `settings.inspect()`

Return a deep-frozen snapshot of currently effective settings.

```ts
const snap = settings.inspect();
console.log(snap.lm?.model);
```

#### `settings.context(overrides, fn)` — Per-request isolation

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

#### `SettingsOptions` type

```ts
interface SettingsOptions {
  lm?:       LM;
  rm?:       Retriever;
  lmConfig?: LMCallConfig;
  logLevel?: "silent" | "error" | "warn" | "info" | "debug";
  cacheDir?: string;
}
```

---

### Modules

All modules extend `Module` and expose a `forward()` method.

#### Abstract `Module`

```ts
abstract class Module {
  abstract forward(...args: unknown[]): Promise<Prediction>;

  // Recursively list all Predict sub-modules
  namedPredictors(): Array<[string, Module]>;

  // Serialize/deserialize learnable parameters (demos, instructions)
  dump(): Record<string, unknown>;
  load(state: Record<string, unknown>): void;

  // Deep-clone the module (used by optimizers)
  clone(): this;
}
```

**Saving and loading a compiled program:**

```ts
import { writeFileSync, readFileSync } from "fs";

// Save
const state = program.dump();
writeFileSync("program.json", JSON.stringify(state, null, 2));

// Load into a fresh instance
const fresh = new MyProgram();
fresh.load(JSON.parse(readFileSync("program.json", "utf8")));
```

---

#### `Predict`

The fundamental module — formats a prompt and calls the LM.

```ts
import { Predict } from "dstsx";

const qa = new Predict("question -> answer");

// Or with a full Signature object
const qa2 = new Predict(Signature.from("context, question -> answer"));

// Forward
const result = await qa.forward({ question: "What is 9 × 7?" });
console.log(result.get("answer")); // "63"
```

**Learnable parameters** (mutated by optimizers):

```ts
qa.demos        // Example[] — few-shot demonstrations
qa.instructions // string | undefined — system instruction override
```

**Multiple completions (`n > 1`):**

```ts
settings.configure({ lmConfig: { n: 5 } });
const result = await qa.forward({ question: "Name a color." });
console.log(result.completions); // 5 candidate answers
```

---

#### `ChainOfThought`

Prepends a hidden `rationale` output field so the LM reasons step-by-step before answering.

```ts
import { ChainOfThought } from "dstsx";

const cot = new ChainOfThought("question -> answer");

// Optional: customize the rationale description
const cot2 = new ChainOfThought("question -> answer", {
  rationaleDescription: "Think aloud to solve the problem",
});

const result = await cot.forward({ question: "If Alice has 3 apples and gets 5 more, how many does she have?" });
console.log(result.get("answer")); // "8" — rationale is internal
```

---

#### `ChainOfThoughtWithHint`

Extends `ChainOfThought` with an optional `hint` input.

```ts
import { ChainOfThoughtWithHint } from "dstsx";

const cot = new ChainOfThoughtWithHint("question -> answer");

const result = await cot.forward({
  question: "What is the chemical formula for water?",
  hint: "It involves hydrogen and oxygen.",
});
```

---

#### `MultiChainComparison`

Runs a signature `M` times and picks the best completion via a final aggregation call.

```ts
import { MultiChainComparison } from "dstsx";

const mcc = new MultiChainComparison("question -> answer", /* M= */ 3);
const result = await mcc.forward({ question: "What is 7 × 8?" });
```

---

#### `ReAct`

Reasoning + Acting loop (Yao et al., 2022). Alternates Thought → Action → Observation until the LM emits `Finish[answer]` or `maxIter` is reached.

```ts
import { ReAct, type Tool } from "dstsx";

const searchTool: Tool = {
  name:        "search",
  description: "Search the web for current information",
  fn: async (query: string) => {
    // Your real implementation here
    return `Search results for: ${query}`;
  },
};

const agent = new ReAct(
  "question -> answer",
  [searchTool],
  /* maxIter= */ 5,
);

const result = await agent.forward({ question: "Who won the 2024 US election?" });
console.log(result.get("answer"));
console.log(result.get("trajectory")); // full thought/action/observation log
```

**`Tool` interface:**

```ts
interface Tool {
  name:        string;
  description: string;
  fn:          (args: string) => Promise<string>;
}
```

---

#### `ProgramOfThought`

Generates JavaScript code, executes it in a `new Function()` context, self-corrects on errors, and returns the result.

> ⚠️ **Security**: Code runs in the current process. Do NOT use with untrusted user inputs in production without an additional sandboxing layer (e.g. a Worker thread).

```ts
import { ProgramOfThought } from "dstsx";

const pot = new ProgramOfThought(
  "question -> answer",
  /* maxAttempts= */ 3,
  /* timeoutMs=   */ 5_000,
);

const result = await pot.forward({ question: "What is the 10th Fibonacci number?" });
console.log(result.get("answer")); // "55"
console.log(result.get("code"));   // the generated JS code
```

---

#### `Retrieve`

Calls the globally configured retriever and returns `passages`.

```ts
import { Retrieve, ColBERTv2, settings } from "dstsx";

settings.configure({ rm: new ColBERTv2("http://localhost:8893") });

const retrieve = new Retrieve(/* k= */ 3);
const result = await retrieve.forward("What is DSPy?");

const passages: string[] = result.get("passages") as string[];
```

---

#### `Retry`

Wraps any module and retries on `AssertionError` (thrown by `Assert()`), feeding the error message back as `feedback`.

```ts
import { Retry, Assert, Predict } from "dstsx";

const qa = new Predict("question, feedback? -> answer");

const retrying = new Retry(qa, /* maxAttempts= */ 3);

const result = await retrying.forward({
  question: "Give a one-word answer: what color is the sky?",
});

// Use Assert inside a custom module to trigger retry
class CheckedQA extends Module {
  predict = new Predict("question -> answer");
  async forward(inputs: { question: string }) {
    const result = await this.predict.forward(inputs);
    Assert(
      String(result.get("answer")).length > 0,
      "Answer must not be empty"
    );
    return result;
  }
}
```

---

#### `BestOfN`

Runs `N` copies of a module in parallel and selects the best via `reduceFunc` (defaults to first result).

```ts
import { BestOfN, Predict } from "dstsx";

const qa = new Predict("question -> answer");
const best = new BestOfN(qa, /* N= */ 5, (predictions) => {
  // Pick the longest answer as a proxy for quality
  return predictions.reduce((a, b) =>
    String(b.get("answer")).length > String(a.get("answer")).length ? b : a
  );
});

const result = await best.forward({ question: "Explain gravity." });
```

---

#### `Ensemble`

Combines multiple pre-built module instances via a reduce function.

```ts
import { Ensemble, ChainOfThought } from "dstsx";

const m1 = new ChainOfThought("question -> answer");
const m2 = new ChainOfThought("question -> answer");

const ensemble = new Ensemble(
  [m1, m2],
  (predictions) => predictions[0]!, // custom vote/merge logic
);

const result = await ensemble.forward({ question: "Is TypeScript better than JavaScript?" });
```

---

### Retrievers

All retrievers extend `Retriever` and implement `retrieve(query, k)`.

#### Abstract `Retriever`

```ts
abstract class Retriever {
  abstract retrieve(query: string, k: number): Promise<string[]>;
}
```

#### `ColBERTv2`

```ts
import { ColBERTv2 } from "dstsx";

const rm = new ColBERTv2("http://localhost:8893");
// or with options:
const rm2 = new ColBERTv2({ url: "http://localhost:8893" });

const passages = await rm.retrieve("What is photosynthesis?", 3);
```

#### `PineconeRM`

Requires: `npm install @pinecone-database/pinecone`

```ts
import { PineconeRM } from "dstsx";

const rm = new PineconeRM({
  indexName:   "my-index",
  apiKey:      "...",       // or PINECONE_API_KEY
  namespace:   "default",
  embeddingFn: async (text) => myEmbedModel.embed(text),
});
```

#### `ChromadbRM`

Requires: `npm install chromadb`

```ts
import { ChromadbRM } from "dstsx";

const rm = new ChromadbRM({
  collectionName: "my-collection",
  url:            "http://localhost:8000", // default
  embeddingFn:    async (texts) => myEmbedModel.embedBatch(texts),
});
```

#### `QdrantRM`

Requires: `npm install @qdrant/js-client-rest`

```ts
import { QdrantRM } from "dstsx";

const rm = new QdrantRM({
  url:            "http://localhost:6333",
  collectionName: "my-collection",
  embeddingFn:    async (text) => myEmbedModel.embed(text),
});
```

#### `WeaviateRM`

Requires: `npm install weaviate-client`

```ts
import { WeaviateRM } from "dstsx";

const rm = new WeaviateRM({
  url:         "http://localhost:8080",
  className:   "Document",
  textField:   "content",
  embeddingFn: async (text) => myEmbedModel.embed(text),
});
```

#### `FaissRM`

Requires: `npm install faiss-node` (optional peer dep)

```ts
import { FaissRM } from "dstsx";

const rm = new FaissRM({
  passages:    ["passage 1", "passage 2"],
  embeddingFn: async (text) => myEmbedModel.embed(text),
});
```

#### `YouRM`

```ts
import { YouRM } from "dstsx";

const rm = new YouRM({
  apiKey: "...", // or YDC_API_KEY
  k:      3,
});
```

#### `MockRetriever`

For unit testing.

```ts
import { MockRetriever } from "dstsx";

const rm = new MockRetriever([
  "The capital of France is Paris.",
  "Paris is located in northern France.",
  "France is a country in Western Europe.",
]);

const passages = await rm.retrieve("capital of France", 2);
```

---

### Optimizers

Optimizers automatically tune a module's few-shot `demos` and/or `instructions`. All optimizers implement:

```ts
abstract class Optimizer {
  abstract compile(
    student: Module,
    trainset: Example[],
    metric:  Metric,
  ): Promise<Module>;
}
```

- The returned module is a **new clone**; the original `student` is never mutated.
- Pass a `valset` where supported to evaluate on held-out data.

---

#### `LabeledFewShot`

Directly assigns labeled examples as `demos` on every `Predict` sub-module (no LM calls).

```ts
import { LabeledFewShot } from "dstsx";

const optimizer = new LabeledFewShot(/* k= */ 16);
const optimized = await optimizer.compile(program, trainset, metric);
```

---

#### `BootstrapFewShot`

Runs the student (or an optional `teacher`) on `trainset`, collects successful traces via `metric`, and uses them as `demos`.

```ts
import { BootstrapFewShot } from "dstsx";

const optimizer = new BootstrapFewShot({
  maxBootstrappedDemos: 4,   // max demos collected per predictor
  maxLabeledDemos:      16,  // max labeled fallback demos
  teacher:              expertProgram, // optional; defaults to student
});

const optimized = await optimizer.compile(program, trainset, exactMatch("answer"));
```

---

#### `BootstrapFewShotWithRandomSearch`

Extends `BootstrapFewShot` — tries `numCandidatePrograms` random demo subsets and selects the best by validation score.

```ts
import { BootstrapFewShotWithRandomSearch } from "dstsx";

const optimizer = new BootstrapFewShotWithRandomSearch({
  maxBootstrappedDemos:  4,
  numCandidatePrograms:  8,   // number of random subsets to evaluate
  valset:                valExamples, // optional held-out set
});

const optimized = await optimizer.compile(program, trainset, metric);
```

---

#### `COPRO` (Collaborative Prompt Optimizer)

Uses the LM to propose instruction improvements for each `Predict` sub-module and selects the best combination by metric score.

```ts
import { COPRO } from "dstsx";

const optimizer = new COPRO({
  breadth: 5,  // instruction candidates per predictor per round
  depth:   3,  // refinement rounds
});

const optimized = await optimizer.compile(program, trainset, metric);
```

---

#### `MIPRO` (Multi-stage Instruction Prompt Optimizer)

Combines COPRO-style instruction proposals with `BootstrapFewShotWithRandomSearch` to jointly optimize instructions _and_ demonstrations.

```ts
import { MIPRO } from "dstsx";

const optimizer = new MIPRO({
  numCandidates:        5,    // instruction candidates per predictor
  initTemperature:      0.9,
  numCandidatePrograms: 8,    // demo subsets to evaluate
  verbose:              true,
});

const optimized = await optimizer.compile(program, trainset, metric);
```

---

#### `KNNFewShot`

Selects demonstrations **at inference time** using k-nearest-neighbour search over the training set embeddings (dynamic few-shot).

```ts
import { KNNFewShot } from "dstsx";

const optimizer = new KNNFewShot({
  k:           3,
  embeddingFn: async (text) => myEmbedModel.embed(text), // required
  keyField:    "question", // which field to embed (default: all fields joined)
});

const optimized = await optimizer.compile(program, trainset, metric);
// At inference time, each forward() call auto-selects the 3 most similar demos
```

---

#### `EnsembleOptimizer`

Wraps a program with an optional reduce function. Primarily useful for building multi-program ensembles.

```ts
import { EnsembleOptimizer } from "dstsx";

const optimizer = new EnsembleOptimizer({
  reduceFunc: (predictions) => predictions[0]!,
});

const wrapped = await optimizer.compile(program, trainset, metric);
```

---

### Evaluation

#### `evaluate(program, examples, metric, options?)`

Run `program` on every example and aggregate scores.

```ts
import { evaluate, exactMatch } from "dstsx";

const result = await evaluate(
  program,
  devset,
  exactMatch("answer"),       // built-in metric
  {
    numThreads:      4,        // parallel evaluation (default: 1)
    displayProgress: true,     // log progress to console
  },
);

console.log(`Score: ${(result.score * 100).toFixed(1)}%`);
console.log(`Passed: ${result.numPassed}/${result.total}`);
```

##### `EvaluationResult`

```ts
interface EvaluationResult {
  score:      number;           // average metric score (0–1)
  numPassed:  number;
  total:      number;
  results:    ExampleResult[];  // per-example breakdown
}

interface ExampleResult {
  example:    Example;
  prediction: Prediction;
  score:      number;
  passed:     boolean;
}
```

---

#### Built-in Metrics

All metrics implement `Metric`:

```ts
type Metric = (
  example:    Example,
  prediction: Prediction,
  trace?:     Trace[],
) => number | boolean;
```

| Factory | Description |
|---|---|
| `exactMatch(field?, caseSensitive?)` | 1 if prediction exactly matches example (case-insensitive by default) |
| `f1(field?)` | Token-level F1 (word overlap), useful for QA |
| `passAtK(innerMetric, k)` | 1 if any of the top-k completions pass `innerMetric` |
| `bleu(field?)` | Simplified BLEU (1-gram + 2-gram precision) |
| `rouge(field?)` | ROUGE-L (LCS-based F1) |

```ts
import { exactMatch, f1, passAtK, bleu, rouge } from "dstsx";

// Exact match on "answer" field (default)
const em = exactMatch();

// Case-sensitive exact match on a custom field
const em2 = exactMatch("label", true);

// Token F1
const f1Metric = f1("answer");

// Pass if any of the 5 completions give exact match
const p5 = passAtK(exactMatch(), 5);

// BLEU / ROUGE
const bleuMetric = bleu("answer");
const rougeMetric = rouge("answer");
```

---

### Assertions & Suggestions

#### `Assert(condition, message?)`

Throws `AssertionError` if `condition` is falsy. Caught and retried by `Retry`.

```ts
import { Assert } from "dstsx";

Assert(result.get("answer") !== "", "Answer must not be empty");
Assert(typeof result.get("score") === "number", "Score must be a number");
```

#### `Suggest(condition, message?)`

Logs a `console.warn` if `condition` is falsy but does **not** throw — the pipeline continues.

```ts
import { Suggest } from "dstsx";

Suggest(result.get("confidence") === "high", "Low confidence in answer");
```

#### `AssertionError`

The typed error class thrown by `Assert`. Caught by `Retry`.

```ts
import { AssertionError } from "dstsx";

try {
  await program.forward(inputs);
} catch (err) {
  if (err instanceof AssertionError) {
    console.warn("Assertion failed:", err.message);
  }
}
```

---

## V2 APIs

The following features are implemented in DSTsx v2.

### `TypedPredictor` & `TypedChainOfThought`

Structured JSON output with optional schema validation. Works without any extra
dependencies — pass a [Zod](https://github.com/colinhacks/zod) schema for
runtime validation.

#### `TypedPrediction<T>`

Extends `Prediction` and adds a `.typed` field with the validated/parsed type.

```ts
import { TypedPredictor } from "dstsx";

// Without schema — output is parsed as plain JSON
const qa = new TypedPredictor("question -> answer");
const result = await qa.forward({ question: "What is π?" });
const typed = result.typed as { answer: string };
console.log(typed.answer);
```

With a Zod schema (`npm install zod` first):

```ts
import { z } from "zod";
import { TypedPredictor, TypedChainOfThought } from "dstsx";

const AnswerSchema = z.object({
  answer:     z.string(),
  confidence: z.number().min(0).max(1),
  sources:    z.array(z.string()).optional(),
});

const qa = new TypedPredictor("question -> answer", AnswerSchema, { maxRetries: 3 });
const result = await qa.forward({ question: "What is 2 + 2?" });

// result.typed is z.infer<typeof AnswerSchema>
console.log(result.typed.confidence); // 0.98 (number, validated)
```

`TypedChainOfThought` adds a hidden `rationale` step before producing the JSON:

```ts
const cot = new TypedChainOfThought("question -> answer", AnswerSchema);
const result = await cot.forward({ question: "Explain gravity briefly." });
```

**Constructor options:**

```ts
new TypedPredictor(signature, schema?, { maxRetries?: number })
// maxRetries: how many times to retry on parse/schema failure (default: 3)
```

---

### `Parallel` Module

Runs multiple modules concurrently with `Promise.all` and returns all results.

```ts
import { Parallel, Predict, ChainOfThought } from "dstsx";

const pipeline = new Parallel([
  new Predict("question -> answer"),
  new ChainOfThought("question -> answer"),
], { timeoutMs: 10_000 }); // optional per-module timeout

// run() returns Prediction[] — one per module
const [directAnswer, cotAnswer] = await pipeline.run({ question: "What is π?" });

// forward() returns the first prediction (for Module interface compat)
const first = await pipeline.forward({ question: "What is π?" });
```

**Constructor:**

```ts
new Parallel(modules: Module[], options?: { timeoutMs?: number })
```

| Method | Returns | Description |
|---|---|---|
| `run(...args)` | `Promise<Prediction[]>` | All module outputs in order |
| `forward(...args)` | `Promise<Prediction>` | First module output (Module compat) |

---

### `Refine` Module

Self-critique / iterative refinement loop. After each inner module run, a built-in
critic predictor evaluates the output and feeds improvement suggestions back.

```ts
import { Refine, Predict } from "dstsx";

const writer = new Predict("topic, feedback? -> essay");

const refined = new Refine(writer, {
  maxRefinements: 2,
  feedbackField:  "feedback",      // injected field name for critique
  stopCondition:  (pred) =>
    String(pred.get("essay")).length > 500, // stop early if long enough
});

const result = await refined.forward({ topic: "Climate change" });
console.log(result.get("essay"));
```

**Constructor:**

```ts
new Refine(inner: Module, options?: {
  maxRefinements?: number;                     // default: 2
  feedbackField?:  string;                     // default: "feedback"
  stopCondition?:  (p: Prediction) => boolean; // optional early-exit check
})
```

The critic calls `Predict("output -> critique, is_satisfactory")`.
If `is_satisfactory` is `"yes"` or `"true"`, refinement stops early.

---

### `majority()` Helper

Votes across multiple `Prediction` instances by the most common value for a given
field. Useful as a `reduceFunc` in `BestOfN` and `Ensemble`.

```ts
import { majority, BestOfN, Predict } from "dstsx";

const qa = new Predict("question -> answer");

// Run 5 times and pick the most common answer
const voted = new BestOfN(qa, 5, majority("answer"));
const result = await voted.forward({ question: "What color is the sky?" });
console.log(result.get("answer")); // most frequently returned answer
```

```ts
// Standalone usage
import { majority } from "dstsx";

const reducer = majority("answer");
const best = reducer([pred1, pred2, pred3]); // Prediction with the most common "answer"
```

---

### `BootstrapFewShotWithOptuna`

Extends `BootstrapFewShot` with a pure-TypeScript TPE (Tree-structured Parzen
Estimator) that searches demo subsets across `numTrials` iterations, learning
from past trial outcomes to find the best configuration — no external
dependencies required.

```ts
import { BootstrapFewShotWithOptuna } from "dstsx";

const optimizer = new BootstrapFewShotWithOptuna({
  maxBootstrappedDemos: 4,
  numTrials:            20,        // number of TPE search trials
  valset:               valExamples, // optional held-out validation set
});

const optimized = await optimizer.compile(program, trainset, metric);
```

**How it works:** First runs `BootstrapFewShot` to collect candidate demos. Then
runs `numTrials` iterations where each trial samples a demo subset using TPE:
the top 25 % of past trials form the "good" pool, sampled with 70 % probability,
biased mutations towards the best configurations found so far.

---

### Disk-Persistent LM Cache

LM adapters now accept a `cacheDir` option. Responses are persisted as JSON
files named by a SHA-256 hash of the prompt, surviving process restarts.

```ts
import { OpenAI, MockLM } from "dstsx";

// Any LM adapter — just pass cacheDir
const lm = new OpenAI({
  model:    "gpt-4o",
  cacheDir: "./.dstsx-cache", // optional disk persistence
});

// Or with MockLM for testing disk cache behavior
const mockLm = new MockLM({ "q": "a" }, undefined, { cacheDir: "/tmp/test-cache" });
```

The disk cache is checked **after** the in-memory LRU cache. On a hit the
response is also written back into the in-memory cache. TTL and max-size
eviction apply to both layers.

`DiskCache` is also exported for custom use:

```ts
import { DiskCache } from "dstsx";

const cache = new DiskCache(
  "./.dstsx-cache",  // directory (created automatically)
  500,               // maxSize (files); default 500
  3_600_000,         // ttlMs; default undefined (no TTL)
);

cache.set("myKey", lmResponse);
const cached = cache.get("myKey");
cache.clear(); // delete all cache files
```

---

### MCP Integration

DSTsx integrates with the [Model Context Protocol](https://modelcontextprotocol.io/)
(MCP) in two directions:

1. **Use MCP servers as tools** inside ReAct agents (`MCPToolAdapter`)
2. **Expose DSTsx modules as MCP tools** (`DSTsxMCPServer`)

Optional peer dependency: `npm install @modelcontextprotocol/sdk`

---

#### `MCPToolAdapter` — consume MCP servers in ReAct

Wraps the tools from an MCP server as DSTsx `Tool` objects for use with `ReAct`.

```ts
import { MCPToolAdapter, ReAct } from "dstsx";

const adapter = new MCPToolAdapter({
  // Test mode: supply tool definitions + call handler without a live server
  tools: [
    {
      name:        "weather",
      description: "Get current weather for a city",
      inputSchema: {
        type:       "object",
        properties: { city: { type: "string" } },
        required:   ["city"],
      },
    },
  ],
  callHandler: async (name, args) => {
    if (name === "weather") return `Sunny in ${args["city"] as string}`;
    throw new Error(`Unknown tool: ${name}`);
  },
});

const tools = await adapter.getTools();
const agent = new ReAct("question -> answer", tools, 5);
const result = await agent.forward({ question: "What is the weather in Paris?" });
```

When `@modelcontextprotocol/sdk` is installed, a live SSE/stdio connection can
be established by setting `serverUrl` (full live-connection implementation is in
the [v2 roadmap](./V2_ROADMAP.md#live-mcp-connection)).

---

#### `DSTsxMCPServer` — expose DSTsx modules as MCP tools

Register any DSTsx module and serve it as an MCP-compatible tool.

```ts
import { DSTsxMCPServer, ChainOfThought, settings, OpenAI } from "dstsx";

settings.configure({ lm: new OpenAI({ model: "gpt-4o" }) });

const qa = new ChainOfThought("context, question -> answer");

const server = new DSTsxMCPServer();
server.registerModule(
  "qa",                                   // tool name
  "Answer questions using chain-of-thought reasoning",
  qa,
  ["context", "question"],               // input field names
);

// List tools (for MCP handshake)
const toolDefs = server.getToolDefinitions();
/*
[{
  name: "qa",
  description: "...",
  inputSchema: { type: "object", properties: { context: { type: "string" }, ... } },
}]
*/

// Handle a tool call
const result = await server.callTool("qa", {
  context:  "Paris is the capital of France.",
  question: "What is the capital of France?",
});
// result is the Prediction.toJSON() object

// With @modelcontextprotocol/sdk installed, launch a stdio MCP server:
// await server.createStdioServer();
```

**MCPTool type:**

```ts
interface MCPTool {
  name:        string;
  description: string;
  inputSchema: {
    type:       "object";
    properties: Record<string, { type: string; description?: string }>;
    required?:  string[];
  };
  handler: (inputs: Record<string, unknown>) => Promise<unknown>;
}
```

**`DSTsxMCPServer` methods:**

| Method | Description |
|---|---|
| `registerModule(name, desc, module, fields)` | Register a module as an MCP tool |
| `getToolDefinitions()` | Return all registered `MCPTool[]` |
| `callTool(name, inputs)` | Invoke a registered tool by name |
| `createStdioServer()` | Start an MCP stdio server (requires SDK) |

---

## End-to-End Examples

### 1. Simple Q&A

```ts
import { settings, OpenAI, Predict } from "dstsx";

settings.configure({ lm: new OpenAI({ model: "gpt-4o-mini" }) });

const qa = new Predict("question -> answer");

const result = await qa.forward({ question: "What is the speed of light?" });
console.log(result.get("answer"));
```

---

### 2. Retrieval-Augmented Generation (RAG)

```ts
import {
  Module, Retrieve, ChainOfThought, ColBERTv2,
  settings, OpenAI, type Prediction,
} from "dstsx";

settings.configure({
  lm: new OpenAI({ model: "gpt-4o" }),
  rm: new ColBERTv2("http://localhost:8893"),
});

class RAG extends Module {
  retrieve = new Retrieve(3);
  generate = new ChainOfThought("context, question -> answer");

  async forward(inputs: { question: string }): Promise<Prediction> {
    const { passages } = (await this.retrieve.forward(inputs.question)).toDict() as { passages: string[] };
    return this.generate.forward({
      context:  passages.join("\n"),
      question: inputs.question,
    });
  }
}

const rag = new RAG();
const result = await rag.forward({ question: "What is the capital of Germany?" });
console.log(result.get("answer")); // "Berlin"
```

---

### 3. Optimizing with BootstrapFewShot

```ts
import {
  settings, MockLM, Predict, Module, BootstrapFewShot,
  Example, evaluate, exactMatch, type Prediction,
} from "dstsx";

settings.configure({ lm: new MockLM({}, "answer: 42") });

class QA extends Module {
  predict = new Predict("question -> answer");
  async forward(inputs: { question: string }): Promise<Prediction> {
    return this.predict.forward(inputs);
  }
}

const trainset = [
  new Example({ question: "What is 6 × 7?", answer: "42" }),
  new Example({ question: "What is 8 × 8?", answer: "64" }),
];

const optimizer = new BootstrapFewShot({ maxBootstrappedDemos: 2 });
const optimized  = await optimizer.compile(new QA(), trainset, exactMatch("answer"));

// Persist
import { writeFileSync } from "fs";
writeFileSync("qa_optimized.json", JSON.stringify(optimized.dump(), null, 2));
```

---

### 4. ReAct Agent

```ts
import { settings, OpenAI, ReAct, type Tool } from "dstsx";

settings.configure({ lm: new OpenAI({ model: "gpt-4o" }) });

const tools: Tool[] = [
  {
    name:        "calculator",
    description: "Evaluates a mathematical expression and returns the numeric result",
    fn:          async (expr) => String(Function(`"use strict"; return (${expr})`)()),
  },
  {
    name:        "lookup",
    description: "Looks up a fact in the knowledge base",
    fn:          async (query) => `Fact about ${query}: (result from KB)`,
  },
];

const agent = new ReAct("question -> answer", tools, /* maxIter= */ 6);
const result = await agent.forward({ question: "What is (123 * 456) + 789?" });
console.log(result.get("answer"));
console.log(result.get("trajectory"));
```

---

### 5. Assertions with Retry

```ts
import {
  settings, MockLM, Module, Predict, Retry, Assert, type Prediction,
} from "dstsx";

settings.configure({ lm: new MockLM({}, "answer: Paris") });

class CapitalQA extends Module {
  predict = new Predict("question, feedback? -> answer");

  async forward(inputs: { question: string }): Promise<Prediction> {
    const result = await this.predict.forward(inputs);
    Assert(
      String(result.get("answer")).trim().length > 0,
      "Answer must not be empty"
    );
    return result;
  }
}

const retrying = new Retry(new CapitalQA(), 3);
const result   = await retrying.forward({ question: "What is the capital of France?" });
console.log(result.get("answer")); // "Paris"
```

---

### 6. Per-Request LM Override (server environments)

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

---

## V2 Roadmap

The following features are ✅ **implemented in v2**. Remaining items are tracked in [V2_ROADMAP.md](./V2_ROADMAP.md).

| Feature | DSPy Equivalent | Status |
|---|---|---|
| **`TypedPredictor`** — JSON-schema + optional Zod validation | `dspy.TypedPredictor`, `dspy.TypedChainOfThought` | ✅ v2 |
| **`Parallel`** module — fan-out / fan-in concurrency | `dspy.Parallel` | ✅ v2 |
| **`Refine`** module — self-critique loop | — | ✅ v2 |
| **`majority()`** helper — vote across Predictions | `dspy.majority` | ✅ v2 |
| **`BootstrapFewShotWithOptuna`** — TPE Bayesian search | `dspy.BootstrapFewShotWithOptuna` | ✅ v2 |
| **Disk-persistent LM cache** — file-based LRU | `dspy.cache` | ✅ v2 |
| **MCP Integration** — `MCPToolAdapter` + `DSTsxMCPServer` | — | ✅ v2 |
| **Streaming** — token-level streaming from LM adapters | `dspy.streamify` | 🗓 Planned |
| **Native tool calling** — OpenAI functions / Anthropic tool use | `dspy.Tool` (v2) | 🗓 Planned |
| **Multi-modal** — image + audio inputs | `dspy.Image` | 🗓 Planned |
| **`BootstrapFinetune`** — export traces for fine-tuning | `dspy.BootstrapFinetune` | 🗓 Planned |
| **`GRPO` / `SIMBA` optimizers** — gradient-based search | `dspy.GRPO`, `dspy.SIMBA` | 🗓 Planned |
| **`AvatarOptimizer`** — role-based prompt optimization | `dspy.AvatarOptimizer` | 🗓 Planned |
| **Experiment tracking** — MLflow / W&B integration | `dspy.MLflow` | 🗓 Planned |
| **Browser sandbox** — Worker-thread `ProgramOfThought` executor | — | 🗓 Planned |
| **Typedoc site** — auto-generated API documentation | — | 🗓 Planned |
| **npm publish workflow** — GitHub Actions CD pipeline | — | 🗓 Planned |

---

## License

MIT