import { describe, it, expect, beforeEach } from "vitest";
import { NativeReAct } from "../../src/modules/NativeReAct.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { settings } from "../../src/settings/Settings.js";
import type { Tool } from "../../src/modules/ReAct.js";

describe("NativeReAct", () => {
  beforeEach(() => settings.reset());

  it("throws when no LM is configured", async () => {
    const agent = new NativeReAct("question -> answer", []);
    await expect(agent.forward({ question: "q" })).rejects.toThrow(/No LM configured/);
  });

  it("returns a Prediction when LM returns text (no tool calls)", async () => {
    settings.configure({ lm: new MockLM({}, "Paris") });
    const agent = new NativeReAct("question -> answer", []);
    const result = await agent.forward({ question: "Capital of France?" });
    expect(result.get("answer")).toBe("Paris");
  });

  it("uses tools when LM raw response contains tool_calls", async () => {
    const mockTool: Tool = {
      name: "lookup",
      description: "Look up a fact",
      fn: async (_args: string) => "The answer is 42",
    };

    // MockLM with raw response containing tool_calls
    class ToolCallLM extends MockLM {
      #called = false;
      protected override async _call(prompt: unknown, config: unknown): Promise<import("../../src/lm/types.js").LMResponse> {
        if (!this.#called) {
          this.#called = true;
          return {
            text: "",
            texts: [""],
            usage: null,
            raw: {
              choices: [{
                message: {
                  tool_calls: [{ function: { name: "lookup", arguments: "test query" } }],
                },
                finish_reason: "tool_calls",
              }],
            },
          };
        }
        return { text: "The answer is 42", texts: ["The answer is 42"], usage: null, raw: null };
      }
    }

    settings.configure({ lm: new ToolCallLM() });
    const agent = new NativeReAct("question -> answer", [mockTool], 3);
    const result = await agent.forward({ question: "What is the answer?" });
    expect(result.get("answer")).toBe("The answer is 42");
  });

  it("has tools and maxIter properties", () => {
    const tools: Tool[] = [{ name: "search", description: "Search", fn: async (a) => a }];
    const agent = new NativeReAct("question -> answer", tools, 3);
    expect(agent.maxIter).toBe(3);
    expect(agent.tools.has("search")).toBe(true);
  });
});
