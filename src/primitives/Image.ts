import { readFileSync } from "node:fs";

/** Supported image MIME types. */
export type ImageMimeType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

/**
 * A multi-modal image value that can be passed as a field in Predict/TypedPredictor.
 *
 * @example
 * ```ts
 * const captioner = new Predict("image, question -> caption");
 * const result = await captioner.forward({
 *   image:    Image.fromURL("https://example.com/photo.jpg"),
 *   question: "What is in this image?",
 * });
 * ```
 */
export class Image {
  readonly url: string | undefined;
  readonly base64: string | undefined;
  readonly mimeType: ImageMimeType | undefined;

  private constructor(init: {
    url?: string | undefined;
    base64?: string | undefined;
    mimeType?: ImageMimeType | undefined;
  }) {
    this.url = init.url;
    this.base64 = init.base64;
    this.mimeType = init.mimeType;
  }

  /** Create an Image from a URL. */
  static fromURL(url: string): Image {
    return new Image({ url });
  }

  /** Create an Image from base64-encoded data. */
  static fromBase64(data: string, mimeType: ImageMimeType = "image/jpeg"): Image {
    return new Image({ base64: data, mimeType });
  }

  /** Create an Image by reading a local file synchronously. */
  static fromFile(path: string, mimeType?: ImageMimeType): Image {
    const data = readFileSync(path);
    const base64 = data.toString("base64");
    const ext = path.split(".").pop()?.toLowerCase();
    const detectedMime: ImageMimeType =
      ext === "png" ? "image/png" :
      ext === "gif" ? "image/gif" :
      ext === "webp" ? "image/webp" :
      "image/jpeg";
    return new Image({ base64, mimeType: mimeType ?? detectedMime });
  }

  /** Serialize to an OpenAI-compatible image_url content part. */
  toOpenAIContentPart(): { type: "image_url"; image_url: { url: string } } {
    if (this.url) {
      return { type: "image_url", image_url: { url: this.url } };
    }
    if (this.base64 && this.mimeType) {
      return { type: "image_url", image_url: { url: `data:${this.mimeType};base64,${this.base64}` } };
    }
    throw new Error("Image: no url or base64 data available");
  }

  /** Serialize to an Anthropic-compatible image content block. */
  toAnthropicContentBlock(): {
    type: "image";
    source: { type: "base64" | "url"; media_type?: string; data?: string; url?: string };
  } {
    if (this.url) {
      return { type: "image", source: { type: "url", url: this.url } };
    }
    if (this.base64 && this.mimeType) {
      return { type: "image", source: { type: "base64", media_type: this.mimeType, data: this.base64 } };
    }
    throw new Error("Image: no url or base64 data available");
  }

  /** Returns a string representation (used when Image is serialized in prompts). */
  toString(): string {
    if (this.url) return `[Image: ${this.url}]`;
    if (this.base64) return `[Image: base64 data, ${this.mimeType ?? "unknown type"}]`;
    return "[Image]";
  }
}
