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

/**
 * PARSE-01: Pi's own frontmatter parser, surfaced here as the ONLY sanctioned
 * import site so the skills/commands staging gates accept/reject bytes with
 * byte-identical semantics to Pi's skill and command loaders. Signature:
 * `<T extends Record<string, unknown>>(content: string) => { frontmatter: T;
 * body: string }`.
 *
 * Verified throw/return semantics (drive the gate branch logic):
 *  - content NOT starting with the `---` delimiter -> `{ frontmatter: {}, body }`
 *    (NO throw) -- the SKILL-02 empty-metadata / first-paragraph-fallback branch.
 *  - an opening `---` with NO closing `\n---` -> `{ frontmatter: {}, body }`
 *    (NO throw) -- also an empty-metadata result, never a degrade trigger.
 *  - a CLOSED `---` block whose inner YAML is malformed -> THROWS (via
 *    `yaml.parse`) -- the SKILL-01 synthesize / CMD-01 neutralize degrade trigger.
 *  - the returned `body` is CR/CRLF->LF normalized; on the frontmatter-present
 *    path it is additionally `.trim()`ed (the no-delimiter path leaves the body
 *    normalized-but-untrimmed).
 *
 * READ-ONLY use only: extract field values, never `eval`/execute (preserves the
 * T-03-17 injection-safety property -- reading-to-validate is not evaluating).
 */
export { parseFrontmatter } from "@earendil-works/pi-coding-agent";

export type {
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  InputEvent,
  InputEventResult,
  SessionBeforeCompactEvent,
  SessionCompactEvent,
  SessionShutdownEvent,
  SessionStartEvent,
  ToolCallEvent,
  ToolCallEventResult,
  ToolDefinition,
  ToolInfo,
  ToolResultEvent,
} from "@earendil-works/pi-coding-agent";

/**
 * Structural `text` content block -- mirrors `pi-ai`'s `TextContent`
 * shape (peer-dep does not re-export it). The bridge's
 * `adaptToolResultResult` emits only `{ type: "text", text }` blocks
 * for `block` outcomes; this type is the minimal structural match
 * accepted by `pi.on("tool_result", ...)`'s narrow `content?:
 * (TextContent | ImageContent)[]` slot.
 */
export interface PiTextContentBlock {
  type: "text";
  text: string;
}

/**
 * Structural Pi `tool_result` handler return shape.
 *
 * Peer-dep does not re-export `ToolResultEventResult` from its root, but
 * the `pi.on("tool_result", handler)` registration in
 * `@earendil-works/pi-coding-agent`'s `ExtensionAPI.on` overload accepts
 * an `ExtensionHandler<ToolResultEvent, ToolResultEventResult>` whose
 * return-shape interface (defined in the peer-dep's internal
 * `core/extensions/types.d.ts`) carries the three optional fields
 * mirrored here. Tracked as a peer-dep export gap; structurally
 * compatible with the upstream declaration.
 */
export interface ToolResultEventResult {
  content?: PiTextContentBlock[];
  details?: unknown;
  isError?: boolean;
}

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
