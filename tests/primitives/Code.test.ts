import { describe, it, expect } from "vitest";
import { Code } from "../../src/primitives/Code.js";

describe("Code", () => {
  it("from() creates a Code instance", () => {
    const code = Code.from("console.log('hello')", "javascript");
    expect(code.value).toBe("console.log('hello')");
    expect(code.language).toBe("javascript");
  });

  it("toString() returns the code value", () => {
    const code = Code.from("x = 1", "python");
    expect(code.toString()).toBe("x = 1");
  });

  it("toJSON() returns structured data", () => {
    const code = Code.from("fn main() {}", "rust");
    const json = code.toJSON();
    expect(json.value).toBe("fn main() {}");
    expect(json.language).toBe("rust");
  });

  it("defaults to javascript language", () => {
    const code = Code.from("let x = 1");
    expect(code.language).toBe("javascript");
  });
});
