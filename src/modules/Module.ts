import { Prediction } from "../primitives/index.js";
import { Parameter } from "../primitives/Parameter.js";

/**
 * The return type of {@link Module.forward} — either a single prediction or
 * an array of predictions for modules that produce multiple outputs (e.g.
 * {@link Parallel}).
 */
export type ModuleOutput = Prediction | Prediction[];

/**
 * Extracts the first {@link Prediction} from a {@link ModuleOutput}.
 *
 * Useful when consuming an unknown module whose `forward()` may return either
 * a single prediction or an array.
 */
export function firstPrediction(result: ModuleOutput): Prediction {
  return Array.isArray(result) ? (result[0] ?? new Prediction({})) : result;
}

/**
 * Abstract base class for all DSTsx modules.
 *
 * A Module is a composable, serializable unit that encapsulates one or more
 * language model calls.  Subclasses implement {@link Module["forward"]} to define
 * their behaviour.
 *
 * Mirrors `dspy.Module` in Python.
 *
 * @example
 * ```ts
 * class MyRAG extends Module {
 *   retrieve = new Retrieve(3);
 *   generate = new ChainOfThought("context, question -> answer");
 *
 *   async forward(question: string): Promise<Prediction> {
 *     const { passages } = await this.retrieve.forward(question);
 *     return this.generate.forward({ context: passages.join("\n"), question });
 *   }
 * }
 * ```
 */
export abstract class Module {
  /**
   * Execute the module.
   *
   * Subclasses define their own parameter signatures; the base type uses
   * `unknown` so that TypeScript accepts any subclass override.
   *
   * The return value is {@link ModuleOutput} — a single {@link Prediction} for
   * most modules, or a `Prediction[]` for multi-output modules such as
   * {@link Parallel}.  Use {@link firstPrediction} to safely extract the first
   * result when consuming an unknown module.
   */
  abstract forward(...args: unknown[]): Promise<ModuleOutput>;

  /**
   * Recursively discover all {@link Predict} sub-modules by walking the own
   * enumerable properties of this instance.
   */
  namedPredictors(): Array<[string, Module]> {
    const results: Array<[string, Module]> = [];
    for (const [key, value] of Object.entries(this)) {
      if (value instanceof Module) {
        results.push([key, value]);
        results.push(...value.namedPredictors().map(([k, v]): [string, Module] => [`${key}.${k}`, v]));
      }
    }
    return results;
  }

  /**
   * Recursively discover all {@link Parameter} instances by walking the own
   * enumerable properties of this instance.
   *
   * Mirrors `dspy.Module.named_parameters()` in Python (analogous to
   * `torch.nn.Module.named_parameters()`).
   *
   * @example
   * ```ts
   * for (const [name, param] of module.namedParameters()) {
   *   console.log(name, param.value);
   * }
   * ```
   */
  namedParameters(): Array<[string, Parameter]> {
    const results: Array<[string, Parameter]> = [];
    for (const [key, value] of Object.entries(this)) {
      if (value instanceof Parameter) {
        results.push([key, value]);
      } else if (value instanceof Module) {
        results.push(
          ...value.namedParameters().map(([k, v]): [string, Parameter] => [`${key}.${k}`, v]),
        );
      }
    }
    return results;
  }

  /**
   * Serialize the module's learnable parameters (e.g. `Predict.demos`) to a
   * plain JSON-compatible object.
   */
  dump(): Record<string, unknown> {
    const state: Record<string, unknown> = {};
    for (const [name, predictor] of this.namedPredictors()) {
      state[name] = predictor.dump();
    }
    return state;
  }

  /**
   * Restore learnable parameters from a plain object previously produced by
   * {@link Module.dump}.
   */
  load(state: Record<string, unknown>): void {
    for (const [name, predictor] of this.namedPredictors()) {
      const sub = state[name];
      if (sub && typeof sub === "object") {
        predictor.load(sub as Record<string, unknown>);
      }
    }
  }

  /**
   * Create a deep clone of this module.
   *
   * Returns a new module with the same prototype.  All sub-{@link Module}
   * properties are recursively cloned so that mutating the clone's learnable
   * parameters (e.g. `Predict.demos`) does **not** affect the original.
   * {@link Parameter} properties are also cloned.
   * Array properties are shallow-copied (their elements are not cloned).
   * All other properties are copied by reference.
   */
  clone(): this {
    const cloned = Object.create(Object.getPrototypeOf(this) as object) as this;
    for (const key of Object.keys(this)) {
      const value = (this as Record<string, unknown>)[key];
      // Parameter check MUST precede Module check in case a future subclass
      // of Parameter also extends Module.
      if (value instanceof Parameter) {
        (cloned as Record<string, unknown>)[key] = value.clone();
      } else if (value instanceof Module) {
        (cloned as Record<string, unknown>)[key] = value.clone();
      } else if (Array.isArray(value)) {
        (cloned as Record<string, unknown>)[key] = [...(value as unknown[])];
      } else {
        (cloned as Record<string, unknown>)[key] = value;
      }
    }
    return cloned;
  }
}
