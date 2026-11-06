/**
 * The built-in MCP registration step and its resync.
 *
 * `session-materialize.ts` runs `builtinRegistrationStep` at every
 * `session_start`, and the extension runs `resyncBuiltinRegistrations` after
 * each load reconcile (D-MB-10). Both run one sync: they register each runnable MCP server of each enabled plugin
 * record with Pi's own MCP for the session, under Claude Code's server name
 * (D-MB-02, D-MB-13), and unregister the plugin servers no record wants any
 * more. A server's values are resolved here from the session environment
 * (BLT-02); nothing is written to a file (D-MB-04).
 *
 * The user scope's records register first, then, only while Pi trusts the
 * project on this call, the project scope's (D-MB-09). A project server
 * replaces the user server of the same name in place (P2-DC-14), so a user
 * server the project lacks still registers. A background child runs the same
 * steps for its own session (D-MB-12). A name whose registration Pi refuses,
 * because another extension registered it first, is noted for the session, so
 * info reads it as `not loaded` (D-MB-29).
 *
 * MSEL-03: under pi-mcp-adapter, or with no implementation active, both steps
 * return before they read the context, the state, or Pi's registry. Pi reports
 * a registration nothing connects as an extension error, and the adapter
 * would proxy a duplicate.
 *
 * UF-1 / NFR-10: a record's plugin root must lie inside its own clone root
 * before any of its files is read or its root reaches `${CLAUDE_PLUGIN_ROOT}`:
 * a git record's own `plugin-clones/<key>/` entry, any other record's
 * marketplace root, which for a cloned marketplace must itself lie inside the
 * scope's `sources/<marketplace>/` checkout. `recorded-servers.ts` owns the
 * check, which its legacy reader applies too.
 *
 * NFR-2: neither step throws. Every skipped record, scope, or server is
 * debug-logged on the `mcp` channel with its name and the error message, never
 * a config value; each absolute path in the line is cut to its last segment,
 * since state, data-directory, and Pi registry errors name absolute paths.
 * The legacy reader logs its own refusals. The steps never handle
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
import {
  builtinServerOwner,
  noteBuiltinServerOwners,
  noteFreshBuiltinRegistration,
  noteRefusedBuiltinRegistration,
  noteReplacedBuiltinRegistration,
} from "../../platform/mcp-builtin-status.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { redactAbsolutePaths } from "../../shared/redact-absolute-paths.ts";
import { SCOPES } from "../../shared/types.ts";

import {
  isPluginRootContained,
  legacyServersSourceFor,
  readLegacyServers,
  recordedMcpServers,
} from "./recorded-servers.ts";

import type { McpSubstitutionContext } from "../../bridges/mcp/index.ts";
import type { ClaudeEnv } from "../../domain/claude-mcp-variables.ts";
import type { RecordedMcpServer } from "../../domain/mcp-implementation.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState, PluginInstallRecord } from "../../persistence/state-io.ts";
import type { BuiltinServerOwner } from "../../platform/mcp-builtin-status.ts";
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

type Registration = readonly [name: string, config: McpServerConfig, owner: BuiltinServerOwner];

/**
 * A scope, or one record of it, whose state or servers could not be read. A
 * live server it owns keeps its registration on this pass.
 */
interface ReadFailure {
  readonly scope: Scope;
  readonly marketplace?: string;
  readonly plugin?: string;
}

/** The registrations a scope or record wants, and what it failed to read. */
interface Outcome {
  readonly registrations: Registration[];
  readonly failures: ReadFailure[];
}

const BUILTIN_PROFILE = profileFor("builtin");

// P2-DC-10: the status reader reads a replaced server's hidden tools as a
// reconnect, not a `/mcp` disable. D-MB-29: info reads a name whose
// registration Pi refused as `not loaded`, not as the other extension's
// server.
const REGISTRATION_NOTES = {
  replaced: noteReplacedBuiltinRegistration,
  fresh: noteFreshBuiltinRegistration,
  refused: noteRefusedBuiltinRegistration,
};

function debugLog(detail: string): void {
  hookDebugLog(redactAbsolutePaths(detail), "mcp");
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

/**
 * The servers of one plugin that the built-in profile runs, named and built in
 * the record's server order. The install-time verdict does not filter: a
 * server only pi-mcp-adapter blocks registers here (P2-DC-06). A server whose
 * resolved config Pi would run differently, such as a variable that resolved
 * to a leading `~`, is skipped and logged.
 */
function serverRegistrations(
  pluginName: string,
  servers: readonly RecordedMcpServer[],
  ctx: McpSubstitutionContext,
  description: string | undefined,
  owner: BuiltinServerOwner,
): Registration[] {
  return servers
    .filter(({ config }) => BUILTIN_PROFILE.classify(config).kind === "supported")
    .flatMap(({ name, config }): Registration[] => {
      const serverName = BUILTIN_PROFILE.serverName(pluginName, name);
      const built = builtinServerConfig(config, ctx, description);
      if (built === undefined) {
        debugLog(
          `MCP server ${serverName} not registered: Pi would not run it as Claude Code does`,
        );
        return [];
      }

      return [[serverName, built, owner]];
    });
}

async function recordRegistrations(
  source: RecordSource,
  locations: ScopedLocations,
  session: SessionFacts,
): Promise<Registration[]> {
  const plugin = `${source.pluginName}@${source.marketplaceName}`;
  const legacySource = legacyServersSourceFor(locations, source.marketplace, source.pluginName);
  if (!(await isPluginRootContained(legacySource))) {
    debugLog(`MCP servers of ${plugin} not registered: its plugin root is outside its sources`);
    return [];
  }

  // MREC-02: a record without `mcpServerConfigs` is re-resolved read-only
  // against its own marketplace record.
  const recorded = await recordedMcpServers(legacySource, readLegacyServers);
  // An unreadable record is a skip, not a read failure: `unreadable` also
  // answers a plugin root outside its clone root, which must never keep a
  // registration (UF-1, NFR-10), so its live servers are unregistered.
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
  return serverRegistrations(source.pluginName, recorded.servers, ctx, description, {
    scope: locations.scope,
    marketplace: source.marketplaceName,
    plugin: source.pluginName,
  });
}

/**
 * One record's registrations. A record whose read throws registers nothing
 * new, is logged, and is reported as a failure, so its live servers stay.
 */
async function guardedRecordRegistrations(
  source: RecordSource,
  locations: ScopedLocations,
  session: SessionFacts,
): Promise<Outcome> {
  try {
    return { registrations: await recordRegistrations(source, locations, session), failures: [] };
  } catch (error: unknown) {
    const plugin = `${source.pluginName}@${source.marketplaceName}`;
    debugLog(`MCP servers of ${plugin} not registered: ${errorMessage(error)}`);
    return {
      registrations: [],
      failures: [
        { scope: locations.scope, marketplace: source.marketplaceName, plugin: source.pluginName },
      ],
    };
  }
}

/** The registrations of one scope's enabled records, in record order. */
async function scopeRegistrations(scope: Scope, session: SessionFacts): Promise<Outcome> {
  const locations = locationsFor(scope, session.cwd);
  let state: ExtensionState;
  try {
    state = await loadState(locations.extensionRoot, { persistMigration: false });
  } catch (error: unknown) {
    debugLog(`MCP servers of the ${scope} scope not registered: ${errorMessage(error)}`);
    return { registrations: [], failures: [{ scope }] };
  }

  const perRecord = await Promise.all(
    enabledRecords(state).map((source) => guardedRecordRegistrations(source, locations, session)),
  );
  return {
    registrations: perRecord.flatMap((outcome) => outcome.registrations),
    failures: perRecord.flatMap((outcome) => outcome.failures),
  };
}

/**
 * D-MB-09: the project scope counts only while Pi trusts the project. The
 * user registrations come first; a later registration of the same name
 * replaces an earlier one in its place (P2-DC-14).
 */
async function desiredRegistrations(
  session: SessionFacts,
  projectTrusted: boolean,
): Promise<Outcome> {
  const scopes: readonly Scope[] = projectTrusted ? SCOPES : ["user"];
  const perScope = await Promise.all(scopes.map((scope) => scopeRegistrations(scope, session)));
  return {
    registrations: perScope.flatMap((outcome) => outcome.registrations),
    failures: perScope.flatMap((outcome) => outcome.failures),
  };
}

function isOwnedByFailure(owner: BuiltinServerOwner, failure: ReadFailure): boolean {
  return (
    owner.scope === failure.scope &&
    (failure.marketplace === undefined ||
      (owner.marketplace === failure.marketplace && owner.plugin === failure.plugin))
  );
}

/**
 * The listed servers whose last-noted owner a read failure covers: they keep
 * their registration and their owner on this pass.
 */
function retainedOwners(
  pi: PiMcpRegistry,
  failures: readonly ReadFailure[],
): Map<string, BuiltinServerOwner> {
  const retained = new Map<string, BuiltinServerOwner>();
  if (failures.length === 0) {
    return retained;
  }

  for (const { name } of pi.getMcpServers()) {
    const owner = builtinServerOwner(name);
    if (owner !== undefined && failures.some((failure) => isOwnedByFailure(owner, failure))) {
      debugLog(`MCP server ${name} kept registered: its owner could not be read`);
      retained.set(name, owner);
    }
  }

  return retained;
}

async function syncSession({ pi, ctx, snapshot }: BuiltinRegistrationStepInput): Promise<void> {
  if (snapshot.softDeps.mcpImplementation !== "builtin") {
    return;
  }

  try {
    // The step's only read of the process environment. Trust is asked on
    // every call, since the user can trust a project mid-session.
    const { registrations, failures } = await desiredRegistrations(
      { cwd: ctx.cwd, env: process.env },
      ctx.isProjectTrusted(),
    );
    // A scope or record that failed to read keeps its live servers: they are
    // neither unregistered nor dropped from the owner map.
    const retained = retainedOwners(pi, failures);
    // P2-DC-14: info reads which record each name belongs to from here.
    noteBuiltinServerOwners(
      new Map([
        ...retained,
        ...registrations.map(([name, , owner]): [string, BuiltinServerOwner] => [name, owner]),
      ]),
    );
    syncBuiltinRegistrations(
      pi,
      new Map(registrations.map(([name, config]) => [name, config])),
      debugLog,
      REGISTRATION_NOTES,
      new Set(retained.keys()),
    );
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
