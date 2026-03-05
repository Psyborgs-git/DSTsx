import { describe, it, expect, vi } from "vitest";

const mockMessagesCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class AnthropicClient {
      messages = {
        create: mockMessagesCreate,
      };
    },
  };
});

import { Anthropic } from "../../src/lm/adapters/Anthropic.js";

describe("Anthropic Adapter", () => {
  it("passes promptCaching blocks correctly for system prompt", async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Hello" }],
      usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 20 },
    });

    const anthropic = new Anthropic({ model: "claude-3-5-sonnet-20241022", promptCaching: true });
    
    // Simulate generic format from a Module
    const messages = [
      { role: "system" as const, content: "You are an agent." },
      { role: "user" as const, content: "What is 2+2?" }
    ];

    const response = await anthropic.call(messages);

    expect(response.text).toBe("Hello");
    expect(response.usage).toEqual(expect.objectContaining({
      promptTokens: 10,
      completionTokens: 5,
      cachedPromptTokens: 20,
    }));

    expect(mockMessagesCreate).toHaveBeenCalledWith(expect.objectContaining({
      system: [{
        type: "text",
        text: "You are an agent.",
        cache_control: { type: "ephemeral" }
      }],
      messages: [{ 
        role: "user", 
        content: [{
          type: "text",
          text: "What is 2+2?",
          cache_control: { type: "ephemeral" }
        }]
      }]
    }));
  });
});
