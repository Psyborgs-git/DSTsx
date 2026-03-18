# Data

Utilities for loading training and evaluation data from various sources.

---

## `DataLoader`

Load structured data from CSV files, JSON files, or plain arrays and convert them to `Example[]`.

```ts
import { DataLoader } from "dstsx";

const loader = new DataLoader();
```

---

### `loader.fromCSV(path, opts?)`

Parse a CSV file into `Example[]`. The first row is treated as the header.

```ts
const examples = loader.fromCSV("./data/train.csv");
// Each row becomes an Example with the column headers as keys

// Custom delimiter and subset of input keys
const examples2 = loader.fromCSV("./data/train.tsv", {
  delimiter:  "\t",
  inputKeys:  ["question"], // only these keys are marked as inputs (optional)
});
```

---

### `loader.fromJSON(path)`

Parse a JSON file containing an array of objects.

```ts
const examples = loader.fromJSON("./data/train.json");
// Expects: [{ "question": "...", "answer": "..." }, ...]
```

---

### `loader.fromArray(records)`

Convert an array of plain objects to `Example[]`.

```ts
const examples = loader.fromArray([
  { question: "What is 2+2?", answer: "4" },
  { question: "What is the capital of France?", answer: "Paris" },
]);

// Use with any optimizer
const optimizer = new BootstrapFewShot({ maxBootstrappedDemos: 4 });
const optimized = await optimizer.compile(program, examples, exactMatch("answer"));
```

---

## Full Example

```ts
import { DataLoader, BootstrapFewShot, exactMatch } from "dstsx";

const loader = new DataLoader();

const trainset = loader.fromCSV("./data/train.csv");
const valset   = loader.fromCSV("./data/val.csv");

console.log(`Loaded ${trainset.length} training examples`);
console.log(`First example:`, trainset[0]?.toDict());

const optimizer = new BootstrapFewShot({ maxBootstrappedDemos: 4 });
const optimized = await optimizer.compile(program, trainset, exactMatch("answer"));
```
