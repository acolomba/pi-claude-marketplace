import type { ExtensionAPI, InputEventResult } from "../platform/pi-api.ts";

/**
 * Registers the input handler for bridged slash commands. D-CF1-01 (argument
 * substitution) and D-CF1-02 (context injection) run their transforms here.
 * Today the handler passes every input through unchanged.
 *
 * The extension factory registers it after the skill-alias rewrite, so the
 * handler sees the text that Pi will expand.
 */
export function registerCommandInvocation(pi: ExtensionAPI): void {
  pi.on("input", (): InputEventResult => ({ action: "continue" }));
}
