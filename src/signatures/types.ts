/** Metadata describing a single field in a Signature. */
export interface FieldMeta {
  /** Human-readable description used in the prompt. */
  description?: string;
  /** Optional prefix that precedes the field value in the prompt. */
  prefix?: string;
  /** Optional format hint (e.g. "json", "markdown", "list"). */
  format?: string;
  /** When true the field may be absent from a completion. */
  optional?: boolean;
  /**
   * The JSON-schema-compatible type annotation for this field.
   * Defaults to "string".
   */
  type?: "string" | "number" | "boolean" | "string[]" | "object";
}

/** Internal representation of a parsed Signature. */
export interface SignatureMeta {
  /** Ordered list of input field names with their metadata. */
  inputs: Map<string, FieldMeta>;
  /** Ordered list of output field names with their metadata. */
  outputs: Map<string, FieldMeta>;
  /** Optional system-level instruction string. */
  instructions?: string;
}
