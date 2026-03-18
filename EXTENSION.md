# DSTsx — Extension & Completion Plan

> Deep gap analysis against DSPy v3.x. No backward compatibility required. Break whatever needs breaking. Build a perfect 1:1 TypeScript port.

-----

## What This Document Is

This is the authoritative implementation plan for completing DSTsx. Every gap against the current DSPy Python library is enumerated, categorised, and given an implementation spec. When done, DSTsx should be a complete 1:1 TypeScript port of DSPy with zero meaningful gaps.

-----

## PART 1 — ARCHITECTURAL OVERHAUL (Do First, Everything Else Depends On It)

### 1. The Adapter / Formatter Layer

**DSPy has:** `dspy.ChatAdapter`, `dspy.JSONAdapter`, `dspy.TwoStepAdapter`, `dspy.Adapter` (abstract)

**DSTsx has:** Nothing. Prompt formatting is baked into each module and each LM adapter inline.

**Why this is the most critical gap:** Without a clean Adapter layer, prompt formatting is scattered, TypedPredictor’s JSON handling is ad-hoc, and it’s impossible to swap prompt formats without editing multiple files. This architectural flaw blocks or degrades nearly every other feature.

**Implementation:**

Create `src/adapters/` directory with:

```
src/adapters/
├── index.ts
├── Adapter.ts          ← abstract base
├── ChatAdapter.ts      ← default; OpenAI-style chat turns
├── JSONAdapter.ts      ← instructs LM to respond in JSON; parses + retries on bad JSON
└── TwoStepAdapter.ts   ← free-text predict then extract to schema; great for weaker models
```

```typescript
// Adapter.ts — abstract base
export abstract class Adapter {
  /** Convert a signature + demos + inputs into LM-ready messages */
  abstract format(
    sig: Signature,
    demos: Example[],
    inputs: Record<string, unknown>,
  ): Message[];

  /** Parse raw LM output string into typed field values */
  abstract parse(
    sig: Signature,
    output: string,
  ): Record<string, unknown>;
}
```

```typescript
// ChatAdapter.ts — default adapter
export class ChatAdapter extends Adapter {
  format(sig, demos, inputs): Message[] {
    // system: sig.instructions
    // user turns: each demo input, assistant turns: each demo output
    // final user turn: current inputs
  }
  parse(sig, output): Record<string, unknown> {
    // parse "field: value" lines from the LM text response
  }
}
```

```typescript
// JSONAdapter.ts
export class JSONAdapter extends Adapter {
  format(sig, demos, inputs): Message[] {
    // instructs LM to respond ONLY with a JSON object matching the output fields
    // includes JSON schema in the system prompt
  }
  parse(sig, output): Record<string, unknown> {
    // JSON.parse with retry and error correction
  }
}
```

```typescript
// TwoStepAdapter.ts
export class TwoStepAdapter extends Adapter {
  // Step 1: ChatAdapter-style free text generation
  // Step 2: second LM call to extract structured fields from the free text
}
```

**Wire it in:**

- `Predict` delegates all prompt formatting to `this.adapter.format()` and `this.adapter.parse()`
- `settings.configure({ adapter: new JSONAdapter() })` sets global default
- `new Predict(sig, { adapter: new TwoStepAdapter() })` per-module override
- `TypedPredictor` becomes a thin wrapper around `Predict` + `JSONAdapter` (remove its inline JSON logic)
- Remove all inline prompt-building code from `Predict`, `ChainOfThought`, `MultiChainComparison`, etc.

-----

## PART 2 — MISSING MODULES

### 2. `CodeAct`

**DSPy has:** `dspy.CodeAct`  
**DSTsx has:** Nothing. `ProgramOfThought` is not the same — it generates code once to answer a question. `CodeAct` is an agent loop where actions *are* executable code, with persistent session state across steps.

```typescript
// src/modules/CodeAct.ts
export class CodeAct extends Module {
  constructor(
    signature: string | Signature,
    tools?: Tool[],          // optional non-code tools too
    maxIter?: number,        // default 5
    sandbox?: 'worker' | 'function' | 'none',
    timeoutMs?: number,
  ) {}

  async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    // Maintains a session with persistent JS variable scope across iterations
    // Loop:
    //   1. LM generates a code block or Finish[answer]
    //   2. Execute code in sandbox, capture stdout/result
    //   3. Feed observation back into next iteration
    // Returns final answer + full code trajectory
  }
}
```

Create `src/tools/JSInterpreter.ts` — wraps the ProgramOfThought worker sandbox as a reusable Tool:

```typescript
export class JSInterpreter {
  constructor(opts?: { sandbox?: 'worker' | 'function'; timeoutMs?: number }) {}
  asTool(): Tool {
    return {
      name: 'js_interpreter',
      description: 'Execute JavaScript code and return the result',
      fn: async (code: string) => this.execute(code),
    };
  }
}
```

Export `JSInterpreter` from the main index.

-----

### 3. `Reasoning` (native reasoning token support for o1/o3/r1 models)

**DSPy has:** `dspy.Reasoning`  
**DSTsx has:** Nothing. Models like o1, o3, DeepSeek-R1 return reasoning tokens separately from the main completion. Without this, DSTsx users on these models lose the reasoning trace.

```typescript
// extend LMResponse
interface LMResponse {
  text: string;
  texts: string[];
  usage: TokenUsage | null;
  raw: unknown;
  reasoning?: string;     // ← ADD: native reasoning content if provided by model
}

// src/modules/Reasoning.ts
export class Reasoning extends Module {
  private predict: Predict;
  constructor(signature: string | Signature) {
    this.predict = new Predict(signature);
  }
  async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    const result = await this.predict.forward(inputs);
    // surfaces result.reasoning from the LM response
    return result;
  }
}
```

Update `OpenAI` adapter to extract `choices[0].message.reasoning_content` (o1) and `Anthropic` adapter to extract `thinking` blocks.
Add `reasoning?: string` to `Trace`.

-----

### 4. `RLM` (Reinforcement Learning Module)

**DSPy has:** `dspy.RLM`  
**DSTsx has:** Nothing.

```typescript
// src/modules/RLM.ts
export class RLM extends Module {
  constructor(
    inner: Module,
    rewardFn: (pred: Prediction) => number,
    k?: number,              // completions to sample per call (default 5)
  ) {}

  async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    // 1. Sample k completions via n > 1
    // 2. Score each with rewardFn
    // 3. Update internal reward statistics
    // 4. Return highest-scored Prediction
    // 5. Over time, bias instructions/demos toward high-reward outputs
  }

  reset(): void { /* clear accumulated statistics */ }
}
```

-----

## PART 3 — MISSING OPTIMIZERS

### 5. `MIPROv2` (replace `MIPRO`)

**DSPy has:** `dspy.MIPROv2` — the current production optimizer. The old `MIPRO` is deprecated.  
**DSTsx has:** `MIPRO` (the old 2023 version). Delete or alias it.

`MIPROv2` is a major upgrade:

- **Grounded proposal stage**: reads the program’s own source, training data, and execution traces to write data-aware instruction candidates. Not just random proposals.
- **Demonstration-aware instruction generation**: instruction proposals are conditioned on which demos are being used in the same trial.
- **Proper Bayesian search (TPE)** over the joint instruction × demo space, not just demo subsets.
- **`auto` budget presets**: `'light' | 'medium' | 'heavy'` so users don’t need to tune hyperparameters.
- **Minibatch evaluation**: evaluates candidates on random mini-batches for efficiency.

```typescript
// src/optimizers/MIPROv2.ts
export interface MIPROv2Options {
  auto?: 'light' | 'medium' | 'heavy' | 'none';
  numCandidates?: number;          // instruction candidates per predictor
  initTemperature?: number;        // temperature for proposal generation (default 0.9)
  maxBootstrappedDemos?: number;
  maxLabeledDemos?: number;
  numTrials?: number;              // TPE Bayesian search trials
  minibatchSize?: number;          // examples per evaluation mini-batch
  minibatchFullEvalSteps?: number; // how often to do full eval (not minibatch)
  trackStats?: boolean;
  verbose?: boolean;
  teacher?: Module;
  valset?: Example[];
}

// auto mode budget presets:
const AUTO_PRESETS = {
  light:  { numCandidates: 5,  numTrials: 10, minibatchSize: 25 },
  medium: { numCandidates: 10, numTrials: 25, minibatchSize: 50 },
  heavy:  { numCandidates: 20, numTrials: 50, minibatchSize: 100 },
};

export class MIPROv2 extends Optimizer {
  compile(student, trainset, metric): Promise<Module>;
  // Stage 1: Bootstrap — collect traces from student/teacher
  // Stage 2: Grounded proposals — for each predictor, use the LM to draft
  //          numCandidates instruction variants, conditioned on:
  //            - the predictor's signature text
  //            - 3–5 training examples
  //            - 3–5 bootstrapped traces
  //            - the program's overall task description
  // Stage 3: Bayesian search — TPE over (instruction_idx × demo_subset) per predictor
  //          evaluate each trial on a minibatch, track scores
  //          every minibatchFullEvalSteps do a full valset eval
  // Return: best-scoring compiled program
}

// Keep old MIPRO as deprecated alias
export { MIPROv2 as MIPRO };
```

Reuse and extend the TPE implementation already in `BootstrapFewShotWithOptuna`. The TPE sampler must now handle multi-dimensional discrete search spaces (one dimension per predictor’s instruction index, one per demo subset).

-----

### 6. `GEPA` (Genetic-Pareto Prompt Optimizer)

**DSPy has:** `dspy.GEPA` (July 2025 paper — newest, most powerful optimizer)  
**DSTsx has:** Nothing.

GEPA uses LM self-reflection to evolve prompts. After each evaluation round, it asks the LM: “Given these failures, what should change?” It uses Pareto-optimal selection to keep diverse high-quality candidates.

Also extends the `Metric` type to optionally return text feedback in addition to a scalar score — this feedback is passed to GEPA’s reflection step.

```typescript
// Extend Metric type to support feedback
export type MetricResult = number | boolean | { score: number; feedback: string };
export type Metric = (example: Example, prediction: Prediction, trace?: Trace[]) => MetricResult;

// src/optimizers/GEPA.ts
export class GEPA extends Optimizer {
  constructor(opts?: {
    numSteps?: number;       // evolution rounds (default 20)
    groupSize?: number;      // candidates per round (default 8)
    temperature?: number;    // sampling temperature (default 1.0)
    valset?: Example[];
    feedbackEnabled?: boolean; // use LM reflection (default true)
  }) {}

  compile(student, trainset, metric): Promise<Module>;
  // Each step:
  // 1. Evaluate current population on mini-batch, collect (score, feedback) pairs
  // 2. Reflection prompt: "Here are failures and their feedback. Propose improved instructions."
  // 3. Generate groupSize new instruction variants from the LM
  // 4. Evaluate all (current + new) candidates
  // 5. Pareto selection: keep non-dominated candidates (score vs diversity)
  // 6. Repeat until numSteps exhausted
  // Return best candidate
}
```

-----

### 7. `BetterTogether`

**DSPy has:** `dspy.BetterTogether`  
**DSTsx has:** Nothing. This is the bridge between prompt optimization and fine-tuning.

```typescript
// src/optimizers/BetterTogether.ts
export class BetterTogether extends Optimizer {
  constructor(opts: {
    promptOptimizer: Optimizer;
    finetuneOptimizer: Optimizer;
    sequence?: Array<'prompt' | 'finetune'>;  // default: ['prompt', 'finetune', 'prompt']
  }) {}

  async compile(student, trainset, metric): Promise<Module> {
    let program = student.clone();
    for (const stage of this.sequence) {
      if (stage === 'prompt') {
        program = await this.promptOptimizer.compile(program, trainset, metric);
      } else {
        program = await this.finetuneOptimizer.compile(program, trainset, metric);
      }
    }
    return program;
  }
}
```

-----

### 8. `InferRules`

**DSPy has:** `dspy.InferRules`  
**DSTsx has:** Nothing.

Extracts explicit rules from successful/failed examples using the LM, then appends them to predictor instructions.

```typescript
// src/optimizers/InferRules.ts
export class InferRules extends Optimizer {
  constructor(opts?: { numRules?: number; verbose?: boolean }) {}

  async compile(student, trainset, metric): Promise<Module> {
    // 1. Run student on trainset, separate successes and failures
    // 2. For each predictor, prompt the LM:
    //    "Given these successful examples: [...] and failed examples: [...]
    //     Write N concise rules that explain what makes an answer correct."
    // 3. Append extracted rules to each predictor's instructions
    // 4. Return compiled program
  }
}
```

-----

### 9. `BootstrapRS` alias

```typescript
// src/optimizers/index.ts — add:
export { BootstrapFewShotWithRandomSearch as BootstrapRS } from './BootstrapFewShotWithRandomSearch';
```

-----

## PART 4 — MISSING PRIMITIVES

### 10. `Audio`

**DSPy has:** `dspy.Audio`  
**DSTsx has:** Nothing. `Image` exists — mirror it exactly.

```typescript
// src/primitives/Audio.ts
export class Audio {
  static fromURL(url: string): Audio;
  static fromBase64(data: string, mimeType?: AudioMimeType): Audio;
  static fromFile(path: string, mimeType?: AudioMimeType): Audio;

  toOpenAIContentPart(): { type: 'input_audio'; input_audio: { data: string; format: string } };
  toGoogleAIContentPart(): { inlineData: { mimeType: string; data: string } };
  toString(): string;
}

type AudioMimeType = 'audio/mpeg' | 'audio/wav' | 'audio/ogg' | 'audio/webm';
```

Update `OpenAI` and `GoogleAI` adapters to handle `Audio` values in message content.

-----

### 11. `History` (multi-turn conversation)

**DSPy has:** `dspy.History`  
**DSTsx has:** Nothing. The existing `Trace` is an execution record, not a conversation context. These are different things.

```typescript
// src/primitives/History.ts
export interface Turn {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class History {
  constructor(turns?: Turn[]) {}

  append(role: Turn['role'], content: string): History;  // returns new History (immutable)
  truncate(maxTurns: number): History;
  toMessages(): Message[];
  toJSON(): Turn[];
  static fromJSON(data: Turn[]): History;
}
```

Update all LM adapters to detect `History` values in inputs and prepend the conversation turns before the current user message.

-----

### 12. `Code` primitive

**DSPy has:** `dspy.Code`  
**DSTsx has:** Nothing.

```typescript
// src/primitives/Code.ts
export class Code {
  readonly value: string;
  readonly language: string;

  static from(value: string, language: string): Code;
  toString(): string;  // returns value for backward compat
  toJSON(): { value: string; language: string };
}
```

Update `ProgramOfThought` and `CodeAct` to return `Code` instances in their `code` output field.

-----

### 13. `ToolCalls` primitive

**DSPy has:** `dspy.ToolCalls`  
**DSTsx has:** Nothing. Tool call results are handled inline in `NativeReAct` without a structured primitive.

```typescript
// src/primitives/ToolCalls.ts
export interface ToolCallEntry {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
  error?: string;
}

export class ToolCalls {
  readonly calls: ReadonlyArray<ToolCallEntry>;
  constructor(calls: ToolCallEntry[]) {}
  toJSON(): ToolCallEntry[];
  static fromJSON(data: ToolCallEntry[]): ToolCalls;
}
```

`ReAct` and `NativeReAct` should populate a `toolCalls: ToolCalls` field on their returned `Prediction`.

-----

## PART 5 — EMBEDDER (First-Class Embedding Model)

### 14. `Embedder`

**DSPy has:** `dspy.Embedder`  
**DSTsx has:** Nothing. Every retriever requires a manual `embeddingFn` callback. This is the biggest DX pain point for retrieval users.

```typescript
// src/models/Embedder.ts
export interface EmbedderOptions {
  model: string;
  provider: 'openai' | 'cohere' | 'huggingface' | 'ollama' | 'custom';
  apiKey?: string;
  baseURL?: string;
  batchSize?: number;      // default 100
  cacheDir?: string;       // disk cache for embeddings
  fn?: (texts: string[]) => Promise<number[][]>;  // for provider: 'custom'
}

export class Embedder {
  constructor(opts: EmbedderOptions) {}

  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  clearCache(): void;
}
```

Update all `Retriever` constructors to accept `embedder?: Embedder` as an alternative to `embeddingFn`. If both are provided, `embedder` takes precedence.

Add `settings.configure({ embedder: new Embedder({ ... }) })` for a global default embedder.

-----

## PART 6 — MISSING EVALUATION

### 15. `SemanticF1`

**DSPy has:** `dspy.SemanticF1` — the recommended default metric for RAG and long-form outputs.  
**DSTsx has:** Nothing. `exactMatch` and token-overlap `f1` are inadequate for any non-trivial output.

```typescript
// src/evaluate/SemanticF1.ts
export class SemanticF1 extends Module {
  constructor(opts?: { threshold?: number }) {}  // threshold default 0.5

  async forward(inputs: {
    question?: string;
    ground_truth: string;
    prediction: string;
  }): Promise<Prediction> {
    // Uses Predict('question?, ground_truth, prediction -> precision, recall, reasoning')
    // Returns f1 = 2 * precision * recall / (precision + recall)
  }

  /** Returns a Metric function compatible with evaluate() and all optimizers */
  asMetricFn(): Metric {
    return async (example, pred) => {
      const result = await this.forward({
        question: example.get('question') as string | undefined,
        ground_truth: String(example.get('answer') ?? ''),
        prediction: String(pred.get('answer') ?? ''),
      });
      const f1 = Number(result.get('f1') ?? 0);
      return f1 >= this.threshold ? 1 : f1;
    };
  }
}
```

-----

### 16. `CompleteAndGrounded`

**DSPy has:** `dspy.CompleteAndGrounded`  
**DSTsx has:** Nothing.

```typescript
// src/evaluate/CompleteAndGrounded.ts
export class CompleteAndGrounded extends Module {
  // Two Predict calls:
  // 1. Predict('context, ground_truth, prediction -> completeness_score, completeness_reasoning')
  // 2. Predict('context, prediction -> groundedness_score, groundedness_reasoning')
  // Combined score: (completeness + groundedness) / 2

  asMetricFn(): Metric;
}
```

-----

### 17. `answerExactMatch` and `answerPassageMatch`

Extend `src/evaluate/metrics.ts`:

```typescript
// Normalises before comparing: lowercase, remove articles (a/an/the), strip punctuation
export function answerExactMatch(field?: string): Metric;

// Checks if prediction text appears in or is entailed by any passage in the context
export function answerPassageMatch(field?: string): Metric;
```

-----

## PART 7 — UTILITIES

### 18. `streamify` — Program-Level Streaming

**DSPy has:** `dspy.streamify`  
**DSTsx has:** `predict.stream()` only. A wrapper around a single Predict call is not the same as streaming a whole multi-module pipeline.

```typescript
// src/utils/streamify.ts
export interface StreamChunk {
  delta: string;
  done: boolean;
  moduleId?: string;    // which predictor generated this chunk
  raw: unknown;
}

/** Wrap any Module so its LM calls stream tokens as they arrive */
export function streamify<T extends Module>(module: T): T & {
  stream(inputs: Record<string, unknown>): AsyncGenerator<StreamChunk>;
};
```

Implementation: uses `AsyncLocalStorage` to intercept `LM.call()` invocations inside `module.forward()` and pipe each LM’s stream to the outer async generator. The `moduleId` is set from the predictor’s name in `namedPredictors()`.

-----

### 19. `asyncify` — Sync-to-Async

**DSPy has:** `dspy.asyncify`  
**DSTsx has:** Nothing.

```typescript
// src/utils/asyncify.ts
/** Run a synchronous Module.forward() in a worker thread so it doesn't block the event loop */
export function asyncify<T extends Module>(module: T): T;
```

-----

### 20. `inspectHistory`

**DSPy has:** `dspy.inspect_history`  
**DSTsx has:** `getHistory()` (raw Trace array) but no pretty-printer.

```typescript
// src/utils/inspectHistory.ts
export function inspectHistory(n?: number, format?: 'text' | 'json'): void;
// Prints the last n LM calls (default 1) in a human-readable format:
// ─── LM Call 1 ─────────────────────
// [PROMPT]  question: What is 2+2?
// [RESPONSE] answer: 4
// [USAGE]   prompt=12 completion=3 total=15 tokens
// [LATENCY] 342ms
```

-----

### 21. Global `load()`

**DSPy has:** `dspy.load(path)`  
**DSTsx has:** `module.load(state)` only — requires an existing instance.

```typescript
// src/utils/load.ts
export async function load(path: string): Promise<Module>;

// Requires modules to register themselves:
// dump() must include { __type: 'RAG', ... }
// load() reads __type and uses ModuleRegistry to instantiate
export const ModuleRegistry: Map<string, new () => Module>;
export function registerModule(name: string, ctor: new () => Module): void;
```

-----

### 22. `configureCache`

**DSPy has:** `dspy.configure_cache`  
**DSTsx has:** `cacheDir` inside `settings.configure()` only.

```typescript
// src/utils/configureCache.ts
export function configureCache(opts: {
  cacheDir?: string;
  maxSize?: number;
  ttlMs?: number;
  enabled?: boolean;
}): void;
```

-----

### 23. `StatusMessage` system

**DSPy has:** `dspy.StatusMessage`, `dspy.StatusMessageProvider`  
**DSTsx has:** Nothing. Long optimizer runs appear to hang with no feedback.

```typescript
// src/utils/StatusMessage.ts
export interface StatusMessage {
  type: 'info' | 'warn' | 'progress' | 'done';
  text: string;
  step?: number;
  total?: number;
  metadata?: Record<string, unknown>;
}

export class StatusMessageProvider extends EventEmitter {
  emit(event: 'status', msg: StatusMessage): boolean;
  on(event: 'status', listener: (msg: StatusMessage) => void): this;
}

// All optimizers emit status messages on the global provider
export const statusProvider: StatusMessageProvider;
```

Add `settings.configure({ onStatus: (msg) => void })` as a convenience shorthand.

-----

### 24. `StreamListener`

**DSPy has:** `dspy.StreamListener`  
**DSTsx has:** Nothing.

```typescript
// src/utils/StreamListener.ts
export class StreamListener {
  constructor(field?: string) {}  // which field to listen on (default: first output field)

  // Used by streamify to aggregate chunks
  observe(chunk: StreamChunk): void;
  get accumulated(): string;
  reset(): void;
}
```

-----

### 25. Logging utilities

```typescript
// src/utils/logging.ts
export function enableLogging(): void;   // sets logLevel to 'debug'
export function disableLogging(): void;  // sets logLevel to 'silent'
export function suppressProviderLogs(): void;  // silences SDK-level noise
```

-----

### 26. `settings.save` / `settings.load`

```typescript
// Add to Settings class:
save(path: string): void;   // serialize current settings to JSON (LM as { provider, model, options })
load(path: string): void;   // restore settings from JSON
```

-----

### 27. `DataLoader`

**DSPy has:** `dspy.DataLoader`  
**DSTsx has:** Nothing. Users must manually construct `Example` arrays.

```typescript
// src/data/DataLoader.ts
export class DataLoader {
  fromCSV(path: string, opts?: { inputKeys?: string[]; delimiter?: string }): Example[];
  fromJSON(path: string, opts?: { inputKeys?: string[] }): Example[];
  fromArray(records: Record<string, unknown>[], inputKeys: string[]): Example[];
}
```

-----

## PART 8 — COMPLETE LIVE MCP CONNECTION

The current `MCPToolAdapter` is test-mode only. The V2_ROADMAP says this is planned — finish it.

```typescript
// MCPToolAdapter additions:
export class MCPToolAdapter {
  constructor(opts:
    | { tools: MCPToolDef[]; callHandler: MCPCallHandler }  // test mode (keep)
    | { serverUrl: string; transport?: 'sse' }               // live SSE
    | { serverCommand: string[]; transport: 'stdio' }        // live stdio
  ) {}

  // lazy-connects on first call; reconnects with exponential backoff
  getTools(): Promise<Tool[]>;
}
```

```typescript
// DSTsxMCPServer — finish the stdio server:
createStdioServer(): Promise<void>;  // full implementation using @modelcontextprotocol/sdk StdioServerTransport
```

-----

## PART 9 — COMPLETE STREAMING FOR ALL ADAPTERS

Currently real streaming is only in `OpenAI` and `Anthropic`. Fix the rest:

- **Cohere:** use `cohere.generateStream()`
- **GoogleAI:** use `model.generateContentStream()`
- **Ollama:** Ollama REST supports streaming natively; use fetch with `{ stream: true }` and parse SSE
- **LMStudio:** OpenAI-compatible — reuse OpenAI streaming logic
- **HuggingFace:** check if inference endpoint supports SSE; implement if available, graceful fallback if not

-----

## PART 10 — TOOLS & EXPERIMENTAL

### 28. `JSInterpreter` as exported Tool (see section 2 above — also add as standalone export)

### 29. `Embeddings` in-memory utility

```typescript
// src/tools/Embeddings.ts
export class Embeddings {
  constructor(opts: { embedder: Embedder }) {}

  add(texts: string[]): Promise<void>;
  search(query: string, k: number): Promise<string[]>;
  clear(): void;
  asRetriever(): Retriever;
}
```

### 30. Experimental primitives

```typescript
// src/experimental/Citations.ts
// A Predict module that outputs answer + cited passage indices
export class Citations extends Module { ... }

// src/experimental/Document.ts
export class Document {
  title?: string;
  body: string;
  metadata?: Record<string, unknown>;
}
```

Export from `dstsx/experimental` entry point (add to package.json exports map).

-----

## PART 11 — TEST COVERAGE

The 218 existing tests are heavily weighted toward v1 features. All v2 features need proper tests, not just “it doesn’t throw” tests:

- **GRPO:** test that each step produces a measurably better score on a deterministic MockLM setup
- **SIMBA:** test that mini-batch acceptance is conditional on score improvement
- **AvatarOptimizer:** test that the winning persona string appears in the compiled predictor’s instructions
- **BootstrapFinetune:** test that the JSONL file is written with the correct schema and correct number of lines
- **NativeReAct:** test with a MockLM that returns tool_use format; verify the tool is actually invoked and the result is fed back
- **MCP:** round-trip test for `DSTsxMCPServer.callTool()`
- **Worker sandbox:** test that a code block with an infinite loop is terminated within `timeoutMs`
- **Adapter layer:** snapshot tests for each (Signature type × Adapter) combination; round-trip format→parse tests
- **SemanticF1:** test with MockLM returning known precision/recall values
- **Audio:** test `fromURL`, `fromBase64`, `fromFile`; test that `toOpenAIContentPart()` has correct structure
- **History:** test `append`, `truncate`, `toMessages()`; test that LM adapters receive history turns correctly

Target: ≥ 80% line coverage on all modules including v2 features.

-----

## PART 12 — NFR AUDIT (check these, fix what’s broken)

|NFR   |Check                                                                                                     |
|------|----------------------------------------------------------------------------------------------------------|
|NFR-03|All LM adapters must implement exponential backoff + jitter on 429 errors. Verify each adapter has this.  |
|NFR-05|`ProgramOfThought` default mode is `"function"` which uses `new Function()`. Change default to `"worker"`.|
|NFR-06|`dump()` on all LM adapters must never include API keys. Audit all.                                       |
|NFR-07|Verify `package.json` has correct ESM + CJS exports map.                                                  |
|NFR-08|Run bundle size analysis. Core should be < 20 KB gzip.                                                    |

-----

## PART 13 — README REWRITE

The README should be one comprehensive, authoritative document. No v1/v2/v3 differentiation. No “this is planned” notes. Only the current complete state of the software.

Structure:

1. Tagline + install
1. Quick start (5 lines)
1. Core concepts table
1. Signatures — full API
1. Primitives — Example, Prediction, Trace, Image, Audio, History, Code, ToolCalls
1. Language Model Adapters — all providers
1. Prompt Adapters — ChatAdapter, JSONAdapter, TwoStepAdapter
1. Settings & Context
1. Modules — all of them including CodeAct, Reasoning, RLM
1. Retrievers — all backends
1. Optimizers — LabeledFewShot, BootstrapFewShot, BootstrapRS, BootstrapFewShotWithOptuna, COPRO, MIPROv2, KNNFewShot, Ensemble, BetterTogether, GRPO, SIMBA, AvatarOptimizer, GEPA, InferRules, BootstrapFinetune
1. Evaluation — evaluate(), SemanticF1, CompleteAndGrounded, all metrics
1. Assertions & Suggestions
1. Embedder
1. Tools — JSInterpreter, Embeddings, ColBERTv2, PythonInterpreter equivalent
1. Data — DataLoader
1. Utilities — streamify, asyncify, inspectHistory, configureCache, load, StatusMessage, StreamListener, logging
1. Experiment Tracking — ConsoleTracker, JsonFileTracker, custom Tracker
1. MCP Integration — MCPToolAdapter (live + test mode), DSTsxMCPServer
1. LM Streaming — streamify, lm.stream(), predict.stream()
1. Worker-thread sandbox — ProgramOfThought sandbox modes
1. Disk cache
1. End-to-end examples (at least 6)
1. Contributing

-----

## Complete DSPy ↔ DSTsx Parity Table (Target State)

|Category    |DSPy Symbol                            |DSTsx Symbol                      |Target              |
|------------|---------------------------------------|----------------------------------|--------------------|
|Adapters    |`dspy.Adapter`                         |`Adapter`                         |NEW                 |
|Adapters    |`dspy.ChatAdapter`                     |`ChatAdapter`                     |NEW                 |
|Adapters    |`dspy.JSONAdapter`                     |`JSONAdapter`                     |NEW                 |
|Adapters    |`dspy.TwoStepAdapter`                  |`TwoStepAdapter`                  |NEW                 |
|Evaluation  |`dspy.SemanticF1`                      |`SemanticF1`                      |NEW                 |
|Evaluation  |`dspy.CompleteAndGrounded`             |`CompleteAndGrounded`             |NEW                 |
|Evaluation  |`dspy.Evaluate`                        |`evaluate()`                      |✅ exists            |
|Evaluation  |`dspy.answer_exact_match`              |`answerExactMatch()`              |NEW                 |
|Evaluation  |`dspy.answer_passage_match`            |`answerPassageMatch()`            |NEW                 |
|Models      |`dspy.LM`                              |`LM`                              |✅ exists            |
|Models      |`dspy.Embedder`                        |`Embedder`                        |NEW                 |
|Modules     |`dspy.Predict`                         |`Predict`                         |✅ exists            |
|Modules     |`dspy.ChainOfThought`                  |`ChainOfThought`                  |✅ exists            |
|Modules     |`dspy.ChainOfThoughtWithHint`          |`ChainOfThoughtWithHint`          |✅ exists            |
|Modules     |`dspy.MultiChainComparison`            |`MultiChainComparison`            |✅ exists            |
|Modules     |`dspy.ReAct`                           |`ReAct`                           |✅ exists            |
|Modules     |`dspy.ProgramOfThought`                |`ProgramOfThought`                |✅ exists            |
|Modules     |`dspy.Retrieve`                        |`Retrieve`                        |✅ exists            |
|Modules     |`dspy.Retry`                           |`Retry`                           |✅ exists            |
|Modules     |`dspy.BestOfN`                         |`BestOfN`                         |✅ exists            |
|Modules     |`dspy.Parallel`                        |`Parallel`                        |✅ exists            |
|Modules     |`dspy.Refine`                          |`Refine`                          |✅ exists            |
|Modules     |`dspy.CodeAct`                         |`CodeAct`                         |NEW                 |
|Modules     |`dspy.RLM`                             |`RLM`                             |NEW                 |
|Modules     |`dspy.Reasoning`                       |`Reasoning`                       |NEW                 |
|Modules     |`dspy.NativeReAct`                     |`NativeReAct`                     |✅ exists            |
|Modules     |`dspy.TypedPredictor`                  |`TypedPredictor`                  |✅ exists (refactor) |
|Modules     |`dspy.TypedChainOfThought`             |`TypedChainOfThought`             |✅ exists (refactor) |
|Optimizers  |`dspy.LabeledFewShot`                  |`LabeledFewShot`                  |✅ exists            |
|Optimizers  |`dspy.BootstrapFewShot`                |`BootstrapFewShot`                |✅ exists            |
|Optimizers  |`dspy.BootstrapFewShotWithRandomSearch`|`BootstrapFewShotWithRandomSearch`|✅ exists            |
|Optimizers  |`dspy.BootstrapRS`                     |`BootstrapRS`                     |NEW (alias)         |
|Optimizers  |`dspy.BootstrapFinetune`               |`BootstrapFinetune`               |✅ exists            |
|Optimizers  |`dspy.BootstrapFewShotWithOptuna`      |`BootstrapFewShotWithOptuna`      |✅ exists            |
|Optimizers  |`dspy.COPRO`                           |`COPRO`                           |✅ exists            |
|Optimizers  |`dspy.MIPROv2`                         |`MIPROv2`                         |NEW (replace MIPRO) |
|Optimizers  |`dspy.KNNFewShot`                      |`KNNFewShot`                      |✅ exists            |
|Optimizers  |`dspy.Ensemble`                        |`Ensemble`                        |✅ exists            |
|Optimizers  |`dspy.BetterTogether`                  |`BetterTogether`                  |NEW                 |
|Optimizers  |`dspy.GRPO`                            |`GRPO`                            |✅ exists            |
|Optimizers  |`dspy.SIMBA`                           |`SIMBA`                           |✅ exists            |
|Optimizers  |`dspy.AvatarOptimizer`                 |`AvatarOptimizer`                 |✅ exists            |
|Optimizers  |`dspy.GEPA`                            |`GEPA`                            |NEW                 |
|Optimizers  |`dspy.InferRules`                      |`InferRules`                      |NEW                 |
|Primitives  |`dspy.Example`                         |`Example`                         |✅ exists            |
|Primitives  |`dspy.Prediction`                      |`Prediction`                      |✅ exists            |
|Primitives  |`dspy.Image`                           |`Image`                           |✅ exists            |
|Primitives  |`dspy.Audio`                           |`Audio`                           |NEW                 |
|Primitives  |`dspy.Code`                            |`Code`                            |NEW                 |
|Primitives  |`dspy.History`                         |`History`                         |NEW                 |
|Primitives  |`dspy.ToolCalls`                       |`ToolCalls`                       |NEW                 |
|Primitives  |`dspy.Tool`                            |`Tool`                            |✅ exists (interface)|
|Retrievers  |`dspy.ColBERTv2`                       |`ColBERTv2`                       |✅ exists            |
|Retrievers  |`dspy.Pinecone`                        |`PineconeRM`                      |✅ exists            |
|Retrievers  |`dspy.Weaviate`                        |`WeaviateRM`                      |✅ exists            |
|Retrievers  |`dspy.Chromadb`                        |`ChromadbRM`                      |✅ exists            |
|Retrievers  |`dspy.Qdrant`                          |`QdrantRM`                        |✅ exists            |
|Retrievers  |`dspy.FaissRM`                         |`FaissRM`                         |✅ exists            |
|Retrievers  |`dspy.YouRM`                           |`YouRM`                           |✅ exists            |
|Tools       |`dspy.PythonInterpreter`               |`JSInterpreter`                   |NEW                 |
|Tools       |`dspy.Embeddings`                      |`Embeddings`                      |NEW                 |
|Utils       |`dspy.configure`                       |`settings.configure()`            |✅ exists            |
|Utils       |`dspy.context`                         |`settings.context()`              |✅ exists            |
|Utils       |`dspy.streamify`                       |`streamify()`                     |NEW                 |
|Utils       |`dspy.asyncify`                        |`asyncify()`                      |NEW                 |
|Utils       |`dspy.inspect_history`                 |`inspectHistory()`                |NEW                 |
|Utils       |`dspy.load`                            |`load()`                          |NEW                 |
|Utils       |`dspy.configure_cache`                 |`configureCache()`                |NEW                 |
|Utils       |`dspy.StatusMessage`                   |`StatusMessage`                   |NEW                 |
|Utils       |`dspy.StreamListener`                  |`StreamListener`                  |NEW                 |
|Utils       |`dspy.enable_logging`                  |`enableLogging()`                 |NEW                 |
|Utils       |`dspy.disable_logging`                 |`disableLogging()`                |NEW                 |
|Data        |`dspy.DataLoader`                      |`DataLoader`                      |NEW                 |
|Experimental|`dspy.Citations`                       |`Citations`                       |NEW                 |
|Experimental|`dspy.Document`                        |`Document`                        |NEW                 |

-----

## File Structure (Target)

```
src/
├── index.ts
├── adapters/
│   ├── index.ts
│   ├── Adapter.ts
│   ├── ChatAdapter.ts
│   ├── JSONAdapter.ts
│   └── TwoStepAdapter.ts
├── data/
│   ├── index.ts
│   └── DataLoader.ts
├── evaluate/
│   ├── index.ts
│   ├── evaluate.ts
│   ├── metrics.ts             ← add answerExactMatch, answerPassageMatch
│   ├── SemanticF1.ts          ← NEW
│   ├── CompleteAndGrounded.ts ← NEW
│   └── types.ts
├── experimental/
│   ├── index.ts
│   ├── Citations.ts
│   └── Document.ts
├── lm/
│   ├── index.ts
│   ├── LM.ts
│   ├── cache.ts
│   ├── types.ts               ← add reasoning?: string to LMResponse
│   └── adapters/
│       ├── OpenAI.ts          ← add reasoning token extraction
│       ├── Anthropic.ts       ← add thinking block extraction
│       ├── Cohere.ts          ← add real streaming
│       ├── GoogleAI.ts        ← add real streaming
│       ├── Ollama.ts          ← add real streaming
│       ├── LMStudio.ts        ← real streaming (OpenAI compat)
│       ├── HuggingFace.ts
│       └── MockLM.ts
├── models/
│   ├── index.ts
│   └── Embedder.ts            ← NEW
├── modules/
│   ├── index.ts
│   ├── Module.ts              ← add setAdapter(), stream()
│   ├── Predict.ts             ← refactor to use Adapter
│   ├── ChainOfThought.ts
│   ├── ChainOfThoughtWithHint.ts
│   ├── MultiChainComparison.ts
│   ├── ReAct.ts               ← populate ToolCalls on Prediction
│   ├── NativeReAct.ts         ← populate ToolCalls on Prediction
│   ├── ProgramOfThought.ts    ← change default sandbox to 'worker'; return Code primitive
│   ├── Retrieve.ts
│   ├── Retry.ts
│   ├── BestOfN.ts
│   ├── Ensemble.ts
│   ├── Parallel.ts
│   ├── Refine.ts
│   ├── TypedPredictor.ts      ← thin wrapper over Predict + JSONAdapter
│   ├── TypedChainOfThought.ts
│   ├── CodeAct.ts             ← NEW
│   ├── Reasoning.ts           ← NEW
│   └── RLM.ts                 ← NEW
├── optimizers/
│   ├── index.ts
│   ├── Optimizer.ts
│   ├── LabeledFewShot.ts
│   ├── BootstrapFewShot.ts
│   ├── BootstrapFewShotWithRandomSearch.ts ← also export as BootstrapRS
│   ├── BootstrapFewShotWithOptuna.ts
│   ├── BootstrapFinetune.ts
│   ├── COPRO.ts
│   ├── MIPROv2.ts             ← NEW (replaces MIPRO.ts, keep MIPRO as re-export alias)
│   ├── KNNFewShot.ts
│   ├── EnsembleOptimizer.ts
│   ├── BetterTogether.ts      ← NEW
│   ├── GRPO.ts
│   ├── SIMBA.ts
│   ├── AvatarOptimizer.ts
│   ├── GEPA.ts                ← NEW
│   └── InferRules.ts          ← NEW
├── primitives/
│   ├── index.ts
│   ├── Example.ts
│   ├── Prediction.ts
│   ├── Trace.ts               ← add reasoning?: string
│   ├── Image.ts
│   ├── Audio.ts               ← NEW
│   ├── Code.ts                ← NEW
│   ├── History.ts             ← NEW
│   └── ToolCalls.ts           ← NEW
├── retrieve/
│   ├── index.ts
│   ├── Retriever.ts
│   └── backends/ (unchanged)
├── settings/
│   ├── index.ts
│   └── Settings.ts            ← add adapter, embedder, onStatus; add save/load
├── tools/
│   ├── index.ts
│   ├── JSInterpreter.ts       ← NEW
│   └── Embeddings.ts          ← NEW
└── utils/
    ├── index.ts
    ├── streamify.ts           ← NEW
    ├── asyncify.ts            ← NEW
    ├── inspectHistory.ts      ← NEW
    ├── load.ts                ← NEW
    ├── configureCache.ts      ← NEW
    ├── StatusMessage.ts       ← NEW
    ├── StreamListener.ts      ← NEW
    └── logging.ts             ← NEW
```