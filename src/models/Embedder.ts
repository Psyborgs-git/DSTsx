export interface EmbedderOptions {
  model: string;
  provider: "openai" | "cohere" | "huggingface" | "ollama" | "custom";
  apiKey?: string;
  baseURL?: string;
  batchSize?: number;
  cacheDir?: string;
  fn?: (texts: string[]) => Promise<number[][]>;
}

/**
 * First-class embedding model.
 * Mirrors `dspy.Embedder`.
 */
export class Embedder {
  readonly #opts: EmbedderOptions;
  readonly #batchSize: number;

  constructor(opts: EmbedderOptions) {
    this.#opts = opts;
    this.#batchSize = opts.batchSize ?? 100;
  }

  /** Embed a single text. */
  async embed(text: string): Promise<number[]> {
    const [result] = await this.embedBatch([text]);
    return result ?? [];
  }

  /** Embed a batch of texts. */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (this.#opts.provider === "custom" && this.#opts.fn) {
      return this.#opts.fn(texts);
    }

    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += this.#batchSize) {
      const batch = texts.slice(i, i + this.#batchSize);
      const batchResults = await this.#embedBatch(batch);
      results.push(...batchResults);
    }
    return results;
  }

  /** Clear cached embeddings. */
  clearCache(): void {
    // Cache clearing is a no-op for now — disk caching to be implemented
  }

  async #embedBatch(texts: string[]): Promise<number[][]> {
    switch (this.#opts.provider) {
      case "openai":
        return this.#embedOpenAI(texts);
      case "cohere":
        return this.#embedCohere(texts);
      case "ollama":
        return this.#embedOllama(texts);
      default:
        throw new Error(
          `Embedder: provider "${this.#opts.provider}" not supported or requires a custom fn`,
        );
    }
  }

  async #embedOpenAI(texts: string[]): Promise<number[][]> {
    const { default: Client } = await import("openai").catch(() => {
      throw new Error(
        "The `openai` package is required for OpenAI embeddings.",
      );
    });
    const client = new Client({
      apiKey: this.#opts.apiKey ?? process.env["OPENAI_API_KEY"],
      baseURL: this.#opts.baseURL,
    });
    const response = await (
      client as unknown as {
        embeddings: {
          create(opts: {
            model: string;
            input: string[];
          }): Promise<{ data: Array<{ embedding: number[] }> }>;
        };
      }
    ).embeddings.create({
      model: this.#opts.model,
      input: texts,
    });
    return response.data.map((d) => d.embedding);
  }

  async #embedCohere(texts: string[]): Promise<number[][]> {
    const { CohereClient } = await import("cohere-ai").catch(() => {
      throw new Error(
        "The `cohere-ai` package is required for Cohere embeddings.",
      );
    });
    const client = new CohereClient({
      token: this.#opts.apiKey ?? process.env["COHERE_API_KEY"],
    });
    const response = await (
      client as unknown as {
        embed(opts: {
          texts: string[];
          model: string;
        }): Promise<{ embeddings: number[][] }>;
      }
    ).embed({
      texts,
      model: this.#opts.model,
    });
    return response.embeddings ?? [];
  }

  async #embedOllama(texts: string[]): Promise<number[][]> {
    const baseURL = this.#opts.baseURL ?? "http://localhost:11434";
    const results: number[][] = [];
    for (const text of texts) {
      const response = await fetch(`${baseURL}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.#opts.model, prompt: text }),
      });
      const data = (await response.json()) as { embedding: number[] };
      results.push(data.embedding);
    }
    return results;
  }
}
