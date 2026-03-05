# Assertions & Suggestions

---

## `Assert(condition, message?)`

Throws `AssertionError` if `condition` is falsy. Caught and retried by `Retry`.

```ts
import { Assert } from "dstsx";

Assert(result.get("answer") !== "", "Answer must not be empty");
Assert(typeof result.get("score") === "number", "Score must be a number");
```

---

## `Suggest(condition, message?)`

Logs a `console.warn` if `condition` is falsy but does **not** throw — the pipeline continues.

```ts
import { Suggest } from "dstsx";

Suggest(result.get("confidence") === "high", "Low confidence in answer");
```

---

## `AssertionError`

The typed error class thrown by `Assert`. Caught by `Retry`.

```ts
import { AssertionError } from "dstsx";

try {
  await program.forward(inputs);
} catch (err) {
  if (err instanceof AssertionError) {
    console.warn("Assertion failed:", err.message);
  }
}
```

---

## Assertion + Retry Pattern

Use `Assert` inside a custom `Module` and wrap it with `Retry` to automatically re-prompt on failure:

```ts
import {
  settings, MockLM, Module, Predict, Retry, Assert, type Prediction,
} from "dstsx";

settings.configure({ lm: new MockLM({}, "answer: Paris") });

class CapitalQA extends Module {
  predict = new Predict("question, feedback? -> answer");

  async forward(inputs: { question: string }): Promise<Prediction> {
    const result = await this.predict.forward(inputs);
    Assert(
      String(result.get("answer")).trim().length > 0,
      "Answer must not be empty"
    );
    return result;
  }
}

const retrying = new Retry(new CapitalQA(), 3);
const result   = await retrying.forward({ question: "What is the capital of France?" });
console.log(result.get("answer")); // "Paris"
```

`Retry` catches `AssertionError`, injects the error message as `feedback` into the next forward call, and retries up to `maxAttempts` times.
