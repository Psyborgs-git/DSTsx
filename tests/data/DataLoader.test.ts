import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DataLoader } from "../../src/data/DataLoader.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const TMP_DIR = "/tmp/dstsx-test-data";

describe("DataLoader", () => {
  const loader = new DataLoader();

  beforeEach(() => {
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("fromArray creates Examples from records", () => {
    const records = [
      { question: "What is 2+2?", answer: "4" },
      { question: "Capital of France?", answer: "Paris" },
    ];
    const examples = loader.fromArray(records, ["question"]);
    expect(examples).toHaveLength(2);
    expect(examples[0]!.get("question")).toBe("What is 2+2?");
  });

  it("fromCSV loads from CSV file", () => {
    const csvPath = join(TMP_DIR, "test.csv");
    writeFileSync(csvPath, "question,answer\nWhat is 1+1?,2\nWhat is 2+2?,4\n");

    const examples = loader.fromCSV(csvPath);
    expect(examples).toHaveLength(2);
    expect(examples[0]!.get("question")).toBe("What is 1+1?");
    expect(examples[0]!.get("answer")).toBe("2");
  });

  it("fromJSON loads from JSON file", () => {
    const jsonPath = join(TMP_DIR, "test.json");
    writeFileSync(jsonPath, JSON.stringify([
      { question: "q1", answer: "a1" },
      { question: "q2", answer: "a2" },
    ]));

    const examples = loader.fromJSON(jsonPath);
    expect(examples).toHaveLength(2);
  });
});
