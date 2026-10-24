// orchestrators/reconcile/delisted-plugins.ts
//
// REC-05 / DLS-01: the load-time warning for an installed plugin its
// marketplace no longer lists. Claude Code 2.1.309 raises a `plugin-not-found`
// load error ("Plugin "x" not found in marketplace "m"") for such a plugin on
// every load; this row is Pi's counterpart. Pi keeps the plugin running and
// the walk reads its declarations from its installed copy (DLS-D1), so this
// row is derived from the records and their loaded manifests, not from a walk
// failure.
//
// Only enabled records are reported: upstream raises the error while loading
// the plugins that are enabled. A marketplace whose manifest fails to load says
// nothing here; that fault is the walk's own row. The manifest read is the
// memoized offline load (NFR-5), and nothing is persisted, so the row returns
// every session until the plugin is uninstalled or listed again.

import { lookupDeclaredPlugin } from "../../domain/manifest-lookup.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";

import type { PerEntryOutcome } from "./apply-outcomes.ts";
import type { MarketplaceManifest } from "../../domain/manifest.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * RECON-04 single-emit: the outcomes after which a load-time warning about the
 * same plugin would be redundant or false. A failed row already reports the
 * plugin, an uninstalled one is gone, and the walk's own unreadable-declarer
 * row already names the fault with a fuller cause.
 */
const SUPPRESSING_KINDS: ReadonlySet<PerEntryOutcome["kind"]> = new Set([
  "plugin-install-failed",
  "plugin-uninstall-failed",
  "plugin-enable-failed",
  "plugin-disable-failed",
  "plugin-uninstalled",
  "plugin-declarer-unreadable",
]);

/**
 * D-08: a plugin this pass disabled -- by its config or because the load-time
 * check held it down -- is no longer an enabled plugin, so it gets no delisted
 * row either. These kinds suppress only that row: a disable does not say the
 * dependency check was lost, so the walk's own row still follows it.
 */
const DELISTED_SUPPRESSING_KINDS: ReadonlySet<PerEntryOutcome["kind"]> = new Set([
  ...SUPPRESSING_KINDS,
  "plugin-disabled",
  "plugin-dependency-disabled",
]);

function hasRowOfKinds(
  kinds: ReadonlySet<PerEntryOutcome["kind"]>,
  outcomes: readonly PerEntryOutcome[],
  scope: Scope,
  marketplace: string,
  plugin: string,
): boolean {
  return outcomes.some(
    (outcome) =>
      kinds.has(outcome.kind) &&
      outcome.scope === scope &&
      "plugin" in outcome &&
      outcome.plugin === plugin &&
      outcome.marketplace === marketplace,
  );
}

/** Whether this pass already reported `plugin@marketplace` in `scope`. */
export function hasSuppressingRow(
  outcomes: readonly PerEntryOutcome[],
  scope: Scope,
  marketplace: string,
  plugin: string,
): boolean {
  return hasRowOfKinds(SUPPRESSING_KINDS, outcomes, scope, marketplace, plugin);
}

/** A manifest that loaded, or `undefined` for one that did not. */
async function loadOrUndefined(
  loadManifest: typeof loadMarketplaceManifest,
  manifestPath: string,
): Promise<MarketplaceManifest | undefined> {
  try {
    return await loadManifest(manifestPath);
  } catch {
    return undefined;
  }
}

/**
 * Pushes one `{not in manifest}` warning for every enabled record in `state`
 * (the read-pass snapshot) whose loaded manifest does not list it, unless this
 * pass already reported, uninstalled, or disabled that plugin. The row reuses the walk's `plugin-declarer-unreadable` shape
 * (REC-05: `(failed)` at `warning`, with a cause), carrying upstream's words as
 * its cause.
 */
export async function reportDelistedPlugins(
  scope: Scope,
  state: ExtensionState | undefined,
  outcomes: PerEntryOutcome[],
  loadManifest: typeof loadMarketplaceManifest = loadMarketplaceManifest,
): Promise<void> {
  const marketplaces = Object.values(state?.marketplaces ?? {});
  const manifests = await Promise.all(
    marketplaces.map((marketplace) => loadOrUndefined(loadManifest, marketplace.manifestPath)),
  );
  marketplaces.forEach((marketplace, index) => {
    const manifest = manifests[index];
    if (manifest === undefined) {
      return;
    }

    for (const [plugin, record] of Object.entries(marketplace.plugins)) {
      if (
        record.enabled &&
        lookupDeclaredPlugin(manifest, plugin).kind === "absent" &&
        !hasRowOfKinds(DELISTED_SUPPRESSING_KINDS, outcomes, scope, marketplace.name, plugin)
      ) {
        outcomes.push({
          kind: "plugin-declarer-unreadable",
          scope,
          marketplace: marketplace.name,
          plugin,
          reason: "not in manifest",
          cause: new Error(`Plugin "${plugin}" not found in marketplace "${marketplace.name}"`),
        });
      }
    }
  });
}
