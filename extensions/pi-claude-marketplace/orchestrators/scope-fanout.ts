// orchestrators/scope-fanout.ts
//
// The scope fan-out both `info` surfaces run before rendering: for each scope
// in play, load that scope's state read-only and, when it records the
// marketplace, pair the record with the per-scope config truth.
//
// It lives at the `orchestrators/` root rather than under `plugin/` or
// `marketplace/` because both families consume it -- the promotion
// `plugin/shared.ts`'s own header prescribes once a consumer appears outside
// the plugin orchestrator family.
//
// NFR-5: `loadState` and `loadMergedScopeConfig` are both read-only local
// reads. Nothing here touches the network.

import { loadMergedScopeConfig } from "../persistence/config-merge.ts";
import { locationsFor } from "../persistence/locations.ts";
import { loadState } from "../persistence/state-io.ts";

import type { ExtensionState } from "../persistence/state-io.ts";
import type { Scope } from "../shared/types.ts";

type MergedScopeConfig = Awaited<ReturnType<typeof loadMergedScopeConfig>>["merged"];

export interface ScopedMarketplaceRecord {
  readonly scope: Scope;
  readonly record: ExtensionState["marketplaces"][string];
  /**
   * SPLIT-01: autoupdate lives in `claude-plugins.json`, not in state, so the
   * per-scope merged config answers it alongside the record.
   */
  readonly autoupdate: boolean;
  /**
   * DFEN-04 / D-01: the user's own `enabled` opinion under the flat
   * `<plugin>@<marketplace>` key, which gates the install-time claim on
   * candidate rows. `undefined` both when the caller asked for no plugin key
   * and when the user has stated nothing -- the marketplace surface has no
   * plugin in hand and never reads it.
   */
  readonly declaredEnabled: boolean | undefined;
}

export interface CollectMarketplaceRecordsOptions {
  readonly cwd: string;
  /** Absent searches BOTH scopes project-first per MSG-GR-3; present searches only that scope. */
  readonly scope: Scope | undefined;
  readonly marketplace: string;
  /** `<plugin>@<marketplace>`; omit on the marketplace surface. */
  readonly pluginKey?: string | undefined;
}

/**
 * Collect the (scope, record) tuples in outer-loop order so the fan-out
 * renderer preserves it.
 */
export async function collectMarketplaceRecordsByScope(
  opts: CollectMarketplaceRecordsOptions,
): Promise<readonly ScopedMarketplaceRecord[]> {
  const scopes: readonly Scope[] = opts.scope === undefined ? ["project", "user"] : [opts.scope];
  const found: ScopedMarketplaceRecord[] = [];

  for (const scope of scopes) {
    const row = await readScopeMarketplaceRecord(opts, scope);
    if (row !== undefined) {
      found.push(row);
    }
  }

  return found;
}

async function readScopeMarketplaceRecord(
  opts: CollectMarketplaceRecordsOptions,
  scope: Scope,
): Promise<ScopedMarketplaceRecord | undefined> {
  const locations = locationsFor(scope, opts.cwd);
  const state = await loadState(locations.extensionRoot);
  const record = state.marketplaces[opts.marketplace];
  if (record === undefined) {
    return undefined;
  }

  // No extra I/O: the merged load was already happening for autoupdate, and it
  // answers the `enabled` opinion from the same parse.
  const { merged } = await loadMergedScopeConfig(locations);

  return {
    scope,
    record,
    autoupdate: merged.marketplaces[opts.marketplace]?.entry.autoupdate ?? false,
    declaredEnabled: declaredEnabledFor(merged, opts.pluginKey),
  };
}

function declaredEnabledFor(
  merged: MergedScopeConfig,
  pluginKey: string | undefined,
): boolean | undefined {
  return pluginKey === undefined ? undefined : merged.plugins[pluginKey]?.entry.enabled;
}
