import { describe, it, expect, vi } from "vitest";

const mockChatCompletionsCreate = vi.fn();

vi.mock("openai", () => {
  return {
    default: class OpenAIClient {
      chat = {
        completions: {
          create: mockChatCompletionsCreate,
        }
      };
    },
  };
});

import { OpenAI } from "../../src/lm/adapters/OpenAI.js";

describe("OpenAI Adapter", () => {
  it("translates cached_tokens usage correctly", async () => {
    mockChatCompletionsCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "Response" } }],
      usage: { 
        prompt_tokens: 50, 
        completion_tokens: 10, 
        total_tokens: 60,
        prompt_tokens_details: {
          cached_tokens: 30
        }
      },
    });

    const openai = new OpenAI({ model: "gpt-4o" });
    const response = await openai.call([{ role: "user", content: "Hi" }]);

    expect(response.text).toBe("Response");
    expect(response.usage).toEqual(expect.objectContaining({
      promptTokens: 50,
      completionTokens: 10,
      totalTokens: 60,
      cachedPromptTokens: 30,
    }));
  });
});
