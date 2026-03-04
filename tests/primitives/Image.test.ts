import { describe, it, expect } from "vitest";
import { Image } from "../../src/primitives/Image.js";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Image", () => {
  it("creates an Image from URL", () => {
    const img = Image.fromURL("https://example.com/photo.jpg");
    expect(img.url).toBe("https://example.com/photo.jpg");
    expect(img.base64).toBeUndefined();
  });

  it("creates an Image from base64 data", () => {
    const img = Image.fromBase64("abc123", "image/png");
    expect(img.base64).toBe("abc123");
    expect(img.mimeType).toBe("image/png");
    expect(img.url).toBeUndefined();
  });

  it("creates an Image from a file", () => {
    const path = join(tmpdir(), "test-image.png");
    writeFileSync(path, Buffer.from("fake png data"));
    try {
      const img = Image.fromFile(path);
      expect(img.base64).toBeDefined();
      expect(img.mimeType).toBe("image/png");
    } finally {
      unlinkSync(path);
    }
  });

  it("toOpenAIContentPart() works with URL", () => {
    const img = Image.fromURL("https://example.com/img.jpg");
    const part = img.toOpenAIContentPart();
    expect(part.type).toBe("image_url");
    expect(part.image_url.url).toBe("https://example.com/img.jpg");
  });

  it("toOpenAIContentPart() works with base64", () => {
    const img = Image.fromBase64("abc", "image/jpeg");
    const part = img.toOpenAIContentPart();
    expect(part.image_url.url).toContain("data:image/jpeg;base64,abc");
  });

  it("toAnthropicContentBlock() works with URL", () => {
    const img = Image.fromURL("https://example.com/img.jpg");
    const block = img.toAnthropicContentBlock();
    expect(block.type).toBe("image");
    expect(block.source.type).toBe("url");
    expect(block.source.url).toBe("https://example.com/img.jpg");
  });

  it("toAnthropicContentBlock() works with base64", () => {
    const img = Image.fromBase64("abc", "image/png");
    const block = img.toAnthropicContentBlock();
    expect(block.source.type).toBe("base64");
    expect(block.source.data).toBe("abc");
  });

  it("toString() returns a description", () => {
    expect(Image.fromURL("https://x.com/a.jpg").toString()).toContain("https://x.com/a.jpg");
    expect(Image.fromBase64("abc", "image/png").toString()).toContain("base64 data");
  });

  it("toOpenAIContentPart() throws when neither url nor base64 available", () => {
    // Access private constructor via Object.create to simulate an empty Image
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emptyImg = Object.create(Image.prototype) as Image;
    // Assign undefined properties directly (bypasses constructor)
    Object.assign(emptyImg, { url: undefined, base64: undefined, mimeType: undefined });
    expect(() => emptyImg.toOpenAIContentPart()).toThrow("Image: no url or base64 data available");
    expect(() => emptyImg.toAnthropicContentBlock()).toThrow("Image: no url or base64 data available");
  });
});
