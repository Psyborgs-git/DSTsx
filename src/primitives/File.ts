import { readFileSync } from "node:fs";

/**
 * Supported MIME types for the {@link File} primitive.
 * Common document, text, and binary formats.
 */
export type FileMimeType =
  | "application/pdf"
  | "text/plain"
  | "text/csv"
  | "text/html"
  | "text/markdown"
  | "application/json"
  | "application/xml"
  | "application/msword"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "application/vnd.ms-excel"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  | (string & {});

/**
 * A generic file value that can be passed as a field in Predict / TypedPredictor
 * for document-level inputs (PDFs, text files, spreadsheets, etc.).
 *
 * Mirrors `dspy.File` in Python.
 *
 * @example
 * ```ts
 * const docQA = new Predict("document, question -> answer");
 * const result = await docQA.forward({
 *   document: File.fromPath("./report.pdf"),
 *   question:  "What is the conclusion?",
 * });
 * ```
 */
export class File {
  readonly url: string | undefined;
  readonly base64: string | undefined;
  readonly mimeType: FileMimeType | undefined;
  /** Optional filename hint (used in serialization / provider payloads). */
  readonly filename: string | undefined;

  private constructor(init: {
    url?: string;
    base64?: string;
    mimeType?: FileMimeType;
    filename?: string;
  }) {
    this.url = init.url;
    this.base64 = init.base64;
    this.mimeType = init.mimeType;
    this.filename = init.filename;
  }

  // ---------------------------------------------------------------------------
  // Factory helpers
  // ---------------------------------------------------------------------------

  /** Create a File from a URL. */
  static fromURL(url: string, filename?: string): File {
    return new File({ url, ...(filename !== undefined ? { filename } : {}) });
  }

  /** Create a File from base64-encoded data. */
  static fromBase64(
    data: string,
    mimeType: FileMimeType = "application/octet-stream",
    filename?: string,
  ): File {
    return new File({ base64: data, mimeType, ...(filename !== undefined ? { filename } : {}) });
  }

  /**
   * Create a File by reading a local file synchronously.
   *
   * The MIME type is inferred from the file extension when not provided.
   */
  static fromPath(path: string, mimeType?: FileMimeType): File {
    const data = readFileSync(path);
    const base64 = data.toString("base64");
    const filename = path.split("/").pop() ?? path.split("\\").pop() ?? path;
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    const detectedMime: FileMimeType = mimeType ?? File.#detectMime(ext);
    return new File({ base64, mimeType: detectedMime, filename });
  }

  static #detectMime(ext: string): FileMimeType {
    const map: Record<string, FileMimeType> = {
      pdf: "application/pdf",
      txt: "text/plain",
      csv: "text/csv",
      html: "text/html",
      htm: "text/html",
      md: "text/markdown",
      json: "application/json",
      xml: "application/xml",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
    return map[ext] ?? "application/octet-stream";
  }

  // ---------------------------------------------------------------------------
  // Serializers
  // ---------------------------------------------------------------------------

  /**
   * Serialize to an OpenAI-compatible file content part.
   * Note: file uploads are not yet part of the chat completions standard;
   * this returns an object suitable for APIs that accept base64 documents.
   */
  toOpenAIContentPart(): {
    type: "text";
    text: string;
  } {
    if (this.url) {
      return { type: "text", text: `[File: ${this.url}]` };
    }
    if (this.base64 && this.mimeType) {
      const name = this.filename ?? "file";
      return {
        type: "text",
        text: `[File: ${name} (${this.mimeType}), base64: ${this.base64}]`,
      };
    }
    throw new Error("File: no url or base64 data available");
  }

  /**
   * Serialize to an Anthropic-compatible document content block.
   * Supports PDF documents via Anthropic's `document` block type.
   */
  toAnthropicContentBlock(): Record<string, unknown> {
    if (this.mimeType === "application/pdf" && this.base64) {
      return {
        type: "document",
        source: {
          type: "base64",
          media_type: this.mimeType,
          data: this.base64,
        },
      };
    }
    if (this.url) {
      return {
        type: "document",
        source: { type: "url", url: this.url },
      };
    }
    if (this.base64 && this.mimeType) {
      return {
        type: "document",
        source: {
          type: "base64",
          media_type: this.mimeType,
          data: this.base64,
        },
      };
    }
    throw new Error("File: no url or base64 data available");
  }

  /**
   * Serialize to a Google AI-compatible inline data part.
   */
  toGoogleAIContentPart(): { inlineData: { mimeType: string; data: string } } {
    if (this.base64 && this.mimeType) {
      return { inlineData: { mimeType: this.mimeType, data: this.base64 } };
    }
    throw new Error("File: base64 data required for Google AI");
  }

  /** Returns a human-readable string representation. */
  toString(): string {
    const name = this.filename ?? "file";
    if (this.url) return `[File: ${name} @ ${this.url}]`;
    if (this.base64) return `[File: ${name} (${this.mimeType ?? "unknown type"}, base64)]`;
    return `[File: ${name}]`;
  }
}
