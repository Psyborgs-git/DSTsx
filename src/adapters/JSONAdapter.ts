import { Adapter } from "./Adapter.js";
import type { Signature } from "../signatures/index.js";
import type { Example } from "../primitives/index.js";
import type { Message } from "../lm/types.js";

/**
 * Adapter that instructs the LM to respond with a JSON object
 * matching the output field schema.
 * Mirrors `dspy.JSONAdapter`.
 */
export class JSONAdapter extends Adapter {
  format(sig: Signature, demos: Example[], inputs: Record<string, unknown>): Message[] {
    const messages: Message[] = [];

    // Build JSON schema description of output fields
    const schemaFields: Record<string, string> = {};
    for (const [name, meta] of sig.outputs) {
      schemaFields[name] = meta.type ?? "string";
    }
    const schemaStr = JSON.stringify(schemaFields, null, 2);

    const systemParts: string[] = [];
    if (sig.instructions) {
      systemParts.push(sig.instructions);
    }
    systemParts.push(
      `\nRespond ONLY with a JSON object matching this schema:\n${schemaStr}\nDo not include any other text, markdown fences, or explanation.`,
    );
    messages.push({ role: "system", content: systemParts.join("\n") });

    // Demo turns as JSON examples
    for (const demo of demos) {
      const data = demo.toDict();
      const userParts: string[] = [];
      for (const [name, meta] of sig.inputs) {
        const label = meta.prefix ?? `${name}:`;
        const prefix = label.endsWith(":") ? label : `${label}:`;
        userParts.push(`${prefix} ${String(data[name] ?? "")}`);
      }
      messages.push({ role: "user", content: userParts.join("\n") });

      const outputObj: Record<string, unknown> = {};
      for (const [name] of sig.outputs) {
        outputObj[name] = data[name] ?? "";
      }
      messages.push({ role: "assistant", content: JSON.stringify(outputObj) });
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
    let text = output.trim();
    // Strip markdown code fences
    const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/m.exec(text);
    if (fence) text = (fence[1] ?? "").trim();

    const parsed = JSON.parse(text) as Record<string, unknown>;

    // Ensure all output fields are present
    const result: Record<string, unknown> = {};
    for (const [name] of sig.outputs) {
      result[name] = parsed[name] ?? "";
    }
    return result;
  }
}
