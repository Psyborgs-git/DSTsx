/**
 * End-to-end integration tests for features added in Phases 1–4.
 *
 * These tests combine multiple new features together to verify they work
 * cohesively in realistic pipeline scenarios.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { settings } from "../../src/settings/Settings.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { MockRetriever } from "../../src/retrieve/backends/MockRetriever.js";
import { Predict } from "../../src/modules/Predict.js";
import { Module } from "../../src/modules/Module.js";
import { Prediction } from "../../src/primitives/Prediction.js";
import { Signature } from "../../src/signatures/Signature.js";
import { Assert, AssertionError } from "../../src/assertions/Assert.js";
import { backtrackHandler } from "../../src/assertions/backtrack.js";
import { assertTransformModule } from "../../src/assertions/backtrack.js";
import { MajorityVoting } from "../../src/modules/MajorityVoting.js";
import { functional } from "../../src/modules/functional.js";
import { trackUsage } from "../../src/utils/trackUsage.js";
import { makeSignature } from "../../src/signatures/makeSignature.js";
import { XMLAdapter } from "../../src/adapters/XMLAdapter.js";
import { Evaluate } from "../../src/evaluate/EvaluateClass.js";
import { exactMatch } from "../../src/evaluate/metrics.js";
import { Example } from "../../src/primitives/Example.js";
import { Document } from "../../src/primitives/Document.js";
import { DocumentRetriever } from "../../src/retrieve/backends/DocumentRetriever.js";
import { Citations } from "../../src/modules/Citations.js";
import { LM } from "../../src/lm/LM.js";
import { Tool } from "../../src/tools/Tool.js";
import { Parameter } from "../../src/primitives/Parameter.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

class QAModule extends Module {
  predict: Predict;

  constructor(sig: string | Signature = "question -> answer") {
    super();
    this.predict = new Predict(sig);
  }

  async forward(inputs: Record<string, unknown>): Promise<Prediction> {
    return this.predict.forward(inputs);
  }

  override clone(): this {
    const c = new QAModule(this.predict.signature) as this;
    c.predict.demos = [...this.predict.demos];
    c.predict.instructions = this.predict.instructions;
    return c;
  }
}

// ---------------------------------------------------------------------------
// 1. LM.from() factory + settings configure
// ---------------------------------------------------------------------------

describe("Phase 1: LM.from() factory", () => {
  it("LM.from() creates a MockLM-like registered provider", async () => {
    // Register a test provider
    LM.registerProvider("testprovider", (_model, _opts) => new MockLM({}, "test answer"));
    const lm = LM.from("testprovider/test-model");
    settings.configure({ lm });
    const pred = new Predict("question -> answer");
    const result = await pred.forward({ question: "test?" });
    expect(result.get("answer")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 2. makeSignature() + Signature.append/delete
// ---------------------------------------------------------------------------

describe("Phase 1: Signature enhancements", () => {
  it("makeSignature creates a usable signature for Predict", async () => {
    settings.configure({ lm: new MockLM({}, "answer: 42\nreasoning: because") });
    const sig = makeSignature({ question: "input", answer: "output", reasoning: "output" });
    const pred = new Predict(sig);
    const result = await pred.forward({ question: "What is 6*7?" });
    expect(result).toBeInstanceOf(Prediction);
  });

  it("Signature.append adds a field used by Predict", async () => {
    settings.configure({ lm: new MockLM({}, "answer: yes\nconfidence: high") });
    const sig = Signature.from("question -> answer")
      .append("confidence", {}, "output");
    const pred = new Predict(sig);
    const result = await pred.forward({ question: "Is the sky blue?" });
    expect(result).toBeInstanceOf(Prediction);
  });

  it("Signature.delete removes a field", () => {
    const sig = Signature.from("question, context -> answer, reasoning")
      .delete("reasoning");
    expect([...sig.outputs.keys()]).not.toContain("reasoning");
    expect([...sig.outputs.keys()]).toContain("answer");
  });
});

// ---------------------------------------------------------------------------
// 3. XMLAdapter round-trip
// ---------------------------------------------------------------------------

describe("Phase 1: XMLAdapter", () => {
  it("parses XML-structured responses into Prediction fields", async () => {
    const sig = Signature.from("question -> answer");
    const xml = `<answer>Paris</answer>`;
    const adapter = new XMLAdapter();
    const result = adapter.parse(sig, xml);
    expect(result["answer"]).toBe("Paris");
  });

  it("formats messages including input field values", () => {
    const sig = Signature.from("question -> answer");
    const adapter = new XMLAdapter();
    const msgs = adapter.format(sig, [], { question: "What city?" });
    // The messages array should contain the input question
    const allContent = msgs.map((m) => m.content).join("\n");
    expect(allContent).toContain("What city?");
  });
});

// ---------------------------------------------------------------------------
// 4. Tool class auto-inference
// ---------------------------------------------------------------------------

describe("Phase 1: Tool class", () => {
  it("Tool auto-infers function name", () => {
    function multiply(a: number, b: number) { return a * b; }
    const tool = new Tool(multiply as any);
    expect(tool.name).toBe("multiply");
  });

  it("Tool.asTool() returns a ReAct-compatible object", () => {
    const tool = new Tool(Math.sqrt as any, { name: "sqrt", description: "Square root" });
    const reactTool = tool.asTool();
    expect(reactTool.name).toBe("sqrt");
    expect(typeof reactTool.fn).toBe("function");
  });

  it("Tool.formatAsOpenAIFunction() returns valid function schema", () => {
    const tool = new Tool(
      (x: unknown) => String(x),
      { name: "stringify", description: "Convert to string", args: { x: { type: "string", required: true } } },
    );
    const schema = tool.formatAsOpenAIFunction();
    expect(schema.type).toBe("function");
    expect(schema.function.name).toBe("stringify");
  });
});

// ---------------------------------------------------------------------------
// 5. backtrackHandler + assertTransformModule integration
// ---------------------------------------------------------------------------

describe("Phase 1: Assertion backtracking", () => {
  beforeEach(() => {
    settings.configure({ lm: new MockLM({}, "answer: valid") });
  });

  it("backtrackHandler retries when assertion fails then succeeds", async () => {
    let attempt = 0;
    class CheckedModule extends Module {
      async forward(inputs: Record<string, unknown>): Promise<Prediction> {
        attempt++;
        if (attempt < 3) {
          Assert(false, "Not valid yet", { inputs, trace: "CheckedModule.forward" });
        }
        return new Prediction({ answer: "final" });
      }
    }
    const wrapped = backtrackHandler(new CheckedModule(), { maxRetries: 3 });
    const result = await wrapped.forward({ question: "test" });
    expect((result as Prediction).get("answer")).toBe("final");
    expect(attempt).toBe(3);
  });

  it("assertTransformModule transforms a module with assertion handling", async () => {
    let count = 0;
    class BadModule extends Module {
      async forward(): Promise<Prediction> {
        count++;
        if (count < 2) throw new AssertionError("first attempt bad");
        return new Prediction({ result: "ok" });
      }
    }
    const transformed = assertTransformModule(new BadModule(), { maxRetries: 2 });
    const result = await transformed.forward({});
    expect((result as Prediction).get("result")).toBe("ok");
  });

  it("backtrackHandler augments inputs with feedback on retry", async () => {
    let capturedInputs: Record<string, unknown> | undefined;
    class FeedbackModule extends Module {
      #calls = 0;
      async forward(inputs: Record<string, unknown>): Promise<Prediction> {
        this.#calls++;
        capturedInputs = inputs;
        if (this.#calls === 1) Assert(false, "try again");
        return new Prediction({ answer: "done" });
      }
    }
    const wrapped = backtrackHandler(new FeedbackModule(), { maxRetries: 2 });
    await wrapped.forward({ question: "q?" });
    // On retry, inputs should contain feedback
    expect(capturedInputs?.["feedback"]).toBe("try again");
  });
});

// ---------------------------------------------------------------------------
// 6. MajorityVoting
// ---------------------------------------------------------------------------

describe("Phase 2: MajorityVoting", () => {
  it("runs inner module N times and returns majority answer", async () => {
    let call = 0;
    const responses = ["answer: Paris", "answer: Paris", "answer: London"];
    settings.configure({ lm: new MockLM({}, responses[0]!) });

    class VaryingModule extends Module {
      async forward(_inputs: Record<string, unknown>): Promise<Prediction> {
        const resp = responses[call++ % responses.length]!;
        const answer = resp.replace("answer: ", "");
        return new Prediction({ answer });
      }
    }

    const mv = new MajorityVoting(new VaryingModule(), { n: 3, field: "answer" });
    const result = await mv.forward({ question: "Capital of France?" });
    // Paris appears twice → should win
    expect((result as Prediction).get("answer")).toBe("Paris");
  });
});

// ---------------------------------------------------------------------------
// 7. trackUsage() context manager
// ---------------------------------------------------------------------------

describe("Phase 2: trackUsage()", () => {
  it("aggregates token usage across LM calls in scope", async () => {
    const lm = new MockLM({}, "answer: 42");
    settings.configure({ lm });

    const { result, usage } = await trackUsage(async () => {
      const pred = new Predict("question -> answer");
      return pred.forward({ question: "q?" });
    });

    expect(result).toBeInstanceOf(Prediction);
    expect(usage).toBeDefined();
    // MockLM returns null usage — so totalTokens is 0
    expect(usage.totalTokens).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 8. functional() module wrapper
// ---------------------------------------------------------------------------

describe("Phase 2: functional()", () => {
  it("wraps a plain function as a Module", async () => {
    const doubler = functional((inputs: Record<string, unknown>) => ({
      doubled: (inputs["n"] as number) * 2,
    }));

    const result = await doubler.forward({ n: 21 });
    expect((result as Prediction).get("doubled")).toBe(42);
  });

  it("uses Predict when a signature is given", async () => {
    settings.configure({ lm: new MockLM({}, "answer: hello") });
    const fn = functional((_: Record<string, unknown>) => ({}), "question -> answer");
    const result = await fn.forward({ question: "Hi?" });
    expect(result).toBeInstanceOf(Prediction);
  });
});

// ---------------------------------------------------------------------------
// 9. Parameter class + namedParameters
// ---------------------------------------------------------------------------

describe("Phase 2: Parameter class", () => {
  it("Parameter wraps a value and updates with set()", () => {
    const p = new Parameter("initial");
    expect(p.value).toBe("initial");
    p.value = "updated";
    expect(p.value).toBe("updated");
  });

  it("Module.namedParameters() discovers Parameter fields", () => {
    class ParamModule extends Module {
      instruction = new Parameter("Solve the problem");
      async forward(): Promise<Prediction> { return new Prediction({}); }
    }
    const m = new ParamModule();
    const params = m.namedParameters();
    expect(params.some(([name]) => name === "instruction")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 10. Evaluate class wrapper
// ---------------------------------------------------------------------------

describe("Phase 3: Evaluate class", () => {
  it("run() evaluates a module and returns a score", async () => {
    settings.configure({ lm: new MockLM({}, "answer: yes") });
    const devset = [
      new Example({ question: "Q1?", answer: "yes" }),
      new Example({ question: "Q2?", answer: "yes" }),
    ];
    const evaluator = new Evaluate({
      devset,
      metric: exactMatch(),
    });
    const score = await evaluator.run(new QAModule());
    // Evaluate returns an EvaluationResult object with a .score property
    expect(typeof score.score).toBe("number");
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// 11. Document + DocumentRetriever + Citations integration
// ---------------------------------------------------------------------------

describe("Phase 3/4: Document + DocumentRetriever + Citations", () => {
  it("DocumentRetriever retrieves relevant Documents for a RAG pipeline", async () => {
    const docs = [
      new Document({ title: "TS",  body: "TypeScript is a typed language." }),
      new Document({ title: "JS",  body: "JavaScript is dynamic and untyped." }),
      new Document({ title: "Go",  body: "Go is compiled and statically typed." }),
    ];
    const rm = new DocumentRetriever({ documents: docs });
    const results = await rm.retrieve("typed language", 2);
    expect(results.length).toBe(2);
    expect(results.some((r) => r.includes("TypeScript") || r.includes("Go"))).toBe(true);
  });

  it("Citations module accepts Document[] as context", async () => {
    settings.configure({
      lm: new MockLM({}, "answer: TypeScript\ncitations: [0]"),
    });
    const docs = [
      new Document({ body: "TypeScript is typed." }),
      new Document({ body: "Python is dynamic." }),
    ];
    const citer = new Citations();
    const result = await citer.forward({
      context: docs,
      question: "Which is typed?",
    });
    expect(result).toBeInstanceOf(Prediction);
  });
});

// ---------------------------------------------------------------------------
// 12. Full RAG pipeline using new features together
// ---------------------------------------------------------------------------

describe("Phase 4: Full new-features integration pipeline", () => {
  it("RAG with DocumentRetriever → Citations → Evaluate", async () => {
    settings.configure({ lm: new MockLM({}, "answer: Paris\ncitations: [0]") });

    const corpus = [
      new Document({ body: "Paris is the capital of France." }),
      new Document({ body: "Berlin is the capital of Germany." }),
      new Document({ body: "Rome is the capital of Italy." }),
    ];
    const rm = new DocumentRetriever({ documents: corpus });
    settings.configure({ rm });

    // Retrieve relevant docs
    const retrieved = await rm.retrieveDocuments("capital France", 1);
    expect(retrieved[0]).toBeInstanceOf(Document);
    expect(retrieved[0]!.body).toContain("Paris");

    // Run Citations with retrieved docs
    const citer = new Citations();
    const result = await citer.forward({
      context: retrieved,
      question: "What is the capital of France?",
    });
    expect(result).toBeInstanceOf(Prediction);
  });

  it("backtrackHandler + AssertionContext provides trace info", async () => {
    settings.configure({ lm: new MockLM({}, "answer: test") });
    let capturedContext: unknown;

    class ContextModule extends Module {
      #attempt = 0;
      async forward(inputs: Record<string, unknown>): Promise<Prediction> {
        this.#attempt++;
        if (this.#attempt === 1) {
          try {
            Assert(false, "needs retry", {
              inputs,
              outputs: { answer: "bad" },
              trace: "ContextModule.forward",
            });
          } catch (e) {
            capturedContext = (e as AssertionError).context;
            throw e;
          }
        }
        return new Prediction({ answer: "ok" });
      }
    }

    const wrapped = backtrackHandler(new ContextModule(), { maxRetries: 2 });
    await wrapped.forward({ question: "test?" });

    expect((capturedContext as any)?.trace).toBe("ContextModule.forward");
    expect((capturedContext as any)?.outputs).toEqual({ answer: "bad" });
  });
});
