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
// NFR-5: no network. This module stays outside `NETWORK_SEAMS` and never names
// the git surface. A path source is read from the marketplace's current
// checkout, as reinstall reads it, so a newer plugin version there can stage
// under the recorded version (reinstall parity).

import {
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
import { errorMessage } from "../../shared/errors.ts";
import { pathExists } from "../../shared/fs-utils.ts";
import { redactAbsolutePaths } from "../../shared/redact-absolute-paths.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";

import type { McpMigrationInput } from "./types.ts";
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

/** The value under an own key only, so a marker string such as `constructor` names no record. */
function ownValue<T>(map: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(map, key) ? map[key] : undefined;
}

/**
 * Re-resolves the plugin from the cached marketplace manifest with no network
 * (NFR-5). A manifest read or resolve that throws gives no plugin: the owner
 * keeps its entries.
 */
async function resolveOffline(
  marketplace: MarketplaceRecord,
  plugin: string,
): Promise<ResolvedPlugin | undefined> {
  try {
    const manifest = await loadMarketplaceManifest(marketplace.manifestPath);
    const lookup = lookupDeclaredPlugin(manifest, plugin);
    if (lookup.kind === "absent" || !PLUGIN_ENTRY_VALIDATOR.Check(lookup.entry)) {
      return undefined;
    }

    return await resolveStrict(lookup.entry, {
      marketplaceRoot: marketplace.marketplaceRoot,
      marketplaceName: marketplace.name,
    });
  } catch {
    // An unreadable manifest or source leaves the entries working under their
    // old names; the next reload tries again.
    return undefined;
  }
}

/**
 * AMIG-01: an owner moves when its record exists in this scope and is
 * enabled, its source resolves offline as installable, and the source still
 * declares every legacy name. Any other owner keeps its entries.
 */
async function movableOwner(
  state: ExtensionState,
  owner: LegacyMcpOwner,
): Promise<MovableOwner | undefined> {
  const marketplace = ownValue(state.marketplaces, owner.marketplace);
  if (marketplace === undefined) {
    return undefined;
  }

  const record = ownValue(marketplace.plugins, owner.plugin);
  if (record === undefined || isRecordedButDisabled(record)) {
    return undefined;
  }

  const resolved = await resolveOffline(marketplace, owner.plugin);
  if (resolved?.state !== "installable") {
    return undefined;
  }

  const declaresAll = owner.names.every((name) => Object.hasOwn(resolved.mcpServers, name));
  return declaresAll ? { owner, record, resolved } : undefined;
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
    pushStoppedRow(input, owner, err);
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
  state: ExtensionState,
  owners: readonly LegacyMcpOwner[],
): Promise<MovableOwner[]> {
  const movable: MovableOwner[] = [];
  for (const owner of owners) {
    // eslint-disable-next-line no-await-in-loop -- owners resolve in their sorted order, one source read at a time
    const move = await movableOwner(state, owner);
    if (move !== undefined) {
      movable.push(move);
    }
  }

  return movable;
}

/** The move under the scope lock, in the write order the module header states. */
async function migrateLocked(
  input: McpMigrationInput,
  operations: McpMigrationOperations,
  locations: ScopedLocations,
  tx: LockedStateTransaction,
): Promise<void> {
  const owners = await readLegacyMcpOwners(locations.mcpJsonPath);
  const staged: LegacyMcpOwner[] = [];
  let recordsChanged = false;
  for (const move of await movableOwners(tx.state, owners)) {
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
 * AMIG-01 / AMIG-03: moves the scope's installed plugins' MCP servers out of
 * the legacy `mcp.json` and appends the rows and notices to the input's
 * accumulators. A scope with no marked legacy entry, or with no `state.json`
 * (no record can own the entries, and the lock would create the extension
 * directory, WR-05), takes no lock and writes nothing. A failure while moving
 * one plugin becomes a stopped row and the other plugins still move.
 */
export async function migrateLegacyMcpEntries(
  input: McpMigrationInput,
  operations: McpMigrationOperations = REAL_OPERATIONS,
): Promise<void> {
  const locations = locationsFor(input.scope, input.cwd);
  if ((await readLegacyMcpOwners(locations.mcpJsonPath)).length === 0) {
    return;
  }

  if (!(await pathExists(locations.stateJsonPath))) {
    return;
  }

  await withLockedStateTransaction(locations, (tx) =>
    migrateLocked(input, operations, locations, tx),
  );
}
