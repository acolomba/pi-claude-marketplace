// presentation/soft-dep.ts
//
// RH-3 / RH-4 / RH-5 soft-dependency probes and warning composition.
// Wraps `pi.getAllTools()` in try/catch (Pitfall 3: getAllTools()
// may throw during Pi process startup race; treat throw as "not
// loaded" -- a spurious warning is the lesser evil compared to
// suppressing a real one).
//
// API parameter shape note (deviation from PLAN.md prescribed pattern):
// `getAllTools()` lives on `ExtensionAPI` (the factory `pi` parameter),
// NOT on `ExtensionContext` (the slash-command/handler ctx). The plan
// snippet's `ctx.pi.getAllTools()` does not compile because
// `ExtensionContext` has no `pi` member -- verified against
// `@mariozechner/pi-coding-agent@0.73.1` type declarations. The probe
// helpers therefore take `pi: ExtensionAPI` and the orchestrator layer
// (which has both the factory `pi` and the command `ctx` in scope)
// supplies the right reference at call time.
//
// ES-5 stable contract: the prefixes `pi-subagents is not loaded; `
// and `pi-mcp-adapter is not loaded; ` come from shared/markers.ts
// (markers-snapshot test enforces). The suffix is locked here per
// RESEARCH Open question 4.

import { PI_MCP_ADAPTER_NOT_LOADED, PI_SUBAGENTS_NOT_LOADED } from "../shared/markers.ts";

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/**
 * RH-3: pi-subagents loaded iff `pi.getAllTools()` contains a tool named
 * "subagent". Pitfall 3: probe throws during Pi startup race -- treat
 * throw as "not loaded".
 */
export function hasLoadedPiSubagents(pi: ExtensionAPI): boolean {
  try {
    return pi.getAllTools().some((tool) => tool.name === "subagent");
  } catch {
    return false;
  }
}

/**
 * RH-4: pi-mcp-adapter loaded iff a tool named "mcp" exists OR any
 * tool's `sourceInfo.source` substring-matches "pi-mcp-adapter".
 *
 * Defensive note: `ToolInfo.sourceInfo` is typed as required by the
 * pi-coding-agent surface, and `SourceInfo.source` is a required string.
 * We still defensively re-check via optional chain to tolerate runtime
 * drift from Pi extensions that synthesize partial tool entries (the
 * try/catch above is the primary safety, this is a belt-and-braces guard
 * against `getAllTools()` returning entries that don't match the declared
 * shape -- Pitfall 3 class drift).
 */
export function hasLoadedPiMcpAdapter(pi: ExtensionAPI): boolean {
  try {
    return pi.getAllTools().some((tool) => {
      if (tool.name === "mcp") {
        return true;
      }

      const src: unknown = tool.sourceInfo.source;
      return typeof src === "string" && src.includes("pi-mcp-adapter");
    });
  } catch {
    return false;
  }
}

/**
 * RH-5: compose the canonical pi-subagents warning when agents were
 * staged AND the dep is unloaded. Returns "" otherwise (the caller
 * uses string-empty as the no-warning signal).
 */
export function subagentWarningIfNeeded(pi: ExtensionAPI, agentsStaged: readonly string[]): string {
  if (agentsStaged.length === 0) {
    return "";
  }

  if (hasLoadedPiSubagents(pi)) {
    return "";
  }

  return `${PI_SUBAGENTS_NOT_LOADED}install/load it (e.g. via /pi:packages add npm:pi-subagents) and run /reload.`;
}

/**
 * RH-5: compose the canonical pi-mcp-adapter warning when MCP servers
 * were staged AND the dep is unloaded.
 */
export function mcpAdapterWarningIfNeeded(pi: ExtensionAPI, mcpStaged: readonly string[]): string {
  if (mcpStaged.length === 0) {
    return "";
  }

  if (hasLoadedPiMcpAdapter(pi)) {
    return "";
  }

  return `${PI_MCP_ADAPTER_NOT_LOADED}install/load it (e.g. via /pi:packages add npm:pi-mcp-adapter) and run /reload.`;
}
