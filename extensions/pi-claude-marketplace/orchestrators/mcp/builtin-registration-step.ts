/**
 * The built-in MCP registration step and its resync.
 *
 * Their names, input, and call sites are fixed: `session-materialize.ts` runs
 * `builtinRegistrationStep` at every `session_start`, and the extension runs
 * `resyncBuiltinRegistrations` after each load reconcile (D-MB-10). Both run
 * one sync: they register each runnable MCP server of each enabled plugin
 * record with Pi's own MCP for the session, under Claude Code's server name
 * (D-MB-02, D-MB-13), and unregister the plugin servers no record wants any
 * more. A server's values are resolved here from the session environment
 * (BLT-02); nothing is written to a file (D-MB-04).
 *
 * The user scope's records register first, then, only while Pi trusts the
 * project on this call, the project scope's (D-MB-09). A project server
 * replaces the user server of the same name in place (P2-DC-14), so a user
 * server the project lacks still registers. A background child runs the same
 * steps for its own session (D-MB-12).
 *
 * MSEL-03: under pi-mcp-adapter, or with no implementation active, both steps
 * return before they read the context, the state, or Pi's registry. Pi reports
 * a registration nothing connects as an extension error, and the adapter
 * would proxy a duplicate.
 *
 * UF-1 / NFR-10: a record's plugin root must lie inside its marketplace root
 * or the scope's plugin clones directory before any of its files is read or
 * its root reaches `${CLAUDE_PLUGIN_ROOT}`.
 *
 * NFR-2: neither step throws. Every skipped record, scope, or server is
 * debug-logged on the `mcp` channel with names only. The steps never handle
 * `mcp_servers_change`, which would make this extension the connector (PI-11).
 */

import {
  builtinServerConfig,
  readBuiltinServerDescription,
  syncBuiltinRegistrations,
} from "../../bridges/mcp/index.ts";
import { profileFor } from "../../domain/mcp-implementation.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { isRecordedButDisabled, loadState } from "../../persistence/state-io.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { assertPathInside } from "../../shared/path-safety.ts";
import { SCOPES } from "../../shared/types.ts";

import { createLegacyServersReader, recordedMcpServers } from "./recorded-servers.ts";

import type { McpSubstitutionContext } from "../../bridges/mcp/index.ts";
import type { ClaudeEnv } from "../../domain/claude-mcp-variables.ts";
import type { RecordedMcpServer } from "../../domain/mcp-implementation.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState, PluginInstallRecord } from "../../persistence/state-io.ts";
import type { ExtensionContext, McpServerConfig, PiMcpRegistry } from "../../platform/pi-api.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { Scope } from "../../shared/types.ts";

/** What the registration step and its resync receive. */
export interface BuiltinRegistrationStepInput {
  /** Pi's session MCP registry, the one Pi surface the step may change. */
  readonly pi: PiMcpRegistry;
  readonly ctx: ExtensionContext;
  /** The run whose soft-dependency snapshot names the active implementation (D-05). */
  readonly snapshot: NotificationRun;
}

/** One enabled plugin record with the marketplace record that lists it. */
interface RecordSource {
  readonly marketplaceName: string;
  readonly marketplace: ExtensionState["marketplaces"][string];
  readonly pluginName: string;
  readonly record: PluginInstallRecord;
}

/** What every record of one session reads besides its own state. */
interface SessionFacts {
  /** The session's working directory: `${CLAUDE_PROJECT_DIR}` for both scopes. */
  readonly cwd: string;
  readonly env: ClaudeEnv;
}

type Registration = readonly [name: string, config: McpServerConfig];

const BUILTIN_PROFILE = profileFor("builtin");

function debugLog(detail: string): void {
  hookDebugLog(detail, "mcp");
}

function enabledRecords(state: ExtensionState): RecordSource[] {
  const sources: RecordSource[] = [];
  for (const [marketplaceName, marketplace] of Object.entries(state.marketplaces)) {
    for (const [pluginName, record] of Object.entries(marketplace.plugins)) {
      if (!isRecordedButDisabled(record) && record.dependencyDisabled !== true) {
        sources.push({ marketplaceName, marketplace, pluginName, record });
      }
    }
  }

  return sources;
}

async function isInside(root: string, pluginRoot: string): Promise<boolean> {
  try {
    await assertPathInside(root, pluginRoot, "plugin root");
    return true;
  } catch {
    // Any refusal, a traversal, a path outside, or a symlinked segment,
    // leaves the plugin root uncontained under this root.
    return false;
  }
}

/** UF-1: a path record's root is inside its marketplace, a git record's inside the clones. */
async function isContained(source: RecordSource, locations: ScopedLocations): Promise<boolean> {
  const pluginRoot = source.record.resolvedSource;
  if (await isInside(source.marketplace.marketplaceRoot, pluginRoot)) {
    return true;
  }

  return isInside(locations.pluginClonesDir, pluginRoot);
}

/**
 * The servers of one plugin that the built-in profile runs, named and built in
 * the record's server order. The install-time verdict does not filter: a
 * server only pi-mcp-adapter blocks registers here (P2-DC-06).
 */
function serverRegistrations(
  pluginName: string,
  servers: readonly RecordedMcpServer[],
  ctx: McpSubstitutionContext,
  description: string | undefined,
): Registration[] {
  return servers
    .filter(({ config }) => BUILTIN_PROFILE.classify(config).kind === "supported")
    .map(
      ({ name, config }) =>
        [
          BUILTIN_PROFILE.serverName(pluginName, name),
          builtinServerConfig(config, ctx, description),
        ] as const,
    )
    .filter((entry): entry is Registration => entry[1] !== undefined);
}

async function recordRegistrations(
  source: RecordSource,
  locations: ScopedLocations,
  session: SessionFacts,
): Promise<Registration[]> {
  const plugin = `${source.pluginName}@${source.marketplaceName}`;
  if (!(await isContained(source, locations))) {
    debugLog(`MCP servers of ${plugin} not registered: its plugin root is outside its sources`);
    return [];
  }

  // MREC-02: a record without `mcpServerConfigs` is re-resolved read-only
  // against its own marketplace record.
  const recorded = await recordedMcpServers(source.record, createLegacyServersReader(source));
  if (recorded.kind === "unreadable") {
    debugLog(`MCP servers of ${plugin} not registered: its servers are unreadable`);
    return [];
  }

  if (recorded.servers.length === 0) {
    return [];
  }

  const [pluginData, description] = await Promise.all([
    locations.pluginDataDir(source.marketplaceName, source.pluginName),
    readBuiltinServerDescription({
      manifestPath: source.marketplace.manifestPath,
      marketplaceRoot: source.marketplace.marketplaceRoot,
      pluginName: source.pluginName,
      pluginRoot: source.record.resolvedSource,
      pin: source.record.resolvedSha,
    }),
  ]);
  const ctx: McpSubstitutionContext = {
    pluginRoot: source.record.resolvedSource,
    pluginData,
    projectDir: session.cwd,
    env: session.env,
  };
  return serverRegistrations(source.pluginName, recorded.servers, ctx, description);
}

/** One record's registrations; a record that fails registers nothing and is logged. */
async function guardedRecordRegistrations(
  source: RecordSource,
  locations: ScopedLocations,
  session: SessionFacts,
): Promise<Registration[]> {
  try {
    return await recordRegistrations(source, locations, session);
  } catch (error: unknown) {
    const plugin = `${source.pluginName}@${source.marketplaceName}`;
    debugLog(`MCP servers of ${plugin} not registered: ${errorMessage(error)}`);
    return [];
  }
}

/** The registrations of one scope's enabled records, in record order. */
async function scopeRegistrations(scope: Scope, session: SessionFacts): Promise<Registration[]> {
  const locations = locationsFor(scope, session.cwd);
  let state: ExtensionState;
  try {
    state = await loadState(locations.extensionRoot, { persistMigration: false });
  } catch (error: unknown) {
    debugLog(`MCP servers of the ${scope} scope not registered: ${errorMessage(error)}`);
    return [];
  }

  const perRecord = await Promise.all(
    enabledRecords(state).map((source) => guardedRecordRegistrations(source, locations, session)),
  );
  return perRecord.flat();
}

/**
 * D-MB-09: the project scope counts only while Pi trusts the project. The map
 * keeps the user registrations' order, and a project registration of the same
 * name replaces the user one in its place (P2-DC-14).
 */
async function desiredRegistrations(
  session: SessionFacts,
  projectTrusted: boolean,
): Promise<Map<string, McpServerConfig>> {
  const scopes: readonly Scope[] = projectTrusted ? SCOPES : ["user"];
  const perScope = await Promise.all(scopes.map((scope) => scopeRegistrations(scope, session)));
  return new Map(perScope.flat());
}

async function syncSession({ pi, ctx, snapshot }: BuiltinRegistrationStepInput): Promise<void> {
  if (snapshot.softDeps.mcpImplementation !== "builtin") {
    return;
  }

  try {
    // The composition root: the only read of the process environment. Trust
    // is asked on every call, since the user can trust a project mid-session.
    const desired = await desiredRegistrations(
      { cwd: ctx.cwd, env: process.env },
      ctx.isProjectTrusted(),
    );
    syncBuiltinRegistrations(pi, desired, debugLog);
  } catch (error: unknown) {
    debugLog(`MCP built-in registration skipped: ${errorMessage(error)}`);
  }
}

/** D-MB-10: registers the built-in MCP servers at `session_start`. */
export function builtinRegistrationStep(input: BuiltinRegistrationStepInput): Promise<void> {
  return syncSession(input);
}

/** D-MB-10: brings the built-in registrations in line with the records after the load reconcile. */
export function resyncBuiltinRegistrations(input: BuiltinRegistrationStepInput): Promise<void> {
  return syncSession(input);
}
