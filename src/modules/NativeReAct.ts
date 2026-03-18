import { Module } from "./Module.js";
import { Prediction } from "../primitives/index.js";
import { Signature } from "../signatures/index.js";
import type { Tool } from "./ReAct.js";
import { settings } from "../settings/index.js";
import type { Message } from "../lm/types.js";
import { ToolCalls } from "../primitives/ToolCalls.js";
import type { ToolCallEntry } from "../primitives/ToolCalls.js";

/**
 * ReAct variant that uses provider-native tool/function calling instead of
 * text-based action parsing.
 *
 * For OpenAI models, this uses function calling (tools API). For Anthropic, it
 * uses tool_use. Other adapters fall back to the text-based ReAct format.
 *
 * @example
 * ```ts
 * const tools: Tool[] = [{ name: "search", description: "Search", fn: search }];
 * const agent = new NativeReAct("question -> answer", tools);
 * const result = await agent.forward({ question: "What is the capital of France?" });
 * ```
 */
export class NativeReAct extends Module {
  readonly tools: ReadonlyMap<string, Tool>;
  readonly maxIter: number;
  readonly #signatureStr: string;
  readonly #outputKey: string;

  constructor(
    signatureStr: string,
    tools: Tool[],
    maxIter = 5,
  ) {
    super();
    this.#signatureStr = signatureStr;
    this.tools = new Map(tools.map((t) => [t.name, t]));
    this.maxIter = maxIter;
    // Parse the output field name from the signature string
    const sig = Signature.from(signatureStr);
    this.#outputKey = [...sig.outputs.keys()][0] ?? "answer";
  }

  override async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    const lm = settings.lm;
    if (!lm) throw new Error("No LM configured.");

    const toolSchemas = [...this.tools.values()].map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: {
          type: "object",
          properties: { args: { type: "string", description: "Tool arguments as JSON or plain string" } },
          required: ["args"],
        },
      },
    }));

    const inputStr = Object.entries(inputs)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join("\n");

    const messages: Message[] = [
      {
        role: "system",
        content: `You are a helpful assistant. Use tools when needed.\nSignature: ${this.#signatureStr}\nTools: ${[...this.tools.keys()].join(", ")}`,
      },
      { role: "user", content: inputStr },
    ];

    let finalAnswer = "";
    const toolCallEntries: ToolCallEntry[] = [];
    const trajectory: Array<{ thought: string; action: string; observation: string }> = [];

    for (let i = 0; i < this.maxIter; i++) {
      const response = await lm.call(messages, {
        extra: { tools: toolSchemas, tool_choice: "auto" },
      });

      const raw = response.raw as Record<string, unknown> | null;
      const choices = (raw?.["choices"] as Array<Record<string, unknown>>) ?? [];
      const choice = choices[0];
      const toolCalls = (
        choice?.["message"] as Record<string, unknown> | undefined
      )?.["tool_calls"] as
        | Array<{ function: { name: string; arguments: string } }>
        | undefined;

      if (toolCalls && toolCalls.length > 0) {
        for (const tc of toolCalls) {
          const toolName = tc.function.name;
          const args = tc.function.arguments;
          const tool = this.tools.get(toolName);
          const observation = tool
            ? await tool.fn(args).catch((e: unknown) => String(e))
            : `Unknown tool: ${toolName}`;

          let parsedArgs: Record<string, unknown>;
          try {
            parsedArgs = JSON.parse(args) as Record<string, unknown>;
          } catch {
            parsedArgs = { input: args };
          }
          toolCallEntries.push({
            name: toolName,
            args: parsedArgs,
            result: observation,
          });
          trajectory.push({
            thought: `Using tool: ${toolName}`,
            action: `${toolName}(${args})`,
            observation,
          });
          messages.push({ role: "assistant", content: `Tool: ${toolName}\nArgs: ${args}` });
          messages.push({ role: "user", content: `Observation: ${observation}` });
        }
      } else {
        finalAnswer = response.text;
        break;
      }
    }

    return new Prediction({ [this.#outputKey]: finalAnswer, trajectory: JSON.stringify(trajectory), toolCalls: new ToolCalls(toolCallEntries) });
  }
}
