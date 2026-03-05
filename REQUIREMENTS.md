# DSTsx — Requirements Document

> A 1:1 TypeScript alternative to [DSPy](https://github.com/stanfordnlp/dspy) (Declarative Self-improving Language Programs).

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [Core Concepts](#3-core-concepts)
4. [Functional Requirements](#4-functional-requirements)
   - 4.1 [Signatures](#41-signatures)
   - 4.2 [Primitives](#42-primitives)
   - 4.3 [Language Model Adapters](#43-language-model-adapters)
   - 4.4 [Modules](#44-modules)
   - 4.5 [Retrievers](#45-retrievers)
   - 4.6 [Optimizers (Teleprompters)](#46-optimizers-teleprompters)
   - 4.7 [Evaluation](#47-evaluation)
   - 4.8 [Assertions & Suggestions](#48-assertions--suggestions)
   - 4.9 [Settings & Context](#49-settings--context)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [API Parity Matrix](#6-api-parity-matrix)
7. [Folder & File Structure](#7-folder--file-structure)
8. [Build, Lint & Test Toolchain](#8-build-lint--test-toolchain)
9. [Dependencies](#9-dependencies)
10. [Roadmap](#10-roadmap)

---

## 1. Project Overview

**DSTsx** is a TypeScript-first, framework-agnostic library that replicates the full programming model of [DSPy](https://github.com/stanfordnlp/dspy).  
DSPy lets developers build Language Model (LM) pipelines by composing **typed modules** and then **optimizing** their prompts and few-shot examples automatically—without manual prompt engineering.

DSTsx brings that same workflow to the TypeScript/JavaScript ecosystem, including Node.js servers, Next.js applications, and browser bundles.

---

## 2. Goals & Non-Goals

### Goals
- Provide a **1:1 API surface** that mirrors every public class, function, and decorator in DSPy.
- Be **runtime-agnostic**: Node.js 18+, Deno, Bun, and modern browsers (via ESM).
- Expose **first-class TypeScript types** for all inputs, outputs, and configurations.
- Support the same **LM backends** as DSPy (OpenAI, Anthropic, Cohere, Google, local models via Ollama/LM Studio).
- Support the same **retriever backends** as DSPy (ColBERTv2, Pinecone, Weaviate, Chromadb, Qdrant, etc.).
- Ship with a **zero-config optimizer** so beginners can improve pipelines in one call.
- Be **tree-shakeable** so bundlers only include what is used.

### Non-Goals
- A Python ↔ TypeScript bridge / interop layer.
- A visual prompt editor / playground (out of scope for v1).
- Fine-tuning or model training (only prompt/few-shot optimization is in scope).

---

## 3. Core Concepts

| Concept | DSPy | DSTsx |
|---|---|---|
| **Signature** | `dspy.Signature` / `"question -> answer"` string | `Signature` class + `sig` tagged template / string shorthand |
| **Field** | `dspy.InputField`, `dspy.OutputField` | `InputField`, `OutputField` typed descriptors |
| **Module** | `dspy.Module` subclass | `Module` abstract class |
| **Program** | Composition of modules | Same |
| **LM** | `dspy.LM`, `dspy.OpenAI`, etc. | `LM` abstract + concrete adapters |
| **Prediction** | `dspy.Prediction` | `Prediction` typed record |
| **Example** | `dspy.Example` | `Example` typed record |
| **Optimizer** | `dspy.BootstrapFewShot`, etc. | `Optimizer` abstract + concrete classes |
| **Retrieve** | `dspy.Retrieve` | `Retrieve` module |
| **Evaluate** | `dspy.Evaluate` | `evaluate` function |
| **Assertion** | `dspy.Assert`, `dspy.Suggest` | `Assert`, `Suggest` functions |
| **Settings** | `dspy.settings.configure(...)` | `settings.configure(...)` singleton |

---

## 4. Functional Requirements

### 4.1 Signatures

Signatures define the **typed interface** (inputs and outputs) for a single LM call.

#### Requirements
- **FR-SIG-01**: Parse shorthand string signatures of the form `"field1, field2 -> out1, out2"`.
- **FR-SIG-02**: Allow full `Signature` class declarations with field metadata (description, type, prefix).
- **FR-SIG-03**: Support `InputField(description, prefix, format)` and `OutputField(description, prefix, format)` decorators / builder functions.
- **FR-SIG-04**: Extend signatures at runtime (add/remove fields) via `Signature.with({...})`.
- **FR-SIG-05**: Signatures must be serializable to/from JSON (for caching optimized programs).
- **FR-SIG-06**: Support optional fields with `?` suffix in shorthand syntax.
- **FR-SIG-07**: Support typed fields: `string`, `number`, `boolean`, `string[]`, custom JSON types.
- **FR-SIG-08**: Provide a `instructions` string property on signatures (system-level prompt instruction).

### 4.2 Primitives

#### `Example`
- **FR-PRIM-01**: `Example` is an immutable record of named string or typed values.
- **FR-PRIM-02**: Supports `.with(overrides)` to return a modified copy.
- **FR-PRIM-03**: Supports `.inputs()` / `.labels()` views filtered by signature.
- **FR-PRIM-04**: Supports `.toDict()` and `Example.fromDict(obj)` serialization.

#### `Prediction`
- **FR-PRIM-05**: `Prediction` extends `Example` and additionally stores `completions` (all candidate outputs).
- **FR-PRIM-06**: Provides `.get(field)` typed accessor.
- **FR-PRIM-07**: Supports multiple completions (for `k > 1` calls).

#### `Trace` / `History`
- **FR-PRIM-08**: Every LM call records a `Trace` object: `{ signature, inputs, outputs, usage, latencyMs }`.
- **FR-PRIM-09**: A thread-local (AsyncLocalStorage) `History` stack accumulates traces during a program run.
- **FR-PRIM-10**: `getHistory()` returns all traces since the last `clearHistory()` call.

### 4.3 Language Model Adapters

#### Abstract `LM`
- **FR-LM-01**: Abstract `LM` class exposes `async call(prompt: string | Message[], config: LMCallConfig): Promise<LMResponse>`.
- **FR-LM-02**: `LMCallConfig` includes: `model`, `temperature`, `maxTokens`, `stop`, `n` (number of completions), `cacheKey`.
- **FR-LM-03**: Built-in **in-memory LRU cache** (configurable size + TTL) for identical prompts.
- **FR-LM-04**: `LM` exposes `requestCount` and `tokenUsage` counters.
- **FR-LM-05**: All adapters implement `LM` and accept provider-specific options through a typed `options` object.

#### Concrete Adapters (v1 scope)
| Adapter | Provider |
|---|---|
| `OpenAI` | openai (chat + text) |
| `Anthropic` | @anthropic-ai/sdk |
| `Cohere` | cohere-ai |
| `GoogleAI` | @google/generative-ai |
| `Ollama` | Ollama REST API |
| `LMStudio` | OpenAI-compatible REST |
| `HuggingFace` | HuggingFace Inference API |

- **FR-LM-06**: A `dummyLM` / `MockLM` adapter for unit testing that returns deterministic completions from a lookup map.
- **FR-LM-07**: `settings.configure({ lm })` sets the global default LM; any module can override locally.

### 4.4 Modules

#### Abstract `Module`
- **FR-MOD-01**: `Module` is an abstract class with `abstract forward(...args): Promise<Prediction>`.
- **FR-MOD-02**: `Module` provides `named_parameters()` which recursively discovers all `Predict` sub-modules.
- **FR-MOD-03**: `Module` provides `save(path)` / `Module.load(path)` JSON serialization of all parameter states.
- **FR-MOD-04**: Modules are composable — a module may contain other modules as properties.
- **FR-MOD-05**: `Module` exposes `setLM(lm)` to override the LM for all child predictors.

#### `Predict`
- **FR-MOD-06**: `Predict(signature)` is the fundamental module: formats a prompt and calls the LM.
- **FR-MOD-07**: Supports zero-shot, few-shot (via `demos` list), and instruction-tuned prompt formats.
- **FR-MOD-08**: `Predict` stores `demos: Example[]` and `instructions: string` as learnable parameters.
- **FR-MOD-09**: Prompt formatting adapts automatically to the LM's preferred format (chat vs. completion).
- **FR-MOD-10**: Supports `n > 1` completions (returns `Prediction` with `completions` array).

#### `ChainOfThought` (CoT)
- **FR-MOD-11**: Wraps `Predict` and prepends a `rationale` output field to the signature.
- **FR-MOD-12**: The rationale is hidden from downstream modules (internal reasoning).
- **FR-MOD-13**: Optional `rationale_type` to customize the rationale field description.

#### `ChainOfThoughtWithHint`
- **FR-MOD-14**: Extends `ChainOfThought`; accepts an extra `hint` input at call time.

#### `MultiChainComparison`
- **FR-MOD-15**: Takes `M` completions from a `ChainOfThought` module and selects the best via a final LM call.
- **FR-MOD-16**: Exposes `M` (number of completions) as a configurable parameter.

#### `ReAct`
- **FR-MOD-17**: Implements the Reasoning + Acting loop (Yao et al., 2022).
- **FR-MOD-18**: Accepts a list of `Tool` objects (each with `name`, `description`, `fn` async callback, `args` schema).
- **FR-MOD-19**: Loops until the LM emits a `Finish` action or `maxIter` is reached.
- **FR-MOD-20**: Records the full thought/action/observation trajectory in the `Prediction`.

#### `ProgramOfThought`
- **FR-MOD-21**: Generates, executes, and self-corrects code (Python-like pseudocode or JS) to answer questions.
- **FR-MOD-22**: Sandboxed execution environment (no `eval` with raw user input; uses a configurable executor).
- **FR-MOD-23**: Retry loop on execution error up to `maxAttempts`.

#### `Retrieve`
- **FR-MOD-24**: `Retrieve(k)` module that calls the globally configured retriever.
- **FR-MOD-25**: Returns a `Prediction` with `passages: string[]`.

#### `Retry`
- **FR-MOD-26**: Wraps any module and retries on assertion failure up to `maxAttempts`.
- **FR-MOD-27**: Passes failure feedback back into the next attempt's prompt.

#### `BestOfN` / `Ensemble`
- **FR-MOD-28**: Runs `N` copies of a module in parallel and selects the best output via a provided `reduceFunc`.

### 4.5 Retrievers

#### Abstract `Retriever`
- **FR-RET-01**: Abstract `Retriever` with `async retrieve(query: string, k: number): Promise<string[]>`.

#### Concrete Retrievers (v1 scope)
| Class | Backend |
|---|---|
| `ColBERTv2` | ColBERT REST API |
| `PineconeRM` | @pinecone-database/pinecone |
| `WeaviateRM` | weaviate-client |
| `ChromadbRM` | chromadb |
| `QdrantRM` | @qdrant/js-client-rest |
| `FaissRM` | faiss-node (optional dep) |
| `YouRM` | You.com API |
| `MockRetriever` | In-memory for testing |

- **FR-RET-02**: `settings.configure({ rm })` sets the global retriever.
- **FR-RET-03**: Each retriever constructor accepts optional `embeddingModel` override.

### 4.6 Optimizers (Teleprompters)

#### Abstract `Optimizer`
- **FR-OPT-01**: Abstract `Optimizer` with `async compile(student: Module, trainset: Example[], metric: Metric): Promise<Module>`.
- **FR-OPT-02**: Returns a **new** (optimized) module; never mutates the input.
- **FR-OPT-03**: Supports a `valset` parameter for held-out validation.

#### `LabeledFewShot`
- **FR-OPT-04**: Directly assigns `trainset` examples as `demos` in each `Predict` module (no LM calls).

#### `BootstrapFewShot`
- **FR-OPT-05**: Runs the student on `trainset`, collects successful traces, and uses them as `demos`.
- **FR-OPT-06**: Accepts `metric: Metric` to filter which traces are "successful".
- **FR-OPT-07**: Configurable `maxBootstrappedDemos` and `maxLabeledDemos`.
- **FR-OPT-08**: Optional `teacher` module (defaults to student).

#### `BootstrapFewShotWithRandomSearch`
- **FR-OPT-09**: Extends `BootstrapFewShot`; tries `numCandidatePrograms` random demo subsets and picks the best.

#### `BootstrapFewShotWithOptuna`
- **FR-OPT-10**: Same as above but uses Bayesian optimization (via `optuna-wasm` or custom) to search demo subsets.

#### `COPRO` (Collaborative Prompt Optimization)
- **FR-OPT-11**: Uses the LM to propose instruction improvements for each `Predict` module.
- **FR-OPT-12**: Configurable `depth` (refinement iterations) and `breadth` (candidates per iteration).

#### `MIPRO` (Multi-stage Instruction PRompt Optimization)
- **FR-OPT-13**: Generates instruction candidates via `COPRO`-style proposals, then selects the best combination using `BootstrapFewShotWithRandomSearch`.
- **FR-OPT-14**: Configurable `numCandidates`, `initTemperature`, `verbose`, `trackStats`.

#### `KNNFewShot`
- **FR-OPT-15**: Selects `demos` at inference time using k-NN over a training set (dynamic few-shot).
- **FR-OPT-16**: Requires an embedding model (uses the globally configured `LM` or a separate embedder).

#### `Ensemble`
- **FR-OPT-17**: Combines multiple optimized programs into one via voting or custom `reduceFunc`.

### 4.7 Evaluation

- **FR-EVAL-01**: `evaluate(program, devset, metric, options?)` async function runs `program` on every example in `devset` and returns an `EvaluationResult`.
- **FR-EVAL-02**: `EvaluationResult` includes `score`, `perExampleResults`, and `averageMetric`.
- **FR-EVAL-03**: Supports **parallel** evaluation with configurable `numThreads`.
- **FR-EVAL-04**: Provides a `displayProgress` option (progress bar via `cli-progress`).
- **FR-EVAL-05**: Ships with built-in `Metric` helpers: `exactMatch`, `f1`, `passAtK`, `bleu`, `rouge`.
- **FR-EVAL-06**: `Metric` type: `(example: Example, prediction: Prediction, trace?: Trace[]) => number | boolean`.

### 4.8 Assertions & Suggestions

- **FR-ASSERT-01**: `Assert(condition, message?)` throws a typed `AssertionError` if `condition` is falsy; this is caught by `Retry`.
- **FR-ASSERT-02**: `Suggest(condition, message?)` logs a soft warning and continues (does not throw).
- **FR-ASSERT-03**: Both are available as standalone functions and as methods on `Prediction`.

### 4.9 Settings & Context

- **FR-SET-01**: `settings` is a **singleton** object with `configure(options)` / `reset()` methods.
- **FR-SET-02**: `SettingsOptions` includes: `lm`, `rm`, `traceMode`, `cacheDir`, `logLevel`, `experimental`.
- **FR-SET-03**: `settings.context(overrides, fn)` runs `fn` inside an `AsyncLocalStorage` scope with locally overridden settings (enables per-request LM in server environments).
- **FR-SET-04**: `settings.inspect()` returns a deep-frozen snapshot of current settings.

---

## 5. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Performance | Optimizer `compile` must not block the event loop; use async I/O throughout. |
| NFR-02 | Performance | In-memory LM response cache reduces repeated API calls by ≥ 80 % in benchmarks. |
| NFR-03 | Reliability | All LM adapters implement exponential back-off + jitter for rate-limit (429) errors. |
| NFR-04 | Reliability | `Module.save` / `Module.load` must be backward-compatible across minor versions. |
| NFR-05 | Security | No `eval()` of untrusted strings outside the sandboxed `ProgramOfThought` executor. |
| NFR-06 | Security | API keys must never appear in serialized modules, logs, or traces. |
| NFR-07 | Compatibility | ESM-first; CommonJS wrapper for legacy Node.js consumers. |
| NFR-08 | Bundle size | Core (`Module`, `Predict`, `Signature`, `Settings`) tree-shakes to < 20 KB gzip. |
| NFR-09 | Testing | ≥ 90 % line coverage on core primitives and modules; optimizer integration tests use `MockLM`. |
| NFR-10 | Documentation | Every public API has a JSDoc comment; a Typedoc-generated site is published. |
| NFR-11 | Versioning | Follows Semantic Versioning 2.0; changelog generated via `conventional-changelog`. |

---

## 6. API Parity Matrix

| DSPy Symbol | DSTsx Symbol | Status |
|---|---|---|
| `dspy.Signature` | `Signature` | ✅ Implemented |
| `dspy.InputField` | `InputField` | ✅ Implemented |
| `dspy.OutputField` | `OutputField` | ✅ Implemented |
| `dspy.Module` | `Module` | ✅ Implemented |
| `dspy.Predict` | `Predict` | ✅ Implemented |
| `dspy.ChainOfThought` | `ChainOfThought` | ✅ Implemented |
| `dspy.ChainOfThoughtWithHint` | `ChainOfThoughtWithHint` | ✅ Implemented |
| `dspy.MultiChainComparison` | `MultiChainComparison` | ✅ Implemented |
| `dspy.ReAct` | `ReAct` | ✅ Implemented |
| `dspy.ProgramOfThought` | `ProgramOfThought` | ✅ Implemented |
| `dspy.Retrieve` | `Retrieve` | ✅ Implemented |
| `dspy.Retry` | `Retry` | ✅ Implemented |
| `dspy.Predict` (n>1) | `Predict` (n>1) | ✅ Implemented |
| `dspy.Example` | `Example` | ✅ Implemented |
| `dspy.Prediction` | `Prediction` | ✅ Implemented |
| `dspy.LM` | `LM` | ✅ Implemented |
| `dspy.OpenAI` | `OpenAI` | ✅ Implemented |
| `dspy.Anthropic` | `Anthropic` | ✅ Implemented |
| `dspy.Cohere` | `Cohere` | ✅ Implemented |
| `dspy.Google` | `GoogleAI` | ✅ Implemented |
| `dspy.OllamaLocal` | `Ollama` | ✅ Implemented |
| `dspy.HFModel` | `HuggingFace` | ✅ Implemented |
| `dspy.ColBERTv2` | `ColBERTv2` | ✅ Implemented |
| `dspy.Pinecone` | `PineconeRM` | ✅ Implemented |
| `dspy.Weaviate` | `WeaviateRM` | ✅ Implemented |
| `dspy.Chromadb` | `ChromadbRM` | ✅ Implemented |
| `dspy.Qdrant` | `QdrantRM` | ✅ Implemented |
| `dspy.LabeledFewShot` | `LabeledFewShot` | ✅ Implemented |
| `dspy.BootstrapFewShot` | `BootstrapFewShot` | ✅ Implemented |
| `dspy.BootstrapFewShotWithRandomSearch` | `BootstrapFewShotWithRandomSearch` | ✅ Implemented |
| `dspy.COPRO` | `COPRO` | ✅ Implemented |
| `dspy.MIPRO` | `MIPRO` | ✅ Implemented |
| `dspy.KNNFewShot` | `KNNFewShot` | ✅ Implemented |
| `dspy.Ensemble` | `Ensemble` | ✅ Implemented |
| `dspy.Evaluate` | `evaluate` | ✅ Implemented |
| `dspy.Assert` | `Assert` | ✅ Implemented |
| `dspy.Suggest` | `Suggest` | ✅ Implemented |
| `dspy.settings` | `settings` | ✅ Implemented |
| `dspy.BootstrapFewShotWithOptuna` | `BootstrapFewShotWithOptuna` | 🗓 Planned (v2) |
| `dspy.TypedPredictor` | `TypedPredictor` | 🗓 Planned (v2) |
| `dspy.streamify` | `LM.stream` / `Module.stream` | 🗓 Planned (v2) |
| `dspy.Image` | `Image` | 🗓 Planned (v2) |

---

## 7. Folder & File Structure

```
DSTsx/
├── REQUIREMENTS.md          ← This document
├── README.md
├── package.json
├── tsconfig.json
├── tsconfig.build.json      ← Exclude tests from production build
├── .eslintrc.cjs
├── .prettierrc
├── vitest.config.ts
├── .gitignore
│
├── src/
│   ├── index.ts             ← Public barrel export
│   │
│   ├── signatures/
│   │   ├── index.ts
│   │   ├── Signature.ts     ← Signature class + shorthand parser
│   │   ├── Field.ts         ← InputField, OutputField builder functions
│   │   └── types.ts         ← FieldMeta, SignatureMeta interfaces
│   │
│   ├── primitives/
│   │   ├── index.ts
│   │   ├── Example.ts
│   │   ├── Prediction.ts
│   │   └── Trace.ts
│   │
│   ├── lm/
│   │   ├── index.ts
│   │   ├── LM.ts            ← Abstract LM base class
│   │   ├── cache.ts         ← LRU cache implementation
│   │   ├── types.ts         ← LMCallConfig, LMResponse, Message
│   │   └── adapters/
│   │       ├── index.ts
│   │       ├── OpenAI.ts
│   │       ├── Anthropic.ts
│   │       ├── Cohere.ts
│   │       ├── GoogleAI.ts
│   │       ├── Ollama.ts
│   │       ├── LMStudio.ts
│   │       ├── HuggingFace.ts
│   │       └── MockLM.ts    ← For testing
│   │
│   ├── modules/
│   │   ├── index.ts
│   │   ├── Module.ts        ← Abstract Module base class
│   │   ├── Predict.ts
│   │   ├── ChainOfThought.ts
│   │   ├── ChainOfThoughtWithHint.ts
│   │   ├── MultiChainComparison.ts
│   │   ├── ReAct.ts
│   │   ├── ProgramOfThought.ts
│   │   ├── Retrieve.ts
│   │   ├── Retry.ts
│   │   ├── BestOfN.ts
│   │   └── Ensemble.ts
│   │
│   ├── retrieve/
│   │   ├── index.ts
│   │   ├── Retriever.ts     ← Abstract Retriever base class
│   │   └── backends/
│   │       ├── index.ts
│   │       ├── ColBERTv2.ts
│   │       ├── PineconeRM.ts
│   │       ├── WeaviateRM.ts
│   │       ├── ChromadbRM.ts
│   │       ├── QdrantRM.ts
│   │       ├── FaissRM.ts
│   │       ├── YouRM.ts
│   │       └── MockRetriever.ts
│   │
│   ├── optimizers/
│   │   ├── index.ts
│   │   ├── Optimizer.ts     ← Abstract Optimizer base class
│   │   ├── LabeledFewShot.ts
│   │   ├── BootstrapFewShot.ts
│   │   ├── BootstrapFewShotWithRandomSearch.ts
│   │   ├── BootstrapFewShotWithOptuna.ts
│   │   ├── COPRO.ts
│   │   ├── MIPRO.ts
│   │   ├── KNNFewShot.ts
│   │   └── Ensemble.ts
│   │
│   ├── evaluate/
│   │   ├── index.ts
│   │   ├── evaluate.ts      ← evaluate() function
│   │   ├── metrics.ts       ← exactMatch, f1, bleu, rouge, passAtK
│   │   └── types.ts         ← Metric, EvaluationResult
│   │
│   ├── assertions/
│   │   ├── index.ts
│   │   ├── Assert.ts
│   │   └── Suggest.ts
│   │
│   └── settings/
│       ├── index.ts
│       └── Settings.ts      ← Singleton settings with AsyncLocalStorage
│
└── tests/
    ├── signatures/
    │   └── Signature.test.ts
    ├── primitives/
    │   ├── Example.test.ts
    │   └── Prediction.test.ts
    ├── lm/
    │   ├── LM.test.ts
    │   └── MockLM.test.ts
    ├── modules/
    │   ├── Predict.test.ts
    │   ├── ChainOfThought.test.ts
    │   └── ReAct.test.ts
    ├── optimizers/
    │   ├── LabeledFewShot.test.ts
    │   └── BootstrapFewShot.test.ts
    └── evaluate/
        └── evaluate.test.ts
```

---

## 8. Build, Lint & Test Toolchain

| Tool | Purpose | Config file |
|---|---|---|
| **TypeScript 5.x** | Type checking + transpilation | `tsconfig.json` |
| **tsup** | Library bundler (ESM + CJS + `.d.ts`) | `package.json#tsup` |
| **Vitest** | Unit & integration testing | `vitest.config.ts` |
| **ESLint** | Linting | `.eslintrc.cjs` |
| **Prettier** | Formatting | `.prettierrc` |
| **Typedoc** | API documentation | `typedoc.json` |
| **Changesets** | Versioning & changelog | `.changeset/config.json` |

### Scripts
```json
{
  "build":   "tsup",
  "test":    "vitest run",
  "test:watch": "vitest",
  "lint":    "eslint src tests --ext .ts",
  "format":  "prettier --write .",
  "typecheck": "tsc --noEmit",
  "docs":    "typedoc"
}
```

---

## 9. Dependencies

### Runtime (peer / optional by adapter)
| Package | Version | Used by |
|---|---|---|
| `openai` | `^4` | `OpenAI` adapter |
| `@anthropic-ai/sdk` | `^0.21` | `Anthropic` adapter |
| `cohere-ai` | `^7` | `Cohere` adapter |
| `@google/generative-ai` | `^0.7` | `GoogleAI` adapter |
| `@pinecone-database/pinecone` | `^2` | `PineconeRM` |
| `weaviate-client` | `^3` | `WeaviateRM` |
| `chromadb` | `^1` | `ChromadbRM` |
| `@qdrant/js-client-rest` | `^1` | `QdrantRM` |

### Dev only
| Package | Version | Purpose |
|---|---|---|
| `typescript` | `^5` | Type checking |
| `tsup` | `^8` | Bundling |
| `vitest` | `^1` | Testing |
| `eslint` | `^8` | Linting |
| `prettier` | `^3` | Formatting |
| `typedoc` | `^0.25` | Docs |

---

## 10. Roadmap

### v0.1 — Core Primitives (MVP)
- [x] `Signature` parsing (string shorthand + class-based)
- [x] `InputField` / `OutputField`
- [x] `Example` and `Prediction` primitives
- [x] `LM` abstract base + `OpenAI` adapter
- [x] `MockLM` for testing
- [x] `Predict` module
- [x] `settings` singleton
- [x] `Assert` / `Suggest`
- [x] Test infrastructure (Vitest)

### v0.2 — Reasoning Modules
- [x] `ChainOfThought`
- [x] `ChainOfThoughtWithHint`
- [x] `ReAct` + `Tool` interface
- [x] `Retry` module
- [x] `Trace` / `History`

### v0.3 — Retrieval
- [x] Abstract `Retriever`
- [x] `ColBERTv2`, `MockRetriever`
- [x] `Retrieve` module
- [x] `PineconeRM`, `ChromadbRM`, `QdrantRM`

### v0.4 — Optimizers
- [x] `LabeledFewShot`
- [x] `BootstrapFewShot`
- [x] `BootstrapFewShotWithRandomSearch`
- [x] `evaluate` + built-in metrics

### v0.5 — Advanced Optimizers
- [x] `COPRO`
- [x] `MIPRO`
- [x] `KNNFewShot`

### v0.6 — Remaining Adapters & Retrievers
- [x] `Anthropic`, `Cohere`, `GoogleAI`, `Ollama`, `HuggingFace`
- [x] `WeaviateRM`, `FaissRM`, `YouRM`
- [x] `MultiChainComparison`, `ProgramOfThought`, `BestOfN`, `Ensemble`

### v1.0 — Production Ready ✅
- [x] 160 tests passing across 29 test files (all modules, optimizers, e2e)
- [x] Full JSDoc on every public API
- [x] Comprehensive README with usage docs for all APIs
- [ ] Typedoc site (see V2 roadmap)
- [ ] Changelog + Semantic Versioning (see V2 roadmap)
- [ ] npm publish workflow / GitHub Actions (see V2 roadmap)

### v2.0 — Next Generation
See [V2_ROADMAP.md](./V2_ROADMAP.md) for the full prioritized list of DSPy features still missing from DSTsx.
