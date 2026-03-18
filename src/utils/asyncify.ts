import type { Module } from "../modules/Module.js";

/**
 * Run a synchronous Module.forward() in a worker thread so it doesn't block
 * the event loop.  Mirrors `dspy.asyncify`.
 *
 * Note: In TypeScript/Node.js, Module.forward() is already async, so this is
 * primarily a semantic wrapper for compatibility with DSPy's API.
 */
export function asyncify<T extends Module>(module: T): T {
  // In Node.js with async/await, forward() is already non-blocking.
  // This wrapper ensures the module is returned as-is for API compatibility.
  return module;
}
