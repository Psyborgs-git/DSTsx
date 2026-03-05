# DSTsx — Overview

> A TypeScript-first port of [DSPy](https://github.com/stanfordnlp/dspy) — Declarative Self-improving Language Programs.

DSTsx lets you build **typed, composable LM pipelines** in TypeScript and then **optimize** their prompts and few-shot examples automatically—no manual prompt engineering required.

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

## Documentation Index

| File | Contents |
|---|---|
| [overview.md](./overview.md) | Installation, quick start, core concepts (this file) |
| [signatures.md](./signatures.md) | `Signature`, `InputField`, `OutputField`, `FieldMeta` |
| [primitives.md](./primitives.md) | `Example`, `Prediction`, `Trace`, `Image`, `majority()` |
| [lm-adapters.md](./lm-adapters.md) | LM adapters, `LMCallConfig`, `LMResponse`, streaming, cache |
| [settings.md](./settings.md) | `settings.configure()`, `settings.context()`, `SettingsOptions` |
| [modules.md](./modules.md) | `Predict`, `ChainOfThought`, `ReAct`, `ProgramOfThought`, and more |
| [retrievers.md](./retrievers.md) | `ColBERTv2`, `PineconeRM`, `ChromadbRM`, and other backends |
| [optimizers.md](./optimizers.md) | `BootstrapFewShot`, `COPRO`, `MIPRO`, `GRPO`, `SIMBA`, and more |
| [evaluate.md](./evaluate.md) | `evaluate()`, built-in metrics (`exactMatch`, `f1`, etc.) |
| [assertions.md](./assertions.md) | `Assert`, `Suggest`, `AssertionError`, `Retry` pattern |
| [v2-features.md](./v2-features.md) | v2 APIs: TypedPredictor, Parallel, Refine, NativeReAct, Image, etc. |
| [tracking.md](./tracking.md) | `ConsoleTracker`, `JsonFileTracker`, custom `Tracker` |
| [mcp.md](./mcp.md) | `MCPToolAdapter`, `DSTsxMCPServer` |
| [examples.md](./examples.md) | End-to-end code examples |

---

## Package Info

- **npm**: `dstsx`
- **License**: MIT
- **DSPy equivalent**: 1:1 TypeScript port of [DSPy](https://github.com/stanfordnlp/dspy)
- **Node.js**: Requires Node.js 18+ (uses `AsyncLocalStorage`, Worker threads)
- **TypeScript**: Full type safety, `exactOptionalPropertyTypes`, generics throughout
