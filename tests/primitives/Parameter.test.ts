import { describe, it, expect } from "vitest";
import { Parameter } from "../../src/primitives/Parameter.js";
import { Module } from "../../src/modules/Module.js";
import { Prediction } from "../../src/primitives/Prediction.js";

describe("Parameter", () => {
  it("initializes with a value", () => {
    const p = new Parameter<string>("initial");
    expect(p.value).toBe("initial");
  });

  it("allows updating the value", () => {
    const p = new Parameter<number>(1);
    p.value = 42;
    expect(p.value).toBe(42);
  });

  it("works with array values", () => {
    const p = new Parameter<string[]>(["a", "b"]);
    expect(p.value).toEqual(["a", "b"]);
  });

  it("clone() returns a new Parameter with the same value", () => {
    const p = new Parameter<string>("hello");
    const cloned = p.clone();
    expect(cloned.value).toBe("hello");
    expect(cloned).not.toBe(p);
  });

  it("clone() shallow-copies arrays", () => {
    const arr = ["a", "b", "c"];
    const p = new Parameter<string[]>(arr);
    const cloned = p.clone();
    expect(cloned.value).toEqual(arr);
    expect(cloned.value).not.toBe(arr); // different reference
  });

  it("mutating clone does not affect original", () => {
    const p = new Parameter<string[]>(["a"]);
    const cloned = p.clone();
    (cloned.value as string[]).push("b");
    expect(p.value).toEqual(["a"]); // original unchanged
  });

  it("toJSON() returns the wrapped value", () => {
    const p = new Parameter<number>(99);
    expect(p.toJSON()).toBe(99);
  });

  it("works with complex objects", () => {
    const obj = { key: "value", nested: { x: 1 } };
    const p = new Parameter<typeof obj>(obj);
    expect(p.value.key).toBe("value");
    expect(p.value.nested.x).toBe(1);
  });
});

describe("Module.namedParameters()", () => {
  it("discovers all Parameter instances in a module", () => {
    class MyModule extends Module {
      instruction = new Parameter<string>("Be helpful.");
      demos = new Parameter<string[]>([]);

      async forward(_inputs: unknown): Promise<Prediction> {
        return new Prediction({});
      }
    }

    const m = new MyModule();
    const params = m.namedParameters();
    const names = params.map(([n]) => n);
    expect(names).toContain("instruction");
    expect(names).toContain("demos");
  });

  it("returns Parameter instances as values", () => {
    class MyModule extends Module {
      p = new Parameter<number>(42);

      async forward(_inputs: unknown): Promise<Prediction> {
        return new Prediction({});
      }
    }

    const m = new MyModule();
    const [[, param]] = m.namedParameters();
    expect(param).toBeInstanceOf(Parameter);
    expect(param!.value).toBe(42);
  });

  it("discovers Parameters in nested modules", () => {
    class Inner extends Module {
      ip = new Parameter<string>("inner");
      async forward(_inputs: unknown): Promise<Prediction> {
        return new Prediction({});
      }
    }

    class Outer extends Module {
      inner = new Inner();
      op = new Parameter<string>("outer");
      async forward(_inputs: unknown): Promise<Prediction> {
        return new Prediction({});
      }
    }

    const m = new Outer();
    const params = m.namedParameters();
    const names = params.map(([n]) => n);
    expect(names).toContain("inner.ip");
    expect(names).toContain("op");
  });

  it("Module.clone() also clones Parameter instances", () => {
    class MyModule extends Module {
      p = new Parameter<string[]>(["demo1"]);
      async forward(_inputs: unknown): Promise<Prediction> {
        return new Prediction({});
      }
    }

    const m = new MyModule();
    const cloned = m.clone();
    (cloned.p.value as string[]).push("demo2");
    expect(m.p.value).toEqual(["demo1"]); // original unchanged
  });
});
