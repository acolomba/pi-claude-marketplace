// orchestrators/reconcile/delisted-plugins.ts
//
// REC-05 / DLS-01: the load-time warning for an installed plugin its
// marketplace no longer lists. Claude Code 2.1.309 raises a `plugin-not-found`
// load error ("Plugin "x" not found in marketplace "m"") for such a plugin on
// every load; this row is Pi's counterpart. Pi keeps the plugin running
// (v1.18), and the dependency walk now reads its declarations from its
// installed copy (DLS-D1), so the warning can no longer come from the walk
// failing. It is derived here, from the records and their loaded manifests.
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

/** Whether this pass already reported `plugin@marketplace` in `scope`. */
export function hasSuppressingRow(
  outcomes: readonly PerEntryOutcome[],
  scope: Scope,
  marketplace: string,
  plugin: string,
): boolean {
  return outcomes.some(
    (outcome) =>
      SUPPRESSING_KINDS.has(outcome.kind) &&
      outcome.scope === scope &&
      "plugin" in outcome &&
      outcome.plugin === plugin &&
      outcome.marketplace === marketplace,
  );
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
 * whose loaded manifest does not list it, unless this pass already reported
 * that plugin. The row reuses the walk's `plugin-declarer-unreadable` shape
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
        !hasSuppressingRow(outcomes, scope, marketplace.name, plugin)
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
