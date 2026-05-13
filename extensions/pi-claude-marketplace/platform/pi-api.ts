// platform/pi-api.ts
//
// Thin Pi extension API boundary. This is the only production file that
// imports from `@earendil-works/pi-coding-agent`; all other extension modules
// import Pi API types from here so peer-version bumps are auditable.
//
// The soft-dependency helpers live here because they probe `pi.getAllTools()`,
// which belongs to the external Pi API surface.

import { PI_MCP_ADAPTER_NOT_LOADED, PI_SUBAGENTS_NOT_LOADED } from "../shared/markers.ts";

export type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  ToolDefinition,
  ToolInfo,
} from "@earendil-works/pi-coding-agent";

export type { AutocompleteItem } from "@earendil-works/pi-tui";

export interface ResourcesDiscoverEvent {
  type: "resources_discover";
  cwd: string;
  reason: "startup" | "reload";
}

export interface ResourcesDiscoverResult {
  skillPaths?: string[];
  promptPaths?: string[];
  themePaths?: string[];
}

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export interface SoftDepStatus {
  piSubagentsLoaded: boolean;
  piMcpAdapterLoaded: boolean;
}

/**
 * RH-3: pi-subagents loaded iff `pi.getAllTools()` contains a tool named
 * "subagent". Probe failures degrade to unloaded.
 */
export function hasLoadedPiSubagents(pi: ExtensionAPI): boolean {
  try {
    return pi.getAllTools().some((tool) => tool.name === "subagent");
  } catch {
    return false;
  }
}

/**
 * RH-4: pi-mcp-adapter loaded iff a tool named "mcp" exists OR any tool's
 * `sourceInfo.source` substring-matches "pi-mcp-adapter". Probe failures
 * degrade to unloaded.
 */
export function hasLoadedPiMcpAdapter(pi: ExtensionAPI): boolean {
  try {
    return pi.getAllTools().some((tool) => {
      const candidate = tool as { name?: unknown; sourceInfo?: { source?: unknown } };
      if (candidate.name === "mcp") {
        return true;
      }

      const src = candidate.sourceInfo?.source;
      return typeof src === "string" && src.includes("pi-mcp-adapter");
    });
  } catch {
    return false;
  }
}

export function softDepStatus(pi: ExtensionAPI): SoftDepStatus {
  return {
    piSubagentsLoaded: hasLoadedPiSubagents(pi),
    piMcpAdapterLoaded: hasLoadedPiMcpAdapter(pi),
  };
}

/**
 * RH-5: compose the canonical pi-subagents warning when agents were staged
 * and the dep is unloaded. Returns "" otherwise.
 */
export function subagentWarningIfNeeded(pi: ExtensionAPI, agentsStaged: readonly string[]): string {
  if (agentsStaged.length === 0) {
    return "";
  }

  if (hasLoadedPiSubagents(pi)) {
    return "";
  }

  return `${PI_SUBAGENTS_NOT_LOADED}install it with \`pi install npm:pi-subagents\`, then run \`/reload\`.`;
}

/**
 * RH-5: compose the canonical pi-mcp-adapter warning when MCP servers were
 * staged and the dep is unloaded. Returns "" otherwise.
 */
export function mcpAdapterWarningIfNeeded(pi: ExtensionAPI, mcpStaged: readonly string[]): string {
  if (mcpStaged.length === 0) {
    return "";
  }

  if (hasLoadedPiMcpAdapter(pi)) {
    return "";
  }

  return `${PI_MCP_ADAPTER_NOT_LOADED}install it with \`pi install npm:pi-mcp-adapter\`, then run \`/reload\`.`;
}
