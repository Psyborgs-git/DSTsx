import { settings } from "../settings/index.js";

/**
 * Pretty-print the last n LM calls.
 * Mirrors `dspy.inspect_history`.
 */
export function inspectHistory(
  n = 1,
  format: "text" | "json" = "text",
): void {
  const lm = settings.lm;
  if (!lm) {
    console.log("No LM configured.");
    return;
  }

  console.log(`─── Last ${n} LM call(s) ───`);
  console.log(`Model: ${lm.model}`);
  console.log(`Total requests: ${lm.requestCount}`);
  const usage = lm.tokenUsage;
  if (format === "json") {
    console.log(
      JSON.stringify(
        {
          model: lm.model,
          requestCount: lm.requestCount,
          tokenUsage: usage,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(
      `Token usage: prompt=${usage.promptTokens} completion=${usage.completionTokens} total=${usage.totalTokens}`,
    );
  }
}
