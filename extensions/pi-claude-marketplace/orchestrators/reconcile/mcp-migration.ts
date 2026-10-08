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
// then removes the plugins' marked entries from `mcp.json`. The trigger goes
// last, so a crash at any point leaves it in place, the next `/reload` runs
// the step again, and the rerun converges to the same bytes. With no marked
// entry the step takes no lock and writes nothing.
//
// AMIG-04: an entry belongs to an install record of this scope only; a record
// of the same plugin in the other scope does not own it. An owner with no
// record stays in place and is reported, unless the scope's reconcile plan
// installs it in the same reload: that install removes the entry itself. An
// owner the plan uninstalls, disables or enables is skipped silently for the
// same reason. An owner whose source cannot be read offline, whose new key
// another config source already defines, or whose scope holds a config file
// that does not parse stays in place with a row, and the next `/reload`
// tries again. Nothing is damped: such an entry is reported on every reload
// until its cause is cleared (COMPAT-01 keeps no state).
//
// NFR-5: no network. This module stays outside `NETWORK_SEAMS` and never names
// the git surface. A path source is read from the marketplace's current
// checkout, as reinstall reads it, so a newer plugin version there can stage
// under the recorded version (reinstall parity). A git source is read from
// the warm clone of the record's sha through the fs-only presence probe; a
// cold cache leaves the entries in place.

import path from "node:path";

import {
  checkMcpAdapterConfig,
  commitPreparedMcp,
  prepareStageMcpServers,
  readLegacyMcpOwners,
  removeLegacyMcpEntries,
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
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";
import { makeRecordedShaPresenceProbe } from "../plugin/git-source-probe.ts";

import type { McpMigrationInput, ReconcilePlan } from "./types.ts";
import type { LegacyMcpOwner } from "../../bridges/mcp/index.ts";
import type { ResolvedPlugin, ResolvedPluginInstallable } from "../../domain/resolver-types.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState, PluginInstallRecord } from "../../persistence/state-io.ts";
import type { LockedStateTransaction } from "../../transaction/with-state-guard.ts";

/**
 * The step's writes and its clock. A test replaces a member to record the
 * write order or to fail one write (AMIG-02).
 */
export interface McpMigrationOperations {
  readonly prepareStageMcpServers: typeof prepareStageMcpServers;
  readonly commitPreparedMcp: typeof commitPreparedMcp;
  readonly saveState: (tx: LockedStateTransaction) => Promise<void>;
  readonly removeLegacyMcpEntries: typeof removeLegacyMcpEntries;
  readonly now: () => Date;
}

const REAL_OPERATIONS: McpMigrationOperations = {
  prepareStageMcpServers,
  commitPreparedMcp,
  saveState: async (tx) => {
    await tx.save();
  },
  removeLegacyMcpEntries,
  now: () => new Date(),
};

type MarketplaceRecord = ExtensionState["marketplaces"][string];

/** An owner whose entries this step moves, with the record and source it moves them from. */
interface MovableOwner {
  readonly owner: LegacyMcpOwner;
  readonly record: PluginInstallRecord;
  readonly resolved: ResolvedPluginInstallable;
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

/**
 * Re-resolves the plugin from the cached marketplace manifest with no network
 * (NFR-5). A git source with a recorded sha resolves from that sha's warm
 * clone; one without resolves `unavailable`, as reinstall's does. Gives
 * undefined when the source cannot be read offline: a manifest read or
 * resolve that throws, an absent or invalid entry, or an `unavailable`
 * result for anything but a malformed MCP server.
 */
async function resolveOffline(
  locations: ScopedLocations,
  marketplace: MarketplaceRecord,
  record: PluginInstallRecord,
  plugin: string,
): Promise<ResolvedPlugin | undefined> {
  try {
    const manifest = await loadMarketplaceManifest(marketplace.manifestPath);
    const lookup = lookupDeclaredPlugin(manifest, plugin);
    if (lookup.kind === "absent" || !PLUGIN_ENTRY_VALIDATOR.Check(lookup.entry)) {
      return undefined;
    }

    const resolved = await resolveStrict(lookup.entry, {
      marketplaceRoot: marketplace.marketplaceRoot,
      marketplaceName: marketplace.name,
      ...(record.resolvedSha !== undefined && {
        resolveGitPluginRoot: makeRecordedShaPresenceProbe(locations, record.resolvedSha),
      }),
    });
    return readableOffline(resolved) ? resolved : undefined;
  } catch {
    // An unreadable manifest or source leaves the entries working under their
    // old names; the next reload tries again.
    return undefined;
  }
}

/**
 * AMIG-01 / AMIG-04: an owner moves when its record exists in this scope and
 * is enabled, the plan does not rewrite it, its source resolves offline as
 * installable, and the source still declares every legacy name. An owner
 * with no record, or whose source cannot be read offline, gets its row; any
 * other owner keeps its entries.
 */
async function movableOwner(
  input: McpMigrationInput,
  locations: ScopedLocations,
  state: ExtensionState,
  owner: LegacyMcpOwner,
): Promise<MovableOwner | undefined> {
  const marketplace = ownValue(state.marketplaces, owner.marketplace);
  const record = marketplace && ownValue(marketplace.plugins, owner.plugin);
  if (marketplace === undefined || record === undefined) {
    reportUnowned(input, owner);
    return undefined;
  }

  if (rewrittenByPlan(input, owner, record) || isRecordedButDisabled(record)) {
    return undefined;
  }

  const resolved = await resolveOffline(locations, marketplace, record, owner.plugin);
  if (resolved === undefined) {
    input.rows.push({ kind: "source-unreadable", ...ownerRowFields(input, owner) });
    return undefined;
  }

  if (resolved.state !== "installable") {
    return undefined;
  }

  const declaresAll = owner.names.every((name) => Object.hasOwn(resolved.mcpServers, name));
  return declaresAll ? { owner, record, resolved } : undefined;
}

/**
 * The colliding source as a scope-and-file label, so no absolute path
 * reaches the notice: one of the four scope files, the project `.mcp.json`,
 * or the file's basename.
 */
function sourceLabel(owningPath: string, cwd: string): string {
  const labels = new Map<string, string>();
  for (const scope of SCOPES) {
    const scoped = locationsFor(scope, cwd);
    labels.set(scoped.mcpAdapterJsonPath, `${scope}-scope mcp-adapter.json`);
    labels.set(scoped.mcpJsonPath, `${scope}-scope mcp.json`);
  }

  labels.set(path.join(cwd, ".mcp.json"), "project .mcp.json");
  return labels.get(owningPath) ?? path.basename(owningPath);
}

function pushStoppedRow(input: McpMigrationInput, owner: LegacyMcpOwner, err: unknown): void {
  input.rows.push({
    kind: "stopped",
    scope: input.scope,
    detail: `${owner.plugin}@${owner.marketplace}: ${redactAbsolutePaths(errorMessage(err))}`,
  });
}

/**
 * Writes the owner's servers into `mcp-adapter.json` exactly as an install
 * stages them and returns the staged names, or undefined when the stage
 * failed. The owner declares every legacy name, so the stage always has
 * servers to write: an unreadable `mcp-adapter.json` refuses (AFILE-02) and
 * the legacy entries stay. The stage's notices describe the write just made,
 * so they are reported now.
 */
async function stageOwner(
  input: McpMigrationInput,
  operations: McpMigrationOperations,
  locations: ScopedLocations,
  move: MovableOwner,
): Promise<readonly string[] | undefined> {
  const { owner, resolved } = move;
  try {
    const prepared = await operations.prepareStageMcpServers({
      locations,
      cwd: input.cwd,
      marketplaceName: owner.marketplace,
      pluginName: owner.plugin,
      servers: resolved.mcpServers,
      pluginRoot: resolved.pluginRoot,
      pluginData: await locations.pluginDataDir(owner.marketplace, owner.plugin),
      sourcePath: `${resolved.pluginRoot}#mcpServers`,
      description: resolved.description,
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
        source: sourceLabel(err.owningPath, input.cwd),
      });
    } else {
      pushStoppedRow(input, owner, err);
    }

    return undefined;
  }
}

/**
 * Sets the record's MCP inventory to the staged names and stamps `updatedAt`
 * when they differ in content or order. Nothing else on the record changes:
 * the move is MCP-only. Returns whether the record changed.
 */
function recordStagedNames(
  record: PluginInstallRecord,
  stagedNames: readonly string[],
  now: () => Date,
): boolean {
  const recorded = record.resources.mcpServers;
  const same =
    recorded.length === stagedNames.length &&
    recorded.every((name, index) => name === stagedNames[index]);
  if (same) {
    return false;
  }

  record.resources.mcpServers = [...stagedNames];
  record.updatedAt = now().toISOString();
  return true;
}

/** Removes the owner's marked entries from `mcp.json`; one moved row per removed name. */
async function removeOwnerLegacyEntries(
  input: McpMigrationInput,
  operations: McpMigrationOperations,
  locations: ScopedLocations,
  owner: LegacyMcpOwner,
): Promise<void> {
  try {
    const removed = await operations.removeLegacyMcpEntries({
      locations,
      pluginName: owner.plugin,
      marketplaceName: owner.marketplace,
    });
    input.notices.push(...removed.notices);
    input.rows.push(
      ...removed.removedNames.map((name) => ({
        kind: "moved" as const,
        scope: input.scope,
        plugin: owner.plugin,
        marketplace: owner.marketplace,
        from: name,
        to: generatedMcpServerKey(owner.plugin, name),
      })),
    );
  } catch (err) {
    pushStoppedRow(input, owner, err);
  }
}

async function movableOwners(
  input: McpMigrationInput,
  locations: ScopedLocations,
  state: ExtensionState,
  owners: readonly LegacyMcpOwner[],
): Promise<MovableOwner[]> {
  const movable: MovableOwner[] = [];
  for (const owner of owners) {
    // eslint-disable-next-line no-await-in-loop -- owners resolve in their sorted order, one source read at a time
    const move = await movableOwner(input, locations, state, owner);
    if (move !== undefined) {
      movable.push(move);
    }
  }

  return movable;
}

/**
 * The scope's legacy owners, or undefined after a file-unreadable row when
 * `mcp.json` does not parse.
 */
async function readOwnersOrReport(
  input: McpMigrationInput,
  locations: ScopedLocations,
): Promise<readonly LegacyMcpOwner[] | undefined> {
  try {
    return await readLegacyMcpOwners(locations.mcpJsonPath);
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

  const owners = await readLegacyMcpOwners(locations.mcpJsonPath);
  const staged: LegacyMcpOwner[] = [];
  let recordsChanged = false;
  for (const move of await movableOwners(input, locations, tx.state, owners)) {
    // eslint-disable-next-line no-await-in-loop -- each stage reads the mcp-adapter.json the previous one wrote
    const stagedNames = await stageOwner(input, operations, locations, move);
    if (stagedNames !== undefined) {
      staged.push(move.owner);
      recordsChanged =
        recordStagedNames(move.record, stagedNames, operations.now) || recordsChanged;
    }
  }

  if (recordsChanged) {
    await operations.saveState(tx);
  }

  for (const owner of staged) {
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
  const owners = await readOwnersOrReport(input, locations);
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
