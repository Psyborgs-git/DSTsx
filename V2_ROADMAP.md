# DSTsx v2 Roadmap

> Features from [DSPy](https://github.com/stanfordnlp/dspy) not yet implemented in DSTsx v1, prioritized for a v2 release.
> Items marked ✅ are implemented and documented in [README.md](./README.md#v2-apis).

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

### 1. ✅ `TypedPredictor` & `TypedChainOfThought`

**DSPy equivalent**: `dspy.TypedPredictor`, `dspy.TypedChainOfThought`
**Status**: ✅ **Implemented** — see [README § TypedPredictor](./README.md#typedpredictor--typedchainofthought)

Structured JSON output with schema validation, powered by [Zod](https://github.com/colinhacks/zod).

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

---

### 2. ✅ LM Streaming

**DSPy equivalent**: `dspy.streamify` (wraps a program for streaming)
**Status**: ✅ **Implemented** — see [README § LM Streaming](./README.md#lm-streaming)

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

### 3. ✅ Disk-Persistent Response Cache

**DSPy equivalent**: `dspy.cache` (SQLite-backed LRU)
**Status**: ✅ **Implemented** — see [README § Disk-Persistent LM Cache](./README.md#disk-persistent-lm-cache)

Persist LM responses across process restarts via file-based JSON cache.

```ts
const lm = new OpenAI({ model: "gpt-4o", cacheDir: "./.dstsx-cache" });
```

---

### 4. ✅ NativeReAct — Native Tool Calling (OpenAI Functions / Anthropic Tool Use)

**DSPy equivalent**: `dspy.Tool` improvements in DSPy v2
**Status**: ✅ **Implemented** — see [README § NativeReAct](./README.md#nativereact)

Use provider-native structured tool calling instead of text-based ReAct parsing.

**Proposed API:**

```ts
import { NativeReAct, Tool } from "dstsx";

const tools: Tool[] = [
  {
    name:        "search",
    description: "Search the web",
    args: {
      type:       "object",
      properties: { query: { type: "string" } },
      required:   ["query"],
    },
    fn: async ({ query }: { query: string }) => search(query),
  },
];

const agent = new NativeReAct("question -> answer", tools);
```

**Scope:**
- New `NativeReAct` module (or `ReAct` option `{ mode: "native" }`).
- `LM._callWithTools(messages, tools)` abstract method on adapters that support it.
- Implement in `OpenAI` (function calling) and `Anthropic` (tool use) adapters.
- Graceful fallback to text-based ReAct for adapters without native tool support.

---

### 5. ✅ Typedoc API Documentation Site

**Status**: ✅ **Implemented** — `typedoc.json` added; run `npm run docs`

Auto-generated API reference site published to GitHub Pages.

**Scope:**
- Add `typedoc.json` configuration.
- Add `"docs": "typedoc"` npm script.
- GitHub Actions workflow to publish to `gh-pages` branch on every release.
- All existing JSDoc comments already serve as source material — minimal effort required.

---

### 6. ✅ npm Publish Workflow (GitHub Actions CD)

**Status**: ✅ **Implemented** — `.github/workflows/ci.yml` + `publish.yml`

Automate package publishing on version bumps.

**Scope:**
- GitHub Actions workflow triggered on `release` events.
- Builds with `tsup`, runs tests, then `npm publish`.
- Use [Changesets](https://github.com/changesets/changesets) for changelog generation.
- Bump `package.json` version from `0.1.0` → `1.0.0`.

---

### 7. ✅ MCP Integration

**Status**: ✅ **Implemented** — see [README § MCP Integration](./README.md#mcp-integration)

- `MCPToolAdapter` — wrap MCP server tools as DSTsx `Tool` objects for `ReAct`
- `DSTsxMCPServer` — expose DSTsx modules as MCP tool definitions

#### Live MCP Connection

The current implementation supports test-mode (pre-loaded tools + callHandler).
A full live connection via SSE/stdio using `@modelcontextprotocol/sdk` is **planned**:

```ts
// Future: connect to a live MCP server
const adapter = new MCPToolAdapter({
  serverUrl: "http://localhost:3000/sse",
});
const tools = await adapter.getTools(); // fetches tool list from server
```

**Scope:**
- `MCPToolAdapter` live SSE transport using `@modelcontextprotocol/sdk`
- `DSTsxMCPServer.createStdioServer()` full stdio transport implementation

---

## Medium Priority

### 8. ✅ `BootstrapFewShotWithOptuna`

**DSPy equivalent**: `dspy.BootstrapFewShotWithOptuna`
**Status**: ✅ **Implemented** — see [README § BootstrapFewShotWithOptuna](./README.md#bootstrapfewshotwithoptuna)

Bayesian optimization (TPE sampler) for demo subset selection, using a built-in
pure-TypeScript TPE implementation (no external deps).

---

### 9. ✅ `majority()` Helper

**DSPy equivalent**: `dspy.majority`
**Status**: ✅ **Implemented** — see [README § majority() Helper](./README.md#majority-helper)

Majority-vote aggregation across multiple completions.

---

### 10. ✅ `Parallel` Module

**DSPy equivalent**: `dspy.Parallel`
**Status**: ✅ **Implemented** — see [README § Parallel Module](./README.md#parallel-module)

Fan-out/fan-in: run multiple different modules concurrently and collect all their outputs.

---

### 11. ✅ Multi-modal Support (`dspy.Image`)

**DSPy equivalent**: `dspy.Image`
**Status**: ✅ **Implemented** — see [README § Image](./README.md#image--multi-modal-support)

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

### 12. ✅ `Refine` Module

**Status**: ✅ **Implemented** — see [README § Refine Module](./README.md#refine-module)

Self-critique / iterative refinement loop.

---

### 13. ✅ Worker-Thread Sandbox for `ProgramOfThought`

**Status**: ✅ **Implemented** — see [README § Worker-Thread ProgramOfThought](./README.md#worker-thread-programofthought)

Replace the current `new Function()` executor with a proper Node.js `Worker` thread.

**Scope:**
- Optional peer dep on `node:worker_threads` (already available in Node 18+).
- Expose `sandbox?: "worker" | "function" | "none"` option on `ProgramOfThought`.
- Default to `"function"` for backward compatibility; document security tradeoffs.

---

## Low Priority

### 14. ✅ `BootstrapFinetune`

**DSPy equivalent**: `dspy.BootstrapFinetune`
**Status**: ✅ **Implemented** — see [README § BootstrapFinetune](./README.md#bootstrapfinetune)

Collect LM traces and export them in fine-tuning format (JSONL) for providers that support it.

**Proposed API:**

```ts
import { BootstrapFinetune } from "dstsx";

const optimizer = new BootstrapFinetune({
  exportPath: "./finetune_data.jsonl",
  format:     "openai",
});

const recipe = await optimizer.compile(program, trainset, metric);
```

---

### 15. ✅ `GRPO` Optimizer

**DSPy equivalent**: `dspy.GRPO` (Group Relative Policy Optimization)
**Status**: ✅ **Implemented** — see [README § GRPO Optimizer](./README.md#grpo-optimizer)

Gradient-style prompt search using reinforcement-learning-inspired reward signals.

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

### 16. ✅ `SIMBA` Optimizer

**DSPy equivalent**: `dspy.SIMBA` (Stochastic Introspective Mini-Batch Ascent)
**Status**: ✅ **Implemented** — see [README § SIMBA Optimizer](./README.md#simba-optimizer)

A lightweight stochastic search optimizer well-suited for small training sets.

---

### 17. ✅ `AvatarOptimizer`

**DSPy equivalent**: `dspy.AvatarOptimizer`
**Status**: ✅ **Implemented** — see [README § AvatarOptimizer](./README.md#avataroptimizer)

Iteratively proposes and evaluates "avatar" personas (role descriptions) for each `Predict` module.

---

### 18. ✅ Experiment Tracking Integration

**DSPy equivalent**: `dspy.MLflow`
**Status**: ✅ **Implemented** — see [README § Experiment Tracking](./README.md#experiment-tracking)

Log optimizer runs, metric scores, and demo sets to MLflow or Weights & Biases.

```ts
import { BootstrapFewShot, MLflowTracker } from "dstsx";

const optimizer = new BootstrapFewShot({
  maxBootstrappedDemos: 4,
  tracker: new MLflowTracker({ experiment: "qa-optimization" }),
});
```

---

## Stretch / Experimental

### 19. `Refine` / Gradient-Based Refinement

**Status**: ✅ **Implemented** (self-critique version)

The v2 `Refine` module implements iterative self-critique. Future: Constitutional AI-style critique, multi-model critique pipelines.

### 20. HTTP Serving

Serialize and serve an optimized program as a REST/gRPC endpoint.

### 21. Cross-Language Trace Sharing

Export / import traces in a format compatible with the Python DSPy library.

### 22. Browser-Native Bundle

A `dstsx/browser` entry-point that strips all `node:` built-ins.

---

## Summary Table

| # | Feature | DSPy Symbol | Priority | Status |
|---|---|---|---|---|
| 1 | TypedPredictor / TypedChainOfThought | `TypedPredictor` | High | ✅ v2 |
| 2 | LM Streaming | `streamify` | High | ✅ v2 |
| 3 | Disk-Persistent Cache | `dspy.cache` | High | ✅ v2 |
| 4 | NativeReAct — Native Tool Calling | `Tool` (v2) | High | ✅ v2 |
| 5 | Typedoc Site | — | High | ✅ v2 |
| 6 | npm Publish Workflow | — | High | ✅ v2 |
| 7 | MCP Integration | — | High | ✅ v2 |
| 8 | BootstrapFewShotWithOptuna | `BootstrapFewShotWithOptuna` | Medium | ✅ v2 |
| 9 | Majority Helper | `majority` | Medium | ✅ v2 |
| 10 | Parallel Module | `Parallel` | Medium | ✅ v2 |
| 11 | Multi-modal (Image) | `dspy.Image` | Medium | ✅ v2 |
| 12 | Refine Module | — | Medium | ✅ v2 |
| 13 | Worker-Thread ProgramOfThought | — | Medium | ✅ v2 |
| 14 | BootstrapFinetune | `BootstrapFinetune` | Low | ✅ v2 |
| 15 | GRPO Optimizer | `GRPO` | Low | ✅ v2 |
| 16 | SIMBA Optimizer | `SIMBA` | Low | ✅ v2 |
| 17 | AvatarOptimizer | `AvatarOptimizer` | Low | ✅ v2 |
| 18 | Experiment Tracking | `MLflow` | Low | ✅ v2 |
| 19 | HTTP Serving | — | Stretch | 🗓 Planned |
| 20 | Cross-Language Trace Sharing | — | Stretch | 🗓 Planned |
| 21 | Browser-Native Bundle | — | Stretch | 🗓 Planned |

---
