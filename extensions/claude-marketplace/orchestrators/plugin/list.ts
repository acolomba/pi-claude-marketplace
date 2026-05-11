// extensions/claude-marketplace/orchestrators/plugin/list.ts
//
// PL-1..7 top-level plugin list. D-06 orchestrator half -- READ-ONLY.
//
// Contract (from PRD §5.3.1 + Plan 05-08):
//   - PL-1 filter union semantics: when NO filter flags (--installed /
//     --available / --unavailable) are set, every bucket is shown. When any
//     one flag is set, show UNION of selected buckets.
//   - PL-2 nested-tree-grouped-by-scope: enumerate state per scope and let
//     `renderPluginList` group user-scope before project-scope.
//   - PL-3 marketplace narrowing: optional opts.marketplace filters which
//     marketplace records are walked.
//   - PL-5 upgradable: STRING comparison (manifest.version !== installed
//     record version). NOT semver.
//   - PL-6 manifest soft-fail: per-marketplace manifest load is wrapped in
//     try/catch; failure becomes a warnings[] entry and the orchestrator
//     continues -- installed plugins still render from state.
//   - PL-7 [autoupdate] tag: `mp.autoupdate === true` flows through the
//     payload's PluginListMarketplace.autoupdate; the renderer composes
//     the header tag.
//
// Architectural constraints (NFR-5 / PI-2 / PL-3):
//   - No withStateGuard (no mutation, no state file write).
//   - No `platform/git` import, no `DEFAULT_GIT_OPS`, no `gitOps` reference.
//   - `tests/architecture/no-orchestrator-network.test.ts` (Plan 05-02)
//     greps this source after stripComments and asserts zero gitOps surface.
//   - `domain/resolver.ts::resolveStrict` is permitted (resolver is a pure
//     fs probe; the architectural test allowlist explicitly covers domain/).
//
// Eager-probe rationale (ROADMAP success criterion #5):
//   Default `list` (no flags) MUST surface every bucket -- including the
//   ⊘ uninstallable rows. For each not-yet-installed manifest entry we run
//   `resolveStrict`; on `installable=false` (or thrown error), the entry is
//   bucketed as `"uninstallable"` with the failure reason captured in
//   `PluginListEntry.notes`. Per-entry probe cost is O(fs.stat-class) and
//   marketplaces are small (<100 plugins typical); a resolver-result cache
//   is the post-V1 NFR-8 perf path -- NOT introduced here.

import { readFile } from "node:fs/promises";

import { MARKETPLACE_VALIDATOR, type MarketplaceManifest } from "../../domain/manifest.ts";
import { resolveStrict } from "../../domain/resolver.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import {
  renderPluginList,
  type PluginListEntry,
  type PluginListMarketplace,
  type PluginListPayload,
  type PluginRenderStatus,
} from "../../presentation/plugin-list.ts";
import { errorMessage } from "../../shared/errors.ts";
import { notifyError, notifySuccess } from "../../shared/notify.ts";

import type { ExtensionContext } from "../../platform/pi-api.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * Options bag for {@link listPlugins}. Phase 6 edge layer constructs this
 * from `/claude:plugin list` argv parsing.
 */
export interface ListPluginsOptions {
  readonly ctx: ExtensionContext;
  readonly cwd: string;
  /** SC-6 enumeration: when undefined, both scopes are walked. */
  readonly scope?: Scope;
  /** PL-3 marketplace narrowing: when undefined, every marketplace is walked. */
  readonly marketplace?: string;
  /** PL-1 union filter: include installed plugins. */
  readonly installed?: boolean;
  /** PL-1 union filter: include available (not-yet-installed installable) plugins. */
  readonly available?: boolean;
  /** PL-1 union filter: include uninstallable (⊘) plugins. */
  readonly unavailable?: boolean;
}

/**
 * PL-1: when ALL three filter flags are absent or false, show every bucket.
 * When any one is true, show UNION of the selected buckets.
 */
function filtersPassive(opts: ListPluginsOptions): boolean {
  return opts.installed !== true && opts.available !== true && opts.unavailable !== true;
}

function shouldShow(opts: ListPluginsOptions, status: PluginRenderStatus): boolean {
  if (filtersPassive(opts)) {
    return true;
  }

  if (opts.installed === true && status === "installed") {
    return true;
  }

  if (opts.available === true && status === "available") {
    return true;
  }

  if (opts.unavailable === true && status === "uninstallable") {
    return true;
  }

  return false;
}

/**
 * PL-6 manifest soft-fail helper. Reads + validates the cached marketplace.json
 * pointed at by `manifestPath`. Throws on any read or validation failure; the
 * orchestrator's try/catch turns the throw into a `warnings[]` entry.
 *
 * Note: this is `domain/manifest.ts::MARKETPLACE_VALIDATOR.Check` -- the SAME
 * gate used at marketplace-add time (state-io.ts ST-6 funnel). Schema-valid
 * manifests typed-narrow to `MarketplaceManifest` via the .Check return guard.
 */
async function loadManifestSoftly(manifestPath: string): Promise<MarketplaceManifest> {
  const raw = await readFile(manifestPath, "utf8");
  const parsed: unknown = JSON.parse(raw);

  if (!MARKETPLACE_VALIDATOR.Check(parsed)) {
    const firstErr = MARKETPLACE_VALIDATOR.Errors(parsed)[0];
    const detail = firstErr
      ? `${firstErr.instancePath || "<root>"}: ${firstErr.message}`
      : "(no detail)";
    throw new Error(`marketplace.json schema invalid: ${detail}`);
  }

  return parsed;
}

/**
 * Plan 06-04 D-02 extraction: pure payload builder. Performs the same
 * state + manifest + resolver work as {@link listPlugins} but returns the
 * structured payload + warnings instead of emitting via notify. Used by
 * `edge/handlers/tools.ts` (claude_marketplace_plugin_list LLM tool) to
 * read the same data without crossing the edge -> persistence import
 * boundary (BLOCK C).
 *
 * On any THROWN failure outside the per-marketplace try/catch (e.g.,
 * state.json schema invalid -- TC-9 surface), the throw propagates to the
 * caller. Per-marketplace manifest failures (TC-8) are soft-failed into
 * `warnings[]` per PL-6.
 */
export async function loadPluginListPayload(
  opts: ListPluginsOptions,
): Promise<{ payload: PluginListPayload; warnings: readonly string[] }> {
  const scopes: readonly Scope[] = opts.scope !== undefined ? [opts.scope] : ["user", "project"];
  const marketplaces: PluginListMarketplace[] = [];
  const warnings: string[] = [];

  for (const scope of scopes) {
    const locations = locationsFor(scope, opts.cwd);
    const state = await loadState(locations.extensionRoot);

    for (const [mpName, mp] of Object.entries(state.marketplaces)) {
      // PL-3 marketplace narrowing.
      if (opts.marketplace !== undefined && opts.marketplace !== mpName) {
        continue;
      }

      // PL-6 manifest soft-fail.
      let manifest: MarketplaceManifest | undefined;
      try {
        manifest = await loadManifestSoftly(mp.manifestPath);
      } catch (err) {
        warnings.push(
          `could not load manifest for "${mpName}" (${scope} scope): ${errorMessage(err)}`,
        );
      }

      const plugins: PluginListEntry[] = [];
      const installedRecords = mp.plugins;
      const installedNames = new Set(Object.keys(installedRecords));

      // Installed entries (always derived from state; manifest is consulted
      // only for decoration -- description + upgradable flag).
      for (const [pluginName, record] of Object.entries(installedRecords)) {
        if (!shouldShow(opts, "installed")) {
          continue;
        }

        const manifestEntry = manifest?.plugins.find((p) => p.name === pluginName);

        // PL-5 string compare. NOT semver.
        const upgradable =
          manifestEntry?.version !== undefined && manifestEntry.version !== record.version;

        const entry: PluginListEntry = {
          name: pluginName,
          status: "installed",
          version: record.version,
          upgradable,
          ...(manifestEntry?.description !== undefined && {
            description: manifestEntry.description,
          }),
        };
        plugins.push(entry);
      }

      // Available + uninstallable entries -- only when manifest loaded.
      if (manifest !== undefined) {
        for (const manifestEntry of manifest.plugins) {
          if (installedNames.has(manifestEntry.name)) {
            continue;
          }

          let status: PluginRenderStatus = "available";
          let probeNotes: readonly string[] | undefined;

          try {
            const resolved = await resolveStrict(manifestEntry, {
              marketplaceRoot: mp.marketplaceRoot,
            });

            if (!resolved.installable) {
              status = "uninstallable";
              if (resolved.notes.length > 0) {
                probeNotes = resolved.notes;
              }
            }
          } catch (probeErr) {
            status = "uninstallable";
            probeNotes = [errorMessage(probeErr)];
          }

          if (!shouldShow(opts, status)) {
            continue;
          }

          const entry: PluginListEntry = {
            name: manifestEntry.name,
            status,
            ...(manifestEntry.version !== undefined && { version: manifestEntry.version }),
            ...(manifestEntry.description !== undefined && {
              description: manifestEntry.description,
            }),
            ...(probeNotes !== undefined && { notes: probeNotes }),
          };
          plugins.push(entry);
        }
      }

      marketplaces.push({
        name: mpName,
        scope,
        autoupdate: mp.autoupdate === true,
        plugins,
      });
    }
  }

  return { payload: { marketplaces }, warnings };
}

/**
 * D-06 orchestrator half. Read-only listing of plugins grouped by scope
 * then by marketplace. Delegates to {@link loadPluginListPayload} for the
 * payload construction; this wrapper handles notify side-effects.
 */
export async function listPlugins(opts: ListPluginsOptions): Promise<void> {
  const { ctx } = opts;
  try {
    const { payload, warnings } = await loadPluginListPayload(opts);
    notifySuccess(ctx, renderPluginList(payload, warnings));
  } catch (err) {
    notifyError(ctx, errorMessage(err), err);
  }
}
