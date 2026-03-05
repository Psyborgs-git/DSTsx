# Experiment Tracking

Track optimizer progress (steps, scores, best candidates) to console, JSON files, or custom backends.

---

## `ConsoleTracker`

Logs events to the console.

```ts
import { ConsoleTracker } from "dstsx";

const tracker = new ConsoleTracker();
// Logs:
// [STEP] step=1 score=0.7500
// [BEST] step=3 score=0.8750
```

---

## `JsonFileTracker`

Appends events to a JSONL file.

```ts
import { JsonFileTracker } from "dstsx";

const tracker = new JsonFileTracker("./runs/exp1.jsonl");
await tracker.flush(); // flush buffer to disk
```

---

## Using Trackers with Optimizers

Trackers are accepted as options on `GRPO`, `SIMBA`, and `AvatarOptimizer`.

```ts
import { GRPO, ConsoleTracker, JsonFileTracker } from "dstsx";

const optimizer = new GRPO({
  numSteps: 10,
  // tracker option (if supported by the optimizer)
});
```

---

## Custom `Tracker`

Extend the abstract `Tracker` class to send events to any backend (MLflow, W&B, etc.).

```ts
import { Tracker } from "dstsx";
import type { TrackerEvent } from "dstsx";

class MLflowTracker extends Tracker {
  log(event: TrackerEvent): void {
    // Send to MLflow REST API, W&B, etc.
    console.log("mlflow.log_metric", event.score);
  }
  async flush(): Promise<void> {}
}
```

---

## `TrackerEvent` type

```ts
interface TrackerEvent {
  type:      "step" | "trial" | "best" | "done";
  step?:     number;
  score?:    number;
  metadata?: Record<string, unknown>;
}
```

---

## Exported classes

| Export | Description |
|---|---|
| `Tracker` | Abstract base class |
| `ConsoleTracker` | Logs to `console.log` |
| `JsonFileTracker` | Appends to a JSONL file |
