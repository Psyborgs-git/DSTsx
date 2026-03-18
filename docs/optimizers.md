# Optimizers

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

## `LabeledFewShot`

Directly assigns labeled examples as `demos` on every `Predict` sub-module (no LM calls).

```ts
import { LabeledFewShot } from "dstsx";

const optimizer = new LabeledFewShot(/* k= */ 16);
const optimized = await optimizer.compile(program, trainset, metric);
```

---

## `BootstrapFewShot`

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

## `BootstrapFewShotWithRandomSearch`

Extends `BootstrapFewShot` — tries `numCandidatePrograms` random demo subsets and selects the best by validation score.

```ts
import { BootstrapFewShotWithRandomSearch } from "dstsx";

const optimizer = new BootstrapFewShotWithRandomSearch({
  maxBootstrappedDemos:  4,
  numCandidatePrograms:  8,          // number of random subsets to evaluate
  valset:                valExamples, // optional held-out set
});

const optimized = await optimizer.compile(program, trainset, metric);
```

---

## `BootstrapFewShotWithOptuna`

Extends `BootstrapFewShot` with a pure-TypeScript TPE (Tree-structured Parzen Estimator) that searches demo subsets across `numTrials` iterations — no external dependencies required.

```ts
import { BootstrapFewShotWithOptuna } from "dstsx";

const optimizer = new BootstrapFewShotWithOptuna({
  maxBootstrappedDemos: 4,
  numTrials:            20,          // number of TPE search trials
  valset:               valExamples, // optional held-out validation set
});

const optimized = await optimizer.compile(program, trainset, metric);
```

**How it works:** First runs `BootstrapFewShot` to collect candidate demos. Then runs `numTrials` iterations where each trial samples a demo subset using TPE: the top 25% of past trials form the "good" pool, sampled with 70% probability, biased towards the best configurations found so far.

---

## `COPRO` (Collaborative Prompt Optimizer)

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

## `MIPRO` _(deprecated)_

> **Deprecated.** `MIPRO` is now an alias for `MIPROv2`. Use `MIPROv2` directly. `MIPRO` will be removed in a future release.

```ts
import { MIPRO } from "dstsx"; // deprecated alias — use MIPROv2 instead
```

---

## `MIPROv2` (Multi-stage Instruction Prompt Optimizer v2)

Combines grounded instruction proposals with Bayesian (TPE) search and auto budget presets. The recommended optimizer for most use cases.

```ts
import { MIPROv2 } from "dstsx";

// Auto preset — recommended
const optimizer = new MIPROv2({ auto: "medium" });
const optimized = await optimizer.compile(program, trainset, metric);
```

**Auto budget presets:**

| Preset | `numCandidates` | `numTrials` | `minibatchSize` |
|---|---|---|---|
| `"light"` | 5 | 10 | 25 |
| `"medium"` | 10 | 25 | 50 |
| `"heavy"` | 20 | 50 | 100 |

**Full options:**

```ts
new MIPROv2({
  auto?:                   "light" | "medium" | "heavy" | "none", // default: "none"
  numCandidates?:          number,  // instruction candidates per predictor (default: 5)
  initTemperature?:        number,  // sampling temperature (default: 0.9)
  maxBootstrappedDemos?:   number,  // default: 3
  maxLabeledDemos?:        number,  // default: 3
  numTrials?:              number,  // Bayesian search trials (default: 10)
  minibatchSize?:          number,  // mini-batch size for fast evaluation (default: 25)
  minibatchFullEvalSteps?: number,  // full eval every N steps (default: 5)
  trackStats?:             boolean, // default: false
  verbose?:                boolean, // default: false
  teacher?:                Module,  // optional teacher program
  valset?:                 Example[], // optional held-out validation set
})
```

**How it works:** (1) Bootstraps a few demonstration traces using the student or teacher. (2) Generates `numCandidates` grounded instruction proposals per predictor using the LM. (3) Runs `numTrials` iterations of TPE-guided Bayesian search over candidate combinations, evaluating on mini-batches. (4) Performs a full validation eval on the top-k candidates and returns the best.

---

## `BootstrapRS`

Alias for `BootstrapFewShotWithRandomSearch`. Provided for brevity.

```ts
import { BootstrapRS } from "dstsx";

const optimizer = new BootstrapRS({ maxBootstrappedDemos: 4, numCandidatePrograms: 8 });
const optimized = await optimizer.compile(program, trainset, metric);
```

---

## `KNNFewShot`

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

## `EnsembleOptimizer`

Wraps a program with an optional reduce function. Primarily useful for building multi-program ensembles.

```ts
import { EnsembleOptimizer } from "dstsx";

const optimizer = new EnsembleOptimizer({
  reduceFunc: (predictions) => predictions[0]!,
});

const wrapped = await optimizer.compile(program, trainset, metric);
```

---

## `BootstrapFinetune`

Extends `BootstrapFewShot` to collect execution traces and export them as a JSONL fine-tuning dataset.

```ts
import { BootstrapFinetune } from "dstsx";

const optimizer = new BootstrapFinetune({
  exportPath:           "./finetune_data.jsonl", // default
  format:               "openai",                // "openai" | "generic"
  maxBootstrappedDemos: 4,
});

const compiled = await optimizer.compile(program, trainset, metric);
// "./finetune_data.jsonl" now contains one JSON object per line
```

**Options:**

| Option | Type | Default | Description |
|---|---|---|---|
| `exportPath` | `string` | `"./finetune_data.jsonl"` | Output file path |
| `format` | `"openai" \| "generic"` | `"openai"` | JSONL line format |
| `maxBootstrappedDemos` | `number` | `4` | Demos to bootstrap per predictor |

**Format examples:**

`"openai"` (suitable for OpenAI fine-tuning):
```jsonl
{"messages": [{"role": "user", "content": "question: What is 2+2?"}, {"role": "assistant", "content": "answer: 4"}]}
```

`"generic"` (plain prompt/completion):
```jsonl
{"prompt": "question: What is 2+2?", "completion": "answer: 4"}
```

---

## `GRPO` (Group Relative Policy Optimization)

Mirrors `dspy.GRPO`. Iteratively generates groups of candidate instruction variants, evaluates them relative to each other, and converges toward the best-scoring configuration.

```ts
import { GRPO } from "dstsx";

const optimizer = new GRPO({
  numSteps:    20,  // optimization iterations
  groupSize:   8,   // candidates per group
  temperature: 1.0, // sampling temperature
});

const optimized = await optimizer.compile(program, trainset, metric);
```

**How it works:** Each step generates `groupSize` instruction alternatives using the configured LM at the specified temperature. All candidates are evaluated on the training set. The relative advantage of each is computed as `(score − mean) / std`. The best-scoring candidate becomes the new baseline for the next step.

**Options:**

| Option | Type | Default |
|---|---|---|
| `numSteps` | `number` | `20` |
| `groupSize` | `number` | `8` |
| `temperature` | `number` | `1.0` |
| `maxLabeledDemos` | `number` | `16` |

---

## `SIMBA` (Stochastic Introspective Mini-Batch Ascent)

Mirrors `dspy.SIMBA`. A lightweight stochastic optimizer well-suited for small training sets.

```ts
import { SIMBA } from "dstsx";

const optimizer = new SIMBA({
  numIter:              10, // iterations
  batchSize:            8,  // mini-batch size per evaluation
  maxBootstrappedDemos: 4,
});

const optimized = await optimizer.compile(program, trainset, metric);
```

**How it works:** Initializes with `BootstrapFewShot`, then for each iteration draws a random mini-batch (Fisher-Yates shuffle), proposes a demo-subset candidate, evaluates it on the batch, and accepts it if it improves on the current best score.

**Options:**

| Option | Type | Default |
|---|---|---|
| `numIter` | `number` | `10` |
| `batchSize` | `number` | `8` |
| `maxBootstrappedDemos` | `number` | `4` |

---

## `AvatarOptimizer`

Iteratively proposes and evaluates "avatar" role descriptions (persona prefixes) for each `Predict` module, selecting the instruction that scores highest on the training set.

```ts
import { AvatarOptimizer } from "dstsx";

const optimizer = new AvatarOptimizer({
  numAvatars:      4, // candidate personas per predictor
  maxLabeledDemos: 8,
});

const optimized = await optimizer.compile(program, trainset, metric);
```

**How it works:** For each `Predict` predictor in the program, asks the configured LM to generate `numAvatars` distinct role/persona descriptions (e.g. "You are an expert doctor…"). Each persona is prepended to the predictor's instructions and scored on the training set. The best persona is kept.

**Options:**

| Option | Type | Default |
|---|---|---|
| `numAvatars` | `number` | `4` |
| `maxLabeledDemos` | `number` | `8` |

---

## `GEPA` (Genetic-Pareto Prompt Optimizer)

Uses LM self-reflection to evolve prompts with Pareto-optimal selection across multiple objectives (e.g. accuracy and conciseness). Supports `{ score, feedback }` metric results for guided refinement.

```ts
import { GEPA } from "dstsx";

const optimizer = new GEPA({
  numSteps:        20, // evolution iterations
  groupSize:        8, // candidates per generation
  temperature:     1.0,
  feedbackEnabled: true, // use LM self-reflection feedback
});

const optimized = await optimizer.compile(program, trainset, metric);
```

**Options:**

| Option | Type | Default |
|---|---|---|
| `numSteps` | `number` | `20` |
| `groupSize` | `number` | `8` |
| `temperature` | `number` | `1.0` |
| `feedbackEnabled` | `boolean` | `true` |
| `valset` | `Example[]` | — (uses trainset) |

**How it works:** Maintains a population of instruction candidates. Each step generates `groupSize` mutated variants using the LM, evaluates all candidates, and selects the Pareto-optimal frontier (best score ± diversity). When `feedbackEnabled` is true, the metric's `feedback` string (from `{ score, feedback }` returns) is fed back into the mutation prompt.

---

## `BetterTogether`

Chains a prompt optimizer and a fine-tuning optimizer in sequence. Each stage's output becomes the next stage's student program.

```ts
import { BetterTogether, MIPROv2, BootstrapFinetune } from "dstsx";

const optimizer = new BetterTogether({
  promptOptimizer:   new MIPROv2({ auto: "light" }),
  finetuneOptimizer: new BootstrapFinetune({ exportPath: "./ft_data.jsonl" }),
  sequence:          ["prompt", "finetune", "prompt"], // default
});

const optimized = await optimizer.compile(program, trainset, metric);
```

**Options:**

| Option | Type | Default | Description |
|---|---|---|---|
| `promptOptimizer` | `Optimizer` | required | Optimizer for prompt/demo tuning |
| `finetuneOptimizer` | `Optimizer` | required | Optimizer for fine-tuning |
| `sequence` | `Array<"prompt" \| "finetune">` | `["prompt","finetune","prompt"]` | Execution order |

---

## `InferRules`

Analyzes successful and failed training examples, then asks the LM to extract explicit rules and appends them to each predictor's instructions.

```ts
import { InferRules } from "dstsx";

const optimizer = new InferRules({
  numRules: 5,      // rules to extract per predictor
  verbose:  true,   // log progress
});

const optimized = await optimizer.compile(program, trainset, metric);
// Each Predict in `optimized` now has auto-inferred rules appended to its instructions
```

**Options:**

| Option | Type | Default |
|---|---|---|
| `numRules` | `number` | `5` |
| `verbose` | `boolean` | `false` |

**How it works:** Runs the student on the training set and classifies each result as a success (score > 0.5) or failure. Sends the success and failure examples to the LM with a prompt asking it to extract `numRules` actionable rules. The rules are appended to the instructions of every `Predict` predictor in a clone of the student.

---

## Persisting Compiled Programs

```ts
import { writeFileSync, readFileSync } from "fs";

// Compile and save
const optimized = await optimizer.compile(program, trainset, metric);
writeFileSync("qa_optimized.json", JSON.stringify(optimized.dump(), null, 2));

// Load into a fresh instance
const fresh = new MyProgram();
fresh.load(JSON.parse(readFileSync("qa_optimized.json", "utf8")));
```
