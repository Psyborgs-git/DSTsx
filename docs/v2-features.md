# V2 Features

The following features are implemented in DSTsx v2.

---

## `TypedPredictor` & `TypedChainOfThought`

Structured JSON output with optional schema validation. Works without any extra dependencies — pass a [Zod](https://github.com/colinhacks/zod) schema for runtime validation.

### `TypedPrediction<T>`

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

## `Parallel` Module

Runs multiple modules concurrently with `Promise.all` and returns all results.

```ts
import { Parallel, Predict, ChainOfThought } from "dstsx";

const pipeline = new Parallel([
  new Predict("question -> answer"),
  new ChainOfThought("question -> answer"),
], { timeoutMs: 10_000 });

const [directAnswer, cotAnswer] = await pipeline.run({ question: "What is π?" });
const first = await pipeline.forward({ question: "What is π?" }); // Module compat
```

---

## `Refine` Module

Self-critique / iterative refinement loop. See [modules.md](./modules.md#refine-module) for full docs.

---

## `majority()` Helper

Votes across multiple `Prediction` instances by the most common value for a given field. See [primitives.md](./primitives.md#majority-helper) for full docs.

---

## `BootstrapFewShotWithOptuna`

TPE Bayesian demonstration search — see [optimizers.md](./optimizers.md#bootstrapfewshotwithoptuna).

---

## Disk-Persistent LM Cache

`cacheDir` option on LM adapters — see [lm-adapters.md](./lm-adapters.md#disk-persistent-lm-cache).

---

## MCP Integration

`MCPToolAdapter` + `DSTsxMCPServer` — see [mcp.md](./mcp.md).

---

## LM Streaming

`lm.stream()` and `predict.stream()` — see [lm-adapters.md](./lm-adapters.md#lm-streaming).

---

## `NativeReAct`

Provider-native function/tool calling — see [modules.md](./modules.md#nativereact).

---

## `Image` — Multi-modal Support

Vision input primitive — see [primitives.md](./primitives.md#image--multi-modal-support).

---

## `BootstrapFinetune`

JSONL fine-tuning export — see [optimizers.md](./optimizers.md#bootstrapfinetune).

---

## `GRPO` Optimizer

Group Relative Policy Optimization — see [optimizers.md](./optimizers.md#grpo-group-relative-policy-optimization).

---

## `SIMBA` Optimizer

Stochastic Introspective Mini-Batch Ascent — see [optimizers.md](./optimizers.md#simba-stochastic-introspective-mini-batch-ascent).

---

## `AvatarOptimizer`

Role/persona prompt optimization — see [optimizers.md](./optimizers.md#avataroptimizer).

---

## Experiment Tracking

`ConsoleTracker`, `JsonFileTracker`, custom `Tracker` — see [tracking.md](./tracking.md).

---

## Worker-Thread `ProgramOfThought`

`sandbox: "worker"` mode — see [modules.md](./modules.md#programofthought).

---

## V2 Feature Table

| Feature | DSPy Equivalent | Status |
|---|---|---|
| `TypedPredictor` / `TypedChainOfThought` | `dspy.TypedPredictor`, `dspy.TypedChainOfThought` | ✅ v2 |
| `Parallel` module | `dspy.Parallel` | ✅ v2 |
| `Refine` module | — | ✅ v2 |
| `majority()` helper | `dspy.majority` | ✅ v2 |
| `BootstrapFewShotWithOptuna` | `dspy.BootstrapFewShotWithOptuna` | ✅ v2 |
| Disk-persistent LM cache | `dspy.cache` | ✅ v2 |
| MCP Integration | — | ✅ v2 |
| LM Streaming | `dspy.streamify` | ✅ v2 |
| `NativeReAct` | `dspy.Tool` (v2) | ✅ v2 |
| `Image` — multi-modal | `dspy.Image` | ✅ v2 |
| `BootstrapFinetune` | `dspy.BootstrapFinetune` | ✅ v2 |
| `GRPO` optimizer | `dspy.GRPO` | ✅ v2 |
| `SIMBA` optimizer | `dspy.SIMBA` | ✅ v2 |
| `AvatarOptimizer` | `dspy.AvatarOptimizer` | ✅ v2 |
| Experiment Tracking | `dspy.MLflow` | ✅ v2 |
| Worker-thread `ProgramOfThought` | — | ✅ v2 |
| Typedoc config | — | ✅ v2 |
| GitHub Actions CI + npm publish | — | ✅ v2 |
| Cross-language trace sharing | — | 🔭 Stretch |
| Browser-native bundle (`dstsx/browser`) | — | 🔭 Stretch |
| HTTP module serving (REST endpoint) | — | 🔭 Stretch |
