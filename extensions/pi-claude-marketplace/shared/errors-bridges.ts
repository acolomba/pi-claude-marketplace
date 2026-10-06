// shared/errors-bridges.ts
//
// Typed error subclasses for bridge refusals. Each error type maps to one
// specific PRD failure mode; bridges throw these so callers can distinguish
// refusal categories via instanceof and so user-visible error messages are
// uniform.

import type { McpConfigNotice } from "./notification-dispatch.ts";

/**
 * The (marketplace, plugin) tuple an agent name belongs to. Declared once so
 * the conflict's owner, the error's public `stagingFor` field and the
 * constructor parameter behind it all name the same two members rather than
 * three copies of them.
 */
export interface PluginCoordinate {
  readonly marketplace: string;
  readonly plugin: string;
}

/**
 * One ownership conflict surfaced by the agents-index when a generated
 * agent name in a stage operation is already owned by a different
 * (marketplace, plugin) tuple. AgentOwnershipConflictError carries an array
 * of these so callers can format multi-conflict messages.
 */
export interface AgentOwnershipConflict {
  readonly generatedName: string;
  readonly owner: PluginCoordinate;
}

/**
 * AG-9 / RN-4 refusal: one or more generated agent names in the new stage
 * operation are already owned by a different (marketplace, plugin) tuple.
 * Bridge collects ALL conflicts before throwing so the user sees a single
 * loud message naming every collision rather than a stutter of refusals.
 */
export class AgentOwnershipConflictError extends Error {
  readonly conflicts: readonly AgentOwnershipConflict[];
  readonly stagingFor: PluginCoordinate;
  constructor(stagingFor: PluginCoordinate, conflicts: readonly AgentOwnershipConflict[]) {
    const list = conflicts
      .map((c) => `"${c.generatedName}" already owned by ${c.owner.marketplace}/${c.owner.plugin}`)
      .join("; ");
    super(`Refusing to stage agents for ${stagingFor.marketplace}/${stagingFor.plugin}: ${list}.`);
    this.name = "AgentOwnershipConflictError";
    this.conflicts = Object.freeze([...conflicts]);
    this.stagingFor = Object.freeze({ ...stagingFor });
  }
}

/**
 * AFILE-05 / MC-4 refusal: a server name being staged is already defined in
 * full by another of pi-mcp-adapter's config sources. `owningPath` is the
 * highest-precedence other source that defines it. `winningPath` is the source
 * the adapter loads under its later-wins precedence: the owner when it ranks
 * above the target file, else the target file itself.
 *
 * ANAME-03: `definedAs` is the owner's own key when it differs from
 * `serverName` only by `-` versus `_`, so the user can find the entry.
 */
export class McpServerCollisionError extends Error {
  readonly serverName: string;
  readonly owningPath: string;
  readonly winningPath: string;
  readonly definedAs?: string;
  constructor(serverName: string, owningPath: string, winningPath: string, otherKey?: string) {
    const folded = otherKey !== undefined && otherKey !== serverName;
    super(
      folded
        ? `Refusing to stage MCP server "${serverName}": ${owningPath} already defines "${otherKey}", which Pi treats as the same tool namespace because it does not tell "-" from "_".`
        : `Refusing to stage MCP server "${serverName}": ${owningPath} already defines it, and pi-mcp-adapter would load the definition in ${winningPath}.`,
    );
    this.name = "McpServerCollisionError";
    this.serverName = serverName;
    this.owningPath = owningPath;
    this.winningPath = winningPath;
    if (folded) {
      this.definedAs = otherKey;
    }
  }
}

/**
 * ANAME-03 refusal: two servers of one plugin map to one server key, or to
 * keys that differ only by `-` versus `_`, which Pi gives one tool namespace.
 * Either way one server would shadow the other. `servers` holds both declared
 * names and `keys` their keys, in declared order.
 */
export class McpServerKeyCollisionError extends Error {
  readonly pluginName: string;
  readonly servers: readonly [string, string];
  readonly keys: readonly [string, string];
  constructor(
    pluginName: string,
    servers: readonly [string, string],
    keys: readonly [string, string],
  ) {
    const subject = `Refusing to stage MCP servers "${servers[0]}" and "${servers[1]}" of plugin "${pluginName}"`;
    super(
      keys[0] === keys[1]
        ? `${subject}: both map to the server key "${keys[0]}".`
        : `${subject}: their server keys "${keys[0]}" and "${keys[1]}" differ only by "-" and "_", which Pi treats as one tool namespace.`,
    );
    this.name = "McpServerKeyCollisionError";
    this.pluginName = pluginName;
    this.servers = Object.freeze([servers[0], servers[1]] as const);
    this.keys = Object.freeze([keys[0], keys[1]] as const);
  }
}

const MCP_CONFIG_DEFECT_TEXT: Readonly<Record<McpConfigFileError["defect"], string>> = {
  "invalid-jsonc": "is not valid JSONC",
  "top-level-not-object": "does not hold a JSON object",
  "mcpServers-not-object": 'has an "mcpServers" value that is not an object',
  "mcp-servers-not-object": 'has an "mcp-servers" value that is not an object',
};

/**
 * AFILE-02 refusal: an MCP config file the bridge cannot read safely. The
 * operation stops before any write, so the file keeps its exact bytes.
 *
 * The message names the file and the defect only, and the error carries no
 * `cause`: Node's `JSON.parse` message can quote file content, and MCP
 * configs hold tokens.
 */
export class McpConfigFileError extends Error {
  readonly filePath: string;
  readonly defect:
    "invalid-jsonc" | "top-level-not-object" | "mcpServers-not-object" | "mcp-servers-not-object";

  constructor(filePath: string, defect: McpConfigFileError["defect"]) {
    super(`MCP config ${filePath} ${MCP_CONFIG_DEFECT_TEXT[defect]}; it was left unchanged.`);
    this.name = "McpConfigFileError";
    this.filePath = filePath;
    this.defect = defect;
  }
}

/**
 * NFR-3: one MCP config file an unstage rewrote and the exact bytes it
 * wrote there. A prune rollback restores the file only while it still holds
 * these bytes.
 */
export interface McpWrittenFile {
  readonly path: string;
  readonly bytes: Buffer;
}

/**
 * AFILE-04: an MCP unstage that rewrote at least one config file and then
 * failed to write a later one. `notices` and `written` describe only the
 * files already rewritten, so the caller can report the dropped comments and
 * a rollback can recognize its own write (NFR-3). `removedNames` lists the
 * names no file still holds (TR-03). The write failure rides `Error.cause`.
 */
export class McpUnstagePartialError extends Error {
  readonly removedNames: readonly string[];
  readonly notices: readonly McpConfigNotice[];
  readonly written: readonly McpWrittenFile[];
  constructor(
    removedNames: readonly string[],
    notices: readonly McpConfigNotice[],
    written: readonly McpWrittenFile[],
    options: ErrorOptions,
  ) {
    super("MCP unstage stopped after rewriting part of its config files.", options);
    this.name = "McpUnstagePartialError";
    this.removedNames = Object.freeze([...removedNames]);
    this.notices = Object.freeze([...notices]);
    this.written = Object.freeze([...written]);
  }
}

/**
 * Generic wrapper for prepare-time staging tmp failures (mkdtemp, partial
 * writes). Carries the underlying cause via Error.cause; downstream
 * callers may use appendLeakToError to surface cleanup leaks.
 */
export class BridgeStagingError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "BridgeStagingError";
  }
}

/**
 * CM-4: one command file whose relative path does not produce a valid
 * generated name (RN-2). `domain/name.ts` knows the failing segment but not
 * the directory the file came from, so the throw site and the call site each
 * hold half of the answer; this error is where they meet.
 *
 * The message names the source and the directory ONLY. The reason rides
 * `Error.cause`, so `causeChainTrailer` renders it exactly once -- inlining
 * it here as well would print it twice.
 */
export class CommandNameError extends Error {
  readonly sourceName: string;
  readonly commandsDir: string;

  constructor(sourceName: string, commandsDir: string, options?: ErrorOptions) {
    super(`invalid command source "${sourceName}" in "${commandsDir}"`, options);
    this.name = "CommandNameError";
    this.sourceName = sourceName;
    this.commandsDir = commandsDir;
  }
}

/**
 * WR-06: a workflow commit found content at a target path this plugin does not
 * own. The engine's saved directory is shared with the user's own hand-saved
 * workflows and with every other plugin, and the `<plugin>:` prefix namespaces
 * a name without granting ownership of it.
 *
 * Typed rather than a bare `Error` because the refusal names a path the
 * operator must inspect: the commit raises it BEFORE its first rename, and the
 * file at that path belongs to somebody else.
 */
export class WorkflowTargetOccupiedError extends Error {
  readonly targetPath: string;
  constructor(targetPath: string) {
    super(`Cannot replace workflow target with non-previous content at ${targetPath}`);
    this.name = "WorkflowTargetOccupiedError";
    this.targetPath = targetPath;
  }
}
