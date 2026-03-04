import { Module } from "./Module.js";
import { Predict } from "./Predict.js";
import { Prediction } from "../primitives/index.js";
import type { Signature } from "../signatures/index.js";

/** A callable tool that ReAct can invoke. */
export interface Tool {
  /** Short unique name used in `Action: toolName[args]` syntax. */
  name: string;
  /** One-sentence description shown in the system prompt. */
  description: string;
  /** Async function that the tool executes. */
  fn: (args: string) => Promise<string>;
}

/**
 * ReAct (Reasoning + Acting) module that interleaves Thought, Action, and
 * Observation steps in a loop until a `Finish` action is emitted.
 *
 * Mirrors `dspy.ReAct` in Python.
 *
 * @example
 * ```ts
 * const react = new ReAct("question -> answer", [searchTool]);
 * const result = await react.forward({ question: "Who won the 2024 Olympics?" });
 * ```
 */
export class ReAct extends Module {
  readonly tools: ReadonlyMap<string, Tool>;
  readonly maxIter: number;
  readonly #predictor: Predict;

  constructor(signature: string | Signature, tools: Tool[], maxIter = 5) {
    super();
    this.tools = new Map(tools.map((t) => [t.name, t]));
    this.maxIter = maxIter;

    const toolDescriptions = tools
      .map((t) => `${t.name}: ${t.description}`)
      .join("\n");

    const base = typeof signature === "string" ? signature : signature;
    const instructions =
      `You are an agent. Use the following tools:\n${toolDescriptions}\n\n` +
      `Respond in the format:\nThought: <reasoning>\nAction: <tool>[<args>]\nObservation: <result>\n...\nFinish[<answer>]`;

    this.#predictor = new Predict(
      typeof base === "string"
        ? `${base}`
        : base,
    );
    this.#predictor.instructions = instructions;
  }

  async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    const trajectory: string[] = [];
    let finalAnswer = "";

    for (let i = 0; i < this.maxIter; i++) {
      const augmented = {
        ...inputs,
        trajectory: trajectory.join("\n"),
      };

      const result = await this.#predictor.forward(augmented);
      const text = String(result.get([...this.#predictor.signature.outputs.keys()][0] ?? "") ?? "");
      trajectory.push(text);

      // Check for Finish action.
      const finishMatch = /Finish\[(.+)\]/i.exec(text);
      if (finishMatch) {
        finalAnswer = finishMatch[1] ?? "";
        break;
      }

      // Execute any Action.
      const actionMatch = /Action:\s*(\w+)\[(.+?)\]/i.exec(text);
      if (actionMatch) {
        const toolName = actionMatch[1] ?? "";
        const toolArgs = actionMatch[2] ?? "";
        const tool = this.tools.get(toolName);
        const observation = tool
          ? await tool.fn(toolArgs)
          : `Tool "${toolName}" not found.`;
        trajectory.push(`Observation: ${observation}`);
      }
    }

    const outputKey = [...this.#predictor.signature.outputs.keys()][0] ?? "answer";
    return new Prediction({
      [outputKey]: finalAnswer || trajectory.at(-1) || "",
      trajectory: trajectory.join("\n"),
    });
  }
}
