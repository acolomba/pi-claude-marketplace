// platform/pi-api.ts
//
// Thin Pi extension API boundary. This is the only production file that
// imports from `@earendil-works/pi-coding-agent`; all other extension modules
// import Pi API types from here so peer-version bumps are auditable.
//
// The soft-dependency probes (`hasLoadedPiSubagents` /
// `hasLoadedPiMcpAdapter` / `hasLoadedWorkflowEngine` / `softDepStatus`) live
// here because they inspect `pi.getAllTools()` and `pi.getCommands()`, which
// belong to the external Pi API surface. `softDepStatus(pi)` returns a
// `SoftDepStatus` snapshot that `shared/notification-dispatch.ts` reads once per
// render to decide whether to append the `requires pi-subagents` /
// `requires pi-mcp-adapter` / `requires pi-dynamic-workflows` markers to a
// plugin row whose `dependencies` declare the kind.

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
// BLOCK E chokepoint: DynamicBorder is a runtime class used by the
// /claude:plugin browse SelectList browser. Re-exported here so edge/
// never imports the peer dep directly.
export { DynamicBorder } from "@earendil-works/pi-coding-agent";

export type {
  AgentEndEvent,
  AgentSettledEvent,
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
  Theme,
  ToolCallEvent,
  ToolCallEventResult,
  ToolResultEvent,
} from "@earendil-works/pi-coding-agent";
export type { AutocompleteProvider } from "@earendil-works/pi-tui";

import type { AgentEndEvent } from "@earendil-works/pi-coding-agent";

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

/**
 * The Pi agent-message union and its assistant-message narrowing, surfaced
 * here so the hooks settle dispatcher can read `stopReason` off the last
 * assistant message cached from `AgentEndEvent.messages`.
 *
 * The concrete `AgentMessage` / `AssistantMessage` / `StopReason` declarations
 * live in the nested `@earendil-works/pi-agent-core` / `@earendil-works/pi-ai`
 * packages, which this install does not hoist to a top-level resolvable
 * specifier. They are derived structurally from the re-exported
 * `AgentEndEvent.messages` element type so `pi-api.ts` remains the sole Pi
 * import site (no direct nested `@earendil-works/*` import in bridge code).
 */
export type AgentMessage = AgentEndEvent["messages"][number];
export type AssistantMessage = Extract<AgentMessage, { role: "assistant" }>;
export type StopReason = AssistantMessage["stopReason"];

export interface SoftDepStatus {
  piSubagentsLoaded: boolean;
  piMcpAdapterLoaded: boolean;
  workflowEngineLoaded: boolean;
}

/** The only Pi UI capability used by the notification boundary. */
export interface NotificationUi {
  notify(message: string, severity?: "info" | "warning" | "error"): void;
}

/** Consumer-owned view of a Pi context used only to emit notifications. */
export interface NotificationContext {
  readonly ui: NotificationUi;
}

/** The tool metadata inspected by the optional-dependency probes. */
export interface ToolInventoryItem {
  readonly name?: unknown;
  readonly sourceInfo?: { readonly source?: unknown };
}

/** The slash-command metadata inspected by the pi-mcp-adapter probe. */
export interface CommandInventoryItem {
  readonly name?: unknown;
  readonly source?: unknown;
  readonly sourceInfo?: { readonly source?: unknown };
}

/**
 * Consumer-owned view of the Pi API used only to inspect registered tools and
 * slash commands.
 */
export interface PiInventory {
  getAllTools(): readonly ToolInventoryItem[];
  getCommands(): readonly CommandInventoryItem[];
}

/**
 * RH-3: pi-subagents loaded iff `pi.getAllTools()` contains a tool named
 * "subagent". Probe failures degrade to unloaded.
 */
function hasLoadedPiSubagents(pi: PiInventory): boolean {
  try {
    return pi.getAllTools().some((tool) => tool.name === "subagent");
  } catch {
    return false;
  }
}

/**
 * WDEP-01: the `@quintinshaw/pi-dynamic-workflows` host engine is loaded iff
 * `pi.getAllTools()` contains a tool named "workflow_control". The engine
 * registers BOTH `workflow` and `workflow_control`; `@nicknisi/pi-workflows`
 * registers only `workflow`, so probing the bare name would report a different
 * engine as the host. Probe failures degrade to unloaded.
 */
function hasLoadedWorkflowEngine(pi: PiInventory): boolean {
  try {
    return pi.getAllTools().some((tool) => tool.name === "workflow_control");
  } catch {
    return false;
  }
}

// ADET-02: pi-mcp-adapter registers the `mcp-adapter` command. When two
// extensions register the same command name, Pi lists each one under the name
// with a `:<n>` occurrence suffix (`mcp-adapter:1`, `mcp-adapter:2`).
const ADAPTER_COMMAND_NAME = /^mcp-adapter(?::\d+)?$/;

function isAdapterSource(source: unknown): boolean {
  return typeof source === "string" && source.includes("pi-mcp-adapter");
}

function isAdapterCommand(command: CommandInventoryItem): boolean {
  if (isAdapterSource(command.sourceInfo?.source)) {
    return true;
  }

  return (
    command.source === "extension" &&
    typeof command.name === "string" &&
    ADAPTER_COMMAND_NAME.test(command.name)
  );
}

/**
 * Runs one probe arm. An arm that throws reports "not loaded", so a Pi read
 * failure can raise a false warning but never a false all-clear.
 */
function probeArm(arm: () => boolean): boolean {
  try {
    return arm();
  } catch {
    return false;
  }
}

/**
 * ADET-02: pi-mcp-adapter is loaded iff `pi.getCommands()` lists an extension
 * command named `mcp-adapter`, or a command or tool `sourceInfo.source`
 * contains "pi-mcp-adapter". The command is present with `disableProxyTool` and
 * in a fork. A bare tool named `mcp` does not count, and neither does Pi's
 * built-in MCP (`mcp__*` tools and an `mcp` command from `builtin:mcp`). Each
 * arm is guarded on its own and both always run, so one snapshot makes the
 * same reads in every state and a throwing arm leaves the other one deciding.
 */
function hasLoadedPiMcpAdapter(pi: PiInventory): boolean {
  const viaCommands = probeArm(() => pi.getCommands().some((command) => isAdapterCommand(command)));
  const viaTools = probeArm(() =>
    pi.getAllTools().some((tool) => isAdapterSource(tool.sourceInfo?.source)),
  );
  return viaCommands || viaTools;
}

export function softDepStatus(pi: PiInventory): SoftDepStatus {
  return {
    piSubagentsLoaded: hasLoadedPiSubagents(pi),
    piMcpAdapterLoaded: hasLoadedPiMcpAdapter(pi),
    workflowEngineLoaded: hasLoadedWorkflowEngine(pi),
  };
}
