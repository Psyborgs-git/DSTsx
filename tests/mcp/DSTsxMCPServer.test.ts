import { describe, it, expect, beforeEach } from "vitest";
import { DSTsxMCPServer } from "../../src/mcp/DSTsxMCPServer.js";
import { Predict } from "../../src/modules/Predict.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { settings } from "../../src/settings/Settings.js";

describe("DSTsxMCPServer", () => {
  beforeEach(() => settings.reset());

  it("registers a module as a tool", () => {
    const server = new DSTsxMCPServer();
    const predict = new Predict("question -> answer");
    server.registerModule("qa", "A QA module", predict, ["question"]);
    const tools = server.getToolDefinitions();
    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe("qa");
    expect(tools[0]!.inputSchema.required).toContain("question");
  });

  it("calls a registered tool", async () => {
    settings.configure({ lm: new MockLM({}, "answer: Paris") });
    const server = new DSTsxMCPServer();
    const predict = new Predict("question -> answer");
    server.registerModule("qa", "A QA module", predict, ["question"]);
    const result = await server.callTool("qa", { question: "Capital of France?" });
    expect(result).toBeDefined();
  });

  it("throws for unknown tool", async () => {
    const server = new DSTsxMCPServer();
    await expect(server.callTool("unknown", {})).rejects.toThrow(
      'Tool "unknown" not found',
    );
  });

  it("throws when trying to create stdio server without sdk", async () => {
    const server = new DSTsxMCPServer();
    await expect(server.createStdioServer()).rejects.toThrow();
  });
});
