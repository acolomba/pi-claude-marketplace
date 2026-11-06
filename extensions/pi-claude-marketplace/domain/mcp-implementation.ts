// domain/mcp-implementation.ts
//
// The MCP implementation profiles (MSEL-01). A plugin's MCP servers run under
// pi-mcp-adapter or under Pi's own built-in MCP, and each implementation has
// a profile: the verdict it gives a declared server, and the names it gives
// the server, its tools, and an agent's grant. Both verdicts share one
// Claude-shape check, so a server is malformed for both or for neither.
//
// `effectiveMcpCompatibility` reads a plugin record's stored compatibility for
// the active implementation, recomputing the MCP part from the recorded
// servers when the stored verdict was not computed for it.

import { createHash } from "node:crypto";

import { classifyBuiltinMcpServer } from "./mcp-builtin-features.ts";
import { checkClaudeShape, classifyMcpServer } from "./mcp-server-features.ts";
import { builtinMcpServerName, foldedMcpServerKey, generatedMcpServerKey } from "./name.ts";

import type {
  DroppedMcpServer,
  McpServerVerdict,
  McpUnsupportedFeature,
} from "./mcp-server-features.ts";
import type { ActiveMcpImplementation, McpImplementationId } from "../platform/pi-api.ts";

export type { ActiveMcpImplementation, McpImplementationId } from "../platform/pi-api.ts";

/** One MCP implementation's verdict table and naming (MSEL-01). */
export interface McpImplementationProfile {
  readonly id: McpImplementationId;
  /** The implementation's verdict for one declared server config. */
  readonly classify: (config: unknown) => McpServerVerdict;
  /** The name the implementation runs a plugin's server under. */
  readonly serverName: (plugin: string, server: string) => string;
  /**
   * The text every tool name of the server starts with, or `undefined` when
   * the implementation cannot promise one: Pi's built-in MCP cuts a long tool
   * name inside a long server namespace (D-MB-13). Without a prefix, a caller
   * matches the full names from `toolName` instead. The adapter profile
   * always returns a prefix.
   */
  readonly toolNamePrefix: (plugin: string, server: string) => string | undefined;
  /** The full name the model sees for one tool of the server. */
  readonly toolName: (plugin: string, server: string, tool: string) => string;
  /** The `mcp:` entry that grants an agent the whole server. */
  readonly grantSelector: (plugin: string, server: string) => string;
}

/**
 * The adapter's tool prefix is Claude Code's own tool-name form,
 * `mcp__plugin_<plugin>_<server>__` (ANAME-01), which is what D-MB-08 says a
 * hook matcher sees.
 */
function adapterToolNamePrefix(plugin: string, server: string): string {
  return `mcp__${generatedMcpServerKey(plugin, server)}_`;
}

/**
 * pi-mcp-adapter 7.0.0 `formatToolName` with `toolPrefix: "mcp"`: it turns
 * each `.` in the tool name into `_`, and it does not add the prefix again to
 * a tool name that already starts with it.
 */
function adapterToolName(plugin: string, server: string, tool: string): string {
  const prefix = adapterToolNamePrefix(plugin, server);
  const sanitized = tool.replaceAll(".", "_");
  if (sanitized.startsWith(prefix) && sanitized.length > prefix.length) {
    return sanitized;
  }

  return `${prefix}${sanitized}`;
}

const ADAPTER_PROFILE: McpImplementationProfile = Object.freeze({
  id: "adapter",
  classify: classifyMcpServer,
  serverName: generatedMcpServerKey,
  toolNamePrefix: adapterToolNamePrefix,
  toolName: adapterToolName,
  grantSelector: (plugin: string, server: string) => `mcp:${generatedMcpServerKey(plugin, server)}`,
});

// Pi 1.5.0 limits a provider tool name to 64 characters
// (`dist/extensions/mcp/tools.js` `MAX_TOOL_NAME_LENGTH`).
const MAX_TOOL_NAME_LENGTH = 64;
const TOOL_NAME_HASH_LENGTH = 8;
// A cut tool name keeps this many characters, then `_` and the hash.
const KEPT_TOOL_NAME_LENGTH = MAX_TOOL_NAME_LENGTH - TOOL_NAME_HASH_LENGTH - 1;

/**
 * D-MB-13: Pi's built-in namespace for a registered server name, `mcp__`
 * plus the name with `-` folded to `_`, then the `__` before the tool. Pi
 * keeps the first 55 characters of a cut tool name, so the profile promises
 * the namespace as a prefix only when it fits in those characters.
 */
function builtinToolNamePrefix(plugin: string, server: string): string | undefined {
  const prefix = `mcp__${foldedMcpServerKey(builtinMcpServerName(plugin, server))}__`;
  return prefix.length <= KEPT_TOOL_NAME_LENGTH ? prefix : undefined;
}

/**
 * D-MB-13: Pi 1.5.0's `createMcpToolName`. Every character outside
 * `[A-Za-z0-9_]` in `mcp__<server>__<tool>` becomes `_`. A name over 64
 * characters keeps its first 55, then `_` and the first 8 hex of the sha256 of
 * the registered server name (with `-` kept), NUL, and the original tool
 * name. Pi also hashes a short name when another tool already sanitizes to
 * it; which tools a server offers is not in the records, so that case cannot
 * be predicted and is a recorded gap.
 */
function builtinToolName(plugin: string, server: string, tool: string): string {
  const serverName = builtinMcpServerName(plugin, server);
  // Without the `u` flag, `\W` is exactly Pi's `[^A-Za-z0-9_]`, applied to
  // each UTF-16 code unit.
  const name = `mcp__${serverName}__${tool}`.replaceAll(/\W/g, "_");
  if (name.length <= MAX_TOOL_NAME_LENGTH) {
    return name;
  }

  const hash = createHash("sha256")
    .update(`${serverName}\0${tool}`)
    .digest("hex")
    .slice(0, TOOL_NAME_HASH_LENGTH);
  return `${name.slice(0, KEPT_TOOL_NAME_LENGTH)}_${hash}`;
}

const BUILTIN_PROFILE: McpImplementationProfile = Object.freeze({
  id: "builtin",
  classify: classifyBuiltinMcpServer,
  serverName: builtinMcpServerName,
  toolNamePrefix: builtinToolNamePrefix,
  toolName: builtinToolName,
  grantSelector: (plugin: string, server: string) => `mcp:${builtinMcpServerName(plugin, server)}`,
});

const PROFILES = {
  adapter: ADAPTER_PROFILE,
  builtin: BUILTIN_PROFILE,
} as const satisfies Record<McpImplementationId, McpImplementationProfile>;

/** The frozen profile of one MCP implementation; every call returns the same object. */
export function profileFor(id: McpImplementationId): McpImplementationProfile {
  return PROFILES[id];
}

/** One recorded MCP server: its declared name and its Claude config. */
export interface RecordedMcpServer {
  readonly name: string;
  readonly config: unknown;
}

/** The recorded MCP servers of one plugin record, or why they cannot be read. */
export type RecordedMcpServers =
  | {
      readonly kind: "recorded" | "re-resolved";
      readonly servers: readonly RecordedMcpServer[];
      readonly bundle: boolean;
    }
  | { readonly kind: "unreadable" };

/**
 * The structural view of a plugin record that the effective read takes, so a
 * caller passes the record itself. A stored compatibility without
 * `compatibilityBasis` carries the adapter's MCP verdict; `"neutral"` means
 * its `mcpServers` kind stands only for an implementation-independent block.
 */
export interface StoredMcpCompatibility {
  readonly compatibility: {
    readonly installable: boolean;
    readonly notes: readonly string[];
    readonly unsupported: readonly string[];
  };
  readonly compatibilityBasis?: "neutral";
}

/** A record's compatibility for the active MCP implementation. */
export interface EffectiveMcpCompatibility {
  readonly installable: boolean;
  readonly unsupported: readonly string[];
  readonly blocked: readonly DroppedMcpServer[];
}

/**
 * TR-04: the note `markUpdateInProgress` in orchestrators/plugin/update-swap.ts
 * writes into `compatibility.notes` while an update is in flight.
 */
export const UPDATE_IN_PROGRESS_NOTE = "update-in-progress";

// The typed unsupported kind of a blocked MCP server or a bundle (ANAME-07).
const MCP_SERVERS_KIND = "mcpServers";

type ReadableMcpServers = Extract<RecordedMcpServers, { readonly servers: unknown }>;

function blockedFeature(verdict: McpServerVerdict): McpUnsupportedFeature | undefined {
  return verdict.kind === "blocked" ? verdict.feature : undefined;
}

/**
 * The feature that blocks one recorded config under the active
 * implementation. With no active implementation a server is blocked only when
 * both profiles block it, and it reports the adapter profile's feature.
 */
function blockingFeature(
  config: unknown,
  active: ActiveMcpImplementation,
): McpUnsupportedFeature | undefined {
  if (active !== "none") {
    return blockedFeature(PROFILES[active].classify(config));
  }

  const adapterFeature = blockedFeature(ADAPTER_PROFILE.classify(config));
  return blockedFeature(BUILTIN_PROFILE.classify(config)) === undefined
    ? undefined
    : adapterFeature;
}

function blockedServers(
  servers: readonly RecordedMcpServer[],
  active: ActiveMcpImplementation,
): DroppedMcpServer[] {
  const blocked: DroppedMcpServer[] = [];
  for (const { name, config } of servers) {
    const feature = blockingFeature(config, active);
    if (feature !== undefined) {
      blocked.push({ server: name, feature });
    }
  }

  return blocked;
}

function storedEffective(
  stored: StoredMcpCompatibility,
  blocked: readonly DroppedMcpServer[],
): EffectiveMcpCompatibility {
  return {
    installable: stored.compatibility.installable,
    unsupported: [...stored.compatibility.unsupported],
    blocked,
  };
}

/** The stored kinds in their order, with `mcpServers` kept, appended, or removed. */
function withMcpServersKind(unsupported: readonly string[], mcpBlocked: boolean): string[] {
  if (!mcpBlocked) {
    return unsupported.filter((kind) => kind !== MCP_SERVERS_KIND);
  }

  return unsupported.includes(MCP_SERVERS_KIND)
    ? [...unsupported]
    : [...unsupported, MCP_SERVERS_KIND];
}

/**
 * A stored `installable: false` turns true only when MCP servers alone held
 * the plugin back: `mcpServers` is the only stored kind, and the record does
 * not carry the update intent mark.
 */
function onlyMcpHeldBack(compatibility: StoredMcpCompatibility["compatibility"]): boolean {
  return (
    compatibility.unsupported.length > 0 &&
    compatibility.unsupported.every((kind) => kind === MCP_SERVERS_KIND) &&
    !compatibility.notes.includes(UPDATE_IN_PROGRESS_NOTE)
  );
}

function recomputedEffective(
  stored: StoredMcpCompatibility,
  recorded: ReadableMcpServers,
  active: ActiveMcpImplementation,
): EffectiveMcpCompatibility {
  const { compatibility } = stored;
  const blocked = blockedServers(recorded.servers, active);
  // A `.mcpb`/`.dxt` bundle blocks under every implementation, and no recorded
  // server represents it. A neutral stored `mcpServers` is such a block.
  const independentBlock =
    recorded.bundle ||
    (stored.compatibilityBasis === "neutral" &&
      compatibility.unsupported.includes(MCP_SERVERS_KIND));
  const mcpBlocked = independentBlock || blocked.length > 0;
  return {
    installable: !mcpBlocked && (compatibility.installable || onlyMcpHeldBack(compatibility)),
    unsupported: withMcpServersKind(compatibility.unsupported, mcpBlocked),
    blocked,
  };
}

/**
 * MSEL-01 / MREC-01: a plugin record's compatibility for the active MCP
 * implementation. The rules apply in order:
 *
 * 1. When the recorded servers cannot be read, or a recorded config fails the
 *    shared Claude-shape check, the stored verdict stands under every
 *    implementation and nothing is reported blocked.
 * 2. A stored compatibility without `compatibilityBasis` carries the
 *    adapter's verdict, so under the adapter it stands exactly; `blocked`
 *    lists the recorded servers the adapter blocks, in recorded order.
 * 3. Otherwise the MCP part is recomputed. `blocked` lists the recorded
 *    servers the active profile blocks (with no active implementation, the
 *    servers both profiles block, with the adapter's feature). A bundle, or a
 *    neutral stored `mcpServers`, blocks under every implementation and is
 *    never lost. The `unsupported` kind list keeps the stored order, with
 *    `mcpServers` kept, appended, or removed. `installable` is false when MCP
 *    blocks; otherwise it is the stored value, and a stored false turns true
 *    only when MCP servers alone held the plugin back.
 */
export function effectiveMcpCompatibility(
  stored: StoredMcpCompatibility,
  recorded: RecordedMcpServers,
  active: ActiveMcpImplementation,
): EffectiveMcpCompatibility {
  if (
    recorded.kind === "unreadable" ||
    recorded.servers.some(({ config }) => checkClaudeShape(config).kind === "malformed")
  ) {
    return storedEffective(stored, []);
  }

  if (active === "adapter" && stored.compatibilityBasis === undefined) {
    return storedEffective(stored, blockedServers(recorded.servers, "adapter"));
  }

  return recomputedEffective(stored, recorded, active);
}
