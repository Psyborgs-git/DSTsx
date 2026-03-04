import type { Tool } from "../modules/ReAct.js";

export interface MCPAdapterOptions {
  serverUrl?: string;
  tools?: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }>;
  callHandler?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Wraps MCP server tools as DSTsx Tool objects.
 *
 * When `tools` + `callHandler` are provided, no network connection is needed.
 * A live MCP connection (via `serverUrl`) requires the
 * `@modelcontextprotocol/sdk` package to be installed.
 */
export class MCPToolAdapter {
  readonly #options: MCPAdapterOptions;
  #tools: Tool[] | undefined;

  constructor(options: MCPAdapterOptions = {}) {
    this.#options = options;
  }

  async getTools(): Promise<Tool[]> {
    if (this.#tools) return this.#tools;

    if (this.#options.tools && this.#options.callHandler) {
      const callHandler = this.#options.callHandler;
      this.#tools = this.#options.tools.map((t) => ({
        name: t.name,
        description: t.description,
        fn: async (args: string) => {
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(args) as Record<string, unknown>;
          } catch {
            parsed = { input: args };
          }
          const result = await callHandler(t.name, parsed);
          return typeof result === "string" ? result : JSON.stringify(result);
        },
      }));
      return this.#tools;
    }

    await import("@modelcontextprotocol/sdk/client/index.js").catch(() => {
      throw new Error(
        "The `@modelcontextprotocol/sdk` package is required for MCPToolAdapter.\n" +
          "Install it with: npm install @modelcontextprotocol/sdk",
      );
    });

    throw new Error(
      "Live MCP connection not yet implemented. Use tools+callHandler for now.",
    );
  }
}
