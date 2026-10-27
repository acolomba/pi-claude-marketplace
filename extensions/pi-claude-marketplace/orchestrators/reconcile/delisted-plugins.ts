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
//
// MKT-01 / D-PL5-28: Claude Code refuses to load a marketplace recorded under a
// name it refuses, and raises one load error for each enabled plugin of it.
// The refused-marketplace row is Pi's counterpart. The plugin keeps working,
// because a load changes no installation state (APL-D1) and Pi has no way to
// unload what its companion extensions already read; only enabled plugins are
// reported, as upstream skips the disabled ones.

import { lookupDeclaredPlugin } from "../../domain/manifest-lookup.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { recordedMarketplaceNameRefusal } from "../../domain/name.ts";

import type { PerEntryOutcome } from "./apply-outcomes.ts";
import type { ScopeReadResult } from "./types.ts";
import type { MarketplaceManifest } from "../../domain/manifest.ts";
import type { ParsedSource } from "../../domain/source.ts";
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
function hasSuppressingRow(
  outcomes: readonly PerEntryOutcome[],
  scope: Scope,
  marketplace: string,
  plugin: string,
): boolean {
  return hasRowOfKinds(SUPPRESSING_KINDS, outcomes, scope, marketplace, plugin);
}

/**
 * D-05-07 / LOAD-01: report the one declarer whose declarations could not be
 * established, which is why no plugin in this scope was held down on this pass.
 *
 * REC-05: the row is a warning naming the fault (`not in manifest`, `invalid
 * manifest`, `unreadable manifest`) with the walk's cause line. The plugin
 * keeps loading; only the check is lost. The verdict is re-derived on every
 * pass, so the row returns every session until the fault is fixed.
 *
 * The walk fails closed, so an unreadable declarer never reads as a plugin that
 * declares nothing -- but it must not be silent either: a silent pass is
 * indistinguishable from a scope whose declarations are all satisfied, and the
 * dependent that should have been held down keeps loading. The row names the
 * DECLARER rather than `state.json`, because the read that failed was of that
 * plugin's own or marketplace manifest and the read-pass catch's file row would
 * make a false claim about the state document.
 *
 * The key is built by the walk as `${name}@${marketplace}`, so splitting on the
 * last `@` is total and needs no fallback arm.
 *
 * RECON-04 single-emit: a declarer this pass already reported as failed -- its
 * clone is gone, its install failed -- gets no second row. The same tree that
 * stops a manifest being read is usually the one that already failed something
 * else about that plugin, and two rows for one plugin state the same fact
 * twice. A declarer this pass uninstalled is gone, so it gets none either. A
 * success row (installed, enabled, disabled, backfilled) does not say the check
 * was lost, so the warning still follows it (REC-05).
 */
export function reportUnreadableDeclarer(
  scope: Scope,
  readResult: ScopeReadResult,
  outcomes: PerEntryOutcome[],
): void {
  const verdict = readResult.verdict;
  if (verdict === undefined || verdict.ok) {
    return;
  }

  const at = verdict.declarer.lastIndexOf("@");
  const marketplace = verdict.declarer.slice(at + 1);
  const plugin = verdict.declarer.slice(0, at);
  if (hasSuppressingRow(outcomes, scope, marketplace, plugin)) {
    return;
  }

  outcomes.push({
    kind: "plugin-declarer-unreadable",
    scope,
    marketplace,
    plugin,
    reason: verdict.reason,
    cause: verdict.cause,
  });
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

/** Every marketplace `state` records, with its loaded manifest or `undefined`. */
async function loadedMarketplaces(
  state: ExtensionState | undefined,
  loadManifest: typeof loadMarketplaceManifest,
): Promise<
  {
    marketplace: ExtensionState["marketplaces"][string];
    manifest: MarketplaceManifest | undefined;
  }[]
> {
  const marketplaces = Object.values(state?.marketplaces ?? {});
  const manifests = await Promise.all(
    marketplaces.map((marketplace) => loadOrUndefined(loadManifest, marketplace.manifestPath)),
  );
  return marketplaces.map((marketplace, index) => ({ marketplace, manifest: manifests[index] }));
}

/**
 * D-PL5-28: pushes one `{invalid manifest}` warning, carrying Claude Code's
 * refusal as its cause, for every enabled record in `state` (the read-pass
 * snapshot) whose marketplace Claude Code refuses, unless this pass already
 * reported, uninstalled, or disabled that plugin. A manifest that cannot be
 * read still has its record's own name checked.
 */
export async function reportRefusedMarketplaces(
  scope: Scope,
  state: ExtensionState | undefined,
  outcomes: PerEntryOutcome[],
  loadManifest: typeof loadMarketplaceManifest = loadMarketplaceManifest,
): Promise<void> {
  for (const { marketplace, manifest } of await loadedMarketplaces(state, loadManifest)) {
    const refusal = recordedMarketplaceNameRefusal(
      marketplace.name,
      marketplace.source as ParsedSource,
      manifest?.name,
    );
    if (refusal === undefined) {
      continue;
    }

    for (const [plugin, record] of Object.entries(marketplace.plugins)) {
      if (
        record.enabled &&
        !hasRowOfKinds(DELISTED_SUPPRESSING_KINDS, outcomes, scope, marketplace.name, plugin)
      ) {
        outcomes.push({
          kind: "plugin-declarer-unreadable",
          scope,
          marketplace: marketplace.name,
          plugin,
          reason: "invalid manifest",
          cause: new Error(refusal),
        });
      }
    }
  }
}

/**
 * Pushes one `{not in manifest}` warning for every enabled record in `state`
 * (the read-pass snapshot) whose loaded manifest does not list it, unless this
 * pass already reported, uninstalled, or disabled that plugin. The row reuses
 * the walk's `plugin-declarer-unreadable` shape (REC-05: `(failed)` at
 * `warning`, with a cause), carrying upstream's words as its cause.
 */
export async function reportDelistedPlugins(
  scope: Scope,
  state: ExtensionState | undefined,
  outcomes: PerEntryOutcome[],
  loadManifest: typeof loadMarketplaceManifest = loadMarketplaceManifest,
): Promise<void> {
  for (const { marketplace, manifest } of await loadedMarketplaces(state, loadManifest)) {
    if (manifest === undefined) {
      continue;
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
  }
}
