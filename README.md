# DSTsx

> Declarative Self-improving Language Programs in TypeScript — a 1:1 port of [DSPy](https://github.com/stanfordnlp/dspy).

[![npm version](https://img.shields.io/npm/v/@jaex/dstsx.svg)](https://www.npmjs.com/package/@jaex/dstsx)
[![license](https://img.shields.io/npm/l/@jaex/dstsx.svg)](LICENSE)
[![tests](https://img.shields.io/badge/tests-300%20passing-brightgreen.svg)](#)

DSTsx lets you build **typed, composable LM pipelines** in TypeScript and then **optimize** their prompts and few-shot examples automatically — no manual prompt engineering required.

---

## Installation

```bash
npm install @jaex/dstsx
```

Install provider SDK peer dependencies only for the adapters you use:

```bash
# Pick only the ones you need:
npm install openai            # OpenAI
npm install @anthropic-ai/sdk # Anthropic
npm install cohere-ai         # Cohere
npm install @google/generative-ai  # Google AI
```

## Quick Start

```ts
import { Predict, OpenAI, settings } from "@jaex/dstsx";

settings.configure({ lm: new OpenAI({ model: "gpt-4o" }) });
const qa = new Predict("question -> answer");
const result = await qa.forward({ question: "What is the capital of France?" });
console.log(result.get("answer")); // "Paris"
```

---

## Core Concepts

| Concept       | Description                                                                 |
|---------------|-----------------------------------------------------------------------------|
| **Signature** | Typed interface (`inputs -> outputs`) for a single LM call                  |
| **Module**    | Composable unit wrapping one or more LM calls (Predict, ChainOfThought…)   |
| **Optimizer** | Automatically tunes prompts and few-shot examples to maximise a metric      |
| **Metric**    | Scoring function used by optimizers and evaluation                          |
| **Adapter**   | Controls how signatures are formatted into LM messages and parsed back      |

---

## Signatures

A Signature defines the typed input/output interface for an LM call.

```ts
import { Signature, InputField, OutputField } from "@jaex/dstsx";

// Shorthand
const sig = Signature.from("context, question -> answer");

// Explicit
const sig2 = new Signature({
  inputs: new Map([["question", InputField({ description: "The question" })]]),
  outputs: new Map([["answer", OutputField({ description: "The answer" })]]),
  instructions: "Answer concisely.",
});
```

**Methods:** `Signature.from()`, `withInput()`, `withOutput()`, `with()`, `toJSON()`, `fromJSON()`

---

## Primitives

### Example & Prediction

```ts
import { Example, Prediction } from "@jaex/dstsx";

const ex = new Example({ question: "2+2?", answer: "4" });
const pred = new Prediction({ answer: "4" }, [{ answer: "four" }]);
console.log(pred.get("answer")); // "4"
```

### Trace & TokenUsage

```ts
import type { Trace, TokenUsage } from "@jaex/dstsx";
// Trace records: signature, inputs, outputs, usage, latencyMs, timestamp, reasoning
```

### Image

```ts
import { Image } from "@jaex/dstsx";

const img = Image.fromURL("https://example.com/photo.jpg");
const img2 = Image.fromBase64(data, "image/png");
const img3 = Image.fromFile("./photo.jpg");
```

### Audio

```ts
import { Audio } from "@jaex/dstsx";

const audio = Audio.fromURL("https://example.com/speech.mp3");
const audio2 = Audio.fromBase64(data, "audio/wav");
const audio3 = Audio.fromFile("./recording.wav");
```

### History

```ts
import { History } from "@jaex/dstsx";

const h = new History()
  .append("user", "Hello")
  .append("assistant", "Hi there!")
  .truncate(10);
const messages = h.toMessages();
```

### Code

```ts
import { Code } from "@jaex/dstsx";

const code = Code.from("return 2 + 2", "javascript");
console.log(code.value, code.language);
```

### ToolCalls

```ts
import { ToolCalls } from "@jaex/dstsx";

const tc = new ToolCalls([{ name: "search", args: { q: "test" }, result: "found" }]);
console.log(tc.calls[0].name); // "search"
```

### majority()

```ts
import { majority } from "@jaex/dstsx";
const winner = majority([pred1, pred2, pred3], "answer");
```

---

## Language Model Adapters

All adapters extend the abstract `LM` base class. Provider SDKs are loaded lazily via `import()`.

### OpenAI

```ts
import { OpenAI } from "@jaex/dstsx";
const lm = new OpenAI({ model: "gpt-4o", apiKey: "sk-..." });
```

### Anthropic

```ts
import { Anthropic } from "@jaex/dstsx";
const lm = new Anthropic({ model: "claude-3-opus-20240229" });
```

### Cohere

```ts
import { Cohere } from "@jaex/dstsx";
const lm = new Cohere({ model: "command-r-plus" });
```

### GoogleAI

```ts
import { GoogleAI } from "@jaex/dstsx";
const lm = new GoogleAI({ model: "gemini-1.5-pro" });
```

### Ollama

```ts
import { Ollama } from "@jaex/dstsx";
const lm = new Ollama({ model: "llama3" });
```

### LMStudio

```ts
import { LMStudio } from "@jaex/dstsx";
const lm = new LMStudio({ model: "local-model" });
```

### HuggingFace

```ts
import { HuggingFace } from "@jaex/dstsx";
const lm = new HuggingFace({ model: "meta-llama/Llama-2-7b-chat-hf" });
```

### MockLM (for testing)

```ts
import { MockLM } from "@jaex/dstsx";
const lm = new MockLM({ "What is 2+2?": "4" }, "default answer");
```

### LM Streaming

```ts
for await (const chunk of lm.stream("Hello", {})) {
  process.stdout.write(chunk.delta);
  if (chunk.done) break;
}
```

### Disk-Persistent Cache

```ts
import { DiskCache } from "@jaex/dstsx";
const lm = new OpenAI({ model: "gpt-4o" }); // pass cacheDir option
```

---

## Prompt Adapters

Adapters control how signatures and demos are formatted into LM messages.

### ChatAdapter (default)

```ts
import { ChatAdapter } from "@jaex/dstsx";
const adapter = new ChatAdapter();
const messages = adapter.format(sig, demos, inputs);
const parsed = adapter.parse(sig, llmOutputText);
```

### JSONAdapter

```ts
import { JSONAdapter } from "@jaex/dstsx";
const adapter = new JSONAdapter();
// Instructs LM to respond with JSON matching output schema
```

### TwoStepAdapter

```ts
import { TwoStepAdapter } from "@jaex/dstsx";
const adapter = new TwoStepAdapter();
// First generates free text, then extracts structured fields
```

---

## Settings & Context

```ts
import { settings } from "@jaex/dstsx";

// Global configuration
settings.configure({ lm, rm, lmConfig: { temperature: 0.7 }, logLevel: "info" });

// Per-request isolation (server environments)
await settings.context({ lm: perRequestLM }, async () => {
  return program.forward(inputs);
});

// Accessors
settings.lm; settings.rm; settings.lmConfig; settings.logLevel; settings.cacheDir;
settings.adapter; settings.embedder;

// Serialize/restore
settings.save("/tmp/settings.json");
settings.load("/tmp/settings.json");
settings.reset();
settings.inspect();
```

---

## Modules

### Predict

```ts
import { Predict } from "@jaex/dstsx";
const qa = new Predict("question -> answer");
const result = await qa.forward({ question: "What is 2+2?" });
```

### ChainOfThought

```ts
import { ChainOfThought } from "@jaex/dstsx";
const cot = new ChainOfThought("question -> answer");
const result = await cot.forward({ question: "Complex reasoning..." });
```

### ChainOfThoughtWithHint

```ts
import { ChainOfThoughtWithHint } from "@jaex/dstsx";
const cot = new ChainOfThoughtWithHint("question -> answer", "Think about math.");
```

### MultiChainComparison

```ts
import { MultiChainComparison } from "@jaex/dstsx";
const mcc = new MultiChainComparison("question -> answer", 3);
```

### ReAct

```ts
import { ReAct } from "@jaex/dstsx";
import type { Tool } from "@jaex/dstsx";

const tools: Tool[] = [{ name: "search", description: "Search web", fn: async (q) => `Result: ${q}` }];
const agent = new ReAct("question -> answer", tools);
const result = await agent.forward({ question: "Who won the 2024 Olympics?" });
result.get("toolCalls"); // ToolCalls with execution history
```

### NativeReAct

```ts
import { NativeReAct } from "@jaex/dstsx";
const agent = new NativeReAct("question -> answer", tools);
// Uses provider-native function calling (OpenAI tools, Anthropic tool_use)
```

### ProgramOfThought

```ts
import { ProgramOfThought } from "@jaex/dstsx";
const pot = new ProgramOfThought("question -> answer"); // default: worker sandbox
const pot2 = new ProgramOfThought("question -> answer", 3, 5000, "function");
```

### Retrieve

```ts
import { Retrieve, ColBERTv2, settings } from "@jaex/dstsx";
settings.configure({ rm: new ColBERTv2("http://localhost:8893") });
const retrieve = new Retrieve(3);
const result = await retrieve.forward("relevant query");
```

### Retry

```ts
import { Retry } from "@jaex/dstsx";
const retrying = new Retry(innerModule, metric, 3);
```

### BestOfN

```ts
import { BestOfN } from "@jaex/dstsx";
const best = new BestOfN(innerModule, metric, 5);
```

### Ensemble

```ts
import { Ensemble } from "@jaex/dstsx";
const ensemble = new Ensemble([module1, module2, module3], "answer");
```

### TypedPredictor & TypedChainOfThought

JSON-structured output with optional schema validation. Uses JSONAdapter internally.

```ts
import { TypedPredictor, TypedChainOfThought } from "@jaex/dstsx";
import { z } from "zod";

const schema = z.object({ answer: z.string(), confidence: z.number() });
const tp = new TypedPredictor("question -> answer, confidence", schema);
const result = await tp.forward({ question: "What is π?" });
console.log(result.typed); // { answer: "3.14159...", confidence: 0.99 }

const tcot = new TypedChainOfThought("question -> answer", schema);
```

### Parallel

```ts
import { Parallel } from "@jaex/dstsx";
const parallel = new Parallel([module1, module2]);
const results = await parallel.forward(inputs);
```

### Refine

```ts
import { Refine } from "@jaex/dstsx";
const refine = new Refine(innerModule, metric, { maxRounds: 3 });
```

### CodeAct

```ts
import { CodeAct } from "@jaex/dstsx";
const agent = new CodeAct("question -> answer", tools, 5, "worker");
const result = await agent.forward({ question: "Compute fibonacci(10)" });
```

### Reasoning

```ts
import { Reasoning } from "@jaex/dstsx";
const reasoning = new Reasoning("question -> answer");
// Surfaces native reasoning tokens from models like o1, o3, DeepSeek-R1
```

### RLM

```ts
import { RLM } from "@jaex/dstsx";
const rlm = new RLM(innerModule, (pred) => scoreFunction(pred), 5);
const result = await rlm.forward(inputs); // Selects highest-scoring of k samples
```

---

## Retrievers

All retrievers extend the abstract `Retriever` base class. Provider SDKs are loaded lazily.

| Retriever       | Provider     | Package                   |
|-----------------|-------------|---------------------------|
| `ColBERTv2`     | ColBERTv2   | —                         |
| `PineconeRM`    | Pinecone    | `@pinecone-database/pinecone` |
| `ChromadbRM`    | Chroma      | `chromadb`                |
| `QdrantRM`      | Qdrant      | `@qdrant/js-client-rest`  |
| `WeaviateRM`    | Weaviate    | `weaviate-ts-client`      |
| `FaissRM`       | FAISS       | `faiss-node`              |
| `YouRM`         | You.com     | —                         |
| `MockRetriever` | (testing)   | —                         |

```ts
import { ColBERTv2 } from "@jaex/dstsx";
const rm = new ColBERTv2("http://localhost:8893");
const passages = await rm.retrieve("query", 5);
```

---

## Optimizers

All optimizers extend the abstract `Optimizer` base class.

### LabeledFewShot

```ts
import { LabeledFewShot } from "@jaex/dstsx";
const opt = new LabeledFewShot(3);
const optimized = await opt.compile(student, trainset, metric);
```

### BootstrapFewShot

```ts
import { BootstrapFewShot } from "@jaex/dstsx";
const opt = new BootstrapFewShot({ maxBootstrappedDemos: 4 });
```

### BootstrapFewShotWithRandomSearch (BootstrapRS)

```ts
import { BootstrapRS } from "@jaex/dstsx"; // alias
const opt = new BootstrapRS({ numCandidatePrograms: 8 });
```

### BootstrapFewShotWithOptuna

```ts
import { BootstrapFewShotWithOptuna } from "@jaex/dstsx";
const opt = new BootstrapFewShotWithOptuna({ numTrials: 20 });
```

### COPRO

```ts
import { COPRO } from "@jaex/dstsx";
const opt = new COPRO({ breadth: 5, depth: 2 });
```

### MIPROv2

```ts
import { MIPROv2 } from "@jaex/dstsx";
const opt = new MIPROv2({ auto: "light" }); // "light" | "medium" | "heavy"
const optimized = await opt.compile(student, trainset, metric);
```

### KNNFewShot

```ts
import { KNNFewShot } from "@jaex/dstsx";
const opt = new KNNFewShot({ k: 3 });
```

### EnsembleOptimizer

```ts
import { EnsembleOptimizer } from "@jaex/dstsx";
const opt = new EnsembleOptimizer({ size: 5 });
```

### BetterTogether

```ts
import { BetterTogether } from "@jaex/dstsx";
const opt = new BetterTogether({
  promptOptimizer: new MIPROv2({ auto: "light" }),
  finetuneOptimizer: new BootstrapFinetune(),
  sequence: ["prompt", "finetune", "prompt"],
});
```

### GRPO

```ts
import { GRPO } from "@jaex/dstsx";
const opt = new GRPO({ groupSize: 4, numSteps: 10 });
```

### SIMBA

```ts
import { SIMBA } from "@jaex/dstsx";
const opt = new SIMBA({ numRounds: 5 });
```

### AvatarOptimizer

```ts
import { AvatarOptimizer } from "@jaex/dstsx";
const opt = new AvatarOptimizer({ maxRounds: 3 });
```

### GEPA

```ts
import { GEPA } from "@jaex/dstsx";
const opt = new GEPA({ numSteps: 20, groupSize: 8, feedbackEnabled: true });
```

### InferRules

```ts
import { InferRules } from "@jaex/dstsx";
const opt = new InferRules({ numRules: 5 });
```

### BootstrapFinetune

```ts
import { BootstrapFinetune } from "@jaex/dstsx";
const opt = new BootstrapFinetune({ format: "openai" });
```

---

## Evaluation

### evaluate()

```ts
import { evaluate, exactMatch } from "@jaex/dstsx";
const result = await evaluate(program, devset, exactMatch("answer"), { numThreads: 4 });
console.log(`Score: ${result.score.toFixed(2)}, Passed: ${result.numPassed}/${result.total}`);
```

### Built-in Metrics

```ts
import { exactMatch, f1, passAtK, bleu, rouge, answerExactMatch, answerPassageMatch } from "@jaex/dstsx";

const em = exactMatch("answer");          // case-insensitive exact match
const f1Score = f1("answer");             // token-level F1
const pak = passAtK(em, 3);              // pass if any of top-3 passes
const bleuScore = bleu("answer");        // simplified BLEU
const rougeScore = rouge("answer");      // ROUGE-L
const aem = answerExactMatch("answer");  // normalized (remove articles, punctuation)
const apm = answerPassageMatch("answer"); // checks if answer in context
```

### Metric Type

```ts
import type { Metric, MetricResult } from "@jaex/dstsx";
// MetricResult = number | boolean | { score: number; feedback: string }
// Metric supports async returns for LM-judged evaluation
```

### SemanticF1

```ts
import { SemanticF1 } from "@jaex/dstsx";
const sf1 = new SemanticF1({ threshold: 0.5 });
const result = await sf1.forward({ ground_truth: "Paris", prediction: "The capital is Paris" });
const metricFn = sf1.asMetricFn(); // Use as Metric in optimizers
```

### CompleteAndGrounded

```ts
import { CompleteAndGrounded } from "@jaex/dstsx";
const cag = new CompleteAndGrounded();
const result = await cag.forward({ context: "...", ground_truth: "...", prediction: "..." });
```

---

## Assertions & Suggestions

```ts
import { Assert, Suggest } from "@jaex/dstsx";

Assert(result.get("answer") !== "", "Answer must not be empty");
Suggest(result.get("answer")!.length > 10, "Answer should be detailed");
```

---

## Embedder

```ts
import { Embedder } from "@jaex/dstsx";

const embedder = new Embedder({ model: "text-embedding-3-small", provider: "openai" });
const vec = await embedder.embed("Hello world");
const vecs = await embedder.embedBatch(["Hello", "World"]);
```

Providers: `"openai"`, `"cohere"`, `"ollama"`, `"custom"` (pass `fn` option).

---

## Tools

### JSInterpreter

```ts
import { JSInterpreter } from "@jaex/dstsx";

const interpreter = new JSInterpreter({ sandbox: "worker", timeoutMs: 10_000 });
const result = await interpreter.execute("return 2 + 2"); // "4"
const tool = interpreter.asTool(); // Use as Tool in ReAct/CodeAct
```

### Embeddings

```ts
import { Embeddings } from "@jaex/dstsx";

const embeddings = new Embeddings({ embedFn: myEmbedFunction });
await embeddings.add(["passage 1", "passage 2"]);
const results = await embeddings.search("query", 3);
const retriever = embeddings.asRetriever(); // Use as Retriever
```

---

## Data

### DataLoader

```ts
import { DataLoader } from "@jaex/dstsx";

const loader = new DataLoader();
const fromCSV = loader.fromCSV("train.csv", { inputKeys: ["question"] });
const fromJSON = loader.fromJSON("data.json");
const fromArray = loader.fromArray([{ question: "q", answer: "a" }], ["question"]);
```

---

## Utilities

### streamify & asyncify

```ts
import { streamify, asyncify } from "@jaex/dstsx";
const streamable = streamify(module);
const asyncModule = asyncify(module);
```

### inspectHistory

```ts
import { inspectHistory } from "@jaex/dstsx";
inspectHistory(3, "text"); // Pretty-print last 3 LM calls
```

### configureCache

```ts
import { configureCache } from "@jaex/dstsx";
configureCache({ cacheDir: "/tmp/dstsx-cache", enabled: true });
```

### load & registerModule

```ts
import { load, registerModule } from "@jaex/dstsx";
registerModule("SimpleQA", SimpleQA);
const module = await load("./saved-module.json");
```

### StatusMessage & StreamListener

```ts
import { statusProvider, StreamListener } from "@jaex/dstsx";

statusProvider.onStatus((msg) => console.log(`[${msg.type}] ${msg.text}`));

const listener = new StreamListener();
listener.observe(chunk);
console.log(listener.accumulated);
```

### Logging

```ts
import { enableLogging, disableLogging, suppressProviderLogs } from "@jaex/dstsx";
enableLogging();    // debug level
disableLogging();   // silent
suppressProviderLogs(); // error only
```

---

## Experiment Tracking

```ts
import { ConsoleTracker, JsonFileTracker } from "@jaex/dstsx";

const tracker = new ConsoleTracker();
tracker.log({ step: 1, score: 0.85 });

const fileTracker = new JsonFileTracker("./logs/experiment.json");
fileTracker.log({ step: 1, score: 0.85 });
```

---

## MCP Integration

### MCPToolAdapter

```ts
import { MCPToolAdapter } from "@jaex/dstsx";

const adapter = new MCPToolAdapter({
  tools: mcpTools,
  callHandler: async (name, args) => callMCPTool(name, args),
});
const tools = await adapter.getTools(); // Tool[] for ReAct
```

### DSTsxMCPServer

```ts
import { DSTsxMCPServer } from "@jaex/dstsx";

const server = new DSTsxMCPServer();
server.registerModule("qa", "Answer questions", qaModule, ["question"]);
const result = await server.callTool("qa", { question: "Hello" });
```

---

## End-to-End Examples

### Simple Q&A

```ts
import { Predict, OpenAI, settings } from "@jaex/dstsx";

settings.configure({ lm: new OpenAI({ model: "gpt-4o" }) });
const qa = new Predict("question -> answer");
const result = await qa.forward({ question: "What is the speed of light?" });
```

### RAG Pipeline

```ts
import { Module, Predict, Retrieve, ChainOfThought, settings, ColBERTv2 } from "@jaex/dstsx";

class RAG extends Module {
  retrieve = new Retrieve(3);
  generate = new ChainOfThought("context, question -> answer");

  async forward({ question }: { question: string }) {
    const { passages } = await this.retrieve.forward(question);
    return this.generate.forward({ context: passages.join("\n"), question });
  }
}
```

### Prompt Optimization

```ts
import { MIPROv2, evaluate, exactMatch } from "@jaex/dstsx";

const optimizer = new MIPROv2({ auto: "light" });
const optimized = await optimizer.compile(student, trainset, exactMatch("answer"));
const result = await evaluate(optimized, devset, exactMatch("answer"));
console.log(`Optimized score: ${result.score}`);
```

### ReAct Agent with Tools

```ts
import { ReAct } from "@jaex/dstsx";
import type { Tool } from "@jaex/dstsx";

const searchTool: Tool = {
  name: "search",
  description: "Search the web",
  fn: async (query) => `Results for: ${query}`,
};

const agent = new ReAct("question -> answer", [searchTool]);
const result = await agent.forward({ question: "Who discovered penicillin?" });
console.log(result.get("toolCalls")); // ToolCalls history
```

### Typed JSON Output

```ts
import { TypedPredictor } from "@jaex/dstsx";
import { z } from "zod";

const schema = z.object({ city: z.string(), country: z.string() });
const tp = new TypedPredictor("question -> city, country", schema);
const result = await tp.forward({ question: "Capital of Japan?" });
console.log(result.typed); // { city: "Tokyo", country: "Japan" }
```

### Streaming

```ts
import { Predict, settings } from "@jaex/dstsx";

const predict = new Predict("question -> answer");
for await (const chunk of predict.stream({ question: "Tell me a story" })) {
  process.stdout.write(chunk.delta);
}
```

---

## Contributing

1. Fork and clone the repository
2. `npm install`
3. `npm test` — run all tests
4. `npm run typecheck` — TypeScript strict check
5. `npm run build` — produce ESM + CJS bundles
6. Open a PR with your changes

---

## License

MIT
