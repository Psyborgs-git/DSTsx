import { settings } from "../settings/index.js";

/** Enable debug-level logging. Mirrors `dspy.enable_logging`. */
export function enableLogging(): void {
  settings.configure({ logLevel: "debug" });
}

/** Disable all logging. Mirrors `dspy.disable_logging`. */
export function disableLogging(): void {
  settings.configure({ logLevel: "silent" });
}

/** Suppress verbose provider SDK logs. */
export function suppressProviderLogs(): void {
  settings.configure({ logLevel: "error" });
}
