/**
 * Tool argument descriptor (JSON-Schema-like).
 *
 * Used by {@link Tool.formatAsOpenAIFunction} and similar serializers.
 */
export interface ToolArgDef {
  /** JSON-schema type string. */
  type: "string" | "number" | "boolean" | "object" | "array";
  /** Human-readable description shown to the LM. */
  description?: string;
  /** Whether this argument is required. */
  required?: boolean;
}

/**
 * Options for the {@link Tool} constructor.
 */
export interface ToolOptions {
  /** Override the tool name (default: inferred from `fn.name`). */
  name?: string;
  /** Human-readable description shown to the LM (default: from JSDoc / function name). */
  description?: string;
  /** Explicit argument schema (default: inferred from function parameter names). */
  args?: Record<string, ToolArgDef>;
}

/**
 * Compatible interface expected by {@link ReAct} and {@link NativeReAct}.
 * @internal
 */
export interface ToolLike {
  name: string;
  description: string;
  fn: (args: string) => Promise<string>;
}

/**
 * A typed, self-describing wrapper around a callable function that can be
 * invoked by an LM agent.
 *
 * Mirrors `dspy.Tool` in Python — wraps any callable, auto-infers `name`,
 * `description`, and `args` from the function signature, and provides
 * serializers for different provider formats.
 *
 * @example
 * ```ts
 * function getWeather(city: string): string {
 *   return `Weather in ${city}: sunny`;
 * }
 *
 * const tool = new Tool(getWeather, { description: "Get current weather" });
 * // or let DSTsx infer metadata:
 * const tool2 = Tool.from(getWeather);
 *
 * // Use with ReAct:
 * const agent = new ReAct("question -> answer", [tool.asTool()]);
 * ```
 */
export class Tool {
  /** Unique identifier for this tool. */
  readonly name: string;
  /** One-sentence description shown to the LM. */
  readonly description: string;
  /** Argument schema. */
  readonly args: Record<string, ToolArgDef>;
  /** The underlying callable. */
  readonly fn: (...args: unknown[]) => unknown;

  constructor(fn: (...args: unknown[]) => unknown, options: ToolOptions = {}) {
    this.fn = fn;
    this.name = options.name ?? fn.name ?? "tool";
    this.description = options.description ?? `Call the ${this.name} function`;
    this.args = options.args ?? Tool.#inferArgs(fn);
  }

  /**
   * Create a {@link Tool} from any callable, automatically inferring all
   * metadata from the function definition.
   */
  static from(fn: (...args: unknown[]) => unknown, options?: ToolOptions): Tool {
    return new Tool(fn, options);
  }

  /**
   * Call the underlying function synchronously.
   */
  call(...args: unknown[]): unknown {
    return this.fn(...args);
  }

  /**
   * Call the underlying function asynchronously.
   */
  async acall(...args: unknown[]): Promise<unknown> {
    return await Promise.resolve(this.fn(...args));
  }

  /**
   * Return a {@link ToolLike} interface for use with {@link ReAct} and
   * {@link NativeReAct}.
   *
   * The wrapper parses a JSON string of arguments from the agent trajectory
   * and maps them to positional/named parameters.
   */
  asTool(): ToolLike {
    return {
      name: this.name,
      description: this.description,
      fn: async (argsString: string): Promise<string> => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(argsString);
        } catch {
          // Treat as a single string argument
          parsed = argsString;
        }

        let result: unknown;
        if (Array.isArray(parsed)) {
          result = await this.acall(...parsed);
        } else if (typeof parsed === "object" && parsed !== null) {
          // Named argument object — spread values in declaration order
          const argNames = Object.keys(this.args);
          if (argNames.length > 0) {
            const positional = argNames.map((k) => (parsed as Record<string, unknown>)[k]);
            result = await this.acall(...positional);
          } else {
            result = await this.acall(parsed);
          }
        } else {
          result = await this.acall(parsed);
        }

        return typeof result === "string" ? result : JSON.stringify(result ?? "");
      },
    };
  }

  /**
   * Serialize to an OpenAI-compatible function calling descriptor.
   *
   * @example
   * ```ts
   * const descriptor = tool.formatAsOpenAIFunction();
   * // Pass to: client.chat.completions.create({ tools: [descriptor], ... })
   * ```
   */
  formatAsOpenAIFunction(): {
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: {
        type: "object";
        properties: Record<string, { type: string; description?: string }>;
        required: string[];
      };
    };
  } {
    const properties: Record<string, { type: string; description?: string }> = {};
    const required: string[] = [];

    for (const [key, def] of Object.entries(this.args)) {
      properties[key] = { type: def.type };
      if (def.description) properties[key]!.description = def.description;
      if (def.required !== false) required.push(key);
    }

    return {
      type: "function",
      function: {
        name: this.name,
        description: this.description,
        parameters: {
          type: "object",
          properties,
          required,
        },
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Infer argument schema from function parameter names using
   * `Function.prototype.toString()`.
   *
   * Uses a parenthesis-depth counter (no complex regex) to locate the parameter
   * list, avoiding ReDoS vulnerabilities on adversarially crafted strings.
   */
  static #inferArgs(fn: (...args: unknown[]) => unknown): Record<string, ToolArgDef> {
    const src = fn.toString();

    // Locate the opening parenthesis of the parameter list.
    // For arrow functions like `x => x`, there may be no parens — handle via fallback.
    const parenStart = src.indexOf("(");
    if (parenStart === -1) return {};

    // Walk to the matching closing parenthesis using a depth counter.
    let depth = 0;
    let parenEnd = -1;
    for (let i = parenStart; i < src.length; i++) {
      if (src[i] === "(") {
        depth++;
      } else if (src[i] === ")") {
        depth--;
        if (depth === 0) {
          parenEnd = i;
          break;
        }
      }
    }

    if (parenEnd === -1) return {};

    const params = src.slice(parenStart + 1, parenEnd).trim();
    if (!params) return {};

    const args: Record<string, ToolArgDef> = {};
    // Valid JS identifier pattern — anchored, no backtracking
    const identRe = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

    for (const raw of params.split(",")) {
      const name = raw
        .trim()
        .replace(/^\.\.\./u, "")    // rest parameters (...args)
        .replace(/[:=].*$/su, "")   // default values (a = 1) and TS type annotations (a: string)
        .replace(/[{[.\]]/gu, "")   // destructuring patterns
        .trim();
      if (!name || !identRe.test(name)) continue;
      args[name] = { type: "string", required: true };
    }

    return args;
  }
}
