// platform/pi-api.ts
//
// Thin Pi extension API boundary. This is the only production file that
// imports from `@earendil-works/pi-coding-agent`; all other extension modules
// import Pi API types from here so peer-version bumps are auditable.
//
// The soft-dependency probes (`hasLoadedPiSubagents` /
// `hasLoadedPiMcpAdapter` / `softDepStatus`) live here because they
// inspect `pi.getAllTools()`, which belongs to the external Pi API
// surface. `softDepStatus(pi)` returns a `SoftDepStatus` snapshot that
// `shared/notify.ts` reads once per render to decide whether to append the
// `requires pi-subagents` / `requires pi-mcp` markers to a plugin row whose
// `dependencies` declare the kind.

export { getAgentDir } from "@earendil-works/pi-coding-agent";

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
