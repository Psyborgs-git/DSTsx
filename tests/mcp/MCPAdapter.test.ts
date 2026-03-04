import { describe, it, expect } from "vitest";
import { MCPToolAdapter } from "../../src/mcp/MCPAdapter.js";

describe("MCPToolAdapter", () => {
  it("creates tools from pre-loaded definitions", async () => {
    const adapter = new MCPToolAdapter({
      tools: [
        {
          name: "search",
          description: "Search the web",
          inputSchema: { query: { type: "string" } },
        },
      ],
      callHandler: async (name, args) =>
        `result for ${name}: ${JSON.stringify(args)}`,
    });

    const tools = await adapter.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe("search");
    const result = await tools[0]!.fn('{"query": "test"}');
    expect(result).toContain("search");
  });

  it("caches tool list after first call", async () => {
    const adapter = new MCPToolAdapter({
      tools: [{ name: "t1", description: "d", inputSchema: {} }],
      callHandler: async () => "ok",
    });
    const t1 = await adapter.getTools();
    const t2 = await adapter.getTools();
    expect(t1).toBe(t2);
  });

  it("throws when no tools or sdk available", async () => {
    const adapter = new MCPToolAdapter({ serverUrl: "http://localhost:9999" });
    await expect(adapter.getTools()).rejects.toThrow();
  });
});
