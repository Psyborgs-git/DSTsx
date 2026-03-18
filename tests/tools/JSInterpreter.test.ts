import { describe, it, expect } from "vitest";
import { JSInterpreter } from "../../src/tools/JSInterpreter.js";

describe("JSInterpreter", () => {
  it("executes code with function sandbox", async () => {
    const interpreter = new JSInterpreter({ sandbox: "function" });
    const result = await interpreter.execute("return 2 + 2");
    expect(result).toBe("4");
  });

  it("executes code with worker sandbox", async () => {
    const interpreter = new JSInterpreter({ sandbox: "worker" });
    const result = await interpreter.execute("return 2 + 2");
    expect(result).toBe("4");
  });

  it("asTool() returns a Tool interface", () => {
    const interpreter = new JSInterpreter();
    const tool = interpreter.asTool();
    expect(tool.name).toBe("js_interpreter");
    expect(typeof tool.fn).toBe("function");
  });

  it("times out on long-running code", async () => {
    const interpreter = new JSInterpreter({ sandbox: "function", timeoutMs: 100 });
    await expect(
      interpreter.execute("return new Promise(resolve => setTimeout(resolve, 5000))")
    ).rejects.toThrow(/timed out/);
  });
});
