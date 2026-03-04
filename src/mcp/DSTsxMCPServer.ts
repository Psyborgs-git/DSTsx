import type { Module } from "../modules/index.js";
import { Prediction } from "../primitives/index.js";

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
  handler: (inputs: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Exposes DSTsx modules as MCP-compatible tool definitions.
 *
 * Registered modules can be called via `callTool()`.  To create a live stdio
 * server the `@modelcontextprotocol/sdk` package must be installed.
 */
export class DSTsxMCPServer {
  readonly #tools: Map<string, MCPTool> = new Map();

  registerModule(
    name: string,
    description: string,
    module: Module,
    inputFields: string[],
  ): this {
    const properties: Record<string, { type: string; description?: string }> = {};
    for (const field of inputFields) {
      properties[field] = { type: "string" };
    }
    this.#tools.set(name, {
      name,
      description,
      inputSchema: { type: "object", properties, required: inputFields },
      handler: async (inputs) => {
        const result = await (
          module.forward as (i: Record<string, unknown>) => Promise<Prediction>
        )(inputs);
        return result.toJSON();
      },
    });
    return this;
  }

  getToolDefinitions(): MCPTool[] {
    return [...this.#tools.values()];
  }

  async callTool(name: string, inputs: Record<string, unknown>): Promise<unknown> {
    const tool = this.#tools.get(name);
    if (!tool) throw new Error(`Tool "${name}" not found.`);
    return tool.handler(inputs);
  }

  async createStdioServer(): Promise<unknown> {
    await import("@modelcontextprotocol/sdk/server/index.js").catch(() => {
      throw new Error(
        "The `@modelcontextprotocol/sdk` package is required.\n" +
          "Install it with: npm install @modelcontextprotocol/sdk",
      );
    });
    throw new Error(
      "createStdioServer requires @modelcontextprotocol/sdk to be installed.",
    );
  }
}
