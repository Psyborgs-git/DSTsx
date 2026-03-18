import { describe, it, expect } from "vitest";
import { Audio } from "../../src/primitives/Audio.js";

describe("Audio", () => {
  it("fromURL creates audio with URL", () => {
    const audio = Audio.fromURL("https://example.com/test.mp3");
    expect(audio.url).toBe("https://example.com/test.mp3");
    expect(audio.base64).toBeUndefined();
  });

  it("fromBase64 creates audio with base64 data", () => {
    const audio = Audio.fromBase64("dGVzdA==", "audio/wav");
    expect(audio.base64).toBe("dGVzdA==");
    expect(audio.mimeType).toBe("audio/wav");
  });

  it("toOpenAIContentPart returns correct structure", () => {
    const audio = Audio.fromBase64("dGVzdA==", "audio/mpeg");
    const part = audio.toOpenAIContentPart();
    expect(part.type).toBe("input_audio");
    expect(part.input_audio.data).toBe("dGVzdA==");
  });

  it("toGoogleAIContentPart returns inline data", () => {
    const audio = Audio.fromBase64("dGVzdA==", "audio/wav");
    const part = audio.toGoogleAIContentPart();
    expect(part.inlineData.mimeType).toBe("audio/wav");
    expect(part.inlineData.data).toBe("dGVzdA==");
  });

  it("toString includes URL", () => {
    const audio = Audio.fromURL("https://example.com/test.mp3");
    expect(audio.toString()).toContain("https://example.com/test.mp3");
  });

  it("toString includes base64 info", () => {
    const audio = Audio.fromBase64("dGVzdA==");
    expect(audio.toString()).toContain("base64");
  });
});
