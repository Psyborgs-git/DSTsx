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

## Built-in Metrics

All metrics implement the `Metric` type:

```ts
type Metric = (
  example:    Example,
  prediction: Prediction,
  trace?:     Trace[],
) => number | boolean;
```

| Factory | Description |
|---|---|
| `exactMatch(field?, caseSensitive?)` | `1` if prediction exactly matches example (case-insensitive by default) |
| `f1(field?)` | Token-level F1 (word overlap), useful for QA |
| `passAtK(innerMetric, k)` | `1` if any of the top-k completions pass `innerMetric` |
| `bleu(field?)` | Simplified BLEU (1-gram + 2-gram precision) |
| `rouge(field?)` | ROUGE-L (LCS-based F1) |

```ts
import { exactMatch, f1, passAtK, bleu, rouge } from "dstsx";

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
