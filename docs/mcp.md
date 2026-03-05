# MCP Integration

DSTsx integrates with the [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) in two directions:

1. **Use MCP servers as tools** inside ReAct agents (`MCPToolAdapter`)
2. **Expose DSTsx modules as MCP tools** (`DSTsxMCPServer`)

Optional peer dependency: `npm install @modelcontextprotocol/sdk`

---

## `MCPToolAdapter` — Consume MCP Servers in ReAct

Wraps the tools from an MCP server as DSTsx `Tool` objects for use with `ReAct`.

```ts
import { MCPToolAdapter, ReAct } from "dstsx";

const adapter = new MCPToolAdapter({
  // Test mode: supply tool definitions + call handler without a live server
  tools: [
    {
      name:        "weather",
      description: "Get current weather for a city",
      inputSchema: {
        type:       "object",
        properties: { city: { type: "string" } },
        required:   ["city"],
      },
    },
  ],
  callHandler: async (name, args) => {
    if (name === "weather") return `Sunny in ${args["city"] as string}`;
    throw new Error(`Unknown tool: ${name}`);
  },
});

const tools = await adapter.getTools();
const agent = new ReAct("question -> answer", tools, 5);
const result = await agent.forward({ question: "What is the weather in Paris?" });
```

### `MCPAdapterOptions`

```ts
interface MCPAdapterOptions {
  tools?:       MCPToolDefinition[];
  callHandler?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  serverUrl?:   string; // live SSE/stdio connection when @modelcontextprotocol/sdk is installed
}
```

---

## `DSTsxMCPServer` — Expose DSTsx Modules as MCP Tools

Register any DSTsx module and serve it as an MCP-compatible tool.

```ts
import { DSTsxMCPServer, ChainOfThought, settings, OpenAI } from "dstsx";

settings.configure({ lm: new OpenAI({ model: "gpt-4o" }) });

const qa = new ChainOfThought("context, question -> answer");

const server = new DSTsxMCPServer();
server.registerModule(
  "qa",                                          // tool name
  "Answer questions using chain-of-thought reasoning",
  qa,
  ["context", "question"],                       // input field names
);

// List tools (for MCP handshake)
const toolDefs = server.getToolDefinitions();
/*
[{
  name: "qa",
  description: "...",
  inputSchema: { type: "object", properties: { context: { type: "string" }, ... } },
}]
*/

// Handle a tool call
const result = await server.callTool("qa", {
  context:  "Paris is the capital of France.",
  question: "What is the capital of France?",
});
// result is the Prediction.toJSON() object

// With @modelcontextprotocol/sdk installed, launch a stdio MCP server:
// await server.createStdioServer();
```

### `MCPTool` type

```ts
interface MCPTool {
  name:        string;
  description: string;
  inputSchema: {
    type:       "object";
    properties: Record<string, { type: string; description?: string }>;
    required?:  string[];
  };
  handler: (inputs: Record<string, unknown>) => Promise<unknown>;
}
```

### `DSTsxMCPServer` methods

| Method | Description |
|---|---|
| `registerModule(name, desc, module, fields)` | Register a module as an MCP tool |
| `getToolDefinitions()` | Return all registered `MCPTool[]` |
| `callTool(name, inputs)` | Invoke a registered tool by name |
| `createStdioServer()` | Start an MCP stdio server (requires `@modelcontextprotocol/sdk`) |
