import { readFileSync } from "node:fs";
import { Example } from "../primitives/index.js";

/**
 * Utility to load training/evaluation data from various sources.
 * Mirrors `dspy.DataLoader`.
 */
export class DataLoader {
  /** Load examples from a CSV file. */
  fromCSV(
    path: string,
    opts?: { inputKeys?: string[]; delimiter?: string },
  ): Example[] {
    const delimiter = opts?.delimiter ?? ",";
    const content = readFileSync(path, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = lines[0]!.split(delimiter).map((h) => h.trim());
    const examples: Example[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i]!.split(delimiter).map((v) => v.trim());
      const record: Record<string, unknown> = {};
      for (let j = 0; j < headers.length; j++) {
        record[headers[j]!] = values[j] ?? "";
      }
      examples.push(new Example(record));
    }
    return examples;
  }

  /** Load examples from a JSON file (array of objects). */
  fromJSON(path: string): Example[] {
    const content = readFileSync(path, "utf-8");
    const data = JSON.parse(content) as Record<string, unknown>[];
    return this.fromArray(data);
  }

  /** Convert an array of records to Examples. */
  fromArray(records: Record<string, unknown>[]): Example[] {
    return records.map((record) => new Example(record));
  }
}
