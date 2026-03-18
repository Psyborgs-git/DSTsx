# End-to-End Examples

---

## 1. Simple Q&A

```ts
import { settings, OpenAI, Predict } from "dstsx";

settings.configure({ lm: new OpenAI({ model: "gpt-4o-mini" }) });

const qa = new Predict("question -> answer");
const result = await qa.forward({ question: "What is the speed of light?" });
console.log(result.get("answer"));
```

---

## 2. Retrieval-Augmented Generation (RAG)

```ts
import {
  Module, Retrieve, ChainOfThought, ColBERTv2,
  settings, OpenAI, type Prediction,
} from "dstsx";

settings.configure({
  lm: new OpenAI({ model: "gpt-4o" }),
  rm: new ColBERTv2("http://localhost:8893"),
});

class RAG extends Module {
  retrieve = new Retrieve(3);
  generate = new ChainOfThought("context, question -> answer");

  async forward(inputs: { question: string }): Promise<Prediction> {
    const { passages } = (await this.retrieve.forward(inputs.question)).toDict() as { passages: string[] };
    return this.generate.forward({
      context:  passages.join("\n"),
      question: inputs.question,
    });
  }
}

const rag = new RAG();
const result = await rag.forward({ question: "What is the capital of Germany?" });
console.log(result.get("answer")); // "Berlin"
```

---

## 3. Optimizing with BootstrapFewShot

```ts
import {
  settings, MockLM, Predict, Module, BootstrapFewShot,
  Example, evaluate, exactMatch, type Prediction,
} from "dstsx";

settings.configure({ lm: new MockLM({}, "answer: 42") });

class QA extends Module {
  predict = new Predict("question -> answer");
  async forward(inputs: { question: string }): Promise<Prediction> {
    return this.predict.forward(inputs);
  }
}

const trainset = [
  new Example({ question: "What is 6 × 7?", answer: "42" }),
  new Example({ question: "What is 8 × 8?", answer: "64" }),
];

const optimizer = new BootstrapFewShot({ maxBootstrappedDemos: 2 });
const optimized  = await optimizer.compile(new QA(), trainset, exactMatch("answer"));

// Persist
import { writeFileSync } from "fs";
writeFileSync("qa_optimized.json", JSON.stringify(optimized.dump(), null, 2));
```

---

## 4. ReAct Agent

```ts
import { settings, OpenAI, ReAct, type Tool } from "dstsx";

settings.configure({ lm: new OpenAI({ model: "gpt-4o" }) });

const tools: Tool[] = [
  {
    name:        "calculator",
    description: "Evaluates a mathematical expression and returns the numeric result",
    fn:          async (expr) => String(Function(`"use strict"; return (${expr})`)()),
  },
  {
    name:        "lookup",
    description: "Looks up a fact in the knowledge base",
    fn:          async (query) => `Fact about ${query}: (result from KB)`,
  },
];

const agent = new ReAct("question -> answer", tools, /* maxIter= */ 6);
const result = await agent.forward({ question: "What is (123 * 456) + 789?" });
console.log(result.get("answer"));
console.log(result.get("trajectory"));
```

---

## 5. Assertions with Retry

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

---

## 6. Per-Request LM Override (server environments)

```ts
import express from "express";
import { settings, OpenAI, Predict } from "dstsx";

const app     = express();
const qa      = new Predict("question -> answer");
const gpt4    = new OpenAI({ model: "gpt-4o" });
const gptMini = new OpenAI({ model: "gpt-4o-mini" });

settings.configure({ lm: gpt4 }); // global default

app.get("/fast", async (req, res) => {
  const result = await settings.context(
    { lm: gptMini },
    () => qa.forward({ question: req.query["q"] as string }),
  );
  res.json(result.toJSON());
});

app.listen(3000);
```

---

## 7. TypedPredictor with Zod Validation

```ts
import { z } from "zod";
import { TypedPredictor, settings, OpenAI } from "dstsx";

settings.configure({ lm: new OpenAI({ model: "gpt-4o" }) });

const AnswerSchema = z.object({
  answer:     z.string(),
  confidence: z.number().min(0).max(1),
});

const qa = new TypedPredictor("question -> answer", AnswerSchema, { maxRetries: 3 });
const result = await qa.forward({ question: "What is 2 + 2?" });

console.log(result.typed.answer);     // "4"
console.log(result.typed.confidence); // 0.99 (validated number)
```

---

## 8. Streaming Responses

```ts
import { settings, OpenAI, Predict } from "dstsx";

settings.configure({ lm: new OpenAI({ model: "gpt-4o" }) });

const writer = new Predict("topic -> essay");

for await (const chunk of writer.stream({ topic: "The future of AI" })) {
  process.stdout.write(chunk.delta);
  if (chunk.done) break;
}
```

---

## 9. Multi-modal Image Input

```ts
import { Image, Predict, settings, OpenAI } from "dstsx";

settings.configure({ lm: new OpenAI({ model: "gpt-4o" }) });

const captioner = new Predict("image, question -> caption");
const img = Image.fromURL("https://example.com/photo.jpg");

const result = await captioner.forward({
  image:    img,
  question: "What is in this image?",
});
console.log(result.get("caption"));
```

---

## 10. GRPO Optimizer with Tracking

```ts
import { GRPO, ConsoleTracker, settings, OpenAI, Predict, Module, exactMatch } from "dstsx";

settings.configure({ lm: new OpenAI({ model: "gpt-4o-mini" }) });

class QA extends Module {
  predict = new Predict("question -> answer");
  async forward(inputs: { question: string }) {
    return this.predict.forward(inputs);
  }
}

const optimizer = new GRPO({ numSteps: 10, groupSize: 4 });
const optimized = await optimizer.compile(new QA(), trainset, exactMatch("answer"));
```

---

## 11. MIPROv2 Optimizer

```ts
import {
  MIPROv2, settings, OpenAI, Predict, Module,
  Example, evaluate, exactMatch, type Prediction,
} from "dstsx";

settings.configure({ lm: new OpenAI({ model: "gpt-4o-mini" }) });

class QA extends Module {
  predict = new Predict("question -> answer");
  async forward(inputs: { question: string }): Promise<Prediction> {
    return this.predict.forward(inputs);
  }
}

const trainset = [
  new Example({ question: "What is 6 × 7?", answer: "42" }),
  new Example({ question: "What is 8 × 8?", answer: "64" }),
  new Example({ question: "What is 9 × 9?", answer: "81" }),
];

// "medium" preset: 10 candidates, 25 Bayesian trials
const optimizer = new MIPROv2({ auto: "medium", verbose: true });
const optimized = await optimizer.compile(new QA(), trainset, exactMatch("answer"));

const score = await evaluate(optimized, trainset, exactMatch("answer"));
console.log(`Score: ${(score.score * 100).toFixed(1)}%`);
```

---

## 12. CodeAct Agent

```ts
import { CodeAct, settings, OpenAI, type Tool } from "dstsx";

settings.configure({ lm: new OpenAI({ model: "gpt-4o" }) });

const tools: Tool[] = [
  {
    name:        "fetchJSON",
    description: "Fetch JSON from a URL and return it as a string",
    fn:          async (url: string) =>
      JSON.stringify(await fetch(url).then((r) => r.json())),
  },
];

const agent = new CodeAct("task -> answer", tools, /* maxIter= */ 5);
const result = await agent.forward({ task: "Compute the 15th Fibonacci number." });
console.log(result.get("answer"));
console.log(result.get("trajectory")); // full execution history
```

---

## 13. SemanticF1 Metric for RAG Evaluation

```ts
import {
  SemanticF1, evaluate, settings, OpenAI,
  Module, Retrieve, ChainOfThought, ColBERTv2, type Prediction,
} from "dstsx";

settings.configure({
  lm: new OpenAI({ model: "gpt-4o" }),
  rm: new ColBERTv2("http://localhost:8893"),
});

class RAG extends Module {
  retrieve = new Retrieve(3);
  generate = new ChainOfThought("context, question -> answer");

  async forward(inputs: { question: string }): Promise<Prediction> {
    const { passages } = (await this.retrieve.forward(inputs.question)).toDict() as { passages: string[] };
    return this.generate.forward({ context: passages.join("\n"), question: inputs.question });
  }
}

const rag = new RAG();
const sf1 = new SemanticF1({ threshold: 0.5 });

const result = await evaluate(rag, devset, sf1.asMetricFn());
console.log(`SemanticF1: ${(result.score * 100).toFixed(1)}%`);
```

---

## 14. Loading Data with DataLoader

```ts
import {
  DataLoader, BootstrapFewShot, exactMatch,
  settings, OpenAI, Predict, Module, type Prediction,
} from "dstsx";

settings.configure({ lm: new OpenAI({ model: "gpt-4o-mini" }) });

class QA extends Module {
  predict = new Predict("question -> answer");
  async forward(inputs: { question: string }): Promise<Prediction> {
    return this.predict.forward(inputs);
  }
}

const loader   = new DataLoader();
const trainset = loader.fromCSV("./data/train.csv");
const valset   = loader.fromCSV("./data/val.csv");

console.log(`Loaded ${trainset.length} training examples`);

const optimizer = new BootstrapFewShot({ maxBootstrappedDemos: 4 });
const optimized = await optimizer.compile(new QA(), trainset, exactMatch("answer"));
```
