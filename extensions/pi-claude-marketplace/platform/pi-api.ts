// platform/pi-api.ts
//
// Thin Pi extension API boundary. This is the only production file that
// imports from `@earendil-works/pi-coding-agent`; all other extension modules
// import Pi API types from here so peer-version bumps are auditable.
//
// The soft-dependency probes (`hasLoadedPiSubagents` /
// `hasLoadedPiMcpAdapter` / `hasLoadedBuiltinMcp` / `hasLoadedWorkflowEngine` /
// `softDepStatus`) live here because they inspect `pi.getAllTools()` and
// `pi.getCommands()`, which belong to the external Pi API surface.
// `softDepStatus` is the probe that `openNotificationRun` takes once per run
// (D-05). It reads `pi.getCommands()` once and hands that one list to both MCP
// arms, the adapter's and the built-in's, so a snapshot makes the same reads
// in every state (MSEL-01). The run's `SoftDepStatus` snapshot decides whether a plugin row whose
// `dependencies` declare a kind carries the `requires pi-subagents` /
// `requires pi-mcp-adapter` / `requires pi-dynamic-workflows` marker.

import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { createReadTool } from "@earendil-works/pi-coding-agent";

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
// Pi peer chokepoint (NFR-11): DynamicBorder is a runtime class used by the
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
  McpServerConfig,
  RegisteredMcpServer,
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

import type {
  AgentEndEvent,
  ExtensionContext,
  McpServerConfig,
  RegisteredMcpServer,
  ToolResultEvent,
} from "@earendil-works/pi-coding-agent";

/** Pi's mode union, derived from its context because the root omits the alias. */
export type ExtensionMode = ExtensionContext["mode"];

/**
 * MSEL-01: the MCP implementations a plugin's MCP servers can run under:
 * pi-mcp-adapter, or Pi's own built-in MCP.
 */
export type McpImplementationId = "adapter" | "builtin";

/**
 * MSEL-01: the MCP implementation a run uses, decided once per run snapshot
 * (D-05). `none` means the extension can name neither implementation as
 * active.
 */
export type ActiveMcpImplementation = McpImplementationId | "none";

/**
 * Consumer-owned view of the Pi API that registers built-in MCP servers for
 * the session. Registrations are not saved; a server of the same name in
 * `mcp.json` takes precedence.
 */
export interface PiMcpRegistry {
  registerMcpServer(name: string, config: McpServerConfig): void;
  unregisterMcpServer(name: string): void;
  getMcpServers(): readonly RegisteredMcpServer[];
}

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
 * mirrored here. `content` takes Pi's text and image parts, as the event
 * carries them. Tracked as a peer-dep export gap; structurally compatible
 * with the upstream declaration.
 */
export interface ToolResultEventResult {
  content?: ToolResultEvent["content"];
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
  /**
   * MSEL-01: the run's active MCP implementation, with the precedence adapter,
   * then Pi's built-in MCP, then none.
   */
  mcpImplementation: ActiveMcpImplementation;
  workflowEngineLoaded: boolean;
}

/** The only Pi UI capability used by the notification boundary. */
export interface NotificationUi {
  notify(message: string, severity?: "info" | "warning" | "error"): void;
}

/** Consumer-owned view of a Pi context used only to emit notifications. */
export interface NotificationContext {
  readonly mode: string;
  readonly ui: NotificationUi;
}

/** The tool metadata inspected by the optional-dependency probes. */
export interface ToolInventoryItem {
  readonly name?: unknown;
  readonly sourceInfo?: { readonly source?: unknown };
}

/** The slash-command metadata inspected by the MCP implementation probes. */
export interface CommandInventoryItem {
  readonly name?: unknown;
  readonly source?: unknown;
  readonly sourceInfo?: { readonly source?: unknown; readonly path?: unknown };
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
 * ASTAT-01: consumer-owned view of Pi's shared extension event bus
 * (`pi.events`), used only to subscribe to another extension's channel.
 */
export interface PiEventSource {
  on(channel: string, handler: (data: unknown) => void): () => void;
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

// ADET-02: `getCommands()` also lists prompt templates and skills, each with
// its package's `sourceInfo`. Only extension commands count, so a skill or
// prompt shipped beside a filtered-off adapter does not read as the adapter.
function isAdapterCommand(command: CommandInventoryItem): boolean {
  if (command.source !== "extension") {
    return false;
  }

  return (
    isAdapterSource(command.sourceInfo?.source) ||
    (typeof command.name === "string" && ADAPTER_COMMAND_NAME.test(command.name))
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
 * The snapshot's one `pi.getCommands()` read, shared by both MCP arms. A read
 * that throws reads as an empty inventory, so neither arm sees a command.
 */
function readCommands(pi: PiInventory): readonly CommandInventoryItem[] {
  try {
    return pi.getCommands();
  } catch {
    return [];
  }
}

/**
 * ADET-02: pi-mcp-adapter is loaded iff `commands` lists an extension command
 * named `mcp-adapter`, or the `sourceInfo.source` of an extension command or
 * of a tool contains "pi-mcp-adapter". The command is present with
 * `disableProxyTool` and in a fork. A bare tool named `mcp` does not count,
 * and neither does Pi's built-in MCP (`mcp__*` tools and an `mcp` command from
 * `builtin:mcp`). Each arm is guarded on its own and both always run, so one
 * snapshot makes the same reads in every state and a throwing arm leaves the
 * other one deciding.
 */
function hasLoadedPiMcpAdapter(
  pi: PiInventory,
  commands: readonly CommandInventoryItem[],
): boolean {
  const viaCommands = probeArm(() => commands.some((command) => isAdapterCommand(command)));
  const viaTools = probeArm(() =>
    pi.getAllTools().some((tool) => isAdapterSource(tool.sourceInfo?.source)),
  );
  return viaCommands || viaTools;
}

/**
 * MSEL-01, D-P5-01: the `sourceInfo.path` of every command and tool that Pi's
 * built-in MCP extension registers. Pi marks each of its own built-in
 * extensions with the source path `builtin:<name>`.
 */
export const BUILTIN_MCP_SOURCE_PATH = "builtin:mcp";

// MSEL-01: a third extension that registers `/mcp` makes Pi leave the built-in
// out, and its command carries that extension's own path, so it does not read
// as the built-in.
function isBuiltinMcpCommand(command: CommandInventoryItem): boolean {
  return (
    command.source === "extension" &&
    command.name === "mcp" &&
    command.sourceInfo?.path === BUILTIN_MCP_SOURCE_PATH
  );
}

/**
 * MSEL-01: Pi's built-in MCP is loaded iff `commands` lists the extension
 * command `mcp` whose `sourceInfo.path` is exactly `builtin:mcp`. A prompt
 * template or skill named `mcp` does not count.
 */
function hasLoadedBuiltinMcp(commands: readonly CommandInventoryItem[]): boolean {
  return probeArm(() => commands.some((command) => isBuiltinMcpCommand(command)));
}

/** MSEL-01: the adapter wins over Pi's built-in MCP; with neither, none. */
function activeMcpImplementation(
  adapterLoaded: boolean,
  builtinLoaded: boolean,
): ActiveMcpImplementation {
  if (adapterLoaded) {
    return "adapter";
  }

  if (builtinLoaded) {
    return "builtin";
  }

  return "none";
}

/**
 * Snapshots which optional companion extensions Pi has loaded and which MCP
 * implementation the run uses. One snapshot reads `pi.getCommands()` once and
 * `pi.getAllTools()` three times, whatever Pi has loaded.
 */
export function softDepStatus(pi: PiInventory): SoftDepStatus {
  const piSubagentsLoaded = hasLoadedPiSubagents(pi);
  const commands = readCommands(pi);
  const adapterLoaded = hasLoadedPiMcpAdapter(pi, commands);
  return {
    piSubagentsLoaded,
    mcpImplementation: activeMcpImplementation(adapterLoaded, hasLoadedBuiltinMcp(commands)),
    workflowEngineLoaded: hasLoadedWorkflowEngine(pi),
  };
}

/** One call of Pi's read tool on a text file, with its optional line range. */
export interface ReadToolCall {
  /** The absolute path of the file. */
  readonly file: string;
  readonly offset: number | undefined;
  readonly limit: number | undefined;
}

/**
 * Whether Pi's own read tool, called as `call` on a text file that holds
 * `content`, returns exactly `text` as its one text block: the same lines,
 * the same truncation, and the same continuation notice. The tool reads
 * `content`, not the disk. Rejects with Pi's error for an offset past the
 * end of `content`.
 */
export async function readToolReturns(
  call: ReadToolCall,
  content: string,
  text: string,
): Promise<boolean> {
  const tool = createReadTool(path.dirname(call.file), {
    operations: {
      readFile: () => Promise.resolve(Buffer.from(content, "utf8")),
      access: () => Promise.resolve(),
    },
  });
  const result = await tool.execute("skill-read", {
    path: call.file,
    ...(call.offset === undefined ? {} : { offset: call.offset }),
    ...(call.limit === undefined ? {} : { limit: call.limit }),
  });
  return isDeepStrictEqual(result.content, [{ type: "text", text }]);
}
