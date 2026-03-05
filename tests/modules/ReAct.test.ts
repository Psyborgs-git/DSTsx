import { describe, it, expect, beforeEach } from "vitest";
import { ReAct } from "../../src/modules/ReAct.js";
import type { Tool } from "../../src/modules/ReAct.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { settings } from "../../src/settings/Settings.js";

describe("ReAct", () => {
  beforeEach(() => settings.reset());

  const searchTool: Tool = {
    name: "search",
    description: "Searches the web for information",
    fn: async (args: string) => `Result for: ${args}`,
  };

  it("completes when LM emits Finish[answer]", async () => {
    settings.configure({
      lm: new MockLM({}, "Thought: I know this.\nFinish[42]"),
    });
    const react = new ReAct("question -> answer", [searchTool]);
    const result = await react.forward({ question: "What is 6*7?" });
    expect(result.get("answer")).toBe("42");
  });

  it("calls tools when LM emits Action: toolName[args]", async () => {
    let callCount = 0;
    const trackedTool: Tool = {
      name: "lookup",
      description: "Looks up a value",
      fn: async (args: string) => {
        callCount++;
        return `found: ${args}`;
      },
    };

    settings.configure({
      lm: new MockLM({}, "Thought: need to look up\nAction: lookup[Paris]\nFinish[Paris]"),
    });

    const react = new ReAct("question -> answer", [trackedTool]);
    const result = await react.forward({ question: "Capital of France?" });
    expect(result.get("answer")).toBe("Paris");
  });

  it("stops at maxIter when no Finish is emitted", async () => {
    settings.configure({
      lm: new MockLM({}, "Thought: still thinking\nAction: search[query]"),
    });
    const react = new ReAct("question -> answer", [searchTool], 2);
    const result = await react.forward({ question: "Infinite loop?" });
    // Should stop after maxIter without crashing
    expect(result.get("trajectory")).toBeDefined();
    expect(result.get("answer")).toBeDefined();
  });

  it("handles unknown tool gracefully", async () => {
    settings.configure({
      lm: new MockLM({}, "Thought: try unknown\nAction: unknownTool[args]"),
    });
    const react = new ReAct("question -> answer", [searchTool], 1);
    const result = await react.forward({ question: "test" });
    const trajectory = String(result.get("trajectory") ?? "");
    expect(trajectory).toContain('Tool "unknownTool" not found');
  });

  it("returns trajectory in the prediction", async () => {
    settings.configure({
      lm: new MockLM({}, "Thought: thinking\nFinish[done]"),
    });
    const react = new ReAct("question -> answer", [searchTool]);
    const result = await react.forward({ question: "test" });
    expect(typeof result.get("trajectory")).toBe("string");
    expect(String(result.get("trajectory")).length).toBeGreaterThan(0);
  });

  it("passes trajectory into prompt inputs on subsequent iterations", async () => {
    let capturedPrompt = "";
    class SniffingLM extends MockLM {
      constructor() {
        super();
      }
      protected override async _call(
        prompt: any,
        config: any
      ) {
        const textPrompt = typeof prompt === "string" ? prompt : JSON.stringify(prompt);
        capturedPrompt = textPrompt;
        
        const returnText = textPrompt.includes("Observation: 4") 
          ? "Thought: done\nFinish[4]"
          : "Thought: calc\nAction: calc[2+2]";
          
        return {
          text: returnText,
          texts: [returnText],
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          raw: {},
        };
      }
    }

    const calcTool: Tool = {
      name: "calc",
      description: "Calculate expression",
      fn: async (x: string) => String(eval(x)),
    };
    const lm = new SniffingLM();
    settings.configure({ lm });
    
    const react = new ReAct("query -> result", [calcTool]);
    const res = await react.forward({ query: "What is 2+2?" });
    
    expect(res.get("result")).toBe("4");
    expect(capturedPrompt).toContain("trajectory");
    expect(capturedPrompt).toContain("Observation: 4");
  });
});
