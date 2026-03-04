import { describe, it, expect, vi } from "vitest";
import { Suggest } from "../../src/assertions/Suggest.js";

describe("Suggest", () => {
  it("does not log for truthy values", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    Suggest(true);
    Suggest(1);
    Suggest("text");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("logs a warning for falsy values", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    Suggest(false, "bad value");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("[DSTsx Suggest] bad value");
    spy.mockRestore();
  });

  it("does not throw for falsy values", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => Suggest(false, "oops")).not.toThrow();
    spy.mockRestore();
  });

  it("uses custom message", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    Suggest(null, "custom warning");
    expect(spy).toHaveBeenCalledWith("[DSTsx Suggest] custom warning");
    spy.mockRestore();
  });

  it("uses default message when not provided", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    Suggest(false);
    expect(spy).toHaveBeenCalledWith("[DSTsx Suggest] Condition not met");
    spy.mockRestore();
  });
});
