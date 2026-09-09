// extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
//
// PL-1..7 top-level plugin list. D-06 orchestrator half -- READ-ONLY.
//
// The orchestrator reads BOTH scopes' state (user + project) regardless of
// which scope the caller requested, computes the orphan-fold per
// D-13-17..D-13-19, and constructs a `NotificationMessage` of
// `MarketplaceNotificationMessage`s for the command-context renderer in
// `orchestrators/plugin/list.messaging.ts`. The fold rule:
//   - For each marketplace `<mp>` that exists in PROJECT scope: emit a
//     `<mp>[project]` header block with the plugins installed under that
//     project-scope marketplace.
//   - For each marketplace `<mp>` that exists in USER scope: emit a
//     `<mp>[user]` header block; ALSO fold any project-scope plugin records
//     whose marketplace name equals `<mp>` AND for which NO project-scope
//     `<mp>` marketplace record exists (the orphan rule). Each folded
//     plugin row carries `scope: "project"` (D-13-18: actual install scope
//     on every surface).
//
// Each arm emits one notify() call with the full NotificationMessage payload.
// Probe failures manifest as per-row (unavailable) variants rather than a
// separate warning -- the per-row shape already carries the signal.
//
// CMC-13 / MSG-SD-1..3 per-row soft-dep markers: each installed-variant
// `PluginInstalledMessage` carries `dependencies: readonly Dependency[]`
// derived from the plugin's installed resources (state-recorded).
// `notify` owns the single softDepStatus(pi) probe per call
// and emits the `{requires pi-subagents}` / `{requires pi-mcp}` markers
// when (declares AND companion unloaded). RLD-04: the list orchestrator
// stamps the steady-state inventory row `installed` with `needsReload: false`,
// so the OR-reduce reload-hint (RLD-02) does NOT fire the `/reload to pick up
// changes` trailer on plain list invocations.
//
// Contract (from PRD §5.3.1):
//   - PL-1 filter union semantics: when NO filter flags (--installed /
//     --available / --unavailable) are set, every bucket is shown. When any
//     one flag is set, show UNION of selected buckets.
//   - PL-3 marketplace narrowing: optional opts.marketplace filters which
//     marketplace records are walked.
//   - PL-5 upgradable: STRING comparison (manifest.version !== installed
//     record version). NOT semver.
//   - PL-6 manifest soft-fail: per-marketplace manifest load failure
//     surfaces as a `(failed)` MarketplaceNotificationMessage with
//     `status: "failed"` and `plugins: []`. No marketplace-level cause
//     trailer (catalog `unparseable-mp` at docs/output-catalog.md:
//     215-226). Installed plugins still render under their normal header
//     when the manifest parses.
//
// Architectural constraints (NFR-5 / PI-2 / PL-3):
//   - No withStateGuard (no mutation, no state file write).
//   - No `platform/git` import, no `DEFAULT_GIT_OPS`, no `gitOps` reference.
//   - `tests/architecture/no-orchestrator-network.test.ts` greps this source
//     after stripComments and asserts zero gitOps surface.

import { lookupDeclaredPlugin, type ManifestLookup } from "../../domain/manifest-lookup.ts";
import { loadMarketplaceManifest, type MarketplaceManifest } from "../../domain/manifest.ts";
import { loadMergedScopeConfig, type MergedConfig } from "../../persistence/config-merge.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState, type ExtensionState } from "../../persistence/state-io.ts";
import { errorMessage } from "../../shared/errors.ts";
import { type PluginFailedMessage } from "../../shared/notification-types.ts";
import {
  notifyWithContext,
  type MarketplaceRows,
  type Plural,
} from "../../shared/notify-context.ts";
import { narrowProbeError as sharedNarrowProbeError } from "../../shared/probe-classifiers.ts";

import { availableRowMessage, type FilterBucket } from "./list-candidate-row.ts";
import { composeInstalledListRow } from "./list-installed-row.ts";
import {
  foldOrphanListRows,
  isOrphanMarketplaceClone,
  orderPluginListBlocks,
  type OrphanFold,
} from "./list-orphan-fold.ts";
import { LIST_CONTEXT, type ListMsg } from "./list.messaging.ts";

import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * PluginRenderStatus retained as an internal alias to keep the orchestrator's
 * bucketing logic (installed / upgradable / available / unavailable) typed.
 * Maps 1:1 onto the PluginNotificationMessage list-surface discriminator
 * subset in shared/notification-types.ts. RLD-04: the installed bucket emits the
 * `installed` token with `needsReload: false` (the stamped flag suppresses the
 * OR-reduce reload-hint on steady-state list invocations); the PL-1
 * `--installed` filter treats `installed`, `upgradable`, and `disabled` as the
 * installed bucket (a disabled plugin IS recorded -- the catalog's
 * `disabled-inventory` state sits under the installed inventory; D-54-01 /
 * ENBL-04).
 */
type PluginRenderStatus =
  | "installed"
  | "upgradable"
  | "available"
  // RSTA-01 / D-80-03: the not-installed git-source row whose clone/mirror is not
  // yet materialized locally. Replaces the manifest-only `(available)` over-claim.
  | "remote"
  | "partially-available"
  | "unavailable"
  | "disabled"
  // FSTAT-02 / FSTAT-04 / D-66-01 / D-66-02: the derived partial-state inventory
  // rows. LIST-01 / D-67-01 / A1: the `--installed` filter now spans them --
  // both are installed-inventory rows, so `shouldShow` admits them under an
  // active `--installed` filter (precedent: the fold-carryover filter below).
  | "partially-installed"
  | "partially-upgradable";

/**
 * LIST-01 / D-67-01: the internal resolver-state bucket the filter predicate
 * keys on. It is retained as a concept DISTINCT from {@link PluginRenderStatus}
 * even though USTAT-01 / D-64-01 now de-collapses the render tokens (resolver
 * `partially-available` renders `(partially-available)` / `⊖`, structural `unavailable` renders
 * `(unavailable)` / `⊘`): the filter keys on this pre-collapse bucket so
 * `--partial` (not-installed plugins resolving `partially-available` -- the
 * partially-available candidates) partitions cleanly from `--unavailable`
 * (structural-unavailable only, A2) regardless of the render token.
 * Installed-inventory rows
 * (installed / upgradable / disabled / partially-installed / partially-upgradable) are
 * not resolver-classified here -- they carry the `installed-inventory` bucket
 * and the filter keys on their render status instead.
 */
/**
 * Options bag for {@link listPlugins}. The edge layer constructs this
 * from `/claude:plugin list` argv parsing.
 *
 * `pi` is REQUIRED -- the `notify(ctx, pi, message)` call consumes it
 * for the single softDepStatus(pi) probe per invocation. The
 * renderer derives per-row soft-dep markers from each
 * `PluginInstalledMessage.dependencies` field plus the probe result.
 */
export interface ListPluginsOptions {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly cwd: string;
  /** SC-6 enumeration narrowing: when undefined the cross-scope walk + fold
   *  rule applies. When set, the orchestrator STILL reads both scopes (the
   *  fold rule needs visibility into both) but constrains which blocks are
   *  emitted at the end. */
  readonly scope?: Scope;
  /** PL-3 marketplace narrowing: when undefined, every marketplace is walked. */
  readonly marketplace?: string;
  /** PL-1 union filter: include installed plugins. */
  readonly installed?: boolean;
  /** PL-1 union filter: include available (not-yet-installed installable) plugins. */
  readonly available?: boolean;
  /** PL-1 union filter: include STRUCTURALLY-uninstallable (⊘) plugins. A2:
   *  the resolver `unavailable` bucket only -- it excludes the not-installed
   *  `partially-available` rows (those are reached by `partially-available`). */
  readonly unavailable?: boolean;
  /** LIST-01 / D-67-01 union filter: include NOT-installed plugins that resolve
   *  `partially-available` (the partially-available candidates). Keys on the internal
   *  resolver bucket, not the `(unavailable)` render token. */
  readonly partial?: boolean;
  /** RSTA-07 / D-80-07 / PL-1 union filter: include the `(remote)` bucket -- a
   *  not-installed git source with no materialized clone. Joins the PL-1 filter
   *  family (`--installed` / `--available` / `--unavailable` / `--partial`). */
  readonly remote?: boolean;
}

/**
 * PL-1 / LIST-01: when ALL filter flags are absent or false, show every bucket.
 * When any one is true, show UNION of the selected buckets.
 */
function filtersPassive(opts: ListPluginsOptions): boolean {
  return (
    opts.installed !== true &&
    opts.available !== true &&
    opts.unavailable !== true &&
    opts.partial !== true &&
    opts.remote !== true
  );
}

/**
 * PL-1 / LIST-01 / D-67-01 filter predicate. `status` is the render status;
 * `bucket` is the internal resolver-state bucket (only meaningful for
 * not-installed rows, where the render `(unavailable)` token is ambiguous
 * between `partially-available` and structural `unavailable`). Installed-inventory rows
 * pass `installed-inventory` and are matched on `status`.
 */
function shouldShow(
  opts: ListPluginsOptions,
  status: PluginRenderStatus,
  bucket: FilterBucket,
): boolean {
  if (filtersPassive(opts)) {
    return true;
  }

  // A1: `--installed` spans the full installed inventory -- the steady-state
  // `installed`/`upgradable`/`disabled` rows PLUS the derived partial states
  // (partially-installed reached here, NOT via `--partial`, per D-67-01). This
  // mirrors the fold-carryover filter's installed-inventory set.
  if (
    opts.installed === true &&
    (status === "installed" ||
      status === "upgradable" ||
      status === "disabled" ||
      status === "partially-installed" ||
      status === "partially-upgradable")
  ) {
    return true;
  }

  if (opts.available === true && status === "available") {
    return true;
  }

  // RSTA-07: `--remote` selects the `(remote)` bucket -- a not-installed git
  // source with no materialized clone. A cold git source carries render
  // status `"remote"` and bucket `"remote"`, so it does not pass the
  // `--available` arm above.
  if (opts.remote === true && bucket === "remote") {
    return true;
  }

  // D-67-01: `--partial` selects not-installed plugins that resolve
  // `partially-available`, keyed on the pre-collapse resolver bucket (the row renders
  // the de-collapsed `(partially-available)` / `⊖` token per USTAT-01).
  if (opts.partial === true && bucket === "partially-available") {
    return true;
  }

  // A2: `--unavailable` narrows to the structural `unavailable` bucket only --
  // the not-installed `partially-available` rows (now a distinct `(partially-available)` token)
  // are excluded.
  if (opts.unavailable === true && bucket === "unavailable") {
    return true;
  }

  return false;
}

/**
 * Per-marketplace manifest load. Wraps `loadMarketplaceManifest` so a thrown
 * error becomes a `(failed)` MarketplaceNotificationMessage per CMC-22 +
 * catalog `unparseable-mp` state at docs/output-catalog.md:215-226 (handled
 * in the block builder).
 */
async function loadManifestSoftly(manifestPath: string): Promise<MarketplaceManifest> {
  return loadMarketplaceManifest(manifestPath);
}

/**
 * Reasons emitted by the list orchestrator. The resolver-narrowing path
 * produces `unsupported hooks` / `lsp` / `unsupported source`; the
 * probe-error path produces `invalid manifest` / `permission denied` /
 * `source missing` / `unreadable` / `unparseable`. All values are members
 * of the closed `Reason` set so the renderer accepts them unchanged
 * (D-48-B IN-02: `invalid manifest` joined the probe-error path for the
 * schema-invalid manifest case).
 */
type ListReason =
  | "unsupported hooks"
  | "lsp"
  | "unsupported source"
  | "invalid manifest"
  | "permission denied"
  | "source missing"
  | "unreadable"
  | "unparseable";

/**
 * Enumerate plugin notification messages for a single (marketplace-record,
 * plugin-scope) pair. Walks the marketplace's installed plugin records
 * first, then the manifest entries that are NOT installed (available /
 * unavailable buckets).
 *
 * `mpRecord` is the marketplace record from `<pluginScope>`'s state;
 * `pluginScope` is the scope under which the plugins are installed (the
 * `[<scope>]` bracket on each plugin row reflects this -- D-13-18 -- via
 * the renderer's orphan-fold rule).
 *
 * `marketplaceScope` is the scope of the OWNING marketplace block. When
 * `pluginScope === marketplaceScope` the plugin row OMITS its `scope`
 * field so the renderer suppresses the bracket; otherwise the row carries
 * the actual install scope.
 *
 * `excludeFromAvailable` is the set of plugin names that should NOT be
 * emitted as `(available)` rows because they are already installed in
 * the OTHER scope under the CLONED marketplace record (orphan-fold rule).
 *
 * `scopedManifest` is the WHOLE manifest-load result rather than the manifest
 * alone (D-95-04): the installed rows must tell "the manifest omits this
 * record" apart from "the manifest could not be read". A caller that could
 * pass a manifest and a separate consistency flag is the drift shape that
 * produced the BOUND-03 defect, so there is one discriminated value, not two.
 *
 * Returns the rows in stable (state-iteration + manifest-order) order;
 * the orchestrator applies the final MSG-GR-3 sort at the block boundary.
 */
async function enumerateMarketplacePlugins(args: {
  opts: ListPluginsOptions;
  mpName: string;
  mpRecord: ExtensionState["marketplaces"][string];
  pluginScope: Scope;
  marketplaceScope: Scope;
  scopedManifest: ScopedManifest;
  /**
   * DFEN-04: the PLUGIN scope's merged base+local config view. Candidate rows
   * read the user's `enabled` opinion out of it -- see `availableRowMessage`.
   */
  pluginScopeConfig: MergedConfig;
  excludeFromAvailable?: ReadonlySet<string> | undefined;
}): Promise<ListMsg[]> {
  const {
    opts,
    mpName,
    mpRecord,
    pluginScope,
    marketplaceScope,
    scopedManifest,
    pluginScopeConfig,
    excludeFromAvailable = new Set<string>(),
  } = args;
  const rows: ListMsg[] = [];
  const installedRecords = mpRecord.plugins;
  const installedNames = new Set(Object.keys(installedRecords));

  // Installed bucket.
  for (const [pluginName, record] of Object.entries(installedRecords)) {
    const row = await composeInstalledListRow({
      pluginName,
      pluginScope,
      marketplaceScope,
      marketplaceRoot: mpRecord.marketplaceRoot,
      record,
      lookup: manifestLookupFor(scopedManifest, pluginName),
      cwd: opts.cwd,
    });
    // Installed-inventory rows are matched on render status; the resolver
    // bucket is not consulted for them (D-67-01).
    if (shouldShow(opts, row.status, "installed-inventory")) {
      rows.push(row);
    }
  }

  // Available / unavailable buckets (manifest entries not in state).
  if (!scopedManifest.ok) {
    return rows;
  }

  for (const manifestEntry of scopedManifest.manifest.plugins) {
    if (installedNames.has(manifestEntry.name)) {
      continue;
    }

    if (excludeFromAvailable.has(manifestEntry.name)) {
      // Already installed in the OTHER scope under a CLONED marketplace
      // record (orphan-fold rule). The folded `(installed)` row carries
      // the plugin's actual install scope (D-13-18); we suppress the
      // duplicate `(available)` enumeration so the block matches the
      // catalog `project-orphan-folded` form.
      continue;
    }

    // RSTA-01 / NFR-5: thread the plugin-scope locations so the git-source
    // presence probe reads the WARM clone/mirror cache fs-only (no network).
    //
    // DFEN-04 / D-01: the config key is the flat `<plugin>@<marketplace>` form,
    // and the merged view resolves base-vs-local by the same identity rule
    // `install` applies (a local entry replaces the base entry wholesale).
    const { message: row, bucket } = await availableRowMessage(
      manifestEntry,
      mpRecord.marketplaceRoot,
      locationsFor(pluginScope, opts.cwd),
      pluginScopeConfig.plugins[`${manifestEntry.name}@${mpName}`]?.entry.enabled,
    );
    if (shouldShow(opts, row.status, bucket)) {
      rows.push(row);
    }
  }

  return rows;
}

/**
 * The outcome of one marketplace-manifest read, DISCRIMINATED on `ok` so
 * "loaded" and "could not be read" are a single state rather than a manifest
 * plus a separate flag that can drift out of agreement (BOUND-03 / D-95-04).
 * `ok: false` is the ONLY state in which an absence claim is unsupported, so
 * the enumerator tests it once.
 */
type ScopedManifest =
  | { readonly ok: true; readonly manifest: MarketplaceManifest }
  | { readonly ok: false; readonly loadError: string };

/**
 * Resolve one installed record against its marketplace's manifest read.
 *
 * BOUND-03 / D-95-05: a failed read is `unverified`, so the row keeps its bare
 * `(installed)` form -- the row is preserved and only the unverified claim is
 * suppressed. That arm is decided HERE and stays here: list is the only surface
 * that continues rendering past a failed read, so it is an I/O fact about this
 * surface, not a membership fact the domain rule could hold.
 *
 * INV-01: a successful read that omits the record IS an absence, on the fold
 * path as much as on a same-scope block. That half is `lookupDeclaredPlugin`
 * (D-99-02a) -- the one writing of exact string identity, shared with `info`
 * and `update` so no surface can judge absence by a different rule.
 */
function manifestLookupFor(scopedManifest: ScopedManifest, pluginName: string): ManifestLookup {
  if (!scopedManifest.ok) {
    return { kind: "unverified" };
  }

  return lookupDeclaredPlugin(scopedManifest.manifest, pluginName);
}

/**
 * Read the manifest THIS marketplace record names. The record's own manifest
 * is the authority for every claim the record's rows make about manifest
 * membership (INV-01), including on the cross-scope orphan fold: a folded row
 * describes the project-scope record, so its absence is judged against the
 * manifest that record points at, not against the user block's header path.
 *
 * D-96-02 settles the scope of that authority: a folded row describes its own
 * record's manifest for ALL of its facts -- the absence claim, the upgradable
 * derivation and the description -- because all three read the single
 * {@link ManifestLookup} value produced for that manifest, which makes
 * disagreement between them unrepresentable. BOUND-01 is the other half: a
 * marketplace whose OWN manifest cannot be read renders the bare `(failed)`
 * header with no child rows, folded rows included.
 */
async function loadMarketplaceManifestSoftly(
  mpRecord: ExtensionState["marketplaces"][string],
): Promise<ScopedManifest> {
  try {
    const manifest = await loadManifestSoftly(mpRecord.manifestPath);
    return { ok: true, manifest };
  } catch (err) {
    return { ok: false, loadError: errorMessage(err) };
  }
}

/**
 * D-13-17 / D-13-19 fold rule. For a USER-scope marketplace `<mp>` that
 * has no matching PROJECT-scope marketplace record, the orphan rule folds
 * project-scope plugin records keyed by `<mp>` under the user-scope header.
 *
 * State-shape observation: a project-scope plugin installed from a
 * user-scope marketplace causes the install orchestrator to clone the
 * marketplace record into the project scope. The orphan condition is:
 *   - A PROJECT-scope marketplace `<mp>` EXISTS in project state (cloned
 *     from user scope at install time) AND
 *   - A USER-scope marketplace `<mp>` ALSO exists in user state AND
 *   - The two records reference the SAME marketplace source (same
 *     `marketplaceRoot`).
 *
 * This treatment matches the catalog `project-orphan-folded` state
 * (docs/output-catalog.md:184-196) and the `same-plugin-both-scopes`
 * state (lines 168-182).
 */
interface BuiltMarketplace {
  readonly mp: MarketplaceRows<ListMsg>;
  readonly emitScope: Scope;
}

const EMPTY_ORPHAN_FOLD: OrphanFold = { folded: [], foldedNames: new Set() };

/**
 * D-13-17 / D-13-18 orphan fold: carry the project-scope installed rows under
 * the user-scope marketplace header when the project record is a CLONE of the
 * user record. Each folded row keeps `scope: "project"` -- its ACTUAL install
 * scope -- which the renderer's orphan-fold rule surfaces as the `[project]`
 * bracket when `p.scope !== mp.scope`.
 *
 * BOUND-03 / D-95-04: the WHOLE manifest load result is bound, not just
 * `manifest`. Taking `manifest` alone dropped the load-failure state and let a
 * folded row claim an absence about a project-side manifest that never parsed.
 * INV-01: the project record's OWN manifest is the authority for its rows'
 * absence claims, because the folded row is a statement about that record.
 *
 * WR-02: the carry-over is filtered to installed-inventory rows only. The
 * project-side enumeration also returns `available` and `unavailable` bucket
 * rows from the same shared manifest (cloned `marketplaceRoot`), and folding
 * those into the user-scope block would duplicate every manifest-listed plugin
 * not installed in either scope -- one row from each side's enumeration. The
 * documented fold semantic is "fold installed records from the other scope".
 *
 * RLD-04 / CR-01: the filter discriminates on `installed` (which
 * `composeInstalledListRow` emits with `needsReload: false` for steady-state
 * inventory) plus `upgradable` and the ENBL-04 `disabled` arm, so orphan-folded
 * rows survive. A disabled record IS an installed record -- dropping it would
 * both hide the row and let the user-side enumeration re-emit the plugin as a
 * duplicate `(available)`. FSTAT-02 / FSTAT-04 / D-66-01 / D-66-02: the derived
 * `partially-installed` / `partially-upgradable` rows are recorded-installed
 * inventory and join for the same reason. Regressions:
 * tests/integration/fold-adoption.test.ts and the "CR-01 / G-21-01
 * fold-carryover" case in tests/orchestrators/plugin/list.test.ts.
 */
async function computeOrphanFold(
  opts: ListPluginsOptions,
  mpName: string,
  projectMp: ExtensionState["marketplaces"][string],
  /**
   * DFEN-04: the PROJECT scope's merged config view. The folded rows are
   * project-scope rows, so the `enabled` opinion they read must come from the
   * project scope's config, not the user scope's.
   */
  projectConfig: MergedConfig,
): Promise<OrphanFold> {
  const projectScopedManifest = await loadMarketplaceManifestSoftly(projectMp);
  const projectSideRows = await enumerateMarketplacePlugins({
    opts,
    mpName,
    mpRecord: projectMp,
    pluginScope: "project",
    marketplaceScope: "user",
    scopedManifest: projectScopedManifest,
    pluginScopeConfig: projectConfig,
  });
  return foldOrphanListRows(projectSideRows);
}

async function buildMarketplaceMessage(args: {
  opts: ListPluginsOptions;
  mpName: string;
  mpScope: Scope;
  mpRecord: ExtensionState["marketplaces"][string];
  /** SPLIT-01 rewire: autoupdate read from MergedConfig at the caller. */
  autoupdate: boolean;
  /** DFEN-04: `mpScope`'s merged config view -- the enumeration's plugin scope. */
  scopeConfig: MergedConfig;
  extraPlugins: readonly ListMsg[];
  excludeFromAvailable?: ReadonlySet<string>;
}): Promise<BuiltMarketplace> {
  const {
    opts,
    mpName,
    mpScope,
    mpRecord,
    autoupdate,
    scopeConfig,
    extraPlugins,
    excludeFromAvailable,
  } = args;
  // Bind the WHOLE load result once: the same value feeds the failed-header
  // guard below and the enumeration's absence gate (D-95-04).
  const scopedManifest = await loadMarketplaceManifestSoftly(mpRecord);

  // Unparseable manifest: catalog `unparseable-mp` form (lines 215-226)
  // -- bare `(failed)` marketplace header with `plugins: []`. No
  // `causeTrailer` per the catalog "notify() does not emit a
  // marketplace-level cause: trailer for failed marketplaces with empty
  // plugins: []" contract. The autoupdate detail also drops on failure --
  // `notification-grammar.ts::renderMpHeader`'s failed-status arm emits a
  // bare header with no `<autoupdate>` marker.
  if (!scopedManifest.ok) {
    return {
      mp: {
        name: mpName,
        scope: mpScope,
        status: "failed",
        // D-03: a failed marketplace header on the list surface -> error.
        severity: "error",
        plugins: [],
      },
      emitScope: mpScope,
    };
  }

  // Normal header + enumerated plugins (own scope) + folded extras.
  const ownPlugins = await enumerateMarketplacePlugins({
    opts,
    mpName,
    mpRecord,
    pluginScope: mpScope,
    marketplaceScope: mpScope,
    scopedManifest,
    pluginScopeConfig: scopeConfig,
    excludeFromAvailable,
  });
  const merged: readonly ListMsg[] = [...ownPlugins, ...extraPlugins];

  // `details` is OPTIONAL and INDEPENDENT of status per D-15-06. The
  // plugin-list surface carries only the `autoupdate` marker;
  // `lastUpdatedAt` is NOT surfaced on the plugin-list rendering (it lives
  // on the marketplace-list surface only). Include `details` ONLY when
  // `autoupdate === true`, and inside `details` carry ONLY `autoupdate`.
  // `lastUpdatedAt` is intentionally omitted so the renderer's
  // `<last-updated <iso>>` token never emits on this surface. Catalog
  // reference: every `/claude:plugin list` fixture at
  // docs/output-catalog.md:139-263 has `details: { autoupdate: true }` --
  // no `lastUpdatedAt` field.
  const detailsField: { readonly details?: { autoupdate: boolean } } = autoupdate
    ? { details: { autoupdate: true } }
    : {};

  return {
    mp: {
      name: mpName,
      scope: mpScope,
      ...detailsField,
      plugins: merged,
    },
    emitScope: mpScope,
  };
}

/**
 * D-02: pure payload builder for the cross-scope
 * plugin list. Reads BOTH scopes' state regardless of `opts.scope` -- the
 * fold rule needs visibility into both; final scope-filtering applies AFTER
 * the blocks are constructed.
 */
export async function loadPluginListPayload(
  opts: ListPluginsOptions,
): Promise<readonly MarketplaceRows<ListMsg>[]> {
  // D-13-19: read both scopes' state.
  const userLocations = locationsFor("user", opts.cwd);
  const projectLocations = locationsFor("project", opts.cwd);
  const [userState, projectState, userMerged, projectMerged] = await Promise.all([
    loadState(userLocations.extensionRoot),
    loadState(projectLocations.extensionRoot),
    // SPLIT-01 rewire: autoupdate lives in claude-plugins.json (config).
    // Pre-compute the merged view per scope ONCE before the fold loops below.
    loadMergedScopeConfig(userLocations).then((r) => r.merged),
    loadMergedScopeConfig(projectLocations).then((r) => r.merged),
  ]);

  const blocks: BuiltMarketplace[] = [];

  // 1. Project-scope marketplace records.
  for (const [mpName, mpRecord] of Object.entries(projectState.marketplaces)) {
    if (opts.marketplace !== undefined && opts.marketplace !== mpName) {
      continue;
    }

    const userMp = userState.marketplaces[mpName];
    // Orphan-fold rule: if the project-scope record is a CLONE of the
    // user-scope record (same marketplaceRoot), DO NOT emit a separate
    // project-scope block. The project-scope plugins fold under the
    // user-scope header below.
    if (isOrphanMarketplaceClone(mpRecord, userMp)) {
      continue;
    }

    const built = await buildMarketplaceMessage({
      opts,
      mpName,
      mpScope: "project",
      mpRecord,
      autoupdate: projectMerged.marketplaces[mpName]?.entry.autoupdate ?? false,
      scopeConfig: projectMerged,
      extraPlugins: [],
    });
    blocks.push(built);
  }

  // 2. User-scope marketplace records (with optional orphan fold).
  for (const [mpName, mpRecord] of Object.entries(userState.marketplaces)) {
    if (opts.marketplace !== undefined && opts.marketplace !== mpName) {
      continue;
    }

    // Fold orphan project plugins iff the matching project-scope record
    // is a clone (per D-13-17 semantics) and exists.
    const projectMp = projectState.marketplaces[mpName];
    const { folded, foldedNames } = isOrphanMarketplaceClone(projectMp, mpRecord)
      ? await computeOrphanFold(opts, mpName, projectMp, projectMerged)
      : EMPTY_ORPHAN_FOLD;

    const built = await buildMarketplaceMessage({
      opts,
      mpName,
      mpScope: "user",
      mpRecord,
      autoupdate: userMerged.marketplaces[mpName]?.entry.autoupdate ?? false,
      scopeConfig: userMerged,
      extraPlugins: folded,
      excludeFromAvailable: foldedNames,
    });
    blocks.push(built);
  }

  // SC-6 scope narrowing: if the caller restricted the scope, only emit
  // blocks whose ORIGINATING scope matches. The fold rule still applied
  // above so the cross-scope visibility is preserved -- but the resulting
  // surface is filtered to the requested scope.
  const filtered =
    opts.scope === undefined ? blocks : blocks.filter((b) => b.emitScope === opts.scope);

  // MSG-GR-3 / CMC-03 sort: pre-sort the marketplace blocks AND the plugin
  // rows within each block at the orchestrator boundary per D-13-19
  // (CMC-03). : notify does NOT sort -- the caller owns iteration
  // order. Name primary case-insensitive, scope secondary
  // project-before-user.
  return orderPluginListBlocks(filtered.map(({ mp }) => mp));
}

/**
 * WR-03: dedicated closed-set Reason narrower for orchestrator-level list
 * failures. Mirrors the `update.ts::narrowDirectFailReason` precedent:
 * errno-bearing FS errors map to the closed Reason that names the cause
 * class (`permission denied` / `source missing`); `SyntaxError` maps to
 * `unparseable` (state.json schema validation throws or JSON.parse
 * failures); the permissive fallback is `unreadable`.
 *
 * Distinct from `narrowProbeError`: that helper classifies per-row
 * resolver probe failures (NOT orchestrator-level list failures). Using
 * `narrowProbeError` for the catch path conflated two failure surfaces --
 * a `loadState` permission error here would surface as `{unreadable}`
 * which semantically describes a resolver probe failure, not a list
 * orchestration failure. The narrower here returns closed-set Reasons
 * accurate to the list-orchestration failure modes (loadState /
 * loadManifest / cross-scope walk throws).
 */
function narrowListFailReason(err: unknown): ListReason {
  return sharedNarrowProbeError(err);
}

/**
 * D-06 orchestrator entrypoint. Read-only listing of plugins. Constructs
 * the `NotificationMessage` payload inline and forwards it to a single
 * `notify(ctx, pi, message)` call per orchestration arm (success or
 * failure). `notify()` owns the single softDepStatus(pi) probe per
 * invocation and emits per-row `{requires pi-subagents}` /
 * `{requires pi-mcp}` markers when (declares AND companion unloaded).
 */
export async function listPlugins(opts: ListPluginsOptions): Promise<void> {
  const { ctx, pi } = opts;
  try {
    // OUT-07 / D-12: the list surface is a bulk op, so its row slot is typed
    // `Plural<Row>` (a readonly array). Additive typing only.
    // WR-01: loadPluginListPayload is typed to `MarketplaceRows<ListMsg>`, so the
    // annotation holds without a cast -- every plugin row it emits is a ListMsg
    // member by construction.
    const marketplaces: Plural<MarketplaceRows<ListMsg>> = await loadPluginListPayload(opts);
    // notify call mirrors the recipe at
    // orchestrators/plugin/uninstall.ts; list.ts substitutes the
    // list-surface plugin variants (available / unavailable / upgradable
    // / installed) per D-19-02. Severity (info; omitted 2nd arg) and
    // the `/reload to pick up changes` trailer are computed by the cascade
    // seam (the trailer fires when at least one
    // installed/updated/reinstalled/uninstalled plugin row is present;
    // pure available/unavailable/upgradable lists emit no trailer).
    notifyWithContext(ctx, pi, LIST_CONTEXT, marketplaces, undefined, "plural");
  } catch (err) {
    // Aggregate list-failure path. The list surface has no dedicated
    // catalog state for orchestrator-level failure (D-19-03 Option B):
    // construct a synthetic
    // `MarketplaceNotificationMessage` carrying a single
    // `PluginFailedMessage` so the renderer's 4-space-indent cause
    // chain surfaces the diagnostic verbatim. Severity is
    // computed as "error" by notify (any failed plugin row
    // -> error); no reload-hint (failed is not in the
    // state-changing variant set).
    //
    // WR-03: use the dedicated `narrowListFailReason` instead of
    // `narrowProbeError`. The two failure surfaces have different
    // semantics -- `narrowProbeError` classifies per-row resolver probe
    // failures (where `unreadable` means "we could not read the plugin
    // source"); `narrowListFailReason` classifies list-orchestration
    // failures (where `unreadable` means "we could not load state.json
    // or walk the marketplace records"). Both share the closed-set
    // `ListReason` codomain so the renderer accepts the result unchanged.
    const cause = err instanceof Error ? err : new Error(errorMessage(err));
    const failedRow: PluginFailedMessage = {
      status: "failed",
      name: SYNTHETIC_LIST_FAILURE_PLUGIN_NAME,
      reasons: [narrowListFailReason(err)],
      cause,
      // D-03/D-06: a synthetic list-failure row -> error, no reload.
      severity: "error",
      needsReload: false,
    };
    const mp: MarketplaceRows<ListMsg> = {
      // WR-03: the `MarketplaceNotificationMessage` shape does not support
      // a failure-trailer channel separate from the marketplace-row form,
      // so use a conspicuously-synthetic placeholder name (mirrors the
      // `(reinstall)` / `(update)` precedent in reinstall.ts / update.ts).
      // The cause-chain trailer carries the actual diagnostic text via the
      // failedRow's `cause` field.
      name: SYNTHETIC_LIST_FAILURE_MARKETPLACE_NAME,
      scope: opts.scope ?? "user",
      plugins: [failedRow],
    };
    // OUT-07 / D-12: cardinality follows the list invocation, not the number
    // of rows produced by this failure arm. It remains a plural operation even
    // though the synthetic failure occupies one marketplace block.
    const failureRows: Plural<MarketplaceRows<ListMsg>> = [mp];
    notifyWithContext(ctx, pi, LIST_CONTEXT, failureRows, undefined, "plural");
  }
}

/**
 * WR-03: synthetic identities used by the list-orchestration catch path.
 * Held as module-level constants so tests can assert against them and
 * future changes are gated behind a single edit point. Both render under
 * the cascade grammar as parens-wrapped tokens -- the renderer does
 * not special-case parens, so the visual marker reads as "synthetic
 * placeholder" to an operator scanning output.
 */
const SYNTHETIC_LIST_FAILURE_MARKETPLACE_NAME = "(list)";
const SYNTHETIC_LIST_FAILURE_PLUGIN_NAME = "(list)";
