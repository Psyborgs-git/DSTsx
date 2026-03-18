# Modules

All modules extend `Module` and expose a `forward()` method.

---

## Abstract `Module`

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

> **Note**: `Module.clone()` uses `Object.create()` which does not install JS private fields. Custom `Module` subclasses containing `Predict` must override `clone()` to construct via `new`.

### Saving and loading a compiled program

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

## `Predict`

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

**Streaming:**

```ts
for await (const chunk of qa.stream({ question: "Tell me a story." })) {
  process.stdout.write(chunk.delta);
  if (chunk.done) break;
}
```

---

## `ChainOfThought`

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

## `ChainOfThoughtWithHint`

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

## `MultiChainComparison`

Runs a signature `M` times and picks the best completion via a final aggregation call.

```ts
import { MultiChainComparison } from "dstsx";

const mcc = new MultiChainComparison("question -> answer", /* M= */ 3);
const result = await mcc.forward({ question: "What is 7 × 8?" });
```

---

## `ReAct`

Reasoning + Acting loop (Yao et al., 2022). Alternates Thought → Action → Observation until the LM emits `Finish[answer]` or `maxIter` is reached.

```ts
import { ReAct, type Tool } from "dstsx";

const searchTool: Tool = {
  name:        "search",
  description: "Search the web for current information",
  fn: async (query: string) => {
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

## `NativeReAct`

A `ReAct` variant that uses provider-native function/tool calling (OpenAI tools API, Anthropic tool_use) instead of text-based action parsing. Falls back to text format for adapters that don't support native calling.

```ts
import { NativeReAct, settings, OpenAI } from "dstsx";
import type { Tool } from "dstsx";

settings.configure({ lm: new OpenAI({ model: "gpt-4o" }) });

const tools: Tool[] = [
  {
    name:        "search",
    description: "Search the web for information",
    fn: async (args) => {
      const { query } = JSON.parse(args) as { query: string };
      return `Results for: ${query}`;
    },
  },
];

const agent = new NativeReAct("question -> answer", tools, 5);
const result = await agent.forward({ question: "What is the capital of France?" });
```

**Constructor:**

```ts
new NativeReAct(
  signature: string,
  tools:     Tool[],
  maxIter?:  number, // default: 5
)
```

---

## `ProgramOfThought`

Generates JavaScript code, executes it in a worker-thread sandbox by default, self-corrects on errors, and returns the result.

> ⚠️ **Security**: Always prefer the default `"worker"` sandbox. Never pass untrusted user input without review.

```ts
import { ProgramOfThought } from "dstsx";

// Default: "worker" sandbox (Node.js Worker thread)
const pot = new ProgramOfThought(
  "question -> answer",
  /* maxAttempts= */ 3,
  /* timeoutMs=   */ 5_000,
);

const result = await pot.forward({ question: "What is the 10th Fibonacci number?" });
console.log(result.get("answer")); // "55"
console.log(result.get("code"));   // the generated JS code
```

### Sandbox modes

```ts
// Worker thread isolation (Node 18+) — default
const potWorker = new ProgramOfThought("question -> answer", 3, 5_000, "worker");

// Run in main process (no isolation — backwards-compatible)
const potFn = new ProgramOfThought("question -> answer", 3, 5_000, "function");

// No sandbox and no timeout — fastest, do not use with untrusted code
const potNone = new ProgramOfThought("question -> answer", 3, 5_000, "none");
```

| Mode | Isolation | True Cancellation | Notes |
|---|---|---|---|
| `"worker"` | Node.js Worker thread | Yes (terminate on timeout) | **Default.** Requires Node 18+. |
| `"function"` | None — runs in main process | No | No isolation. |
| `"none"` | None — no timeout applied | N/A | Fastest; do not use with untrusted code. |

---

## `Retrieve`

Calls the globally configured retriever and returns `passages`.

```ts
import { Retrieve, ColBERTv2, settings } from "dstsx";

settings.configure({ rm: new ColBERTv2("http://localhost:8893") });

const retrieve = new Retrieve(/* k= */ 3);
const result = await retrieve.forward("What is DSPy?");

const passages: string[] = result.get("passages") as string[];
```

---

## `Retry`

Wraps any module and retries on `AssertionError` (thrown by `Assert()`), feeding the error message back as `feedback`.

```ts
import { Retry, Assert, Module, Predict } from "dstsx";

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

const retrying = new Retry(new CheckedQA(), /* maxAttempts= */ 3);
const result   = await retrying.forward({ question: "What color is the sky?" });
```

---

## `BestOfN`

Runs `N` copies of a module in parallel and selects the best via `reduceFunc` (defaults to first result).

```ts
import { BestOfN, Predict } from "dstsx";

const qa = new Predict("question -> answer");
const best = new BestOfN(qa, /* N= */ 5, (predictions) => {
  return predictions.reduce((a, b) =>
    String(b.get("answer")).length > String(a.get("answer")).length ? b : a
  );
});

const result = await best.forward({ question: "Explain gravity." });
```

---

## `Ensemble`

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

## `Parallel` Module

Runs multiple modules concurrently with `Promise.all` and returns all results.

```ts
import { Parallel, Predict, ChainOfThought } from "dstsx";

const pipeline = new Parallel([
  new Predict("question -> answer"),
  new ChainOfThought("question -> answer"),
], { timeoutMs: 10_000 });

// run() returns Prediction[] — one per module
const [directAnswer, cotAnswer] = await pipeline.run({ question: "What is π?" });

// forward() returns the first prediction (for Module interface compat)
const first = await pipeline.forward({ question: "What is π?" });
```

**Constructor:**

```ts
new Parallel(modules: Module[], options?: { timeoutMs?: number })
```

---

## `Refine` Module

Self-critique / iterative refinement loop. After each inner module run, a built-in critic predictor evaluates the output and feeds improvement suggestions back.

```ts
import { Refine, Predict } from "dstsx";

const writer = new Predict("topic, feedback? -> essay");

const refined = new Refine(writer, {
  maxRefinements: 2,
  feedbackField:  "feedback",   // injected field name for critique
  stopCondition:  (pred) =>
    String(pred.get("essay")).length > 500, // stop early if long enough
});

const result = await refined.forward({ topic: "Climate change" });
```

**Constructor:**

```ts
new Refine(inner: Module, options?: {
  maxRefinements?: number;                     // default: 2
  feedbackField?:  string;                     // default: "feedback"
  stopCondition?:  (p: Prediction) => boolean; // optional early-exit check
})
```

The critic calls `Predict("output -> critique, is_satisfactory")`. If `is_satisfactory` is `"yes"` or `"true"`, refinement stops early.

---

## `TypedPredictor` & `TypedChainOfThought`

Structured JSON output with optional Zod schema validation. `TypedPredictor` delegates all JSON formatting/parsing to `JSONAdapter` internally.

```ts
import { z } from "zod";
import { TypedPredictor, TypedChainOfThought, settings, OpenAI } from "dstsx";

settings.configure({ lm: new OpenAI({ model: "gpt-4o" }) });

const AnswerSchema = z.object({
  answer:     z.string(),
  confidence: z.number().min(0).max(1),
});

const qa = new TypedPredictor("question -> answer", AnswerSchema, { maxRetries: 3 });
const result = await qa.forward({ question: "What is 2 + 2?" });

console.log(result.typed.answer);     // "4"
console.log(result.typed.confidence); // 0.99 (validated number)
```

**`TypedPrediction`** — the return type of `TypedPredictor.forward()`:

```ts
class TypedPrediction<T> extends Prediction {
  readonly typed: T; // schema-validated value
}
```

**`TypedChainOfThought`** — same as `TypedPredictor` but prepends a `rationale` step:

```ts
const cot = new TypedChainOfThought("question -> answer", AnswerSchema);
const result = await cot.forward({ question: "What is 7 × 6?" });
console.log(result.typed.answer); // "42"
```

**Constructor:**

```ts
new TypedPredictor<T>(
  signature: string | Signature,
  schema?:   { parse: (v: unknown) => T }, // e.g. Zod schema
  options?:  { maxRetries?: number },      // default: 3
)
```

---

## `Reasoning`

Surfaces native reasoning tokens from models like o1, o3, and DeepSeek-R1. The `reasoning` field from `LMResponse` is accessible via the returned prediction.

```ts
import { Reasoning, settings, OpenAI } from "dstsx";

settings.configure({ lm: new OpenAI({ model: "o3-mini" }) });

const solver = new Reasoning("problem -> solution");
const result = await solver.forward({ problem: "Prove that √2 is irrational." });
console.log(result.get("solution"));
```

---

## `CodeAct`

Agent loop where actions are executable JavaScript code, with persistent session state. Each iteration generates code, executes it, inspects the result, and feeds it back until the task is complete or `maxIter` is reached.

```ts
import { CodeAct, settings, OpenAI } from "dstsx";
import type { Tool } from "dstsx";

settings.configure({ lm: new OpenAI({ model: "gpt-4o" }) });

const tools: Tool[] = [
  {
    name:        "fetchData",
    description: "Fetch JSON data from a URL",
    fn:          async (url: string) => JSON.stringify(await fetch(url).then((r) => r.json())),
  },
];

const agent = new CodeAct("task -> answer", tools, /* maxIter= */ 5);
const result = await agent.forward({ task: "What is 15! ?" });
console.log(result.get("answer"));
console.log(result.get("trajectory")); // full execution history
```

**Constructor:**

```ts
new CodeAct(
  signature: string | Signature,
  tools?:    Tool[],             // default: []
  maxIter?:  number,             // default: 5
  sandbox?:  "worker" | "function" | "none", // default: "worker"
  timeoutMs?: number,            // default: 10_000
)
```

> ⚠️ **Security**: Code execution uses `new Function()`. Always prefer the `"worker"` sandbox mode and never run untrusted input.

---

## `RLM` (Reinforcement Learning Module)

Samples `k` completions from the inner module and returns the highest-scoring one according to a reward function.

```ts
import { RLM, Predict, settings, OpenAI } from "dstsx";

settings.configure({ lm: new OpenAI({ model: "gpt-4o" }) });

const inner = new Predict("question -> answer");

const rlm = new RLM(
  inner,
  (pred) => {
    const answer = String(pred.get("answer") ?? "");
    // Score based on length (example reward)
    return answer.length > 20 ? 1 : 0;
  },
  /* k= */ 5,
);

const result = await rlm.forward({ question: "Explain the Pythagorean theorem." });

// Get cumulative reward statistics
rlm.reset(); // clear reward stats
```

**Constructor:**

```ts
new RLM(
  inner:    Module,
  rewardFn: (pred: Prediction) => number,
  k?:       number, // default: 5
)
```
