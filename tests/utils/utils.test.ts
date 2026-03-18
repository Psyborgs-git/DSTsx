import { describe, it, expect, beforeEach } from "vitest";
import { inspectHistory } from "../../src/utils/inspectHistory.js";
import { configureCache } from "../../src/utils/configureCache.js";
import { enableLogging, disableLogging, suppressProviderLogs } from "../../src/utils/logging.js";
import { StreamListener } from "../../src/utils/StreamListener.js";
import { StatusMessageProvider, statusProvider } from "../../src/utils/StatusMessage.js";
import { asyncify } from "../../src/utils/asyncify.js";
import { streamify } from "../../src/utils/streamify.js";
import { registerModule, ModuleRegistry } from "../../src/utils/load.js";
import { settings } from "../../src/settings/Settings.js";
import { MockLM } from "../../src/lm/adapters/MockLM.js";
import { Predict } from "../../src/modules/Predict.js";

describe("Utilities", () => {
  beforeEach(() => settings.reset());

  describe("inspectHistory", () => {
    it("runs without error when no LM configured", () => {
      expect(() => inspectHistory()).not.toThrow();
    });

    it("runs with LM configured", () => {
      settings.configure({ lm: new MockLM({}, "test") });
      expect(() => inspectHistory(1, "text")).not.toThrow();
    });

    it("json format works", () => {
      settings.configure({ lm: new MockLM({}, "test") });
      expect(() => inspectHistory(1, "json")).not.toThrow();
    });
  });

  describe("configureCache", () => {
    it("sets cache directory", () => {
      configureCache({ cacheDir: "/tmp/test-cache" });
      expect(settings.cacheDir).toBe("/tmp/test-cache");
    });

    it("disables cache", () => {
      configureCache({ cacheDir: "/tmp/test" });
      configureCache({ enabled: false });
      expect(settings.cacheDir).toBe("");
    });
  });

  describe("logging", () => {
    it("enableLogging sets debug level", () => {
      enableLogging();
      expect(settings.logLevel).toBe("debug");
    });

    it("disableLogging sets silent level", () => {
      disableLogging();
      expect(settings.logLevel).toBe("silent");
    });

    it("suppressProviderLogs sets error level", () => {
      suppressProviderLogs();
      expect(settings.logLevel).toBe("error");
    });
  });

  describe("StreamListener", () => {
    it("accumulates chunks", () => {
      const listener = new StreamListener();
      listener.observe({ delta: "hello ", done: false, raw: null });
      listener.observe({ delta: "world", done: true, raw: null });
      expect(listener.accumulated).toBe("hello world");
    });

    it("reset clears buffer", () => {
      const listener = new StreamListener();
      listener.observe({ delta: "test", done: false, raw: null });
      listener.reset();
      expect(listener.accumulated).toBe("");
    });
  });

  describe("StatusMessageProvider", () => {
    it("emits and receives status messages", () => {
      const provider = new StatusMessageProvider();
      let received: unknown;
      provider.on("status", (msg) => { received = msg; });
      provider.emit("status", { type: "info", text: "test" });
      expect(received).toEqual({ type: "info", text: "test" });
    });

    it("statusProvider is a singleton", () => {
      expect(statusProvider).toBeInstanceOf(StatusMessageProvider);
    });
  });

  describe("asyncify", () => {
    it("returns the same module (passthrough)", () => {
      const predict = new Predict("q -> a");
      const wrapped = asyncify(predict);
      expect(wrapped).toBe(predict);
    });
  });

  describe("streamify", () => {
    it("adds stream method to module", () => {
      const predict = new Predict("q -> a");
      const wrapped = streamify(predict);
      expect(typeof (wrapped as any).stream).toBe("function");
    });
  });

  describe("ModuleRegistry", () => {
    it("registerModule adds to registry", () => {
      registerModule("TestModule", Predict as any);
      expect(ModuleRegistry.has("TestModule")).toBe(true);
    });
  });
});
