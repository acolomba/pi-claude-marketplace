// orchestrators/marketplace/update.ts
//
// MU-1, MU-4, MU-5, MU-6, MU-7, MU-8, MU-9 + RH-1/RH-2/RH-5 + SC-6 + NFR-5.
//
// Phase 13 Wave 2 sub-wave 2c (Plan 13-02c-01): CMC-32 / CMC-10 /
// CMC-20 / MSG-SR-4..6 migration. The legacy summary sentence
// (formerly emitted on every refresh) is RETIRED. Success now emits:
//   - autoupdate OFF (manifest-only refresh): a standalone
//     `MarketplaceRow{status:"updated"}` + reload-hint (NFR for
//     "manifest re-validated" -- the marketplace itself was refreshed).
//   - autoupdate ON (cascade): a `cascadeSummary({marketplace, rows,
//     probe})` block -- marketplace header `(updated)` + indented
//     `PluginCascadeRow[]` children for each plugin partition. Severity
//     dispatches via the 2-arm `(severity === "warning" ? notifyWarning
//     : notifySuccess)` ternary (MSG-SR-6 forbids notifyError on cascade
//     summaries; the literal-union severity has no "error" arm).
//   - mp-level failure (clone/manifest unreachable): `notifyError` with
//     chained cause -- entity-level, NOT a cascade, so MSG-SR-6 doesn't
//     apply here. The MU-5 retry hint stays inside the message before
//     the trailer per the existing contract.
//
// Per-row soft-dep markers (CMC-13 / MSG-SD-1..2) ride on
// `PluginCascadeRow.declaresAgents/Mcp` from the `PluginUpdateOutcome`
// surface; the aggregated soft-dep trailer pattern is RETIRED per
// D-13-07 (the per-row marker is now the single source).
//
// MU-2 and MU-3 are SUPERSEDED by Phase 4 D-14 ("follow upstream
// blindly" -- the local marketplace clone is read-only by contract;
// V1's pull --ff-only choreography and non-fast-forward divergence
// detection no longer apply). The supersession is recorded in
// REQUIREMENTS.md and PROJECT.md by Plan 04-10.
//
// Flow:
//   1. Resolve scope(s):
//      - opts.name === undefined → bare form (MU-1, SC-6)
//      - opts.name + opts.scope === undefined → resolveScopeFromState
//      - opts.name + opts.scope set → use it directly
//
//   2. For each (scope, marketplaceName) pair:
//      a. OUTER GUARD (D-04 + D-08 -- wraps refresh + persist, NOT cascade):
//           withStateGuard(locations, async (state) => {
//             record = state.marketplaces[name]
//             if (record.source.kind === "github"):
//               cloneAdvanced = false
//               try {
//                 refreshGitHubClone(cloneDir, record.source.ref, gitOps,
//                                    () => { cloneAdvanced = true; });
//                 // CR-05 / MU-5: the onFetchSucceeded callback flips
//                 // cloneAdvanced to true ONLY after gitOps.fetch returns.
//                 // Pre-fetch throws (DNS/network/auth) leave cloneAdvanced
//                 // at false so the "Retry the command." hint is suppressed.
//                 // Any later D-14 step throw (forceUpdateRef/checkout) or
//                 // manifest re-read throw still produces the retry hint.
//                 manifest = read+validate <marketplaceRoot>/.claude-plugin/marketplace.json
//                 record.lastUpdatedAt = now
//               } catch (err) {
//                 throw new MarketplaceUpdateError(..., { cause, retryHint: cloneAdvanced ? "Retry the command." : "" })
//               }
//             else if path:
//               refreshPathManifest(record)  // NO gitOps; NFR-5
//             // capture snapshot for cascade-outside-guard:
//             snapshot = { autoupdate: record.autoupdate ?? false, plugins: Object.keys(record.plugins) }
//             return snapshot
//           })
//
//      b. CASCADE OUTSIDE GUARD (D-08 honors MU-4 literal "persisted before cascade"):
//           if (snapshot.autoupdate === true && pluginUpdate is provided):
//             for each plugin in snapshot.plugins:
//               outcome = await pluginUpdate(plugin, name, scope);
//               partition[outcome.partition].push(outcome)
//           // MU-7: per-plugin outcomes feed PluginCascadeRow construction
//
//   3. Compose user-visible output via the Wave 1 primitives:
//      - mp-level failure -> notifyError with chained cause (+ MU-5
//        retry hint when applicable)
//      - empty scope (no marketplaces configured) -> `(no marketplaces)`
//        EmptyToken (CMC-10)
//      - autoupdate OFF success -> standalone marketplace row + reload-hint
//      - autoupdate ON success -> cascadeSummary + 2-arm severity dispatch
//
// D-14 sequence (Pattern 3, RESEARCH §3): fetch + (symbolic HEAD)
// forceUpdateRef + checkout, OR (detached HEAD) checkout directly.
// NO `pull` (D-13).

import path from "node:path";

import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { softDepStatus } from "../../platform/pi-api.ts";
import { cascadeSummary } from "../../presentation/cascade-summary.ts";
import { causeChainTrailer } from "../../presentation/cause-chain.ts";
import { renderRow } from "../../presentation/compact-line.ts";
import { appendReloadHint, reloadHint } from "../../presentation/reload-hint.ts";
import { dropMarketplaceCache } from "../../shared/completion-cache.ts";
import {
  MarketplaceNotFoundError,
  MarketplaceUpdateError,
  errorMessage,
} from "../../shared/errors.ts";
import { notifyError, notifySuccess, notifyWarning } from "../../shared/notify.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";

import {
  DEFAULT_GIT_OPS,
  refreshGitHubClone,
  resolveScopeFromState,
  type GitOps,
} from "./shared.ts";

import type { ParsedSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type {
  MarketplaceRow,
  PluginCascadeRow,
  SoftDepProbe,
} from "../../presentation/compact-line.ts";
import type { Reason } from "../../shared/grammar/reasons.ts";
import type { Scope } from "../../shared/types.ts";
import type { PluginUpdateFn, PluginUpdateOutcome } from "../types.ts";

/**
 * Marketplace label rows never carry per-row soft-dep markers (those
 * are plugin-row predicates). When the orchestrator has no `pi` to
 * probe (test paths that don't exercise RH-5), this fallback probe
 * keeps the renderer's `composeReasons` branch inert.
 */
const NULL_PROBE: SoftDepProbe = {
  piSubagentsLoaded: true,
  piMcpAdapterLoaded: true,
};

export interface UpdateMarketplaceOptions {
  readonly ctx: ExtensionContext;
  /** Single marketplace by name. Required for `updateMarketplace`; rejected by `updateAllMarketplaces` (which derives the list from state). */
  readonly name: string;
  readonly scope?: Scope;
  readonly cwd: string;
  readonly gitOps?: GitOps;
  /**
   * D-05 injection seam. When omitted, autoupdate cascade is a NO-OP
   * (Phase 4 ships marketplace update without Phase 5 wiring; tests
   * inject a mock).
   */
  readonly pluginUpdate?: PluginUpdateFn;
  /**
   * Soft-dep probe target. `pi.getAllTools()` is the source of truth
   * for whether `pi-subagents` / `pi-mcp-adapter` are loaded. Optional
   * because tests that don't care about RH-5 can omit it.
   */
  readonly pi?: ExtensionAPI;
}

export interface UpdateAllMarketplacesOptions {
  readonly ctx: ExtensionContext;
  readonly scope?: Scope;
  readonly cwd: string;
  readonly gitOps?: GitOps;
  readonly pluginUpdate?: PluginUpdateFn;
  readonly pi?: ExtensionAPI;
}

/** MU-1 single-name form. */
export async function updateMarketplace(opts: UpdateMarketplaceOptions): Promise<void> {
  const gitOps = opts.gitOps ?? DEFAULT_GIT_OPS;
  const userLocations = locationsFor("user", opts.cwd);
  const projectLocations = locationsFor("project", opts.cwd);
  const resolved =
    opts.scope === undefined
      ? await resolveScopeFromState(opts.name, userLocations, projectLocations)
      : {
          scope: opts.scope,
          locations: opts.scope === "user" ? userLocations : projectLocations,
        };

  await refreshOneMarketplace({
    ctx: opts.ctx,
    name: opts.name,
    scope: resolved.scope,
    locations: resolved.locations,
    gitOps,
    ...(opts.pluginUpdate !== undefined && { pluginUpdate: opts.pluginUpdate }),
    ...(opts.pi !== undefined && { pi: opts.pi }),
  });
}

/**
 * MU-1 bare form (no name): refresh every marketplace in target scope(s).
 * SC-6 enumerates both scopes when --scope omitted.
 */
export async function updateAllMarketplaces(opts: UpdateAllMarketplacesOptions): Promise<void> {
  const gitOps = opts.gitOps ?? DEFAULT_GIT_OPS;
  const scopes: readonly Scope[] = opts.scope === undefined ? ["user", "project"] : [opts.scope];

  // Collect (scope, marketplaceName) pairs from a single fresh state read per scope.
  const targets: { scope: Scope; locations: ScopedLocations; name: string }[] = [];
  for (const scope of scopes) {
    const locations = locationsFor(scope, opts.cwd);
    const state = await loadState(locations.extensionRoot);
    for (const name of Object.keys(state.marketplaces)) {
      targets.push({ scope, locations, name });
    }
  }

  // CMC-10: empty-set succeeds silently with the `(no marketplaces)`
  // EmptyToken (formerly the "No marketplaces configured." sentence).
  if (targets.length === 0) {
    notifySuccess(opts.ctx, renderRow({ kind: "empty", token: "no marketplaces" }, NULL_PROBE));
    return;
  }

  // Process sequentially per CONTEXT.md (parallel refresh is a deferred perf optimization).
  for (const t of targets) {
    await refreshOneMarketplace({
      ctx: opts.ctx,
      name: t.name,
      scope: t.scope,
      locations: t.locations,
      gitOps,
      ...(opts.pluginUpdate !== undefined && { pluginUpdate: opts.pluginUpdate }),
      ...(opts.pi !== undefined && { pi: opts.pi }),
    });
  }
}

interface RefreshOneArgs {
  readonly ctx: ExtensionContext;
  readonly name: string;
  readonly scope: Scope;
  readonly locations: ScopedLocations;
  readonly gitOps: GitOps;
  readonly pluginUpdate?: PluginUpdateFn;
  readonly pi?: ExtensionAPI;
}

async function refreshRecord(
  record: ExtensionState["marketplaces"][string],
  args: RefreshOneArgs,
): Promise<void> {
  const { name, locations, gitOps } = args;
  const source = record.source as ParsedSource;
  let cloneAdvanced = false;
  try {
    if (source.kind === "github") {
      const cloneDir = await locations.sourceCloneDir(name);
      await refreshGitHubClone(cloneDir, source.ref, gitOps, () => {
        cloneAdvanced = true;
      });
      await validateManifestAtRoot(record, cloneDir);
    } else if (source.kind === "path") {
      await validateManifestAtRoot(record, record.marketplaceRoot);
    } else {
      throw new Error(
        `Cannot update marketplace "${name}": unsupported source kind "${source.kind}"`,
      );
    }

    record.lastUpdatedAt = new Date().toISOString();
  } catch (err) {
    throw new MarketplaceUpdateError(
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- cloneAdvanced is set via callback inside refreshGitHubClone (CR-05).
      cloneAdvanced
        ? `Marketplace "${name}" clone advanced but manifest could not be persisted.`
        : `Failed to update marketplace "${name}".`,
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- cloneAdvanced is set via callback inside refreshGitHubClone (CR-05).
      { cause: err, retryHint: cloneAdvanced ? "Retry the command." : "" },
    );
  }
}

interface RefreshSnapshot {
  readonly autoupdate: boolean;
  readonly plugins: readonly string[];
}

async function snapshotAfterRefresh(args: RefreshOneArgs): Promise<RefreshSnapshot> {
  const { name, scope, locations } = args;
  return withStateGuard(locations, async (state) => {
    const record = state.marketplaces[name];
    if (record === undefined) {
      throw new MarketplaceNotFoundError(name, [scope]);
    }

    await refreshRecord(record, args);
    return {
      autoupdate: record.autoupdate ?? false,
      plugins: Object.keys(record.plugins),
    };
  });
}

async function cascadeAutoupdates(
  snapshot: RefreshSnapshot,
  name: string,
  scope: Scope,
  pluginUpdate: PluginUpdateFn | undefined,
): Promise<readonly PluginUpdateOutcome[]> {
  if (!snapshot.autoupdate || pluginUpdate === undefined) {
    return [];
  }

  const outcomes: PluginUpdateOutcome[] = [];
  for (const plugin of snapshot.plugins) {
    try {
      outcomes.push(await pluginUpdate(plugin, name, scope));
    } catch (err) {
      // `notes` is consumed by callers OUTSIDE the notify path (e.g.
      // JSON-mode outcome aggregation in tests), so the cause-chain
      // trailer must be composed inline rather than relying on
      // notifyError's auto-trailer.
      outcomes.push({
        partition: "failed",
        name: plugin,
        notes: [composeErrorWithCauseChain(err)],
      });
    }
  }

  return outcomes;
}

/**
 * MU-7 / CMC-26: map a `PluginUpdateOutcome` to a `PluginCascadeRow`.
 * The renderer (`cascadeSummary` + `renderRow`) owns the icon dispatch
 * and the per-row soft-dep marker injection.
 *
 *   - updated  -> `(updated)` with `v<from> → v<to>` version slot
 *     (renderer prepends `v` to the version string; we pass the arrow
 *     form without a leading `v` to avoid double-`v` per Wave 2a
 *     deviation #1).
 *   - unchanged -> `(skipped) {up-to-date}` (trivial skip -> ● icon)
 *   - skipped  -> `(skipped) {<narrowed reason>}` (non-trivial skip)
 *   - failed   -> `(failed) {<narrowed reason>}`; for now we use
 *     `"not in manifest"` as the documented permissive fallback when
 *     no closed-set Reason maps cleanly. The catalog UAT in Wave 3
 *     verifies the rendered text.
 */
function outcomeToCascadeRow(outcome: PluginUpdateOutcome, scope: Scope): PluginCascadeRow {
  const baseDeclares = {
    ...(outcome.declaresAgents !== undefined && { declaresAgents: outcome.declaresAgents }),
    ...(outcome.declaresMcp !== undefined && { declaresMcp: outcome.declaresMcp }),
  };
  switch (outcome.partition) {
    case "updated": {
      // MSG-PL-3: version-transition arrow "v<from> → v<to>". The
      // renderer's `renderVersion` slot prepends `v`; we omit the
      // leading `v` on the from-side so the final form is `v<from>
      // → v<to>` (catalog form). The arrow is U+2192 (space-padded).
      const version =
        outcome.fromVersion !== undefined && outcome.toVersion !== undefined
          ? `${outcome.fromVersion} → v${outcome.toVersion}`
          : undefined;
      return {
        kind: "plugin-cascade",
        name: outcome.name,
        scope,
        ...(version !== undefined && { version }),
        status: "updated",
        ...baseDeclares,
      };
    }

    case "unchanged":
      return {
        kind: "plugin-cascade",
        name: outcome.name,
        scope,
        status: "skipped",
        reasons: ["up-to-date"],
      };
    case "skipped":
      return {
        kind: "plugin-cascade",
        name: outcome.name,
        scope,
        status: "skipped",
        reasons: [narrowSkipReason(outcome.notes)],
      };
    case "failed":
      return {
        kind: "plugin-cascade",
        name: outcome.name,
        scope,
        status: "failed",
        reasons: [narrowFailReason(outcome.notes)],
      };
  }
}

/**
 * Narrow `skipped` outcome notes to a closed-set Reason. The
 * documented permissive default is `"up-to-date"` (the most common
 * non-failure skip); the catalog UAT in Wave 3 is the binding
 * verification that the mapped Reason set is sufficient.
 */
function narrowSkipReason(notes: readonly string[] | undefined): Reason {
  if (notes === undefined || notes.length === 0) {
    return "up-to-date";
  }

  const text = notes.join(" ").toLowerCase();
  if (text.includes("not in manifest") || text.includes("not found in marketplace")) {
    return "not in manifest";
  }

  if (text.includes("source mismatch")) {
    return "source mismatch";
  }

  if (text.includes("no longer installable")) {
    return "no longer installable";
  }

  return "up-to-date";
}

/**
 * Narrow `failed` outcome notes to a closed-set Reason. The fallback
 * is `"unreadable manifest"` because most update failures bubble up
 * from manifest re-reads; the catalog UAT in Wave 3 verifies.
 */
function narrowFailReason(notes: readonly string[] | undefined): Reason {
  if (notes === undefined || notes.length === 0) {
    return "unreadable manifest";
  }

  const text = notes.join(" ").toLowerCase();
  if (text.includes("not in manifest") || text.includes("not found in marketplace")) {
    return "not in manifest";
  }

  if (text.includes("rollback partial")) {
    return "rollback partial";
  }

  if (text.includes("invalid manifest") || text.includes("unparseable")) {
    return "invalid manifest";
  }

  if (text.includes("unreadable")) {
    return "unreadable manifest";
  }

  return "unreadable manifest";
}

async function refreshOneMarketplace(args: RefreshOneArgs): Promise<void> {
  const { ctx, name, scope, locations, pluginUpdate, pi } = args;

  let snapshot: RefreshSnapshot;
  try {
    snapshot = await snapshotAfterRefresh(args);
  } catch (err) {
    // Entity-level failure (MU-5 + ES-4): surface via notifyError with
    // chained cause. NOT a cascade, so MSG-SR-6 doesn't apply. The
    // legacy "Updated ..." summary sentence is gone (Plan 13-02c-01)
    // -- the error body is the bare errorMessage (the cause-chain
    // trailer auto-appends through notifyError per D-CMC-12).
    if (err instanceof MarketplaceUpdateError && err.retryHint !== "") {
      // notifyError will append the MSG-CC-1 trailer for `err.cause`
      // automatically; we append the retry hint INSIDE `message` so it
      // surfaces between the message and the cause-chain trailer.
      notifyError(ctx, `${errorMessage(err)}\n${err.retryHint}`, err.cause);
    } else {
      notifyError(ctx, errorMessage(err), err);
    }

    return;
  }

  // D-03-INV (Plan 06-05): post-state-commit completion-cache invalidation.
  // Manifest refresh may have changed the plugin set; drop the cached
  // plugin index so the next completion read rebuilds from the freshly
  // updated marketplace.json. Defense-in-depth try/catch.
  try {
    await dropMarketplaceCache(await locations.pluginCacheFile(name), scope, name);
  } catch (err) {
    notifyWarning(
      ctx,
      `Marketplace "${name}" updated; completion cache refresh deferred: ${errorMessage(err)}`,
    );
  }

  // CASCADE OUTSIDE the outer guard (D-08). Honors MU-4 literal
  // "persisted before any plugin cascade runs".
  const outcomes = await cascadeAutoupdates(snapshot, name, scope, pluginUpdate);
  const probe: SoftDepProbe = pi === undefined ? NULL_PROBE : softDepStatus(pi);

  // Compose the marketplace header row. The marker reflects the post-
  // refresh autoupdate state (catalog: `<autoupdate>` when ON; absent
  // when OFF). Status is `(updated)` -- the manifest re-validation
  // completed successfully on this code path.
  const headerRow: MarketplaceRow = {
    kind: "marketplace",
    name,
    scope,
    outcomeClass: "ok",
    status: "updated",
    ...(snapshot.autoupdate && { marker: "autoupdate" as const }),
  };

  // CMC-32 binding: when autoupdate is OFF (manifest-only refresh)
  // emit the bare marketplace row -- no cascade children, no
  // reload-hint trailer (catalog lines 659-666: the autoupdate-off
  // case shows just the marketplace row; no resources actually
  // changed on the user's filesystem -- the manifest read is a
  // bookkeeping refresh on the local clone, not a generated-resource
  // update).
  if (!snapshot.autoupdate || pluginUpdate === undefined) {
    notifySuccess(ctx, renderRow(headerRow, probe));
    return;
  }

  // CMC-26 / CMC-13: autoupdate ON -- cascade via Wave 1 composer.
  // PluginCascadeRow constructed per outcome; cascadeSummary handles
  // the indent + sort + severity computation.
  const rows: PluginCascadeRow[] = outcomes.map((o) => outcomeToCascadeRow(o, scope));
  const { message, severity } = cascadeSummary({ marketplace: headerRow, rows, probe });

  // RH-1 / MSG-RH-1: emit the reload-hint trailer iff at least one
  // plugin's resources actually changed (the (updated) partition is
  // non-empty).
  const changedNames = outcomes.filter((o) => o.partition === "updated").map((o) => o.name);
  const hint = reloadHint(changedNames);
  const body = appendReloadHint(message, hint);
  const dispatch = severity === "warning" ? notifyWarning : notifySuccess;
  dispatch(ctx, body);
}

/**
 * MU-4 / MU-5: re-read and re-validate the marketplace.json at the
 * given root. Throws on read or validation failure -- the caller wraps
 * as `MarketplaceUpdateError`.
 *
 * WR-03: previously named `refreshManifestPointer` and unconditionally
 * wrote `record.manifestPath` and `record.marketplaceRoot`. For path
 * sources the caller already passes `record.marketplaceRoot`, and for
 * github sources `cloneDir === record.marketplaceRoot` after `add`. The
 * writes were no-ops that obscured the function's actual purpose (just
 * validate). Writes are now gated on a real change so a future
 * "did anything change?" optimization can rely on identity.
 */
async function validateManifestAtRoot(
  record: ExtensionState["marketplaces"][string],
  marketplaceRoot: string,
): Promise<void> {
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await loadMarketplaceManifest(manifestPath);

  if (record.manifestPath !== manifestPath) {
    record.manifestPath = manifestPath;
  }

  if (record.marketplaceRoot !== marketplaceRoot) {
    record.marketplaceRoot = marketplaceRoot;
  }
}

/**
 * Compose `errorMessage(err) [\n\n${causeChainTrailer(err)}]` for outcome
 * `notes` aggregated outside the notify path. `notifyError` does this
 * automatically; this helper exists for outcome-aggregation callsites that
 * need the same text without going through the notify channel.
 */
function composeErrorWithCauseChain(err: unknown): string {
  const trailer = causeChainTrailer(err);
  return trailer === "" ? errorMessage(err) : `${errorMessage(err)}\n\n${trailer}`;
}
