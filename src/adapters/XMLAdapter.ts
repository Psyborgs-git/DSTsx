import { Adapter } from "./Adapter.js";
import type { Signature } from "../signatures/index.js";
import type { Example } from "../primitives/index.js";
import type { Message } from "../lm/types.js";

/**
 * Adapter that instructs the LM to respond with XML-formatted output.
 *
 * Each output field is wrapped in a `<fieldName>value</fieldName>` tag.
 * Mirrors `dspy.XMLAdapter` in Python.
 *
 * @example
 * ```ts
 * settings.configure({ adapter: new XMLAdapter() });
 *
 * const pred = new Predict("question -> answer, explanation");
 * // LM will return:
 * // <answer>Paris</answer>
 * // <explanation>France's capital city...</explanation>
 * ```
 */
export class XMLAdapter extends Adapter {
  format(sig: Signature, demos: Example[], inputs: Record<string, unknown>): Message[] {
    const messages: Message[] = [];

    // Build XML schema description
    const fieldList = [...sig.outputs.keys()]
      .map((name) => `  <${name}>...</${name}>`)
      .join("\n");
    const schemaBlock = `<response>\n${fieldList}\n</response>`;

    const systemParts: string[] = [];
    if (sig.instructions) {
      systemParts.push(sig.instructions);
    }
    systemParts.push(
      `\nRespond ONLY with a valid XML block matching this structure (no markdown, no extra text):\n${schemaBlock}`,
    );
    messages.push({ role: "system", content: systemParts.join("\n") });

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

      // Assistant response in XML
      let xmlResponse = "<response>\n";
      for (const [name] of sig.outputs) {
        const val = this.#escapeXml(String(data[name] ?? ""));
        xmlResponse += `  <${name}>${val}</${name}>\n`;
      }
      xmlResponse += "</response>";
      messages.push({ role: "assistant", content: xmlResponse });
    }

    // Current inputs
    const inputParts: string[] = [];
    for (const [name, meta] of sig.inputs) {
      const label = meta.prefix ?? `${name}:`;
      const prefix = label.endsWith(":") ? label : `${label}:`;
      inputParts.push(`${prefix} ${String(inputs[name] ?? "")}`);
    }
    messages.push({ role: "user", content: inputParts.join("\n") });

    return messages;
  }

  parse(sig: Signature, output: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [name] of sig.outputs) {
      // Match both self-closing and regular tags, greedy or non-greedy content
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const tagRegex = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i");
      const match = tagRegex.exec(output);
      if (match) {
        result[name] = this.#unescapeXml(match[1]?.trim() ?? "");
      }
    }

    // Fallback: if single output and nothing matched, use full trimmed text
    const outputKeys = [...sig.outputs.keys()];
    const [singleKey] = outputKeys;
    if (outputKeys.length === 1 && singleKey !== undefined && !(singleKey in result)) {
      result[singleKey] = output.trim();
    }

    return result;
  }

  #escapeXml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  #unescapeXml(text: string): string {
    return text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }
}
