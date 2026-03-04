import { Prediction } from "../primitives/index.js";
import type { Example } from "../primitives/index.js";
import type { Metric } from "./types.js";

// ---------------------------------------------------------------------------
// Exact Match
// ---------------------------------------------------------------------------

/**
 * Returns 1 if the prediction's `field` exactly matches the example's `field`
 * (case-insensitive by default), 0 otherwise.
 */
export function exactMatch(field = "answer", caseSensitive = false): Metric {
  return (example, prediction) => {
    const expected = String(example.get(field) ?? "");
    const actual = String(prediction.get(field) ?? "");
    return caseSensitive
      ? expected === actual
      : expected.toLowerCase() === actual.toLowerCase();
  };
}

// ---------------------------------------------------------------------------
// F1 Score (token-level)
// ---------------------------------------------------------------------------

/**
 * Token-level F1 metric (word overlap), commonly used for SQuAD-style QA.
 */
export function f1(field = "answer"): Metric {
  return (example, prediction) => {
    const expected = tokenize(String(example.get(field) ?? ""));
    const actual = tokenize(String(prediction.get(field) ?? ""));

    if (expected.length === 0 && actual.length === 0) return 1;
    if (expected.length === 0 || actual.length === 0) return 0;

    const expectedSet = new Set(expected);
    const actualSet = new Set(actual);

    const common = [...expectedSet].filter((t) => actualSet.has(t));
    const precision = common.length / actual.length;
    const recall = common.length / expected.length;

    if (precision + recall === 0) return 0;
    return (2 * precision * recall) / (precision + recall);
  };
}

// ---------------------------------------------------------------------------
// Pass@K
// ---------------------------------------------------------------------------

/**
 * Returns 1 if at least one of the top-`k` completions passes the `innerMetric`.
 */
export function passAtK(innerMetric: Metric, k: number): Metric {
  return (example, prediction, trace) => {
    for (let i = 0; i < Math.min(k, prediction.completions.length + 1); i++) {
      const candidate =
        i === 0
          ? prediction
          : buildPrediction(prediction.completions[i - 1] ?? {});
      const result = innerMetric(example, candidate, trace);
      if (result === true || (typeof result === "number" && result > 0)) return 1;
    }
    return 0;
  };
}

// ---------------------------------------------------------------------------
// BLEU (simplified 1-gram / 2-gram)
// ---------------------------------------------------------------------------

/**
 * Simplified BLEU score (1-gram + 2-gram precision) for a single field.
 */
export function bleu(field = "answer"): Metric {
  return (example, prediction) => {
    const reference = tokenize(String(example.get(field) ?? ""));
    const hypothesis = tokenize(String(prediction.get(field) ?? ""));

    if (hypothesis.length === 0) return 0;

    const refSet = new Set(reference);
    const uni = hypothesis.filter((t) => refSet.has(t)).length / hypothesis.length;

    if (hypothesis.length < 2) return uni;
    const refBigrams = new Set(
      reference.slice(0, -1).map((t, i) => `${t} ${reference[i + 1] ?? ""}`),
    );
    const hypBigrams = hypothesis.slice(0, -1).map((t, i) => `${t} ${hypothesis[i + 1] ?? ""}`);
    const bi = hypBigrams.filter((b) => refBigrams.has(b)).length / hypBigrams.length;

    return Math.sqrt(uni * bi);
  };
}

// ---------------------------------------------------------------------------
// ROUGE-L (Longest Common Subsequence)
// ---------------------------------------------------------------------------

/**
 * ROUGE-L metric (LCS-based recall/precision/F1) for a single field.
 */
export function rouge(field = "answer"): Metric {
  return (example, prediction) => {
    const reference = tokenize(String(example.get(field) ?? ""));
    const hypothesis = tokenize(String(prediction.get(field) ?? ""));

    if (reference.length === 0 && hypothesis.length === 0) return 1;
    if (reference.length === 0 || hypothesis.length === 0) return 0;

    const lcsLen = lcs(reference, hypothesis);
    const precision = lcsLen / hypothesis.length;
    const recall = lcsLen / reference.length;

    if (precision + recall === 0) return 0;
    return (2 * precision * recall) / (precision + recall);
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);
}

function lcs(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = a[i - 1] === b[j - 1] ? dp[i - 1]![j - 1]! + 1 : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    }
  }
  return dp[m]![n]!;
}

function buildPrediction(data: Record<string, unknown>): Prediction {
  return new Prediction(data);
}
