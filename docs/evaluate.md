# Evaluation

---

## `evaluate(program, examples, metric, options?)`

Run `program` on every example and aggregate scores.

```ts
import { evaluate, exactMatch } from "dstsx";

const result = await evaluate(
  program,
  devset,
  exactMatch("answer"),      // built-in metric
  {
    numThreads:      4,      // parallel evaluation (default: 1)
    displayProgress: true,   // log progress to console
  },
);

console.log(`Score: ${(result.score * 100).toFixed(1)}%`);
console.log(`Passed: ${result.numPassed}/${result.total}`);
```

---

## `EvaluationResult`

```ts
interface EvaluationResult {
  score:     number;          // average metric score (0–1)
  numPassed: number;
  total:     number;
  results:   ExampleResult[]; // per-example breakdown
}

interface ExampleResult {
  example:    Example;
  prediction: Prediction;
  score:      number;
  passed:     boolean;
}
```

---

## `EvaluateOptions`

```ts
interface EvaluateOptions {
  numThreads?:      number;  // default: 1
  displayProgress?: boolean; // default: false
}
```

---

## `Metric` type

```ts
type MetricResult = number | boolean | { score: number; feedback: string };

type Metric = (
  example:    Example,
  prediction: Prediction,
  trace?:     Trace[],
) => MetricResult | Promise<MetricResult>;
```

Metrics can return:
- `number` — a continuous score (0–1)
- `boolean` — pass/fail
- `{ score: number; feedback: string }` — used by `GEPA` to provide guided feedback to the optimizer
- Any of the above wrapped in a `Promise` (async metrics are fully supported)

---

## Built-in Metrics

| Factory | Description |
|---|---|
| `exactMatch(field?, caseSensitive?)` | `1` if prediction exactly matches example (case-insensitive by default) |
| `f1(field?)` | Token-level F1 (word overlap), useful for QA |
| `passAtK(innerMetric, k)` | `1` if any of the top-k completions pass `innerMetric` |
| `bleu(field?)` | Simplified BLEU (1-gram + 2-gram precision) |
| `rouge(field?)` | ROUGE-L (LCS-based F1) |
| `answerExactMatch(field?)` | Normalized exact match (strips articles, punctuation, lowercases) |
| `answerPassageMatch(field?)` | `1` if prediction appears in the example's `context` field |

```ts
import { exactMatch, f1, passAtK, bleu, rouge, answerExactMatch, answerPassageMatch } from "dstsx";

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

// Normalized exact match (mirrors dspy.answer_exact_match)
const aem = answerExactMatch("answer");

// Passage containment match (mirrors dspy.answer_passage_match)
const apm = answerPassageMatch("answer");
```

---

## `SemanticF1`

LM-judged precision/recall metric for RAG and long-form outputs. Evaluates predictions against a ground truth using the configured LM.

```ts
import { SemanticF1 } from "dstsx";

const sf1 = new SemanticF1({ threshold: 0.5 });

// Use directly
const result = await sf1.forward({
  question:     "What is the capital of France?", // optional
  ground_truth: "Paris",
  prediction:   "The capital is Paris.",
});
console.log(result.get("f1"));        // "0.93"
console.log(result.get("precision")); // "0.95"
console.log(result.get("recall"));    // "0.91"

// Use as a Metric function (compatible with evaluate() and all optimizers)
const metricFn = sf1.asMetricFn();
const evalResult = await evaluate(program, devset, metricFn);
```

**Constructor:**

```ts
new SemanticF1(opts?: { threshold?: number }) // threshold default: 0.5
```

---

## `CompleteAndGrounded`

Evaluates both the completeness of a prediction against ground truth and its groundedness in the provided context.

```ts
import { CompleteAndGrounded } from "dstsx";

const metric = new CompleteAndGrounded();

const result = await metric.forward({
  context:      "Paris is the capital and largest city of France.",
  ground_truth: "Paris is the capital of France.",
  prediction:   "The capital of France is Paris.",
});
console.log(result.get("completeness_score")); // "0.95"
console.log(result.get("groundedness_score")); // "0.98"
console.log(result.get("score"));              // combined average

// Use as a Metric function
const metricFn: Metric = async (example, pred) => {
  const r = await metric.forward({
    context:      String(example.get("context") ?? ""),
    ground_truth: String(example.get("answer") ?? ""),
    prediction:   String(pred.get("answer") ?? ""),
  });
  return Number(r.get("score") ?? 0);
};
```

---

## Custom Metrics

```ts
import type { Metric } from "dstsx";

const lengthMetric: Metric = (example, prediction) => {
  const answer = String(prediction.get("answer") ?? "");
  return answer.length > 50 ? 1 : 0;
};

const result = await evaluate(program, devset, lengthMetric);
```

Async metrics are also supported:

```ts
const asyncMetric: Metric = async (example, prediction) => {
  const score = await myLMJudge(example, prediction);
  return { score, feedback: `Score was ${score}` };
};
```
