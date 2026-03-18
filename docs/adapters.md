# Adapters

Adapters control how a `Signature`, few-shot `demos`, and runtime `inputs` are formatted into LM messages and how the raw LM output string is parsed back into typed field values.

All adapters extend the abstract `Adapter` base class and can be set globally via `settings.configure({ adapter })` or per-request via `settings.context({ adapter }, fn)`.

---

## Abstract `Adapter`

```ts
abstract class Adapter {
  /** Convert a signature + demos + inputs into LM-ready messages. */
  abstract format(
    sig:    Signature,
    demos:  Example[],
    inputs: Record<string, unknown>,
  ): Message[];

  /** Parse raw LM output string into typed field values. */
  abstract parse(
    sig:    Signature,
    output: string,
  ): Record<string, unknown>;
}
```

---

## `ChatAdapter`

The default prompt adapter. Formats inputs as OpenAI-style chat turns (`system` / `user` / `assistant`).

```ts
import { ChatAdapter, settings } from "dstsx";

// Use ChatAdapter globally (this is the default)
settings.configure({ adapter: new ChatAdapter() });
```

**Behavior:**
- System message: signature `instructions` (if any)
- Demo turns: each demo becomes a `user`/`assistant` message pair
- Current input: final `user` message with field prefixes (`field: value`)
- Output parsing: looks for `field: value` patterns in the LM response

---

## `JSONAdapter`

Instructs the LM to respond with a JSON object matching the output field schema. Used internally by `TypedPredictor`.

```ts
import { JSONAdapter, settings } from "dstsx";

settings.configure({ adapter: new JSONAdapter() });
```

**Behavior:**
- System message: signature instructions + JSON schema description
- Demo turns: user message with input fields; assistant message is a JSON object of output fields
- Current input: final `user` message
- Output parsing: parses JSON from the LM response and maps fields

```ts
// Example — JSONAdapter forces structured output
import { JSONAdapter, Predict, settings, MockLM } from "dstsx";

settings.configure({
  lm:      new MockLM({}, '{"answer": "Paris"}'),
  adapter: new JSONAdapter(),
});

const qa = new Predict("question -> answer");
const result = await qa.forward({ question: "What is the capital of France?" });
console.log(result.get("answer")); // "Paris"
```

---

## `TwoStepAdapter`

Generates a free-text response first, then extracts the structured output fields in a second parsing step. Useful when the LM struggles to produce structured output directly.

```ts
import { TwoStepAdapter, settings } from "dstsx";

settings.configure({ adapter: new TwoStepAdapter() });
```

**Behavior:**
- Step 1 (`format`): uses `ChatAdapter`-style formatting for the initial generation
- Step 2 (`parse`): tries `ChatAdapter`-style field extraction; falls back to using the full output text for single-output signatures

---

## Choosing an Adapter

| Adapter | Best for |
|---|---|
| `ChatAdapter` (default) | General text generation, most LMs |
| `JSONAdapter` | Structured outputs, `TypedPredictor`, tool use |
| `TwoStepAdapter` | LMs that struggle with field-delimited output |

You can also implement a custom adapter by extending `Adapter`:

```ts
import { Adapter } from "dstsx";
import type { Signature, Example, Message } from "dstsx";

class MyAdapter extends Adapter {
  format(sig: Signature, demos: Example[], inputs: Record<string, unknown>): Message[] {
    // custom formatting logic
    return [{ role: "user", content: JSON.stringify(inputs) }];
  }

  parse(sig: Signature, output: string): Record<string, unknown> {
    // custom parsing logic
    return JSON.parse(output) as Record<string, unknown>;
  }
}

settings.configure({ adapter: new MyAdapter() });
```
