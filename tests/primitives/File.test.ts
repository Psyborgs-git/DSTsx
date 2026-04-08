import { describe, it, expect } from "vitest";
import { File } from "../../src/primitives/File.js";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("File", () => {
  it("creates a File from URL", () => {
    const f = File.fromURL("https://example.com/doc.pdf");
    expect(f.url).toBe("https://example.com/doc.pdf");
    expect(f.base64).toBeUndefined();
  });

  it("creates a File from URL with filename", () => {
    const f = File.fromURL("https://example.com/doc.pdf", "doc.pdf");
    expect(f.url).toBe("https://example.com/doc.pdf");
    expect(f.filename).toBe("doc.pdf");
  });

  it("creates a File from base64 data", () => {
    const f = File.fromBase64("abc123", "application/pdf", "report.pdf");
    expect(f.base64).toBe("abc123");
    expect(f.mimeType).toBe("application/pdf");
    expect(f.filename).toBe("report.pdf");
  });

  it("creates a File from base64 with default MIME type", () => {
    const f = File.fromBase64("abc123");
    expect(f.mimeType).toBe("application/octet-stream");
  });

  it("creates a File from a local path (PDF)", () => {
    const path = join(tmpdir(), "test-doc.pdf");
    writeFileSync(path, Buffer.from("fake pdf data"));
    try {
      const f = File.fromPath(path);
      expect(f.base64).toBeDefined();
      expect(f.mimeType).toBe("application/pdf");
      expect(f.filename).toBe("test-doc.pdf");
    } finally {
      unlinkSync(path);
    }
  });

  it("creates a File from a local path (CSV)", () => {
    const path = join(tmpdir(), "data.csv");
    writeFileSync(path, "col1,col2\n1,2");
    try {
      const f = File.fromPath(path);
      expect(f.mimeType).toBe("text/csv");
    } finally {
      unlinkSync(path);
    }
  });

  it("toOpenAIContentPart() works with URL", () => {
    const f = File.fromURL("https://example.com/doc.pdf");
    const part = f.toOpenAIContentPart();
    expect(part.type).toBe("text");
    expect(part.text).toContain("https://example.com/doc.pdf");
  });

  it("toOpenAIContentPart() works with base64", () => {
    const f = File.fromBase64("abc", "application/pdf", "report.pdf");
    const part = f.toOpenAIContentPart();
    expect(part.type).toBe("text");
    expect(part.text).toContain("report.pdf");
  });

  it("toOpenAIContentPart() throws when no data", () => {
    const emptyFile = Object.create(File.prototype) as File;
    Object.assign(emptyFile, { url: undefined, base64: undefined, mimeType: undefined });
    expect(() => emptyFile.toOpenAIContentPart()).toThrow("File: no url or base64 data available");
  });

  it("toAnthropicContentBlock() returns document block for PDF base64", () => {
    const f = File.fromBase64("abc", "application/pdf");
    const block = f.toAnthropicContentBlock();
    expect(block["type"]).toBe("document");
    const source = block["source"] as Record<string, unknown>;
    expect(source["type"]).toBe("base64");
    expect(source["media_type"]).toBe("application/pdf");
  });

  it("toAnthropicContentBlock() returns URL document block", () => {
    const f = File.fromURL("https://example.com/doc.pdf");
    const block = f.toAnthropicContentBlock();
    expect(block["type"]).toBe("document");
    const source = block["source"] as Record<string, unknown>;
    expect(source["type"]).toBe("url");
  });

  it("toGoogleAIContentPart() works with base64", () => {
    const f = File.fromBase64("abc", "text/plain");
    const part = f.toGoogleAIContentPart();
    expect(part.inlineData.mimeType).toBe("text/plain");
    expect(part.inlineData.data).toBe("abc");
  });

  it("toGoogleAIContentPart() throws without base64", () => {
    const f = File.fromURL("https://example.com/doc.pdf");
    expect(() => f.toGoogleAIContentPart()).toThrow("File: base64 data required");
  });

  it("toString() returns a description", () => {
    expect(File.fromURL("https://x.com/doc.pdf").toString()).toContain("https://x.com/doc.pdf");
    expect(File.fromBase64("abc", "application/pdf", "report.pdf").toString()).toContain("report.pdf");
  });
});
