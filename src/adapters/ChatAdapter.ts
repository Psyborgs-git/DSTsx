import { Adapter } from "./Adapter.js";
import type { Signature } from "../signatures/index.js";
import type { Example } from "../primitives/index.js";
import type { Message } from "../lm/types.js";

/**
 * Default prompt adapter — formats into OpenAI-style chat turns.
 * Mirrors `dspy.ChatAdapter`.
 */
export class ChatAdapter extends Adapter {
  format(sig: Signature, demos: Example[], inputs: Record<string, unknown>): Message[] {
    const messages: Message[] = [];

    // System message with instructions
    if (sig.instructions) {
      messages.push({ role: "system", content: sig.instructions });
    }

    // Demo turns
    for (const demo of demos) {
      const data = demo.toDict();
      const userParts: string[] = [];
      for (const [name, meta] of sig.inputs) {
        const label = meta.prefix ?? `${name}:`;
        const prefix = label.endsWith(":") ? label : `${label}:`;
        userParts.push(`${prefix} ${String(data[name] ?? "")}`);
      }
      messages.push({ role: "user", content: userParts.join("\n") });

      const assistantParts: string[] = [];
      for (const [name, meta] of sig.outputs) {
        const label = meta.prefix ?? `${name}:`;
        const prefix = label.endsWith(":") ? label : `${label}:`;
        assistantParts.push(`${prefix} ${String(data[name] ?? "")}`);
      }
      messages.push({ role: "assistant", content: assistantParts.join("\n") });
    }

    // Current input turn
    const inputParts: string[] = [];
    for (const [name, meta] of sig.inputs) {
      const label = meta.prefix ?? `${name}:`;
      const prefix = label.endsWith(":") ? label : `${label}:`;
      inputParts.push(`${prefix} ${String(inputs[name] ?? "")}`);
    }
    // Append output field labels so the LM knows what to produce
    for (const [name, meta] of sig.outputs) {
      const label = meta.prefix ?? `${name}:`;
      inputParts.push(label.endsWith(":") ? label : `${label}:`);
    }
    messages.push({ role: "user", content: inputParts.join("\n") });

    return messages;
  }

  parse(sig: Signature, output: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const outputs = [...sig.outputs.entries()];

    const fieldLabels: Array<{ key: string; patterns: string[] }> = [];
    for (const [key, meta] of outputs) {
      const prefixBase = (meta.prefix ?? "").replace(/:$/, "").trim();
      const patterns = [key];
      if (prefixBase && prefixBase.toLowerCase() !== key.toLowerCase()) {
        patterns.push(prefixBase);
      }
      fieldLabels.push({ key, patterns });
    }

    const allPatterns = fieldLabels.flatMap((f) => f.patterns);
    const allPatternsEscaped = allPatterns.map((p) =>
      p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );

    const markerPattern = `(?:\\*\\*|\\*|_)?(${allPatternsEscaped.join("|")})(?:\\*\\*|\\*|_)?:`;
    const markerRegex = new RegExp(markerPattern, "gi");

    const markers: Array<{ key: string; start: number; end: number }> = [];
    let markerMatch;
    while ((markerMatch = markerRegex.exec(output)) !== null) {
      const matchedLabel = markerMatch[1]!.toLowerCase();
      for (const { key, patterns } of fieldLabels) {
        if (patterns.some((p) => p.toLowerCase() === matchedLabel)) {
          markers.push({ key, start: markerMatch.index, end: markerMatch.index + markerMatch[0].length });
          break;
        }
      }
    }

    for (let i = 0; i < markers.length; i++) {
      const marker = markers[i]!;
      const contentStart = marker.end;
      const contentEnd = i + 1 < markers.length ? markers[i + 1]!.start : output.length;
      let content = output.slice(contentStart, contentEnd).trim();
      content = content.replace(/^[*_]+\s*/, "");
      content = content.replace(/\s*[*_]+$/, "");
      if (!(marker.key in result)) {
        result[marker.key] = content;
      }
    }

    // Fallback: single output field with no match
    const outputKeys = outputs.map(([k]) => k);
    const [singleKey] = outputKeys;
    if (outputKeys.length === 1 && singleKey !== undefined && !(singleKey in result)) {
      result[singleKey] = output.trim();
    }

    return result;
  }
}
