# Signatures

Signatures declare the **typed input/output interface** for a single LM call.

---

## `Signature.from(shorthand, instructions?)`

Parse a shorthand string. Use `->` to separate inputs from outputs; suffix `?` for optional fields.

```ts
import { Signature } from "dstsx";

// Simple shorthand
const sig = Signature.from("question -> answer");

// Multiple fields, optional field, instructions
const sig2 = Signature.from(
  "context, question -> answer, confidence?",
  "Answer based only on the provided context."
);
```

---

## `new Signature(meta)`

Construct a signature explicitly with full field metadata.

```ts
import { Signature, InputField, OutputField } from "dstsx";

const sig = new Signature({
  inputs: new Map([
    ["context",  InputField({ description: "Background passages" })],
    ["question", InputField({ description: "The question to answer" })],
  ]),
  outputs: new Map([
    ["answer", OutputField({ description: "Concise factual answer", type: "string" })],
  ]),
  instructions: "Answer using only the context provided.",
});
```

---

## `InputField(meta?)` / `OutputField(meta?)`

Builder helpers that return a `FieldMeta` descriptor.

```ts
import { InputField, OutputField } from "dstsx";

const field = InputField({
  description: "The user's question",
  prefix:   "Q:",          // optional prompt prefix
  format:   "markdown",    // optional format hint
  optional: true,          // field may be absent
  type:     "string",      // "string" | "number" | "boolean" | "string[]" | "object"
});
```

---

## `FieldMeta` interface

```ts
interface FieldMeta {
  description?: string;
  prefix?:      string;
  format?:      string;
  optional?:    boolean;
  type?:        "string" | "number" | "boolean" | "string[]" | "object";
}
```

---

## Signature mutation helpers

All helpers return a **new** `Signature`; the original is never mutated.

```ts
const base = Signature.from("question -> answer");

// Override instructions
const extended = base.with({ instructions: "Be concise." });

// Add a single input field
const withCtx = base.withInput("context", { description: "Background text" });

// Add a single output field
const withConf = base.withOutput("confidence", { type: "number" });
```

---

## Serialization

```ts
const json = sig.toJSON();             // → plain object
const sig2 = Signature.fromJSON(json); // → Signature
```

---

## `SignatureMeta` interface

```ts
interface SignatureMeta {
  inputs:        Map<string, FieldMeta>;
  outputs:       Map<string, FieldMeta>;
  instructions?: string;
}
```
