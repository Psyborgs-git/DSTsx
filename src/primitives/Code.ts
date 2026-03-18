/**
 * A code primitive representing executable code with language metadata.
 * Mirrors `dspy.Code`.
 */
export class Code {
  readonly value: string;
  readonly language: string;

  private constructor(value: string, language: string) {
    this.value = value;
    this.language = language;
  }

  static from(value: string, language = "javascript"): Code {
    return new Code(value, language);
  }

  toString(): string {
    return this.value;
  }

  toJSON(): { value: string; language: string } {
    return { value: this.value, language: this.language };
  }
}
