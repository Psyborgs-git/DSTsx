# Retrievers

All retrievers extend `Retriever` and implement `retrieve(query, k)`.

---

## Abstract `Retriever`

```ts
abstract class Retriever {
  abstract retrieve(query: string, k: number): Promise<string[]>;
}
```

---

## `ColBERTv2`

```ts
import { ColBERTv2 } from "dstsx";

const rm = new ColBERTv2("http://localhost:8893");
// or with options:
const rm2 = new ColBERTv2({ url: "http://localhost:8893" });

const passages = await rm.retrieve("What is photosynthesis?", 3);
```

---

## `PineconeRM`

Requires: `npm install @pinecone-database/pinecone`

```ts
import { PineconeRM } from "dstsx";

const rm = new PineconeRM({
  indexName:   "my-index",
  apiKey:      "...",      // or PINECONE_API_KEY
  namespace:   "default",
  embeddingFn: async (text) => myEmbedModel.embed(text),
});
```

---

## `ChromadbRM`

Requires: `npm install chromadb`

```ts
import { ChromadbRM } from "dstsx";

const rm = new ChromadbRM({
  collectionName: "my-collection",
  url:            "http://localhost:8000", // default
  embeddingFn:    async (texts) => myEmbedModel.embedBatch(texts),
});
```

---

## `QdrantRM`

Requires: `npm install @qdrant/js-client-rest`

```ts
import { QdrantRM } from "dstsx";

const rm = new QdrantRM({
  url:            "http://localhost:6333",
  collectionName: "my-collection",
  embeddingFn:    async (text) => myEmbedModel.embed(text),
});
```

---

## `WeaviateRM`

Requires: `npm install weaviate-client`

```ts
import { WeaviateRM } from "dstsx";

const rm = new WeaviateRM({
  url:         "http://localhost:8080",
  className:   "Document",
  textField:   "content",
  embeddingFn: async (text) => myEmbedModel.embed(text),
});
```

---

## `FaissRM`

Requires: `npm install faiss-node`

```ts
import { FaissRM } from "dstsx";

const rm = new FaissRM({
  passages:    ["passage 1", "passage 2"],
  embeddingFn: async (text) => myEmbedModel.embed(text),
});
```

---

## `YouRM`

```ts
import { YouRM } from "dstsx";

const rm = new YouRM({
  apiKey: "...", // or YDC_API_KEY
  k:      3,
});
```

---

## `MockRetriever`

For unit testing.

```ts
import { MockRetriever } from "dstsx";

const rm = new MockRetriever([
  "The capital of France is Paris.",
  "Paris is located in northern France.",
  "France is a country in Western Europe.",
]);

const passages = await rm.retrieve("capital of France", 2);
```

---

## Using a Retriever in a RAG Pipeline

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
