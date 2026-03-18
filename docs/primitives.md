# Primitives — Example, Prediction, Trace, Image, Audio, History, Code, ToolCalls, majority()

---

## `Example`

Immutable record of named values used as training data or module inputs.

```ts
import { Example } from "dstsx";

const ex = new Example({ question: "What is 2+2?", answer: "4" });

ex.get("question");           // "What is 2+2?"
ex.toDict();                  // { question: "What is 2+2?", answer: "4" }
ex.toJSON();                  // same as toDict()

// Non-mutating copy with overrides
const updated = ex.with({ answer: "four" });

// Filtered views — inputs() keeps only specified keys; labels() keeps all OTHER keys
const inputOnly = ex.inputs(["question"]);  // Example { question: ... }
const labelOnly = ex.labels(["question"]);  // Example { answer: ... } (excludes "question")

// Deserialize
const ex2 = Example.fromDict({ question: "Hi", answer: "Hello" });
```

---

## `Prediction`

Extends `Example` and adds `completions` for multi-output calls (`n > 1`).

```ts
import { Prediction } from "dstsx";

const pred = new Prediction(
  { answer: "42" },
  [{ answer: "42" }, { answer: "forty-two" }],  // completions
);

pred.get("answer");              // "42"
pred.getTyped<string>("answer"); // "42" — typed cast
pred.completions;                // ReadonlyArray of all candidates
pred.toJSON();                   // { answer: "42", completions: [...] }
```

---

## `Trace`

Recorded per LM call. Accessible via module history (see Settings).

```ts
interface Trace {
  signature:  Signature;
  inputs:     Record<string, unknown>;
  outputs:    Record<string, unknown>;
  usage:      { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  latencyMs:  number;
  timestamp:  string; // ISO-8601
  reasoning?: string; // native reasoning tokens (o1/o3/DeepSeek-R1); undefined otherwise
}
```

### `TokenUsage`

```ts
interface TokenUsage {
  promptTokens:     number;
  completionTokens: number;
  totalTokens:      number;
}
```

---

## `Image` — Multi-modal Support

The `Image` primitive enables passing images to vision-capable LMs as field values in any `Predict` or `TypedPredictor` call.

```ts
import { Image, Predict, settings, OpenAI } from "dstsx";

settings.configure({ lm: new OpenAI({ model: "gpt-4o" }) });

const captioner = new Predict("image, question -> caption");

// From a URL (lazy — no download at construction time)
const img1 = Image.fromURL("https://example.com/photo.jpg");
const result1 = await captioner.forward({ image: img1, question: "Describe this image." });

// From base64 data
const img2 = Image.fromBase64(base64String, "image/png");

// From a local file (read synchronously)
const img3 = Image.fromFile("./photo.jpg");
```

### Static factory methods

| Method | Description |
|---|---|
| `Image.fromURL(url)` | Image at a remote URL |
| `Image.fromBase64(data, mimeType?)` | Inline base64 (default: `"image/jpeg"`) |
| `Image.fromFile(path, mimeType?)` | Local file read synchronously; auto-detects MIME from extension |

### Serialization helpers (used by adapters internally)

```ts
img.toOpenAIContentPart()     // { type: "image_url", image_url: { url } }
img.toAnthropicContentBlock() // { type: "image", source: { ... } }
img.toString()                // "[Image: https://...]" — used in text prompts
```

### `ImageMimeType`

Supported MIME types: `"image/jpeg"`, `"image/png"`, `"image/gif"`, `"image/webp"`

---

## `Audio` — Multi-modal Audio Support

The `Audio` primitive enables passing audio to audio-capable LMs as field values in any `Predict` call.

```ts
import { Audio, Predict, settings, OpenAI } from "dstsx";

settings.configure({ lm: new OpenAI({ model: "gpt-4o-audio-preview" }) });

const transcriber = new Predict("audio, prompt -> transcription");

// From a URL
const audio1 = Audio.fromURL("https://example.com/clip.mp3");

// From base64 data
const audio2 = Audio.fromBase64(base64String, "audio/wav");

// From a local file (read synchronously; MIME auto-detected from extension)
const audio3 = Audio.fromFile("./recording.mp3");
```

### Static factory methods

| Method | Description |
|---|---|
| `Audio.fromURL(url)` | Audio at a remote URL |
| `Audio.fromBase64(data, mimeType?)` | Inline base64 (default: `"audio/mpeg"`) |
| `Audio.fromFile(path, mimeType?)` | Local file read synchronously; auto-detects MIME from extension |

### Serialization helpers (used by adapters internally)

```ts
audio.toOpenAIContentPart()  // { type: "input_audio", input_audio: { data, format } }
audio.toString()             // "[Audio: https://...]" — used in text prompts
```

### `AudioMimeType`

Supported MIME types: `"audio/mpeg"`, `"audio/wav"`, `"audio/ogg"`, `"audio/webm"`

---

## `History` — Multi-turn Conversation Context

An immutable sequence of conversation turns. Pass as a field value to carry previous dialogue context into a `Predict` call.

```ts
import { History } from "dstsx";

let history = new History();
history = history.append("user", "What is the capital of France?");
history = history.append("assistant", "Paris.");
history = history.append("user", "And Germany?");

// Keep only the last 5 turns
const recent = history.truncate(5);

// Convert to LM message format
const messages = history.toMessages();
// [{ role: "user", content: "..." }, { role: "assistant", content: "..." }, ...]

// Serialization
const json = history.toJSON();
const restored = History.fromJSON(json);
```

### `Turn` interface

```ts
interface Turn {
  role:    "user" | "assistant" | "system";
  content: string;
}
```

---

## `Code` — Typed Code Primitive

A typed code value with language metadata. Returned by `ProgramOfThought` and `CodeAct`.

```ts
import { Code } from "dstsx";

const snippet = Code.from("const x = 1 + 2; return x;", "javascript");

snippet.value;    // "const x = 1 + 2; return x;"
snippet.language; // "javascript"
snippet.toString(); // same as .value
snippet.toJSON(); // { value: "...", language: "javascript" }
```

### Static factory

```ts
Code.from(value: string, language?: string): Code
// language defaults to "javascript"
```

---

## `ToolCalls` — Structured Tool Call Results

Records tool calls made by `ReAct` and `NativeReAct` agents. Populated automatically on the returned `Prediction` as `prediction.get("toolCalls")`.

```ts
import { ToolCalls } from "dstsx";

const calls = new ToolCalls([
  { name: "search", args: { query: "capital of France" }, result: "Paris", error: undefined },
  { name: "calculator", args: { expr: "2+2" }, result: 4, error: undefined },
]);

calls.calls;    // ReadonlyArray<ToolCallEntry>
calls.toJSON(); // ToolCallEntry[]

const restored = ToolCalls.fromJSON(calls.toJSON());
```

### `ToolCallEntry` interface

```ts
interface ToolCallEntry {
  name:    string;
  args:    Record<string, unknown>;
  result:  unknown;
  error?:  string;
}
```

---

## `majority()` Helper

Votes across multiple `Prediction` instances by the most common value for a given field. Useful as a `reduceFunc` in `BestOfN` and `Ensemble`.

```ts
import { majority, BestOfN, Predict } from "dstsx";

const qa = new Predict("question -> answer");

// Run 5 times and pick the most common answer
const voted = new BestOfN(qa, 5, majority("answer"));
const result = await voted.forward({ question: "What color is the sky?" });
console.log(result.get("answer")); // most frequently returned answer
```

```ts
// Standalone usage
import { majority } from "dstsx";

const reducer = majority("answer");
const best = reducer([pred1, pred2, pred3]); // Prediction with the most common "answer"
```
