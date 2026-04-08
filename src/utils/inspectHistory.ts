import { settings } from "../settings/index.js";
import type { LMCallRecord } from "../lm/types.js";

/**
 * Options for {@link inspectHistory}.
 */
export interface InspectHistoryOptions {
  /**
   * Number of recent calls to display (default: 1).
   * Pass `Infinity` to show all recorded calls.
   */
  n?: number;
  /**
   * Output format:
   * - `"text"` (default) — human-readable colour-free text
   * - `"json"` — machine-readable JSON array
   */
  format?: "text" | "json";
  /**
   * Optional predicate to filter which call records are shown.
   * Receives each {@link LMCallRecord} and returns `true` to include it.
   *
   * @example
   * ```ts
   * // Only show calls that used more than 100 tokens
   * inspectHistory({ filter: (r) => (r.response.usage?.totalTokens ?? 0) > 100 });
   * ```
   */
  filter?: (record: LMCallRecord) => boolean;
}

/**
 * Pretty-print recent LM calls from the configured LM's call history.
 *
 * Mirrors `dspy.inspect_history` in Python, with additional filtering and
 * formatting options.
 *
 * @param options - Either an {@link InspectHistoryOptions} object or a number
 *   (the legacy API).  Passing a number directly is **deprecated** — prefer
 *   `inspectHistory({ n: 3 })` for clarity.
 *
 * @example
 * ```ts
 * // Show the last 3 calls
 * inspectHistory({ n: 3 });
 *
 * // Show all calls as JSON
 * inspectHistory({ n: Infinity, format: "json" });
 *
 * // Filter to calls that failed (empty response)
 * inspectHistory({ filter: (r) => r.response.text === "" });
 *
 * // @deprecated numeric form — use the options object instead
 * inspectHistory(3);
 * ```
 */
export function inspectHistory(options: InspectHistoryOptions | number = {}): void {
  const opts: InspectHistoryOptions =
    typeof options === "number" ? { n: options } : options;
  const { n = 1, format = "text", filter } = opts;

  const lm = settings.lm;
  if (!lm) {
    console.log("No LM configured.");
    return;
  }

  // Retrieve call history
  let records = lm.getHistory();
  if (filter) {
    records = records.filter(filter);
  }
  const limit = isFinite(n) ? Math.abs(n) : records.length;
  records = records.slice(-limit);

  if (format === "json") {
    const output = records.map((r) => ({
      model: lm.model,
      timestamp: r.timestamp,
      prompt: r.prompt,
      config: r.config,
      response: {
        text: r.response.text,
        usage: r.response.usage,
      },
    }));
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Text format
  const divider = "─".repeat(60);
  console.log(`${divider}`);
  console.log(`  LM: ${lm.model} | Total requests: ${lm.requestCount}`);
  const globalUsage = lm.tokenUsage;
  console.log(
    `  Cumulative usage: prompt=${globalUsage.promptTokens} completion=${globalUsage.completionTokens} total=${globalUsage.totalTokens}`,
  );
  console.log(divider);

  if (records.length === 0) {
    console.log("  No call history recorded yet.");
    console.log(divider);
    return;
  }

  records.forEach((r, idx) => {
    const date = new Date(r.timestamp).toISOString();
    const usage = r.response.usage;
    console.log(`  [Call ${idx + 1}/${records.length}] ${date}`);

    // Prompt
    if (typeof r.prompt === "string") {
      const preview = r.prompt.length > 200 ? `${r.prompt.slice(0, 200)}…` : r.prompt;
      console.log(`  Prompt: ${preview}`);
    } else {
      const msgSummary = r.prompt
        .map((m) => {
          const preview = m.content.length > 100 ? `${m.content.slice(0, 100)}…` : m.content;
          return `[${m.role}] ${preview}`;
        })
        .join(" | ");
      console.log(`  Messages: ${msgSummary}`);
    }

    // Response
    const respPreview =
      r.response.text.length > 200
        ? `${r.response.text.slice(0, 200)}…`
        : r.response.text;
    console.log(`  Response: ${respPreview}`);

    // Token usage
    if (usage) {
      console.log(
        `  Tokens: prompt=${usage.promptTokens} completion=${usage.completionTokens} total=${usage.totalTokens}`,
      );
    } else {
      console.log("  Tokens: n/a");
    }

    if (idx < records.length - 1) console.log("  " + "·".repeat(58));
  });

  console.log(divider);
}
