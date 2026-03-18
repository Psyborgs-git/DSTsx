import { readFileSync } from "node:fs";
import type { Module } from "../modules/Module.js";

/** Registry of module constructors for deserialization. */
export const ModuleRegistry = new Map<string, new () => Module>();

/** Register a module class for use with load(). */
export function registerModule(name: string, ctor: new () => Module): void {
  ModuleRegistry.set(name, ctor);
}

/**
 * Load a module from a serialized JSON file.
 * Mirrors `dspy.load`.
 */
export async function load(path: string): Promise<Module> {
  const data = readFileSync(path, "utf-8");
  const state = JSON.parse(data) as Record<string, unknown>;
  const typeName = state["__type"] as string | undefined;

  if (!typeName) {
    throw new Error(
      "Cannot load module: missing __type field in serialized state",
    );
  }

  const Ctor = ModuleRegistry.get(typeName);
  if (!Ctor) {
    throw new Error(
      `Cannot load module: unknown type "${typeName}". Register it with registerModule().`,
    );
  }

  const module = new Ctor();
  module.load(state);
  return module;
}
