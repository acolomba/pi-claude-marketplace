// orchestrators/reconcile/mcp-migration.ts
//
// AMIG-01 / AMIG-03: the load-time move of an installed plugin's MCP servers
// out of the scope's legacy `mcp.json` into `mcp-adapter.json`. Released
// builds wrote each server into `mcp.json` under its declared name; the
// entries move under `generatedMcpServerKey(plugin, server)`. Each entry is
// re-staged from the plugin's source through the install's stage path, so it
// gets the bytes a fresh install writes. Nothing is read from a legacy entry
// but its marker's owner.
//
// The marked legacy entries are the only trigger (COMPAT-01): no flag is
// stored. Per scope the step writes `mcp-adapter.json` for every movable
// plugin first, then `state.json` once when a record's MCP inventory changed,
// then, for the user scope, the project `mcp-adapter.json` disable stubs under
// the moved old names, then removes the plugins' marked entries from
// `mcp.json`. The trigger goes
// last, so a crash at any point leaves it in place, the next `/reload` runs
// the step again, and the rerun converges to the same bytes. With no marked
// entry the step takes no lock and writes nothing.
//
// AMIG-01: the move also removes what the installed plugin no longer
// provides, in the same `mcp.json` write. A legacy name the re-staged source
// no longer declares is removed. A server the source declares with a feature
// pi-mcp-adapter cannot run is removed and not written, and the record becomes
// partially installed, as `install --partial` leaves it. A plugin whose MCP
// config is malformed has every legacy entry removed and none written, and
// its record lists no MCP server, as a fresh install refuses it. A disabled
// plugin's entries are removed with no re-stage and no record change
// (ENBL-08: a disabled plugin's servers are never restored at load). The
// record change is saved before the legacy entries go, so the trigger
// outlives it. This differs from load-time backfill, which refuses to degrade
// a clean record on a load the user did not start: the move degrades a record
// or drops a plugin's MCP servers because that is what the installed plugin
// now provides, and the notice lists every change with its reason.
//
// AMIG-04: an entry belongs to an install record of this scope only; a record
// of the same plugin in the other scope does not own it. An owner with no
// record stays in place and is reported, unless the scope's reconcile plan
// installs it in the same reload: that install removes the entry itself. An
// owner the plan uninstalls, disables or enables is skipped silently for the
// same reason. The plan's toggle buckets come from the reload's first read,
// so when a dependency install in the same reload refreshes them, an owner
// skipped as planned for a dependency disable keeps its legacy entries with
// no row for one reload, and the next reload moves or reports it. An owner
// whose manifest no longer lists it in a valid form, whose source cannot be
// read offline, whose new key another config source already defines, or
// whose scope holds a config file that does not parse stays in place with a
// row, and the next `/reload` tries again. So does a git owner whose recorded
// commit has no plugin at the declared path (D-08-05). Each row names a
// remedy that clears its cause. Nothing is damped: such an entry is reported
// on every reload until its cause is cleared (COMPAT-01 keeps no state).
//
// NFR-5: no network. This module stays outside `NETWORK_SEAMS` and never names
// the git surface. A path source is read from the marketplace's current
// checkout, as reinstall reads it, so a newer plugin version there can stage
// under the recorded version (reinstall parity). A git source is read from
// the warm clone of the record's sha through the fs-only presence probe; a
// cold cache leaves the entries in place.

import { realpath } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import {
  checkMcpAdapterConfig,
  commitPreparedMcp,
  prepareStageMcpServers,
  projectDisableStubNames,
  readLegacyMcpOwners,
  removeLegacyMcpEntries,
  removeProjectDisableStubs,
} from "../../bridges/mcp/index.ts";
import { PLUGIN_ENTRY_VALIDATOR } from "../../domain/components/plugin.ts";
import { lookupDeclaredPlugin } from "../../domain/manifest-lookup.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { generatedMcpServerKey } from "../../domain/name.ts";
import { resolveStrict } from "../../domain/plugin-resolver.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { isRecordedButDisabled } from "../../persistence/state-io.ts";
import { McpConfigFileError, McpServerCollisionError } from "../../shared/errors-bridges.ts";
import { errorMessage } from "../../shared/errors.ts";
import { pathExists } from "../../shared/fs-utils.ts";
import { narrowResolverNotes } from "../../shared/probe-classifiers.ts";
import { redactAbsolutePaths } from "../../shared/redact-absolute-paths.ts";
import { SCOPES } from "../../shared/types.ts";
import {
  withExistingScopeLock,
  withLockedStateTransaction,
} from "../../transaction/with-state-guard.ts";
import { makeRecordedShaPresenceProbe } from "../plugin/git-source-probe.ts";

import type { McpMigrationInput, ReconcilePlan } from "./types.ts";
import type { LegacyMcpOwner, ProjectDisableStubOwner } from "../../bridges/mcp/index.ts";
import type {
  GitPluginRootResult,
  MaterializablePlugin,
  ResolvedPlugin,
} from "../../domain/resolver-types.ts";
import type { GitBackedSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState, PluginInstallRecord } from "../../persistence/state-io.ts";
import type {
  McpMigrationRow,
  McpMigrationUnfinishedRow,
} from "../../shared/notification-dispatch.ts";
import type { LockedStateTransaction } from "../../transaction/with-state-guard.ts";

/**
 * The step's reads of mcp.json, its writes and its clock. A test replaces a
 * member to record the write order or to fail one read or write (AMIG-02).
 */
export interface McpMigrationOperations {
  readonly readLegacyMcpOwners: typeof readLegacyMcpOwners;
  readonly prepareStageMcpServers: typeof prepareStageMcpServers;
  readonly commitPreparedMcp: typeof commitPreparedMcp;
  readonly saveState: (tx: LockedStateTransaction) => Promise<void>;
  readonly removeProjectDisableStubs: typeof removeProjectDisableStubs;
  readonly removeLegacyMcpEntries: typeof removeLegacyMcpEntries;
  readonly now: () => Date;
}

const REAL_OPERATIONS: McpMigrationOperations = {
  readLegacyMcpOwners,
  prepareStageMcpServers,
  commitPreparedMcp,
  saveState: async (tx) => {
    await tx.save();
  },
  removeProjectDisableStubs,
  removeLegacyMcpEntries,
  now: () => new Date(),
};

type MarketplaceRecord = ExtensionState["marketplaces"][string];

/**
 * An owner whose entries this step acts on. A `move` owner's servers are
 * re-staged from its source; a `malformed` or `disabled` owner's entries are
 * removed and none is written.
 */
type OwnerAction =
  | {
      readonly arm: "move";
      readonly owner: LegacyMcpOwner;
      readonly record: PluginInstallRecord;
      readonly resolved: MaterializablePlugin;
    }
  | {
      readonly arm: "malformed" | "disabled";
      readonly owner: LegacyMcpOwner;
      readonly record: PluginInstallRecord;
    };

/** An owner whose stage committed, with the names it wrote. */
interface StagedOwner {
  readonly action: OwnerAction;
  readonly stagedNames: readonly string[];
}

/** A plan entry that names one plugin. */
interface PlannedPlugin {
  readonly plugin: string;
  readonly marketplace: string;
}

/** The value under an own key only, so a marker string such as `constructor` names no record. */
function ownValue<T>(map: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(map, key) ? map[key] : undefined;
}

function inBucket(bucket: readonly PlannedPlugin[], owner: LegacyMcpOwner): boolean {
  return bucket.some(
    (entry) => entry.plugin === owner.plugin && entry.marketplace === owner.marketplace,
  );
}

/**
 * AMIG-04: whether this reload installs the owner, so its install removes the
 * legacy entry. Only a reload runs the dependency install.
 */
function plannedInstall(input: McpMigrationInput, owner: LegacyMcpOwner): boolean {
  const plan = input.plan;
  if (plan === undefined) {
    return false;
  }

  return (
    inBucket(plan.pluginsToInstall, owner) ||
    (input.reason === "reload" && inBucket(plan.pluginsToDependencyInstall, owner))
  );
}

/** Whether this reload uninstalls or disables an enabled owner, which rewrites both files. */
function plannedRemoval(plan: ReconcilePlan, owner: LegacyMcpOwner): boolean {
  return (
    inBucket(plan.pluginsToUninstall, owner) ||
    inBucket(plan.pluginsToDisable, owner) ||
    inBucket(plan.pluginsToDependencyDisable, owner) ||
    plan.marketplacesToRemove.some((entry) => entry.marketplace === owner.marketplace)
  );
}

/**
 * AMIG-01: whether this reload's plan rewrites both files for a recorded
 * owner anyway: it enables a disabled owner, or uninstalls or disables an
 * enabled one.
 */
function rewrittenByPlan(
  input: McpMigrationInput,
  owner: LegacyMcpOwner,
  record: PluginInstallRecord,
): boolean {
  const plan = input.plan;
  if (plan === undefined) {
    return false;
  }

  return isRecordedButDisabled(record)
    ? inBucket(plan.pluginsToEnable, owner)
    : plannedRemoval(plan, owner);
}

function ownerRowFields(
  input: McpMigrationInput,
  owner: LegacyMcpOwner,
): {
  readonly scope: McpMigrationInput["scope"];
  readonly plugin: string;
  readonly marketplace: string;
  readonly servers: readonly string[];
} {
  return {
    scope: input.scope,
    plugin: owner.plugin,
    marketplace: owner.marketplace,
    servers: owner.names,
  };
}

/** AMIG-04: an owner with no record here stays and is reported, unless this reload installs it. */
function reportUnowned(input: McpMigrationInput, owner: LegacyMcpOwner): void {
  if (!plannedInstall(input, owner)) {
    input.rows.push({ kind: "unowned", ...ownerRowFields(input, owner) });
  }
}

/**
 * Whether the move can act on the resolve: anything but an `unavailable`
 * result, which reads as a source the step cannot see, unless its notes name
 * a malformed MCP server.
 */
function readableOffline(resolved: ResolvedPlugin): boolean {
  return (
    resolved.state !== "unavailable" ||
    narrowResolverNotes(resolved.notes).includes("malformed mcp")
  );
}

/** Why an owner's source gives no resolve the move can act on. */
type OfflineMiss =
  "not-listed" | "source-unreadable" | "source-outdated" | "marketplace-unreadable";

/**
 * The git-root resolver of the offline read (NFR-5), whether the plugin's
 * clone could not be read from the cache (it is missing, or its probe threw),
 * and whether the warm clone has no plugin at the declared path. A record
 * with a sha reads that sha's warm clone; one without has no clone to read.
 */
interface OfflineCloneRead {
  readonly resolve: (source: GitBackedSource) => Promise<GitPluginRootResult>;
  readonly cloneUnread: () => boolean;
  readonly pathMissing: () => boolean;
}

function offlineCloneRead(
  locations: ScopedLocations,
  record: PluginInstallRecord,
): OfflineCloneRead {
  const probe =
    record.resolvedSha === undefined
      ? undefined
      : makeRecordedShaPresenceProbe(locations, record.resolvedSha);
  let unread = false;
  let missing = false;
  return {
    resolve: async (source) => {
      unread = true;
      const result: GitPluginRootResult =
        probe === undefined ? { kind: "not-cached" } : await probe(source);
      unread = result.kind === "not-cached";
      missing = result.kind === "missing-subdir" || result.kind === "escapes";
      return result;
    },
    cloneUnread: () => unread,
    pathMissing: () => missing,
  };
}

/** The miss of a resolve the move cannot act on, by what the clone read found. */
function missKind(clone: OfflineCloneRead): Exclude<OfflineMiss, "not-listed"> {
  if (clone.cloneUnread()) {
    return "source-unreadable";
  }

  return clone.pathMissing() ? "source-outdated" : "marketplace-unreadable";
}

/**
 * Re-resolves the plugin from the cached marketplace manifest with no network
 * (NFR-5). Each miss names the cause a command can clear (AMIG-01):
 * `source-unreadable` for a git clone the cache cannot give, which a
 * reinstall fetches; `source-outdated` for a warm clone of the recorded
 * commit with no plugin at the declared path, which an update replaces with
 * the source the marketplace now declares (D-08-05); `not-listed` when the
 * manifest has no valid entry for the plugin; `marketplace-unreadable` for
 * any other read failure, such as a missing or unparseable manifest or a
 * plugin directory the marketplace copy lacks. A reinstall reads the same
 * marketplace copy, so it clears neither of the last two.
 */
async function resolveOffline(
  locations: ScopedLocations,
  marketplace: MarketplaceRecord,
  record: PluginInstallRecord,
  plugin: string,
): Promise<ResolvedPlugin | OfflineMiss> {
  const clone = offlineCloneRead(locations, record);
  try {
    const manifest = await loadMarketplaceManifest(marketplace.manifestPath);
    const lookup = lookupDeclaredPlugin(manifest, plugin);
    if (lookup.kind === "absent" || !PLUGIN_ENTRY_VALIDATOR.Check(lookup.entry)) {
      return "not-listed";
    }

    const resolved = await resolveStrict(lookup.entry, {
      marketplaceRoot: marketplace.marketplaceRoot,
      marketplaceName: marketplace.name,
      resolveGitPluginRoot: clone.resolve,
    });
    if (readableOffline(resolved)) {
      return resolved;
    }

    return missKind(clone);
  } catch {
    // The entries keep working under their old names; the next reload tries
    // again.
    return clone.cloneUnread() ? "source-unreadable" : "marketplace-unreadable";
  }
}

/**
 * AMIG-01 / AMIG-04: what the step does with a recorded owner the plan does
 * not rewrite. A disabled record's entries are removed. Otherwise the source
 * is resolved offline: a materializable resolve moves the servers it still
 * supports, and a malformed MCP config removes every entry. An owner with no
 * record, whose manifest entry is gone or not valid, or whose source cannot
 * be read offline, gets its row; an owner the plan rewrites keeps its entries.
 */
async function ownerAction(
  input: McpMigrationInput,
  locations: ScopedLocations,
  state: ExtensionState,
  owner: LegacyMcpOwner,
): Promise<OwnerAction | undefined> {
  const marketplace = ownValue(state.marketplaces, owner.marketplace);
  const record = marketplace && ownValue(marketplace.plugins, owner.plugin);
  if (marketplace === undefined || record === undefined) {
    reportUnowned(input, owner);
    return undefined;
  }

  if (rewrittenByPlan(input, owner, record)) {
    return undefined;
  }

  if (isRecordedButDisabled(record)) {
    return { arm: "disabled", owner, record };
  }

  const resolved = await resolveOffline(locations, marketplace, record, owner.plugin);
  if (typeof resolved === "string") {
    input.rows.push({ kind: resolved, ...ownerRowFields(input, owner) });
    return undefined;
  }

  return resolved.state === "unavailable"
    ? { arm: "malformed", owner, record }
    : { arm: "move", owner, record, resolved };
}

/**
 * A source path as `~/<relative>`. Every source the scope labels leave out is
 * in the home directory: a global source under `homedir()`, and an ancestor
 * file under its real path (AFILE-05), which differs when the home directory
 * is a symlink.
 */
async function homeRelativePath(sourcePath: string): Promise<string> {
  const home = homedir();
  const lexical = path.relative(home, sourcePath).split(path.sep);
  const segments =
    lexical[0] === ".." ? path.relative(await realpath(home), sourcePath).split(path.sep) : lexical;
  return `~/${segments.join("/")}`;
}

/**
 * The colliding source as the phrase the collision row reads, so no absolute
 * path reaches the notice: one of the four scope files or the project
 * `.mcp.json` with its article, or any other source by its home-relative path.
 */
async function sourceLabel(owningPath: string, cwd: string): Promise<string> {
  const labels = new Map<string, string>();
  for (const scope of SCOPES) {
    const scoped = locationsFor(scope, cwd);
    labels.set(scoped.mcpAdapterJsonPath, `the ${scope}-scope mcp-adapter.json`);
    labels.set(scoped.mcpJsonPath, `the ${scope}-scope mcp.json`);
  }

  labels.set(path.join(cwd, ".mcp.json"), "the project .mcp.json");
  return labels.get(owningPath) ?? (await homeRelativePath(owningPath));
}

function pushStoppedRow(input: McpMigrationInput, owner: LegacyMcpOwner, err: unknown): void {
  input.rows.push({
    kind: "stopped",
    scope: input.scope,
    detail: `${owner.plugin}@${owner.marketplace}: ${redactAbsolutePaths(errorMessage(err))}`,
  });
}

/**
 * The servers an owner's stage writes: a moving owner's supported servers
 * from its source, none for a malformed or disabled owner, whose stage only
 * drops the plugin's old-name leftovers.
 */
function stagedSource(action: OwnerAction): {
  readonly servers: Record<string, unknown>;
  readonly pluginRoot: string;
  readonly description: string | undefined;
} {
  return action.arm === "move"
    ? {
        servers: action.resolved.mcpServers,
        pluginRoot: action.resolved.pluginRoot,
        description: action.resolved.description,
      }
    : { servers: {}, pluginRoot: action.record.resolvedSource, description: undefined };
}

/**
 * Writes the owner's servers into `mcp-adapter.json` exactly as an install
 * stages them and returns the staged names, or undefined when the stage
 * failed. The stage's notices describe the write just made, so they are
 * reported now.
 */
async function stageOwner(
  input: McpMigrationInput,
  operations: McpMigrationOperations,
  locations: ScopedLocations,
  action: OwnerAction,
): Promise<readonly string[] | undefined> {
  const { owner } = action;
  const { servers, pluginRoot, description } = stagedSource(action);
  try {
    const prepared = await operations.prepareStageMcpServers({
      locations,
      cwd: input.cwd,
      marketplaceName: owner.marketplace,
      pluginName: owner.plugin,
      servers,
      pluginRoot,
      pluginData: await locations.pluginDataDir(owner.marketplace, owner.plugin),
      sourcePath: `${pluginRoot}#mcpServers`,
      description,
    });
    const result = await operations.commitPreparedMcp(prepared);
    input.notices.push(...result.notices);
    return result.stagedNames;
  } catch (err) {
    if (err instanceof McpServerCollisionError) {
      input.rows.push({
        kind: "collision",
        ...ownerRowFields(input, owner),
        key: err.definedAs ?? err.serverName,
        source: await sourceLabel(err.owningPath, input.cwd),
      });
    } else {
      pushStoppedRow(input, owner, err);
    }

    return undefined;
  }
}

/** Sets the record's MCP inventory to the staged names when they differ in content or order. */
function applyStagedNames(record: PluginInstallRecord, stagedNames: readonly string[]): boolean {
  const recorded = record.resources.mcpServers;
  const same =
    recorded.length === stagedNames.length &&
    recorded.every((name, index) => name === stagedNames[index]);
  if (same) {
    return false;
  }

  record.resources.mcpServers = [...stagedNames];
  return true;
}

/**
 * AMIG-01: a moving owner whose source declares a server pi-mcp-adapter
 * cannot run becomes partially installed, as `install --partial` records it:
 * not installable, with `mcpServers` among the unsupported components.
 */
function applyDroppedServers(action: OwnerAction): boolean {
  if (action.arm !== "move" || (action.resolved.droppedMcpServers ?? []).length === 0) {
    return false;
  }

  const compatibility = action.record.compatibility;
  const listed = compatibility.unsupported.includes("mcpServers");
  if (!compatibility.installable && listed) {
    return false;
  }

  compatibility.installable = false;
  if (!listed) {
    compatibility.unsupported = [...compatibility.unsupported, "mcpServers"];
  }

  return true;
}

/**
 * Records what the owner's stage wrote and stamps `updatedAt` when anything
 * differs. Nothing else on the record changes: the move is MCP-only. A
 * disabled record is never changed. Returns whether the record changed.
 */
function recordAction(
  action: OwnerAction,
  stagedNames: readonly string[],
  now: () => Date,
): boolean {
  if (action.arm === "disabled") {
    return false;
  }

  const namesChanged = applyStagedNames(action.record, stagedNames);
  const compatibilityChanged = applyDroppedServers(action);
  if (!namesChanged && !compatibilityChanged) {
    return false;
  }

  action.record.updatedAt = now().toISOString();
  return true;
}

/**
 * AMIG-01 / AMIG-03: the row for one removed legacy name: moved when the
 * stage wrote it, otherwise removed with its cause.
 */
function removalRow(input: McpMigrationInput, staged: StagedOwner, name: string): McpMigrationRow {
  const { action, stagedNames } = staged;
  const fields = {
    scope: input.scope,
    plugin: action.owner.plugin,
    marketplace: action.owner.marketplace,
  };
  if (action.arm !== "move") {
    return { kind: "removed", ...fields, server: name, cause: action.arm };
  }

  if (stagedNames.includes(name)) {
    return { kind: "moved", ...fields, from: name, to: generatedMcpServerKey(fields.plugin, name) };
  }

  const dropped = action.resolved.droppedMcpServers?.find((entry) => entry.server === name);
  return dropped === undefined
    ? { kind: "removed", ...fields, server: name, cause: "not-declared" }
    : {
        kind: "removed",
        ...fields,
        server: name,
        cause: "unsupported-feature",
        feature: dropped.feature,
      };
}

/**
 * AMIG-02: a failed write to `file` after a committed move leaves both files
 * holding the servers; the row names that file and says the next reload
 * finishes it. An owner whose stage wrote no server gets a stopped row.
 */
function pushRemovalFailureRow(
  input: McpMigrationInput,
  action: OwnerAction,
  err: unknown,
  file: McpMigrationUnfinishedRow["file"],
): void {
  if (action.arm !== "move") {
    pushStoppedRow(input, action.owner, err);
    return;
  }

  input.rows.push({
    kind: "unfinished",
    ...ownerRowFields(input, action.owner),
    file,
    detail: redactAbsolutePaths(errorMessage(err)),
  });
}

/** Removes the owner's marked entries from `mcp.json`; one row per removed name. */
async function removeOwnerLegacyEntries(
  input: McpMigrationInput,
  operations: McpMigrationOperations,
  locations: ScopedLocations,
  staged: StagedOwner,
): Promise<void> {
  const { owner } = staged.action;
  try {
    const removed = await operations.removeLegacyMcpEntries({
      locations,
      pluginName: owner.plugin,
      marketplaceName: owner.marketplace,
    });
    input.notices.push(...removed.notices);
    input.rows.push(...removed.removedNames.map((name) => removalRow(input, staged, name)));
  } catch (err) {
    pushRemovalFailureRow(input, staged.action, err, "mcp.json");
  }
}

function stubOwner({ action }: StagedOwner): ProjectDisableStubOwner {
  return {
    pluginName: action.owner.plugin,
    marketplaceName: action.owner.marketplace,
    names: action.owner.names,
  };
}

/**
 * The staged owners with a project stub under an old name, or undefined after
 * a row per staged owner when the probe fails.
 */
async function ownersWithStubs(
  input: McpMigrationInput,
  staged: readonly StagedOwner[],
): Promise<readonly StagedOwner[] | undefined> {
  try {
    const probes = await Promise.all(
      staged.map(async (owner) => ({
        owner,
        names: await projectDisableStubNames(input.cwd, stubOwner(owner)),
      })),
    );
    return probes.filter(({ names }) => names.length > 0).map(({ owner }) => owner);
  } catch (err) {
    for (const owner of staged) {
      pushRemovalFailureRow(input, owner.action, err, "project-scope mcp-adapter.json");
    }

    return undefined;
  }
}

/**
 * AMIG-01: `/mcp-adapter disable` writes its stub into the project
 * `mcp-adapter.json` whatever the server's scope, so the user-scope move also
 * drops the stubs under the staged owners' old names there. Project-scope
 * commands rewrite that file under the project-scope lock, so the step takes
 * that lock, inside the user-scope lock, and reads no project state. No
 * command takes the two locks in the other order, and both are taken with no
 * retry, so a held lock fails at once. With no project extension directory,
 * no project-scope command has run in this project, and the step writes the
 * file without the lock rather than create that directory (NFR-10). Returns
 * the owners whose legacy entries can go now. When the project file cannot
 * be written, an owner with a stub there keeps its legacy entries and its
 * stub, gets a row naming that file, and the next `/reload` tries again.
 * When the stub probe itself fails, no owner can tell whether it has a stub
 * there, so every staged owner keeps its legacy entries and gets that row.
 */
async function clearProjectStubs(
  input: McpMigrationInput,
  operations: McpMigrationOperations,
  staged: readonly StagedOwner[],
): Promise<readonly StagedOwner[]> {
  if (input.scope !== "user") {
    return staged;
  }

  const withStubs = await ownersWithStubs(input, staged);
  if (withStubs === undefined) {
    return [];
  }

  if (withStubs.length === 0) {
    return staged;
  }

  const project = locationsFor("project", input.cwd);
  const removeStubs = async (): Promise<void> => {
    input.notices.push(
      ...(await operations.removeProjectDisableStubs(input.cwd, withStubs.map(stubOwner))),
    );
  };

  try {
    await ((await pathExists(project.extensionRoot))
      ? withExistingScopeLock(project, removeStubs)
      : removeStubs());
  } catch (err) {
    for (const owner of withStubs) {
      pushRemovalFailureRow(input, owner.action, err, "project-scope mcp-adapter.json");
    }

    return staged.filter((owner) => !withStubs.includes(owner));
  }

  return staged;
}

async function ownerActions(
  input: McpMigrationInput,
  locations: ScopedLocations,
  state: ExtensionState,
  owners: readonly LegacyMcpOwner[],
): Promise<OwnerAction[]> {
  const actions: OwnerAction[] = [];
  for (const owner of owners) {
    // eslint-disable-next-line no-await-in-loop -- owners resolve in their sorted order, one source read at a time
    const action = await ownerAction(input, locations, state, owner);
    if (action !== undefined) {
      actions.push(action);
    }
  }

  return actions;
}

/**
 * The scope's legacy owners, or undefined after a file-unreadable row when
 * `mcp.json` does not parse. The locked re-read reports the same way, since
 * the file can change after the unlocked read.
 */
async function readOwnersOrReport(
  input: McpMigrationInput,
  operations: McpMigrationOperations,
  locations: ScopedLocations,
): Promise<readonly LegacyMcpOwner[] | undefined> {
  try {
    return await operations.readLegacyMcpOwners(locations.mcpJsonPath);
  } catch (err) {
    if (!(err instanceof McpConfigFileError)) {
      throw err;
    }

    input.rows.push({ kind: "file-unreadable", scope: input.scope, file: "mcp.json" });
    return undefined;
  }
}

/** Whether `mcp-adapter.json` parses; when it does not, a file-unreadable row and false. */
async function adapterConfigReadable(
  input: McpMigrationInput,
  locations: ScopedLocations,
): Promise<boolean> {
  try {
    await checkMcpAdapterConfig(locations.mcpAdapterJsonPath);
    return true;
  } catch (err) {
    if (!(err instanceof McpConfigFileError)) {
      throw err;
    }

    input.rows.push({ kind: "file-unreadable", scope: input.scope, file: "mcp-adapter.json" });
    return false;
  }
}

/** The move under the scope lock, in the write order the module header states. */
async function migrateLocked(
  input: McpMigrationInput,
  operations: McpMigrationOperations,
  locations: ScopedLocations,
  tx: LockedStateTransaction,
): Promise<void> {
  if (!(await adapterConfigReadable(input, locations))) {
    return;
  }

  const owners = await readOwnersOrReport(input, operations, locations);
  if (owners === undefined) {
    return;
  }

  const staged: StagedOwner[] = [];
  let recordsChanged = false;
  for (const action of await ownerActions(input, locations, tx.state, owners)) {
    // eslint-disable-next-line no-await-in-loop -- each stage reads the mcp-adapter.json the previous one wrote
    const stagedNames = await stageOwner(input, operations, locations, action);
    if (stagedNames !== undefined) {
      staged.push({ action, stagedNames });
      recordsChanged = recordAction(action, stagedNames, operations.now) || recordsChanged;
    }
  }

  if (recordsChanged) {
    await operations.saveState(tx);
  }

  for (const owner of await clearProjectStubs(input, operations, staged)) {
    // eslint-disable-next-line no-await-in-loop -- each removal reads the mcp.json the previous one wrote
    await removeOwnerLegacyEntries(input, operations, locations, owner);
  }
}

/**
 * AMIG-01 / AMIG-03 / AMIG-04: moves the scope's installed plugins' MCP
 * servers out of the legacy `mcp.json` and appends the rows and notices to
 * the input's accumulators. A scope with no marked legacy entry, an
 * unparseable `mcp.json`, or no `state.json` takes no lock and writes
 * nothing: with no `state.json` no record can own the entries, so each owner
 * the plan does not install is reported unowned, and the lock would create
 * the extension directory (WR-05). Under the lock an unparseable
 * `mcp-adapter.json` stops the scope before any write. A failure while
 * moving one plugin becomes a row and the other plugins still move.
 */
export async function migrateLegacyMcpEntries(
  input: McpMigrationInput,
  operations: McpMigrationOperations = REAL_OPERATIONS,
): Promise<void> {
  const locations = locationsFor(input.scope, input.cwd);
  const owners = await readOwnersOrReport(input, operations, locations);
  if (owners === undefined || owners.length === 0) {
    return;
  }

  if (!(await pathExists(locations.stateJsonPath))) {
    for (const owner of owners) {
      reportUnowned(input, owner);
    }

    return;
  }

  await withLockedStateTransaction(locations, (tx) =>
    migrateLocked(input, operations, locations, tx),
  );
}
