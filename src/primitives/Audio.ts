import { readFileSync } from "node:fs";

/** Supported audio MIME types. */
export type AudioMimeType = "audio/mpeg" | "audio/wav" | "audio/ogg" | "audio/webm";

/**
 * A multi-modal audio value that can be passed as a field in Predict.
 * Mirrors `dspy.Audio`.
 */
export class Audio {
  readonly url: string | undefined;
  readonly base64: string | undefined;
  readonly mimeType: AudioMimeType | undefined;

  private constructor(init: {
    url?: string | undefined;
    base64?: string | undefined;
    mimeType?: AudioMimeType | undefined;
  }) {
    this.url = init.url;
    this.base64 = init.base64;
    this.mimeType = init.mimeType;
  }

  /** Create an Audio from a URL. */
  static fromURL(url: string): Audio {
    return new Audio({ url });
  }

  /** Create an Audio from base64-encoded data. */
  static fromBase64(data: string, mimeType: AudioMimeType = "audio/mpeg"): Audio {
    return new Audio({ base64: data, mimeType });
  }

  /** Create an Audio by reading a local file synchronously. */
  static fromFile(path: string, mimeType?: AudioMimeType): Audio {
    const data = readFileSync(path);
    const base64 = data.toString("base64");
    const ext = path.split(".").pop()?.toLowerCase();
    const detectedMime: AudioMimeType =
      ext === "wav" ? "audio/wav" :
      ext === "ogg" ? "audio/ogg" :
      ext === "webm" ? "audio/webm" :
      "audio/mpeg";
    return new Audio({ base64, mimeType: mimeType ?? detectedMime });
  }

  /** Serialize to an OpenAI-compatible input_audio content part. */
  toOpenAIContentPart(): { type: "input_audio"; input_audio: { data: string; format: string } } {
    if (this.base64 && this.mimeType) {
      const format = this.mimeType.split("/")[1] ?? "mp3";
      return { type: "input_audio", input_audio: { data: this.base64, format } };
    }
    if (this.url) {
      throw new Error("Audio: URL-based audio is not supported for OpenAI; convert to base64 first");
    }
    throw new Error("Audio: no url or base64 data available");
  }

  /** Serialize to a Google AI-compatible content part. */
  toGoogleAIContentPart(): { inlineData: { mimeType: string; data: string } } {
    if (this.base64 && this.mimeType) {
      return { inlineData: { mimeType: this.mimeType, data: this.base64 } };
    }
    throw new Error("Audio: base64 data required for Google AI");
  }

  toString(): string {
    if (this.url) return `[Audio: ${this.url}]`;
    if (this.base64) return `[Audio: base64 data, ${this.mimeType ?? "unknown type"}]`;
    return "[Audio]";
  }
}
