# DSTsx v2 Roadmap

> Features from [DSPy](https://github.com/stanfordnlp/dspy) not yet implemented in DSTsx v1, prioritized for a v2 release.

---

## Table of Contents

1. [Design Principles](#design-principles)
2. [Priority Tiers](#priority-tiers)
3. [High Priority](#high-priority)
4. [Medium Priority](#medium-priority)
5. [Low Priority](#low-priority)
6. [Stretch / Experimental](#stretch--experimental)

---

## Design Principles

All v2 features must:

- Maintain **100 % backward-compatibility** with the v1 API.
- Be **tree-shakeable** — optional features add zero weight to a minimal import.
- Ship with **full TypeScript types** and JSDoc documentation.
- Include **unit tests** using `MockLM` / `MockRetriever`.

---

## Priority Tiers

| Tier | Criteria |
|---|---|
| **High** | Blocking real-world production use-cases, or widely used in DSPy |
| **Medium** | Commonly requested; improves developer experience or coverage |
| **Low** | Niche use cases or experimental DSPy features |
| **Stretch** | Research-level features, large effort, uncertain API |

---

## High Priority

### 1. `TypedPredictor` & `TypedChainOfThought`

**DSPy equivalent**: `dspy.TypedPredictor`, `dspy.TypedChainOfThought`

Structured JSON output with schema validation, powered by [Zod](https://github.com/colinhacks/zod).

**Proposed API:**

```ts
import { z } from "zod";
import { TypedPredictor } from "dstsx";

const Answer = z.object({
  answer:     z.string(),
  confidence: z.number().min(0).max(1),
  sources:    z.array(z.string()).optional(),
});

const qa = new TypedPredictor("question -> answer", Answer);
const result = await qa.forward({ question: "What is 2+2?" });
// result.typed is Answer (validated at runtime)
console.log(result.typed.confidence); // 0.98
```

**Scope:**
- `TypedPredictor(signature, schema)` — validates every output against the Zod schema.
- `TypedChainOfThought(signature, schema)` — same + hidden rationale.
- Auto-inject JSON formatting instructions into the prompt when a schema is present.
- Re-parse / re-try on validation failure (up to `maxRetries`).
- Zero-dependency: Zod is an optional peer dependency; plain `JSON.parse` is the fallback.

---

### 2. LM Streaming

**DSPy equivalent**: `dspy.streamify` (wraps a program for streaming)

Token-level streaming output from all LM adapters.

**Proposed API:**

```ts
import { settings, OpenAI, Predict } from "dstsx";

settings.configure({ lm: new OpenAI({ model: "gpt-4o", stream: true }) });

const qa = new Predict("question -> answer");
for await (const chunk of qa.stream({ question: "Tell me a story." })) {
  process.stdout.write(chunk.delta);
}
const final = await qa.forward({ question: "Tell me a story." }); // still works
```

**Scope:**
- Add `LM.stream(prompt, config)` returning `AsyncIterable<StreamChunk>`.
- `Module.stream(...args)` that calls the inner LM in streaming mode.
- `StreamChunk` type: `{ delta: string; done: boolean; raw: unknown }`.
- Implement streaming for `OpenAI`, `Anthropic`, `Cohere`, `GoogleAI`, `Ollama`, `LMStudio` adapters.

---

### 3. Disk-Persistent Response Cache

**DSPy equivalent**: `dspy.cache` (SQLite-backed LRU)

Persist LM responses across process restarts to avoid redundant API calls.

**Proposed API:**

```ts
settings.configure({
  lm:       new OpenAI({ model: "gpt-4o" }),
  cacheDir: "./.dstsx-cache",  // enable disk cache
});
// or per-adapter:
const lm = new OpenAI({ model: "gpt-4o", cacheDir: "./.dstsx-cache" });
```

**Scope:**
- File-based cache (one JSON file per adapter by default; SQLite optional via peer dep).
- Pluggable `CacheBackend` interface for custom implementations (Redis, etc.).
- `settings.configure({ cacheDir })` already reserves this option — just needs the backend.
- LRU eviction policy with configurable `maxSize` and `ttlMs`.

---

### 4. Native Tool Calling (OpenAI Functions / Anthropic Tool Use)

**DSPy equivalent**: `dspy.Tool` improvements in DSPy v2

Use provider-native structured tool calling instead of text-based ReAct parsing, for more reliable and faster agents.

**Proposed API:**

```ts
import { NativeReAct, Tool } from "dstsx";

const tools: Tool[] = [
  {
    name:        "search",
    description: "Search the web",
    args: {                          // JSON Schema for the tool args
      type:       "object",
      properties: { query: { type: "string" } },
      required:   ["query"],
    },
    fn: async ({ query }: { query: string }) => search(query),
  },
];

const agent = new NativeReAct("question -> answer", tools);
// Uses OpenAI function calling or Anthropic tool use under the hood
```

**Scope:**
- New `NativeReAct` module (or `ReAct` option `{ mode: "native" }`).
- `LM._callWithTools(messages, tools)` abstract method on adapters that support it.
- Implement in `OpenAI` (function calling) and `Anthropic` (tool use) adapters.
- Graceful fallback to text-based ReAct for adapters without native tool support.

---

### 5. Typedoc API Documentation Site

Auto-generated API reference site published to GitHub Pages.

**Scope:**
- Add `typedoc.json` configuration.
- Add `"docs": "typedoc"` npm script.
- GitHub Actions workflow to publish to `gh-pages` branch on every release.
- All existing JSDoc comments already serve as source material — minimal effort required.

---

### 6. npm Publish Workflow (GitHub Actions CD)

Automate package publishing on version bumps.

**Scope:**
- GitHub Actions workflow triggered on `release` events.
- Builds with `tsup`, runs tests, then `npm publish`.
- Use [Changesets](https://github.com/changesets/changesets) for changelog generation.
- Bump `package.json` version from `0.1.0` → `1.0.0`.

---

## Medium Priority

### 7. `BootstrapFewShotWithOptuna`

**DSPy equivalent**: `dspy.BootstrapFewShotWithOptuna`

Bayesian optimization (TPE sampler) for demo subset selection, replacing the random search in `BootstrapFewShotWithRandomSearch`.

**Proposed API:**

```ts
import { BootstrapFewShotWithOptuna } from "dstsx";

const optimizer = new BootstrapFewShotWithOptuna({
  maxBootstrappedDemos: 4,
  numTrials:            20,   // Optuna trials
});

const optimized = await optimizer.compile(program, trainset, metric);
```

**Scope:**
- Peer dependency on `optuna-wasm` (WASM port) or a custom TPE implementation.
- If the peer dep is absent, fall back to `BootstrapFewShotWithRandomSearch`.

---

### 8. `Majority` Module

**DSPy equivalent**: `dspy.majority`

Majority-vote aggregation across multiple completions, useful as a `reduceFunc` in `BestOfN` and `Ensemble`.

**Proposed API:**

```ts
import { majority } from "dstsx";

const reducer = majority("answer");        // field to vote on
const best    = new BestOfN(qa, 5, reducer);
```

**Scope:**
- `majority(field)` returns a `(predictions: Prediction[]) => Prediction` reducer.
- Ties broken by index (first occurrence wins).

---

### 9. `Parallel` Module

**DSPy equivalent**: `dspy.Parallel`

Fan-out/fan-in: run multiple different modules concurrently and collect all their outputs.

**Proposed API:**

```ts
import { Parallel } from "dstsx";

const pipeline = new Parallel([
  new Predict("question -> answer"),
  new ChainOfThought("question -> answer"),
  new ProgramOfThought("question -> answer"),
]);

const [pred1, pred2, pred3] = await pipeline.forward({ question: "What is π?" });
```

**Scope:**
- `Parallel(modules)` runs all modules with `Promise.all`.
- Returns `Prediction[]` — one per module.
- Optional timeout per module (rejects with partial results).

---

### 10. Multi-modal Support (`dspy.Image`)

**DSPy equivalent**: `dspy.Image`

Pass images (and other media) as inputs to vision-capable LMs.

**Proposed API:**

```ts
import { Predict, Image } from "dstsx";

const captioner = new Predict("image, question -> caption");
const result = await captioner.forward({
  image:    Image.fromURL("https://example.com/photo.jpg"),
  question: "What is in this image?",
});
```

**Scope:**
- `Image` primitive: `fromURL(url)`, `fromBase64(data, mimeType)`, `fromFile(path)`.
- Extend `LMCallConfig` to accept `Image` values in message content.
- Implement in `OpenAI` (GPT-4V), `Anthropic` (Claude 3 vision), `GoogleAI` (Gemini Vision).

---

### 11. Worker-Thread Sandbox for `ProgramOfThought`

Replace the current `new Function()` executor with a proper Node.js `Worker` thread that:

- Has no access to `require`, `process`, filesystem, or network.
- Can be killed on timeout (true cancellation, not just race rejection).

**Scope:**
- Optional peer dep on `node:worker_threads` (already available in Node 18+).
- Expose `sandbox?: "worker" | "function" | "none"` option on `ProgramOfThought`.
- Default to `"function"` for backward compatibility; document security tradeoffs.

---

## Low Priority

### 12. `BootstrapFinetune`

**DSPy equivalent**: `dspy.BootstrapFinetune`

Collect LM traces and export them in fine-tuning format (JSONL) for providers that support it (OpenAI, Together AI, etc.).

**Proposed API:**

```ts
import { BootstrapFinetune } from "dstsx";

const optimizer = new BootstrapFinetune({
  exportPath: "./finetune_data.jsonl",
  format:     "openai",
});

// Compiles the student to collect traces; exports them for fine-tuning
const recipe = await optimizer.compile(program, trainset, metric);
```

---

### 13. `GRPO` Optimizer

**DSPy equivalent**: `dspy.GRPO` (Group Relative Policy Optimization)

Gradient-style prompt search using reinforcement-learning-inspired reward signals. Requires many LM calls but achieves state-of-the-art optimization quality on complex tasks.

**Proposed API:**

```ts
import { GRPO } from "dstsx";

const optimizer = new GRPO({
  numSteps:    50,
  groupSize:   8,
  temperature: 1.0,
});

const optimized = await optimizer.compile(program, trainset, metric);
```

---

### 14. `SIMBA` Optimizer

**DSPy equivalent**: `dspy.SIMBA` (Stochastic Introspective Mini-Batch Ascent)

A lightweight stochastic search optimizer well-suited for small training sets.

---

### 15. `AvatarOptimizer`

**DSPy equivalent**: `dspy.AvatarOptimizer`

Iteratively proposes and evaluates "avatar" personas (role descriptions) for each `Predict` module to improve instruction diversity.

---

### 16. Experiment Tracking Integration

**DSPy equivalent**: `dspy.MLflow`

Log optimizer runs, metric scores, and demo sets to MLflow or Weights & Biases for experiment comparison.

**Proposed API:**

```ts
import { BootstrapFewShot, MLflowTracker } from "dstsx";

const optimizer = new BootstrapFewShot({
  maxBootstrappedDemos: 4,
  tracker: new MLflowTracker({ experiment: "qa-optimization" }),
});
```

---

## Stretch / Experimental

### 17. `dspy.Refine` / Gradient-Based Refinement

Iteratively improve a prediction by generating a critique and then regenerating — similar to self-refinement / Constitutional AI approaches.

### 18. HTTP Serving

Serialize and serve an optimized program as a REST/gRPC endpoint, enabling deployment without re-running the optimizer.

### 19. Cross-Language Trace Sharing

Export / import traces in a format compatible with the Python DSPy library, enabling Python-optimized programs to run in DSTsx and vice-versa.

### 20. Browser-Native Bundle

A `dstsx/browser` entry-point that:
- Strips all `node:` built-ins.
- Replaces `AsyncLocalStorage` with a `Map`-based fallback.
- Excludes `ProgramOfThought` (no `new Function` in restrictive CSPs).

---

## Summary Table

| # | Feature | DSPy Symbol | Priority | Effort |
|---|---|---|---|---|
| 1 | TypedPredictor / TypedChainOfThought | `TypedPredictor` | High | Medium |
| 2 | LM Streaming | `streamify` | High | Medium |
| 3 | Disk-Persistent Cache | `dspy.cache` | High | Small |
| 4 | Native Tool Calling | `Tool` (v2) | High | Medium |
| 5 | Typedoc Site | — | High | Small |
| 6 | npm Publish Workflow | — | High | Small |
| 7 | BootstrapFewShotWithOptuna | `BootstrapFewShotWithOptuna` | Medium | Medium |
| 8 | Majority Module | `majority` | Medium | Small |
| 9 | Parallel Module | `Parallel` | Medium | Small |
| 10 | Multi-modal (Image) | `dspy.Image` | Medium | Large |
| 11 | Worker-Thread ProgramOfThought | — | Medium | Medium |
| 12 | BootstrapFinetune | `BootstrapFinetune` | Low | Large |
| 13 | GRPO Optimizer | `GRPO` | Low | Large |
| 14 | SIMBA Optimizer | `SIMBA` | Low | Large |
| 15 | AvatarOptimizer | `AvatarOptimizer` | Low | Medium |
| 16 | Experiment Tracking | `MLflow` | Low | Medium |
| 17 | Refine / Self-Critique | `Refine` | Stretch | Large |
| 18 | HTTP Serving | — | Stretch | Large |
| 19 | Cross-Language Trace Sharing | — | Stretch | Large |
| 20 | Browser-Native Bundle | — | Stretch | Medium |
