/**
 * @deprecated
 * `Document` has been promoted to stable and is now exported from the main
 * `@jaex/dstsx` package directly.  This re-export is kept for backward
 * compatibility and will be removed in a future major version.
 *
 * @example
 * ```ts
 * // ✅ Preferred — import from the stable location
 * import { Document } from "@jaex/dstsx";
 *
 * // 🚫 Deprecated — the experimental path still works but is discouraged
 * import { Document } from "@jaex/dstsx/experimental";
 * ```
 */
export { Document } from "../primitives/Document.js";

/**
 * @deprecated
 * `Citations` has been promoted to stable and is now exported from the main
 * `@jaex/dstsx` package directly.  This re-export is kept for backward
 * compatibility and will be removed in a future major version.
 *
 * @example
 * ```ts
 * // ✅ Preferred
 * import { Citations } from "@jaex/dstsx";
 *
 * // 🚫 Deprecated
 * import { Citations } from "@jaex/dstsx/experimental";
 * ```
 */
export { Citations } from "../modules/Citations.js";

