import { describe, it, expect } from "vitest";
import { Tool } from "../../src/tools/Tool.js";

function getWeather(city: string, units: string): string {
  return `Weather in ${city} (${units}): sunny`;
}

describe("Tool", () => {
  it("infers name from function name", () => {
    const tool = new Tool(getWeather);
    expect(tool.name).toBe("getWeather");
  });

  it("uses custom name when provided", () => {
    const tool = new Tool(getWeather, { name: "weather_tool" });
    expect(tool.name).toBe("weather_tool");
  });

  it("uses custom description when provided", () => {
    const tool = new Tool(getWeather, { description: "Get current weather" });
    expect(tool.description).toBe("Get current weather");
  });

  it("infers default description from function name", () => {
    const tool = new Tool(getWeather);
    expect(tool.description).toContain("getWeather");
  });

  it("infers args from function parameter names", () => {
    const tool = new Tool(getWeather);
    expect(Object.keys(tool.args)).toContain("city");
    expect(Object.keys(tool.args)).toContain("units");
  });

  it("uses custom args when provided", () => {
    const tool = new Tool(getWeather, {
      args: { city: { type: "string", description: "City name" } },
    });
    expect(tool.args["city"]).toBeDefined();
    expect(tool.args["city"]!.description).toBe("City name");
  });

  it("Tool.from() is a static factory alias", () => {
    const tool = Tool.from(getWeather);
    expect(tool).toBeInstanceOf(Tool);
    expect(tool.name).toBe("getWeather");
  });

  it("call() invokes the underlying function synchronously", () => {
    const tool = new Tool(getWeather);
    const result = tool.call("Paris", "metric");
    expect(result).toContain("Paris");
  });

  it("acall() invokes the underlying function asynchronously", async () => {
    const tool = new Tool(getWeather);
    const result = await tool.acall("London", "imperial");
    expect(result).toContain("London");
  });

  it("asTool() returns a ToolLike interface", async () => {
    const tool = new Tool(getWeather);
    const tl = tool.asTool();
    expect(tl.name).toBe("getWeather");
    expect(tl.description).toBeDefined();
    expect(typeof tl.fn).toBe("function");
  });

  it("asTool().fn parses JSON array arguments", async () => {
    const tool = new Tool(getWeather);
    const result = await tool.asTool().fn(JSON.stringify(["Berlin", "metric"]));
    expect(result).toContain("Berlin");
  });

  it("asTool().fn parses JSON object arguments", async () => {
    const tool = new Tool(getWeather);
    const result = await tool.asTool().fn(JSON.stringify({ city: "Tokyo", units: "metric" }));
    expect(result).toContain("Tokyo");
  });

  it("asTool().fn handles plain string argument", async () => {
    const echo = new Tool((x: unknown) => String(x), { name: "echo", args: {} });
    const result = await echo.asTool().fn("hello");
    expect(result).toBe("hello");
  });

  it("formatAsOpenAIFunction() returns correct descriptor", () => {
    const tool = new Tool(getWeather, {
      description: "Get weather",
      args: {
        city: { type: "string", description: "City name", required: true },
        units: { type: "string", description: "Units", required: false },
      },
    });
    const desc = tool.formatAsOpenAIFunction();
    expect(desc.type).toBe("function");
    expect(desc.function.name).toBe("getWeather");
    expect(desc.function.description).toBe("Get weather");
    expect(desc.function.parameters.properties["city"]).toBeDefined();
    expect(desc.function.parameters.required).toContain("city");
    expect(desc.function.parameters.required).not.toContain("units");
  });

  it("works with async functions", async () => {
    const asyncGreet = async (name: string) => `Hello, ${name}!`;
    const tool = new Tool(asyncGreet);
    const result = await tool.acall("World");
    expect(result).toBe("Hello, World!");
  });

  it("works with arrow functions", () => {
    const add = (a: unknown, b: unknown) => Number(a) + Number(b);
    const tool = Tool.from(add);
    expect(tool.name).toBe("add");
    const keys = Object.keys(tool.args);
    expect(keys).toContain("a");
    expect(keys).toContain("b");
  });
});
