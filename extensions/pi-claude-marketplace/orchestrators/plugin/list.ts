// extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
//
// PL-1..7 top-level plugin list. D-06 orchestrator half -- READ-ONLY.
//
// Phase 13 Wave 2 sub-wave 2d (Plan 13-02d-01): CMC-22 / CMC-21 / D-13-17..19.
// The orchestrator now reads BOTH scopes' state (user + project) regardless
// of which scope the caller requested, computes the orphan-fold per
// D-13-17..D-13-19, and constructs a `PluginListPayload` of
// `PluginListMarketplaceBlock`s for the rewritten renderer at
// `presentation/plugin-list.ts`. The fold rule:
//   - For each marketplace `<mp>` that exists in PROJECT scope: emit a
//     `<mp>[project]` header block with the plugins installed under that
//     project-scope marketplace.
//   - For each marketplace `<mp>` that exists in USER scope: emit a
//     `<mp>[user]` header block; ALSO fold any project-scope plugin records
//     whose marketplace name equals `<mp>` AND for which NO project-scope
//     `<mp>` marketplace record exists (the orphan rule). Each folded
//     plugin row carries `scope: "project"` (D-13-18: actual install scope
//     on every surface).
// Adoption is automatic on the next list render after `marketplace add`
// lands a project-scope `<mp>` -- zero state mutation in the
// marketplace-add orchestrator for adoption purposes (D-13-17).
//
// CMC-13 / MSG-SD-1..3 per-row soft-dep markers: each PluginListRow carries
// `declaresAgents` / `declaresMcp` derived from the plugin's installed
// resources (state-recorded) or the resolved manifest entry (for available
// rows). The renderer probes companion-loaded state via the injected
// `SoftDepProbe` constructed from `softDepStatus(opts.pi)` and emits the
// `{requires pi-subagents}` / `{requires pi-mcp}` reasons when (declares
// AND companion unloaded).
//
// Contract (from PRD §5.3.1 + Plan 05-08, preserved):
//   - PL-1 filter union semantics: when NO filter flags (--installed /
//     --available / --unavailable) are set, every bucket is shown. When any
//     one flag is set, show UNION of selected buckets.
//   - PL-3 marketplace narrowing: optional opts.marketplace filters which
//     marketplace records are walked.
//   - PL-5 upgradable: STRING comparison (manifest.version !== installed
//     record version). NOT semver.
//   - PL-6 manifest soft-fail: per-marketplace manifest load failure
//     surfaces as a `(failed) {unparseable}` MarketplaceRow header per
//     CMC-22 + catalog lines 228-235 (NOT as a top-level `[warning]` line).
//     Installed plugins still render under their normal header.
//
// Architectural constraints (NFR-5 / PI-2 / PL-3):
//   - No withStateGuard (no mutation, no state file write).
//   - No `platform/git` import, no `DEFAULT_GIT_OPS`, no `gitOps` reference.
//   - `tests/architecture/no-orchestrator-network.test.ts` greps this source
//     after stripComments and asserts zero gitOps surface.

import { loadMarketplaceManifest, type MarketplaceManifest } from "../../domain/manifest.ts";
import { resolveStrict } from "../../domain/resolver.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState, type ExtensionState } from "../../persistence/state-io.ts";
import { softDepStatus } from "../../platform/pi-api.ts";
import {
  renderPluginList,
  type PluginListMarketplaceBlock,
  type PluginListPayload,
} from "../../presentation/plugin-list.ts";
import { compareByNameThenScope } from "../../presentation/sort.ts";
import { errorMessage } from "../../shared/errors.ts";
import { notifyError, notifySuccess, notifyWarning } from "../../shared/notify.ts";

import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type {
  EmptyToken,
  MarketplaceRow,
  PluginListRow,
  Scope as RowScope,
} from "../../presentation/compact-line.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * PluginRenderStatus retained as an internal alias to keep the orchestrator's
 * bucketing logic (installed / upgradable / available / unavailable) typed.
 * The renderer's `PluginListRow.status` is the union narrowed by Wave 1's
 * `Extract<StatusToken, ...>` -- this alias maps onto the same set.
 */
type PluginRenderStatus = "installed" | "upgradable" | "available" | "unavailable";

/**
 * Options bag for {@link listPlugins}. Phase 6 edge layer constructs this
 * from `/claude:plugin list` argv parsing.
 *
 * `pi` is REQUIRED -- the orchestrator constructs a `SoftDepProbe` via
 * `softDepStatus(pi)` and passes it to the renderer for per-row soft-dep
 * marker emission (CMC-13 / MSG-SD-1..3).
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

  if (opts.installed === true && (status === "installed" || status === "upgradable")) {
    return true;
  }

  if (opts.available === true && status === "available") {
    return true;
  }

  if (opts.unavailable === true && status === "unavailable") {
    return true;
  }

  return false;
}

/**
 * Per-marketplace manifest load. Wraps `loadMarketplaceManifest` so a thrown
 * error becomes a `(failed) {unparseable}` MarketplaceRow header per CMC-22
 * + catalog lines 228-235 (handled in the block builder).
 */
async function loadManifestSoftly(manifestPath: string): Promise<MarketplaceManifest> {
  return loadMarketplaceManifest(manifestPath);
}

/**
 * Reasons emitted by the list orchestrator. The resolver-narrowing path
 * produces `hooks` / `lspServers` / `unsupported source`; the
 * probe-error path produces `permission denied` / `source missing` /
 * `unreadable` / `unparseable`. All values are members of the closed
 * `Reason` set so the renderer accepts them unchanged.
 */
type ListReason =
  | "hooks"
  | "lspServers"
  | "unsupported source"
  | "permission denied"
  | "source missing"
  | "unreadable"
  | "unparseable";

interface PluginRowComputation {
  readonly status: PluginRenderStatus;
  readonly version?: string;
  readonly description?: string;
  readonly reasons?: readonly ListReason[];
  // CMC-13 / Task 260525-cjr B1: required `boolean` on the internal
  // computation, mirroring the same flip applied to `PluginListRow`
  // and the orchestrator outcome types. Every producer site
  // populates both predicates explicitly (the `availableRowComputation`
  // error-path returns the unavailable variant with `false` defaults).
  readonly declaresAgents: boolean;
  readonly declaresMcp: boolean;
}

/**
 * Build a PluginListRow for an INSTALLED plugin record. `declaresAgents` /
 * `declaresMcp` are derived from the installed record's `resources` (the
 * cleanest source -- the state-recorded counts reflect what was actually
 * staged for this plugin). When the manifest entry is present the row also
 * carries the manifest description and computes the (upgradable) status
 * via PL-5 string compare (manifest.version !== installed.version).
 */
function installedRowComputation(
  record: ExtensionState["marketplaces"][string]["plugins"][string],
  manifestEntry: MarketplaceManifest["plugins"][number] | undefined,
): PluginRowComputation {
  const declaresAgents = record.resources.agents.length > 0;
  const declaresMcp = record.resources.mcpServers.length > 0;
  const upgradable =
    manifestEntry?.version !== undefined && manifestEntry.version !== record.version;
  return {
    status: upgradable ? "upgradable" : "installed",
    version: record.version,
    ...(manifestEntry?.description !== undefined && { description: manifestEntry.description }),
    declaresAgents,
    declaresMcp,
  };
}

/**
 * Narrow the resolver `notes` array to closed-set REASONS members. The
 * manifest field carve-out (MSG-GR-4) passes `hooks` / `lspServers`
 * verbatim; any other unsupported-source note falls through to
 * `unsupported source`. Empty notes -> empty reasons array (the row is
 * `(unavailable)` without an explicit reason; uncommon path).
 */
function narrowResolverNotes(
  notes: readonly string[],
): readonly ("hooks" | "lspServers" | "unsupported source")[] {
  const out: ("hooks" | "lspServers" | "unsupported source")[] = [];
  const seen = new Set<string>();
  for (const note of notes) {
    // Scan the note for known manifest-field carve-outs in order.
    if (note.includes("hooks") && !seen.has("hooks")) {
      out.push("hooks");
      seen.add("hooks");
      continue;
    }

    if (note.includes("lspServers") && !seen.has("lspServers")) {
      out.push("lspServers");
      seen.add("lspServers");
      continue;
    }

    if (!seen.has("unsupported source")) {
      out.push("unsupported source");
      seen.add("unsupported source");
    }
  }

  return out;
}

/**
 * Captured probe failure -- the resolver threw an unexpected error for one
 * manifest entry. The classified `reason` flows into the row's reasons
 * block (so the user sees the cause CLASS on the rendered line); the raw
 * `message` is aggregated by `listPlugins` into a single trailing
 * `notifyWarning` so the user sees the underlying detail without having
 * one notification per failed row.
 */
interface ProbeFailure {
  readonly plugin: string;
  readonly reason: ListReason;
  readonly message: string;
}

/**
 * Module-scope per-`listPlugins` capture buffer. `listPlugins` resets it
 * before each call and drains it after `renderPluginList`. This avoids
 * threading a `probeFailures: ProbeFailure[]` parameter through every
 * helper (`enumerateMarketplacePlugins` -> `buildMarketplaceBlock` ->
 * `availableRowComputation`) just to surface aggregated detail. The
 * orchestrator is single-call per entrypoint (no recursion, no
 * concurrent calls within one `listPlugins` invocation); the reset is
 * the single synchronisation point.
 */
let PROBE_FAILURES: ProbeFailure[] = [];

/**
 * Classify a thrown `resolveStrict` failure to a closed-set `ListReason`.
 *
 * Errno-bearing Node FS errors map to the matching closed Reason
 * (`EACCES` -> `permission denied`; `ENOENT` -> `source missing`;
 * `EIO`/other IO -> `unreadable`). `SyntaxError` (thrown by JSON.parse
 * inside the resolver / manifest read path) maps to `unparseable`. Any
 * other thrown shape falls through to `unreadable`, which is the closed
 * Reason that means "we could not read enough of the source to decide".
 *
 * This replaces the previous behavior of substring-matching every
 * caught error through `narrowResolverNotes` -- which only recognises
 * `hooks` / `lspServers` and silently degraded EVERY OTHER throw to
 * `{unsupported source}`, hiding real failure causes from the user.
 */
function narrowProbeError(err: unknown): ListReason {
  if (err instanceof SyntaxError) {
    return "unparseable";
  }

  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EACCES" || code === "EPERM") {
      return "permission denied";
    }

    if (code === "ENOENT" || code === "ENOTDIR") {
      return "source missing";
    }
  }

  return "unreadable";
}

/**
 * Resolve a not-yet-installed manifest entry into a PluginRowComputation.
 * `resolveStrict` succeeds + `installable: true` -> `(available)`; the
 * resolver returns `installable: false` (or throws) -> `(unavailable)` with
 * the failure reasons narrowed to closed-set REASONS.
 *
 * The `declaresAgents` / `declaresMcp` predicates for AVAILABLE rows come
 * from the resolved manifest: presence of any agents/mcp content under the
 * plugin root. For unavailable rows the predicates are omitted (the plugin
 * cannot be staged anyway, so the soft-dep markers would describe a no-op
 * state -- consistent with MSG-SD-3 spirit on non-installed rows).
 */
async function availableRowComputation(
  manifestEntry: MarketplaceManifest["plugins"][number],
  marketplaceRoot: string,
): Promise<PluginRowComputation> {
  try {
    const resolved = await resolveStrict(manifestEntry, { marketplaceRoot });
    if (resolved.installable) {
      const declaresAgents = resolved.componentPaths.agents.length > 0;
      const declaresMcp = Object.keys(resolved.mcpServers).length > 0;
      return {
        status: "available",
        ...(manifestEntry.version !== undefined && { version: manifestEntry.version }),
        ...(manifestEntry.description !== undefined && {
          description: manifestEntry.description,
        }),
        declaresAgents,
        declaresMcp,
      };
    }

    return {
      status: "unavailable",
      ...(manifestEntry.version !== undefined && { version: manifestEntry.version }),
      ...(manifestEntry.description !== undefined && {
        description: manifestEntry.description,
      }),
      reasons: narrowResolverNotes(resolved.notes),
      // Task 260525-cjr B1: unavailable rows do not render the
      // soft-dep marker (MSG-SD-3); the explicit `false` keeps the
      // required-boolean contract symmetrical.
      declaresAgents: false,
      declaresMcp: false,
    };
  } catch (probeErr) {
    // The previous implementation routed EVERY throw through
    // `narrowResolverNotes`, which only recognises the strings `hooks`
    // and `lspServers` and silently degrades everything else to
    // `{unsupported source}`. That hid EACCES, JSON parse failures,
    // and programming bugs behind a misleading reason. Route resolver
    // notes through `narrowResolverNotes` (the path that produces them
    // is `resolveStrict` returning NotInstallable with structured notes
    // -- already handled above on the `installable === false` branch),
    // and route thrown probe failures through `narrowProbeError` so the
    // row reports the actual cause class. The raw `errorMessage(probeErr)`
    // is captured into `PROBE_FAILURES` and surfaced once at the end of
    // `listPlugins` via a single `notifyWarning` (one notification, not
    // one per failed row).
    const reason = narrowProbeError(probeErr);
    PROBE_FAILURES.push({
      plugin: manifestEntry.name,
      reason,
      message: errorMessage(probeErr),
    });
    return {
      status: "unavailable",
      ...(manifestEntry.version !== undefined && { version: manifestEntry.version }),
      ...(manifestEntry.description !== undefined && {
        description: manifestEntry.description,
      }),
      reasons: [reason],
      declaresAgents: false,
      declaresMcp: false,
    };
  }
}

/**
 * Convert a PluginRowComputation into a PluginListRow with the supplied
 * name + scope. The renderer's `Extract<StatusToken, ...>` narrowing on
 * `PluginListRow.status` accepts exactly the set this computation produces.
 */
function makePluginListRow(
  name: string,
  scope: RowScope,
  comp: PluginRowComputation,
): PluginListRow {
  return {
    kind: "plugin-list",
    name,
    scope,
    ...(comp.version !== undefined && { version: comp.version }),
    status: comp.status,
    ...(comp.reasons !== undefined && comp.reasons.length > 0 && { reasons: comp.reasons }),
    ...(comp.description !== undefined && { description: comp.description }),
    // CMC-13 / Task 260525-cjr B1: `PluginRowComputation.declares*`
    // is now REQUIRED boolean; forward verbatim.
    declaresAgents: comp.declaresAgents,
    declaresMcp: comp.declaresMcp,
  };
}

/**
 * Enumerate plugin rows for a single (marketplace-record, plugin-scope) pair.
 * Walks the marketplace's installed plugin records first, then the manifest
 * entries that are NOT installed (available / unavailable buckets).
 *
 * `mpRecord` is the marketplace record from `<pluginScope>`'s state;
 * `pluginScope` is the scope under which the plugins are installed (the
 * `[<scope>]` bracket on each plugin row reflects this -- D-13-18).
 *
 * `excludeFromAvailable` is the set of plugin names that should NOT be
 * emitted as `(available)` rows because they are already installed in
 * the OTHER scope's CLONED record (and will fold under this header via
 * the orphan-fold rule). Without this exclusion the catalog "orphan
 * fold" form would emit a duplicate `○ alpha v1.0.0 (available)` row
 * alongside the folded `● alpha [project] v1.0.0 (installed)` -- the
 * manifest's `alpha` entry classifies as not-installed in this scope
 * (true) AND installable (true), which would normally bucket as
 * available. The exclusion preserves the catalog form at lines 205-213.
 *
 * Returns the rows in stable (state-iteration + manifest-order) order; the
 * renderer applies the final MSG-GR-3 sort inside each block.
 */
async function enumerateMarketplacePlugins(
  opts: ListPluginsOptions,
  mpRecord: ExtensionState["marketplaces"][string],
  pluginScope: Scope,
  manifest: MarketplaceManifest | undefined,
  excludeFromAvailable: ReadonlySet<string> = new Set(),
): Promise<PluginListRow[]> {
  const rows: PluginListRow[] = [];
  const installedRecords = mpRecord.plugins;
  const installedNames = new Set(Object.keys(installedRecords));

  // Installed bucket.
  for (const [pluginName, record] of Object.entries(installedRecords)) {
    const manifestEntry = manifest?.plugins.find((p) => p.name === pluginName);
    const comp = installedRowComputation(record, manifestEntry);
    if (shouldShow(opts, comp.status)) {
      rows.push(makePluginListRow(pluginName, pluginScope, comp));
    }
  }

  // Available / unavailable buckets (manifest entries not in state).
  if (manifest === undefined) {
    return rows;
  }

  for (const manifestEntry of manifest.plugins) {
    if (installedNames.has(manifestEntry.name)) {
      continue;
    }

    if (excludeFromAvailable.has(manifestEntry.name)) {
      // Already installed in the OTHER scope under a CLONED marketplace
      // record (orphan-fold rule). The folded `(installed)` row carries
      // the plugin's actual install scope (D-13-18); we suppress the
      // duplicate `(available)` enumeration so the block matches the
      // catalog form at lines 205-213.
      continue;
    }

    const comp = await availableRowComputation(manifestEntry, mpRecord.marketplaceRoot);
    if (shouldShow(opts, comp.status)) {
      rows.push(makePluginListRow(manifestEntry.name, pluginScope, comp));
    }
  }

  return rows;
}

interface ScopedManifest {
  readonly manifest: MarketplaceManifest | undefined;
  readonly loadError: string | undefined;
}

async function loadMarketplaceManifestSoftly(
  mpRecord: ExtensionState["marketplaces"][string],
): Promise<ScopedManifest> {
  try {
    const manifest = await loadManifestSoftly(mpRecord.manifestPath);
    return { manifest, loadError: undefined };
  } catch (err) {
    return { manifest: undefined, loadError: errorMessage(err) };
  }
}

function makeMarketplaceHeader(
  name: string,
  scope: Scope,
  mpRecord: ExtensionState["marketplaces"][string],
): MarketplaceRow {
  return {
    kind: "marketplace",
    name,
    scope,
    outcomeClass: "ok",
    ...(mpRecord.autoupdate === true && { marker: "autoupdate" as const }),
    // status + reasons intentionally omitted -- list headers are pure label rows
    // for ok-class marketplaces; the failure-class header (unparseable manifest)
    // is constructed separately in `makeFailedMarketplaceHeader`.
  };
}

function makeFailedMarketplaceHeader(
  name: string,
  scope: Scope,
  mpRecord: ExtensionState["marketplaces"][string],
): MarketplaceRow {
  return {
    kind: "marketplace",
    name,
    scope,
    outcomeClass: "failure",
    status: "failed",
    reasons: ["unparseable"] as const,
    ...(mpRecord.autoupdate === true && { marker: "autoupdate" as const }),
  };
}

/**
 * D-13-17 / D-13-19 fold rule. For a USER-scope marketplace `<mp>` that
 * has no matching PROJECT-scope marketplace record, the orphan rule folds
 * project-scope plugin records keyed by `<mp>` (i.e. installed under a
 * project-scope marketplace record of the same name that does not exist)
 * under the user-scope header.
 *
 * State-shape observation: plugin install records live UNDER their owning
 * marketplace record. A project-scope plugin installed from a user-scope
 * marketplace causes the install orchestrator to clone the marketplace
 * record into the project scope (via `cloneMarketplaceRecordForTargetScope`
 * -- see `orchestrators/plugin/shared.ts`). So the orphan condition is:
 *   - A PROJECT-scope marketplace `<mp>` EXISTS in project state (cloned
 *     from user scope at install time) AND
 *   - A USER-scope marketplace `<mp>` ALSO exists in user state AND
 *   - The two records reference the SAME marketplace source (same
 *     `marketplaceRoot`) -- the project record is a CLONE of the user
 *     record, not an independently-added project-scope marketplace.
 *
 * When all three conditions hold, the project-scope plugin rows fold under
 * the user-scope header AND the project-scope marketplace block is NOT
 * emitted separately (otherwise the user would see the project plugins
 * twice). When the project-scope marketplace was added independently
 * (different `marketplaceRoot`), it is NOT a clone -- both blocks are
 * emitted and no fold occurs.
 *
 * This treatment matches the catalog at lines 205-213 (orphan fold) and
 * lines 196-201 (independent project + user marketplaces of the same
 * name render as two separate per-scope blocks).
 */
function isCloneOfUserMarketplace(
  projectMp: ExtensionState["marketplaces"][string] | undefined,
  userMp: ExtensionState["marketplaces"][string] | undefined,
): boolean {
  if (projectMp === undefined || userMp === undefined) {
    return false;
  }

  // Identity by marketplaceRoot: the install orchestrator copies this from
  // the source marketplace verbatim, so a project-scope clone of a user
  // marketplace always has the same on-disk root.
  return projectMp.marketplaceRoot === userMp.marketplaceRoot;
}

interface BuiltBlock {
  readonly block: PluginListMarketplaceBlock;
  readonly emitScope: Scope;
}

async function buildMarketplaceBlock(args: {
  opts: ListPluginsOptions;
  mpName: string;
  mpScope: Scope;
  mpRecord: ExtensionState["marketplaces"][string];
  extraPlugins: readonly PluginListRow[];
  excludeFromAvailable?: ReadonlySet<string>;
}): Promise<BuiltBlock> {
  const { opts, mpName, mpScope, mpRecord, extraPlugins, excludeFromAvailable } = args;
  const { manifest, loadError } = await loadMarketplaceManifestSoftly(mpRecord);

  // Unparseable manifest: failure header + cause trailer; no plugin rows
  // (the installed records do not render under a failed header per the
  // catalog form at lines 228-235).
  if (loadError !== undefined) {
    return {
      block: {
        header: makeFailedMarketplaceHeader(mpName, mpScope, mpRecord),
        plugins: [],
        causeTrailer: loadError,
      },
      emitScope: mpScope,
    };
  }

  // Normal header + enumerated plugins (own scope) + folded extras.
  // Pass `excludeFromAvailable` so the available-bucket enumeration skips
  // names already installed in the OTHER scope under a CLONED marketplace
  // (the orphan-fold rule -- catalog lines 205-213 form).
  const ownPlugins = await enumerateMarketplacePlugins(
    opts,
    mpRecord,
    mpScope,
    manifest,
    excludeFromAvailable,
  );
  const merged = [...ownPlugins, ...extraPlugins];

  // Per-marketplace empty case (catalog lines 240-246): zero plugins.
  if (merged.length === 0) {
    const empty: EmptyToken = { kind: "empty", token: "no plugins" };
    return {
      block: {
        header: makeMarketplaceHeader(mpName, mpScope, mpRecord),
        plugins: [empty],
      },
      emitScope: mpScope,
    };
  }

  return {
    block: {
      header: makeMarketplaceHeader(mpName, mpScope, mpRecord),
      plugins: merged,
    },
    emitScope: mpScope,
  };
}

/**
 * Plan 06-04 D-02 extraction: pure payload builder for the cross-scope
 * plugin list. Reads BOTH scopes' state regardless of `opts.scope` -- the
 * fold rule needs visibility into both; final scope-filtering applies AFTER
 * the blocks are constructed.
 */
export async function loadPluginListPayload(opts: ListPluginsOptions): Promise<PluginListPayload> {
  // D-13-19: read both scopes' state.
  const userLocations = locationsFor("user", opts.cwd);
  const projectLocations = locationsFor("project", opts.cwd);
  const [userState, projectState] = await Promise.all([
    loadState(userLocations.extensionRoot),
    loadState(projectLocations.extensionRoot),
  ]);

  const blocks: BuiltBlock[] = [];

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
    if (isCloneOfUserMarketplace(mpRecord, userMp)) {
      continue;
    }

    const built = await buildMarketplaceBlock({
      opts,
      mpName,
      mpScope: "project",
      mpRecord,
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
    const isProjectMpClone = isCloneOfUserMarketplace(projectMp, mpRecord);
    let folded: readonly PluginListRow[] = [];
    let foldedNames: ReadonlySet<string> = new Set();
    if (isProjectMpClone && projectMp !== undefined) {
      // Each folded row carries scope: "project" (D-13-18 actual install scope).
      const { manifest } = await loadMarketplaceManifestSoftly(projectMp);
      folded = await enumerateMarketplacePlugins(opts, projectMp, "project", manifest);
      // Record the folded plugin names so the user-scope manifest's
      // available-bucket enumeration skips them (catalog lines 205-213
      // shows a single `● alpha [project] ... (installed)` row -- no
      // duplicate `○ alpha (available)` row under the same header).
      foldedNames = new Set(
        folded
          .filter((r) => r.status === "installed" || r.status === "upgradable")
          .map((r) => r.name),
      );
    }

    const built = await buildMarketplaceBlock({
      opts,
      mpName,
      mpScope: "user",
      mpRecord,
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
  // rows within each block at the orchestrator boundary. The renderer
  // applies a defensive secondary sort, but the canonical contract is that
  // the orchestrator owns ordering (D-13-19 / sub-wave 2c precedent --
  // `marketplace-list.ts` orchestrator likewise sorts before handing off).
  // `compareByNameThenScope` is the single per-scope MSG-GR-3 comparator.
  const sortedBlocks = [...filtered].sort((a, b) =>
    compareByNameThenScope(a.block.header, b.block.header),
  );
  const marketplaceBlocks: PluginListMarketplaceBlock[] = sortedBlocks.map(({ block }) => {
    // Within each block, sort plugin rows (not EmptyTokens) by the same
    // comparator -- project-before-user tie-break per MSG-GR-3.
    const sortedPlugins = sortPluginsInBlock(block.plugins);
    return { ...block, plugins: sortedPlugins };
  });

  return { marketplaceBlocks };
}

/**
 * MSG-GR-3 in-block plugin sort. EmptyTokens pass through unchanged (they
 * only appear as the SOLE element of a block); all-PluginListRow blocks
 * sort via `compareByNameThenScope`. Mirrors the renderer's defensive
 * sort but happens at the orchestrator boundary per D-13-19 (CMC-03).
 */
function sortPluginsInBlock(
  plugins: readonly (PluginListRow | EmptyToken)[],
): readonly (PluginListRow | EmptyToken)[] {
  if (plugins.length === 0) {
    return plugins;
  }

  if (plugins.some((p) => p.kind === "empty")) {
    return plugins;
  }

  const rows = plugins as readonly PluginListRow[];
  return [...rows].sort((a, b) => compareByNameThenScope(a, b));
}

/**
 * D-06 orchestrator entrypoint. Read-only listing of plugins. Constructs
 * the payload via {@link loadPluginListPayload} and forwards a
 * `SoftDepProbe` to the renderer for per-row soft-dep marker emission
 * (CMC-13 / MSG-SD-1..3).
 */
export async function listPlugins(opts: ListPluginsOptions): Promise<void> {
  const { ctx, pi } = opts;
  // Reset the per-call capture buffer. Each `availableRowComputation`
  // catch site appends a `ProbeFailure` here; we drain into a single
  // `notifyWarning` after the success render so the user sees the real
  // failure causes without one notification per failed row. Reset on
  // function entry rather than after notify so that a throw from
  // `loadPluginListPayload` itself does not bleed captured failures
  // into the next invocation.
  PROBE_FAILURES = [];
  try {
    const payload = await loadPluginListPayload(opts);
    const probe = softDepStatus(pi);
    notifySuccess(ctx, renderPluginList(payload, probe));
    if (PROBE_FAILURES.length > 0) {
      const summary = PROBE_FAILURES.map((f) => `  - ${f.plugin}: {${f.reason}} ${f.message}`).join(
        "\n",
      );
      notifyWarning(
        ctx,
        `Some plugins could not be probed (${String(PROBE_FAILURES.length)}):\n${summary}`,
      );
    }
  } catch (err) {
    notifyError(ctx, errorMessage(err), err);
  } finally {
    PROBE_FAILURES = [];
  }
}

// Test-only re-export. Mirrors the `__test_classifyEntityShapeError` /
// `__test_classifyInstallFailure` precedent in `install.ts`: the helper
// is file-private but its classification table is the load-bearing
// contract that callers (and the user) rely on.
export { narrowProbeError as __test_narrowProbeError };
