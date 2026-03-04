import { describe, it, expect, beforeEach } from "vitest";
import {
  Module,
  Predict,
  ChainOfThought,
  Retrieve,
  Retry,
  BestOfN,
  Ensemble,
} from "../../src/modules/index.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { MockRetriever } from "../../src/retrieve/backends/MockRetriever.js";
import { settings } from "../../src/settings/Settings.js";
import { Example } from "../../src/primitives/Example.js";
import { Prediction } from "../../src/primitives/Prediction.js";
import { evaluate } from "../../src/evaluate/evaluate.js";
import { exactMatch, f1 } from "../../src/evaluate/metrics.js";
import { LabeledFewShot } from "../../src/optimizers/LabeledFewShot.js";
import { BootstrapFewShot } from "../../src/optimizers/BootstrapFewShot.js";
import { KNNFewShot } from "../../src/optimizers/KNNFewShot.js";
import { Assert, AssertionError } from "../../src/assertions/Assert.js";
import { Suggest } from "../../src/assertions/Suggest.js";
import { Signature } from "../../src/signatures/Signature.js";

// ---------------------------------------------------------------------------
// Reusable helper: wraps a Predict in a Module so optimizers can discover it
// via namedPredictors().  Overrides clone() to construct a new Predict through
// the constructor (Module.clone uses Object.create which doesn't install JS
// private fields required by Predict).
// ---------------------------------------------------------------------------
class QAModule extends Module {
  predict: Predict;

  constructor(signature: string | Signature = "question -> answer") {
    super();
    this.predict = new Predict(signature);
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

/** Extract a named Predict sub-module from a compiled module. */
function getPredictor(mod: Module, name = "predict"): Predict {
  const found = mod.namedPredictors().find(([n]) => n === name);
  if (!found) throw new Error(`Predictor "${name}" not found`);
  return found[1] as Predict;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("E2E Pipeline Tests", () => {
  beforeEach(() => {
    settings.reset();
  });

  // =========================================================================
  // 1. QA Pipeline: Predict → Evaluate
  // =========================================================================
  describe("QA Pipeline: Predict → Evaluate", () => {
    it("evaluates QA predictions with exactMatch metric", async () => {
      // MockLM always returns "Paris" regardless of prompt
      const lm = new MockLM({}, "answer: Paris");
      settings.configure({ lm });

      const qa = new Predict("question -> answer");

      const devset = [
        new Example({ question: "Capital of France?", answer: "Paris" }),
        new Example({ question: "Capital of Germany?", answer: "Berlin" }),
        new Example({ question: "Capital of Japan?", answer: "Tokyo" }),
      ];

      const result = await evaluate(qa, devset, exactMatch());

      // Only "Paris" matches — 1 out of 3
      expect(result.total).toBe(3);
      expect(result.numPassed).toBe(1);
      expect(result.score).toBeCloseTo(1 / 3);
      expect(result.results[0]!.passed).toBe(true);
      expect(result.results[1]!.passed).toBe(false);
      expect(result.results[2]!.passed).toBe(false);
    });

    it("scores perfectly when all answers match", async () => {
      const lm = new MockLM({}, "answer: yes");
      settings.configure({ lm });

      const qa = new Predict("question -> answer");
      const devset = [
        new Example({ question: "Is the sky blue?", answer: "yes" }),
        new Example({ question: "Is water wet?", answer: "yes" }),
      ];

      const result = await evaluate(qa, devset, exactMatch());
      expect(result.score).toBe(1);
      expect(result.numPassed).toBe(2);
    });
  });

  // =========================================================================
  // 2. Chain-of-Thought Pipeline
  // =========================================================================
  describe("Chain-of-Thought Pipeline", () => {
    it("generates rationale internally and strips it from output", async () => {
      const lm = new MockLM(
        {},
        "rationale: Let me think step by step. 2 plus 2 equals 4.\nanswer: 4",
      );
      settings.configure({ lm });

      const cot = new ChainOfThought("question -> answer");

      const questions = ["What is 2+2?", "What is 3+3?", "What is 4+4?"];
      for (const q of questions) {
        const result = await cot.forward({ question: q });
        // Answer should be parsed correctly
        expect(result.get("answer")).toBe("4");
        // Rationale must NOT be visible in the returned prediction
        expect(result.get("rationale")).toBeUndefined();
      }
    });

    it("works with evaluate using exactMatch", async () => {
      const lm = new MockLM(
        {},
        "rationale: Thinking...\nanswer: 42",
      );
      settings.configure({ lm });

      const cot = new ChainOfThought("question -> answer");
      const devset = [
        new Example({ question: "Life, the universe?", answer: "42" }),
        new Example({ question: "Another question?", answer: "wrong" }),
      ];

      const result = await evaluate(cot, devset, exactMatch());
      expect(result.numPassed).toBe(1);
      expect(result.score).toBeCloseTo(0.5);
    });
  });

  // =========================================================================
  // 3. Retrieve + Generate RAG Pipeline
  // =========================================================================
  describe("RAG Pipeline: Retrieve + Generate", () => {
    it("retrieves passages and generates an answer", async () => {
      const passages = [
        "Paris is the capital of France.",
        "Berlin is the capital of Germany.",
        "Tokyo is the capital of Japan.",
      ];
      const rm = new MockRetriever(passages);
      const lm = new MockLM({}, "answer: Paris");
      settings.configure({ lm, rm });

      class RAG extends Module {
        retrieve = new Retrieve(3);
        generate = new Predict("context, question -> answer");
        lastPassages: string[] = [];

        async forward(inputs: Record<string, unknown>): Promise<Prediction> {
          const query = String(inputs["question"] ?? "");
          const retrieved = await this.retrieve.forward(query);
          this.lastPassages = retrieved.get("passages") as string[];
          return this.generate.forward({
            context: this.lastPassages.join("\n"),
            question: query,
          });
        }
      }

      const rag = new RAG();
      const result = await rag.forward({ question: "France" });

      // Answer should come from the generation step
      expect(result.get("answer")).toBe("Paris");

      // MockRetriever matches "france" → returns the passage about France
      expect(rag.lastPassages.length).toBeGreaterThan(0);
      expect(rag.lastPassages[0]).toContain("France");
    });

    it("falls back to first-k passages when no substring match", async () => {
      const passages = ["Passage A", "Passage B", "Passage C"];
      const rm = new MockRetriever(passages);
      const lm = new MockLM({}, "answer: fallback");
      settings.configure({ lm, rm });

      const retrieve = new Retrieve(2);
      const result = await retrieve.forward("no-match-query");
      const returned = result.get("passages") as string[];

      expect(returned).toHaveLength(2);
      expect(returned[0]).toBe("Passage A");
      expect(returned[1]).toBe("Passage B");
    });
  });

  // =========================================================================
  // 4. LabeledFewShot Optimization → Evaluation
  // =========================================================================
  describe("LabeledFewShot Optimization → Evaluation", () => {
    it("assigns labeled demos to all Predict sub-modules", async () => {
      const lm = new MockLM({}, "answer: 4");
      settings.configure({ lm });

      const trainset = [
        new Example({ question: "1+1?", answer: "2" }),
        new Example({ question: "2+2?", answer: "4" }),
        new Example({ question: "3+3?", answer: "6" }),
      ];

      const student = new QAModule();
      const optimizer = new LabeledFewShot(2);
      const optimized = await optimizer.compile(student, trainset, exactMatch());

      // Verify demos were assigned (first k=2 examples)
      const predict = getPredictor(optimized);
      expect(predict.demos).toHaveLength(2);
      expect(predict.demos[0]!.get("question")).toBe("1+1?");
      expect(predict.demos[1]!.get("question")).toBe("2+2?");

      // Original student is not mutated
      expect(student.predict.demos).toHaveLength(0);
    });

    it("evaluates the optimized module", async () => {
      const lm = new MockLM({}, "answer: 4");
      settings.configure({ lm });

      const trainset = [
        new Example({ question: "2+2?", answer: "4" }),
        new Example({ question: "3+3?", answer: "6" }),
      ];
      const devset = [
        new Example({ question: "4+4?", answer: "4" }),
        new Example({ question: "5+5?", answer: "10" }),
      ];

      const optimizer = new LabeledFewShot(2);
      const optimized = await optimizer.compile(new QAModule(), trainset, exactMatch());
      const result = await evaluate(optimized, devset, exactMatch());

      // LM always returns "4" → matches first devset example only
      expect(result.total).toBe(2);
      expect(result.numPassed).toBe(1);
    });
  });

  // =========================================================================
  // 5. BootstrapFewShot Optimization → Evaluation
  // =========================================================================
  describe("BootstrapFewShot Optimization → Evaluation", () => {
    it("collects passing demos via teacher execution", async () => {
      const lm = new MockLM({}, "answer: 4");
      settings.configure({ lm });

      const trainset = [
        new Example({ question: "2+2?", answer: "4" }),   // LM returns "4" → passes
        new Example({ question: "1+3?", answer: "4" }),   // LM returns "4" → passes
        new Example({ question: "3+3?", answer: "6" }),   // LM returns "4" → fails
        new Example({ question: "5+5?", answer: "10" }),  // LM returns "4" → fails
      ];

      const student = new QAModule();
      const optimizer = new BootstrapFewShot({ maxBootstrappedDemos: 2 });
      const optimized = await optimizer.compile(student, trainset, exactMatch());

      // Only the 2 passing examples are collected as demos
      const predict = getPredictor(optimized);
      expect(predict.demos).toHaveLength(2);
    });

    it("evaluates the bootstrapped module", async () => {
      const lm = new MockLM({}, "answer: 4");
      settings.configure({ lm });

      const trainset = [
        new Example({ question: "2+2?", answer: "4" }),
        new Example({ question: "1+3?", answer: "4" }),
      ];
      const devset = [
        new Example({ question: "7+1?", answer: "4" }),
        new Example({ question: "9+1?", answer: "10" }),
      ];

      const optimizer = new BootstrapFewShot({ maxBootstrappedDemos: 2 });
      const optimized = await optimizer.compile(new QAModule(), trainset, exactMatch());
      const result = await evaluate(optimized, devset, exactMatch());

      expect(result.total).toBe(2);
      expect(result.numPassed).toBe(1); // "4" matches first devset example
    });
  });

  // =========================================================================
  // 6. Retry + Assert Pipeline
  // =========================================================================
  describe("Retry + Assert Pipeline", () => {
    it("retries on assertion failure and succeeds on second attempt", async () => {
      const lm = new MockLM({}, "answer: 42");
      settings.configure({ lm });

      class ValidatedQA extends Module {
        predict = new Predict("question -> answer");
        callCount = 0;

        async forward(inputs: Record<string, unknown>): Promise<Prediction> {
          this.callCount++;
          const result = await this.predict.forward(inputs);
          // Fail the first attempt with a hard assertion
          Assert(this.callCount > 1, "First attempt always fails");
          return result;
        }
      }

      const inner = new ValidatedQA();
      const retry = new Retry(inner, 3);
      const result = await retry.forward({ question: "What is the answer?" });

      expect(result.get("answer")).toBe("42");
      expect(inner.callCount).toBe(2); // Failed once, succeeded on retry
    });

    it("throws after all retry attempts are exhausted", async () => {
      const lm = new MockLM({}, "answer: bad");
      settings.configure({ lm });

      class AlwaysFails extends Module {
        predict = new Predict("question -> answer");

        async forward(inputs: Record<string, unknown>): Promise<Prediction> {
          const result = await this.predict.forward(inputs);
          Assert(false, "Permanent failure");
          return result;
        }
      }

      const retry = new Retry(new AlwaysFails(), 2);
      await expect(retry.forward({ question: "test" })).rejects.toThrow(
        AssertionError,
      );
    });

    it("Suggest does not throw — only logs a warning", async () => {
      const lm = new MockLM({}, "answer: ok");
      settings.configure({ lm });

      const predict = new Predict("question -> answer");
      const result = await predict.forward({ question: "test" });

      // Suggest is a soft warning, never throws
      expect(() => Suggest(false, "This is just a warning")).not.toThrow();
      expect(result.get("answer")).toBe("ok");
    });
  });

  // =========================================================================
  // 7. BestOfN Pipeline
  // =========================================================================
  describe("BestOfN Pipeline", () => {
    it("runs N copies and invokes the reduce function", async () => {
      const lm = new MockLM({}, "answer: 42");
      settings.configure({ lm });

      const predict = new Predict("question -> answer");
      let reduceCalled = false;
      let receivedCount = 0;

      const bestOfN = new BestOfN(predict, 3, (preds) => {
        reduceCalled = true;
        receivedCount = preds.length;
        // Pick the "best" — they're all identical with MockLM
        return preds[0]!;
      });

      const result = await bestOfN.forward({ question: "What is the answer?" });

      expect(reduceCalled).toBe(true);
      expect(receivedCount).toBe(3);
      expect(result.get("answer")).toBe("42");
    });

    it("defaults to first prediction when no reduce function given", async () => {
      const lm = new MockLM({}, "answer: default");
      settings.configure({ lm });

      const bestOfN = new BestOfN(new Predict("question -> answer"), 5);
      const result = await bestOfN.forward({ question: "test" });

      expect(result.get("answer")).toBe("default");
    });
  });

  // =========================================================================
  // 8. Ensemble Module Pipeline
  // =========================================================================
  describe("Ensemble Module Pipeline", () => {
    it("runs all modules and reduces their results", async () => {
      const lm = new MockLM({}, "answer: yes");
      settings.configure({ lm });

      const m1 = new Predict("question -> answer");
      const m2 = new Predict("question -> answer");
      const m3 = new Predict("question -> answer");

      let receivedPreds: Prediction[] = [];
      const ensemble = new Ensemble([m1, m2, m3], (preds) => {
        receivedPreds = preds;
        return preds[0]!;
      });

      const result = await ensemble.forward({ question: "Is the sky blue?" });

      // All 3 modules were called
      expect(receivedPreds).toHaveLength(3);
      expect(result.get("answer")).toBe("yes");

      // Every module produced the same answer
      for (const p of receivedPreds) {
        expect(p.get("answer")).toBe("yes");
      }
    });

    it("works with modules having different signatures", async () => {
      const lm = new MockLM({}, "answer: combined");
      settings.configure({ lm });

      const formal = new Predict("question -> answer");
      const casual = new Predict("query -> answer");

      let callCount = 0;
      const ensemble = new Ensemble([formal, casual], (preds) => {
        callCount = preds.length;
        return preds[0]!;
      });

      // Both modules accept their respective inputs
      const result = await ensemble.forward({ question: "test", query: "test" });
      expect(callCount).toBe(2);
      expect(result.get("answer")).toBe("combined");
    });
  });

  // =========================================================================
  // 9. Settings Context Isolation
  // =========================================================================
  describe("Settings Context Isolation", () => {
    it("provides different LMs to concurrent async contexts", async () => {
      const lm1 = new MockLM({}, "answer: from-lm1");
      const lm2 = new MockLM({}, "answer: from-lm2");

      const predict = new Predict("question -> answer");

      const [r1, r2] = await Promise.all([
        settings.context({ lm: lm1 }, () =>
          predict.forward({ question: "test" }),
        ),
        settings.context({ lm: lm2 }, () =>
          predict.forward({ question: "test" }),
        ),
      ]);

      expect(r1.get("answer")).toBe("from-lm1");
      expect(r2.get("answer")).toBe("from-lm2");
    });

    it("context overrides do not leak to the global scope", async () => {
      const globalLm = new MockLM({}, "answer: global");
      settings.configure({ lm: globalLm });

      const predict = new Predict("question -> answer");

      await settings.context(
        { lm: new MockLM({}, "answer: scoped") },
        async () => {
          const r = await predict.forward({ question: "inside" });
          expect(r.get("answer")).toBe("scoped");
        },
      );

      // Global LM is unaffected after the context exits
      const result = await predict.forward({ question: "outside" });
      expect(result.get("answer")).toBe("global");
    });

    it("nested contexts override outer contexts", async () => {
      const outerLm = new MockLM({}, "answer: outer");
      const innerLm = new MockLM({}, "answer: inner");

      const predict = new Predict("question -> answer");

      await settings.context({ lm: outerLm }, async () => {
        const r1 = await predict.forward({ question: "q1" });
        expect(r1.get("answer")).toBe("outer");

        await settings.context({ lm: innerLm }, async () => {
          const r2 = await predict.forward({ question: "q2" });
          expect(r2.get("answer")).toBe("inner");
        });

        // Back to outer after inner context exits
        const r3 = await predict.forward({ question: "q3" });
        expect(r3.get("answer")).toBe("outer");
      });
    });
  });

  // =========================================================================
  // 10. Module Serialization Round-trip
  // =========================================================================
  describe("Module Serialization Round-trip", () => {
    it("dump and load preserve demos and instructions", async () => {
      const lm = new MockLM({}, "answer: 42");
      settings.configure({ lm });

      const original = new QAModule();
      original.predict.demos = [
        new Example({ question: "1+1?", answer: "2" }),
        new Example({ question: "2+2?", answer: "4" }),
      ];
      original.predict.instructions = "Be concise.";

      // Dump state
      const state = original.dump();
      expect(state["predict"]).toBeDefined();

      // Load into a fresh module
      const restored = new QAModule();
      restored.load(state);

      expect(restored.predict.demos).toHaveLength(2);
      expect(restored.predict.demos[0]!.get("question")).toBe("1+1?");
      expect(restored.predict.demos[1]!.get("answer")).toBe("4");
      expect(restored.predict.instructions).toBe("Be concise.");

      // Both produce the same result
      const r1 = await original.forward({ question: "test" });
      const r2 = await restored.forward({ question: "test" });
      expect(r1.get("answer")).toBe(r2.get("answer"));
    });

    it("clone creates an independent copy", async () => {
      const lm = new MockLM({}, "answer: cloned");
      settings.configure({ lm });

      const original = new QAModule();
      original.predict.demos = [new Example({ question: "x", answer: "y" })];

      const cloned = original.clone();

      // Modify clone — original must be unaffected
      cloned.predict.demos = [];
      expect(original.predict.demos).toHaveLength(1);
      expect(cloned.predict.demos).toHaveLength(0);

      // Both still work independently
      const r = await original.forward({ question: "test" });
      expect(r.get("answer")).toBe("cloned");
    });
  });

  // =========================================================================
  // 11. KNNFewShot Dynamic Demo Selection
  // =========================================================================
  describe("KNNFewShot Dynamic Demo Selection", () => {
    it("dynamically selects nearest demos at inference time", async () => {
      // Deterministic embedding: distribute char codes across 3 dimensions
      const embeddingFn = async (text: string): Promise<number[]> => {
        const vec = [0, 0, 0];
        for (let i = 0; i < text.length; i++) {
          vec[i % 3]! += text.charCodeAt(i);
        }
        return vec;
      };

      const lm = new MockLM({}, "answer: result");
      settings.configure({ lm });

      const trainset = [
        new Example({ question: "math problem", answer: "42" }),
        new Example({ question: "science question", answer: "physics" }),
        new Example({ question: "math quiz", answer: "7" }),
        new Example({ question: "history lesson", answer: "1776" }),
      ];

      const student = new QAModule();
      const optimizer = new KNNFewShot({
        k: 2,
        embeddingFn,
        keyField: "question",
      });
      const optimized = await optimizer.compile(student, trainset, exactMatch());

      // Run forward — demos should be dynamically injected by KNN
      const result = await optimized.forward({ question: "math test" });
      expect(result.get("answer")).toBe("result");

      // After forward, the predict module should have 2 nearest demos
      const predict = getPredictor(optimized);
      expect(predict.demos).toHaveLength(2);

      // The two math-related examples should be selected as nearest neighbors
      const demoQuestions = predict.demos.map((d) => d.get("question"));
      expect(demoQuestions).toContain("math quiz");
      expect(demoQuestions).toContain("math problem");
    });
  });

  // =========================================================================
  // 12. Full Pipeline: Optimize → Evaluate → Compare
  // =========================================================================
  describe("Full Pipeline: Optimize → Evaluate → Compare", () => {
    it("optimized module scores >= baseline", async () => {
      const lm = new MockLM({}, "answer: 4");
      settings.configure({ lm });

      const trainset = [
        new Example({ question: "2+2?", answer: "4" }),
        new Example({ question: "1+3?", answer: "4" }),
        new Example({ question: "0+4?", answer: "4" }),
      ];

      const devset = [
        new Example({ question: "4+0?", answer: "4" }),
        new Example({ question: "5+5?", answer: "10" }),
        new Example({ question: "2+2?", answer: "4" }),
      ];

      // Baseline evaluation (no demos)
      const baseline = new QAModule();
      const baselineResult = await evaluate(baseline, devset, exactMatch());

      // Optimize with LabeledFewShot
      const optimizer = new LabeledFewShot(3);
      const optimized = await optimizer.compile(
        new QAModule(),
        trainset,
        exactMatch(),
      );

      // Evaluate optimized
      const optimizedResult = await evaluate(optimized, devset, exactMatch());

      // Both return "4" from MockLM → same scores (2/3)
      expect(optimizedResult.score).toBeGreaterThanOrEqual(baselineResult.score);
      expect(baselineResult.score).toBeCloseTo(2 / 3);
      expect(optimizedResult.score).toBeCloseTo(2 / 3);
      expect(baselineResult.total).toBe(3);
      expect(optimizedResult.total).toBe(3);
    });

    it("compares exactMatch and f1 metrics on the same pipeline", async () => {
      const lm = new MockLM({}, "answer: the quick brown fox");
      settings.configure({ lm });

      const devset = [
        new Example({
          question: "Complete the phrase",
          answer: "the quick brown fox",
        }),
        new Example({
          question: "Another phrase",
          answer: "a lazy dog",
        }),
      ];

      const module = new QAModule();
      const emResult = await evaluate(module, devset, exactMatch());
      const f1Result = await evaluate(module, devset, f1());

      // exactMatch: 1/2 (only first example matches exactly)
      expect(emResult.score).toBeCloseTo(0.5);

      // f1: first example has perfect F1 (1.0), second has some token overlap (0)
      // "the quick brown fox" vs "a lazy dog" → no shared tokens → 0
      // Average F1 = (1.0 + 0) / 2 = 0.5
      expect(f1Result.score).toBeCloseTo(0.5);
    });
  });
});
