import { describe, it, expect, beforeEach } from "vitest";
import { LM } from "../../src/lm/LM.js";
import { lmFrom } from "../../src/lm/factory.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { OpenAI } from "../../src/lm/adapters/OpenAI.js";
import { Anthropic } from "../../src/lm/adapters/Anthropic.js";
import { Ollama } from "../../src/lm/adapters/Ollama.js";
import { Groq } from "../../src/lm/adapters/Groq.js";
import { TogetherAI } from "../../src/lm/adapters/TogetherAI.js";
import { AzureOpenAI } from "../../src/lm/adapters/AzureOpenAI.js";

// Importing factory triggers provider registration side-effects
import "../../src/lm/factory.js";

describe("LM.registerProvider / LM.from", () => {
  beforeEach(() => {
    // Register a mock provider for tests
    LM.registerProvider("mock", (_model, _opts) => new MockLM(["test response"]));
  });

  it("LM.from() returns a MockLM for the mock provider", () => {
    const lm = LM.from("mock/any-model");
    expect(lm).toBeInstanceOf(MockLM);
  });

  it("LM.from() returns an OpenAI instance for openai/ prefix", () => {
    const lm = LM.from("openai/gpt-4o");
    expect(lm).toBeInstanceOf(OpenAI);
    expect(lm.model).toBe("gpt-4o");
  });

  it("LM.from() returns an Anthropic instance for anthropic/ prefix", () => {
    const lm = LM.from("anthropic/claude-3-5-sonnet-20241022");
    expect(lm).toBeInstanceOf(Anthropic);
    expect(lm.model).toBe("claude-3-5-sonnet-20241022");
  });

  it("LM.from() returns an Ollama instance for ollama/ prefix", () => {
    const lm = LM.from("ollama/llama3");
    expect(lm).toBeInstanceOf(Ollama);
    expect(lm.model).toBe("llama3");
  });

  it("LM.from() returns a Groq instance for groq/ prefix", () => {
    const lm = LM.from("groq/llama-3.1-70b-versatile");
    expect(lm).toBeInstanceOf(Groq);
    expect(lm.model).toBe("llama-3.1-70b-versatile");
  });

  it("LM.from() returns a TogetherAI instance for together/ prefix", () => {
    const lm = LM.from("together/meta-llama/Llama-3-70b-chat-hf");
    expect(lm).toBeInstanceOf(TogetherAI);
  });

  it("LM.from() returns an AzureOpenAI instance for azure/ prefix", () => {
    const lm = LM.from("azure/gpt-4o");
    expect(lm).toBeInstanceOf(AzureOpenAI);
  });

  it("LM.from() throws for unknown provider", () => {
    expect(() => LM.from("unknown_provider_xyz/model")).toThrow(/Unknown LM provider/);
  });

  it("LM.from() passes options to the provider", () => {
    const lm = LM.from("openai/gpt-4o-mini", { apiKey: "test-key" });
    expect(lm).toBeInstanceOf(OpenAI);
    expect(lm.model).toBe("gpt-4o-mini");
  });

  it("LM.from() supports gemini/ as an alias for google/", () => {
    const lm = LM.from("gemini/gemini-pro");
    expect(lm.model).toBe("gemini-pro");
  });
});

describe("lmFrom()", () => {
  it("lmFrom is a convenience alias for LM.from", () => {
    const lm = lmFrom("openai/gpt-4o");
    expect(lm).toBeInstanceOf(OpenAI);
  });

  it("lmFrom accepts options", () => {
    const lm = lmFrom("groq/llama-3.1-70b-versatile", { apiKey: "test" });
    expect(lm).toBeInstanceOf(Groq);
  });
});

describe("Groq adapter", () => {
  it("constructs with default model", () => {
    const lm = new Groq();
    expect(lm.model).toBe("llama-3.1-70b-versatile");
  });

  it("constructs with custom model", () => {
    const lm = new Groq({ model: "mixtral-8x7b-32768" });
    expect(lm.model).toBe("mixtral-8x7b-32768");
  });
});

describe("TogetherAI adapter", () => {
  it("constructs with default model", () => {
    const lm = new TogetherAI();
    expect(lm.model).toBe("meta-llama/Llama-3-70b-chat-hf");
  });

  it("constructs with custom model", () => {
    const lm = new TogetherAI({ model: "mistralai/Mixtral-8x7B-Instruct-v0.1" });
    expect(lm.model).toBe("mistralai/Mixtral-8x7B-Instruct-v0.1");
  });
});

describe("AzureOpenAI adapter", () => {
  it("constructs with default deployment", () => {
    const lm = new AzureOpenAI();
    expect(lm.model).toBe("gpt-4o");
  });

  it("constructs with custom deployment name", () => {
    const lm = new AzureOpenAI({ deploymentName: "my-gpt4o" });
    expect(lm.model).toBe("my-gpt4o");
  });
});
