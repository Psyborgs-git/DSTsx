import { describe, it, expect, beforeEach } from "vitest";
import { settings } from "../../src/settings/Settings.js";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const TMP_DIR = "/tmp/dstsx-settings-test";

describe("Settings save/load", () => {
  beforeEach(() => {
    settings.reset();
    mkdirSync(TMP_DIR, { recursive: true });
  });

  it("save writes settings to JSON file", () => {
    settings.configure({ logLevel: "debug", cacheDir: "/tmp/cache" });
    const path = join(TMP_DIR, "settings.json");
    settings.save(path);
    expect(existsSync(path)).toBe(true);
  });

  it("load restores settings from JSON file", () => {
    const path = join(TMP_DIR, "settings-load.json");
    writeFileSync(path, JSON.stringify({ logLevel: "info", cacheDir: "/tmp/test-cache" }));
    settings.load(path);
    expect(settings.logLevel).toBe("info");
    expect(settings.cacheDir).toBe("/tmp/test-cache");
  });

  it("round-trip save and load", () => {
    settings.configure({ logLevel: "error" });
    const path = join(TMP_DIR, "roundtrip.json");
    settings.save(path);
    settings.reset();
    settings.load(path);
    expect(settings.logLevel).toBe("error");
    rmSync(TMP_DIR, { recursive: true, force: true });
  });
});
