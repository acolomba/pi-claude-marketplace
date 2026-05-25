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
import { composeErrorWithCauseChain } from "../../presentation/cause-chain.ts";
import { renderRow } from "../../presentation/compact-line.ts";
import { appendReloadHint, reloadHint } from "../../presentation/reload-hint.ts";
import { composeVersionArrow } from "../../presentation/version-arrow.ts";
import { dropMarketplaceCache } from "../../shared/completion-cache.ts";
import {
  MarketplaceNotFoundError,
  MarketplaceUpdateError,
  PluginShapeError,
  assertNever,
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
import type {
  PluginUpdateFailedOutcome,
  PluginUpdateFn,
  PluginUpdateOutcome,
  PluginUpdateSkippedOutcome,
} from "../types.ts";

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
  // Iteration order is project-first per MSG-GR-3 / compareByNameThenScope
  // so same-name cross-scope stable-sort ties render project-before-user.
  const scopes: readonly Scope[] = opts.scope === undefined ? ["project", "user"] : [opts.scope];

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
      //
      // Task 260525-cjr B2: ALSO pre-narrow the closed-set Reason via
      // `reasonsFromCascadeError(err)` so the cascade row renders the
      // precise cause class (`permission denied` / `source missing` /
      // `no longer installable` / ...) instead of degrading to the
      // permissive `not in manifest` fallback via the consumer's
      // `narrowFailReasons` substring parse. Previously this catch
      // swallowed the throw into a notes-only outcome with `reasons`
      // absent, leaving the downstream consumer no choice but to
      // substring-narrow.
      const typedReasons = reasonsFromCascadeError(err);
      outcomes.push({
        partition: "failed",
        name: plugin,
        notes: [composeErrorWithCauseChain(err)],
        ...(typedReasons !== undefined && { reasons: typedReasons }),
        // CMC-13 / Task 260525-cjr B1: required `boolean` on the
        // outcome contract. `(failed)` cascade rows do not render the
        // soft-dep marker (MSG-SD-3), so the value is deliberately
        // `false`; explicit emission keeps every producer site honest.
        declaresAgents: false,
        declaresMcp: false,
      });
    }
  }

  return outcomes;
}

/**
 * Task 260525-cjr B2: typed-dispatch helper for the `cascadeAutoupdates`
 * catch. Maps a thrown error to a closed-set Reason[] using the same
 * priority order as the cascade narrowers in
 * `orchestrators/plugin/{update,reinstall}.ts::reasonsFromTypedError`:
 * PluginShapeError variants first, then errno-bearing FS errors, then
 * `undefined` to defer to the consumer's substring fallback.
 */
function reasonsFromCascadeError(err: unknown): readonly Reason[] | undefined {
  if (err instanceof PluginShapeError) {
    // Task 260525-cjr C4: switch on `err.shape.kind` for compile-time
    // exhaustiveness.
    switch (err.shape.kind) {
      case "no-longer-installable":
      case "not-installable":
        return ["no longer installable"] as const;
      case "not-in-manifest":
        return ["not in manifest"] as const;
      case "already-installed":
        // Cascade-path "already installed" is unexpected (we only
        // cascade-update plugins already in the record); map to the
        // permissive `not in manifest` fallback.
        return ["not in manifest"] as const;
    }
  }

  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EACCES" || code === "EPERM") {
      return ["permission denied"] as const;
    }

    if (code === "ENOENT" || code === "ENOTDIR") {
      return ["source missing"] as const;
    }
  }

  return undefined;
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
  // CMC-13 / Task 260525-cjr B1: `outcome.declaresAgents` and
  // `outcome.declaresMcp` are now REQUIRED booleans on every partition.
  // Forward them verbatim on `(updated)` rows where MSG-SD-3 allows the
  // marker; pin to `false` on non-(updated) rows where MSG-SD-3
  // forbids the marker (the renderer narrows on `status` anyway, but
  // explicit emission keeps the contract symmetrical with every
  // producer site).
  //
  // Task 260525-cjr C2: PluginUpdateOutcome is now a discriminated
  // union; the switch exhausts all 4 partitions and ends with an
  // `assertNever` so any future variant addition fails at compile
  // time. The (updated) branch no longer needs a `fromVersion !==
  // undefined` ternary -- both version fields are REQUIRED on
  // PluginUpdateUpdatedOutcome.
  switch (outcome.partition) {
    case "updated": {
      // MSG-PL-3: version-transition arrow "v<from> → v<to>". Task
      // 260525-cjr C6: route through the shared
      // `presentation/version-arrow.ts::composeVersionArrow` helper
      // so this and the plugin-side `outcomeToCascadeRow` produce
      // byte-equivalent slot text from the same source of truth.
      // Updated outcomes always have both versions present, so the
      // helper returns a defined string -- the local non-null
      // assertion would be safe but the conditional spread is
      // clearer.
      const version = composeVersionArrow(outcome.fromVersion, outcome.toVersion);
      return {
        kind: "plugin-cascade",
        name: outcome.name,
        scope,
        ...(version !== undefined && { version }),
        status: "updated",
        declaresAgents: outcome.declaresAgents,
        declaresMcp: outcome.declaresMcp,
      };
    }

    case "unchanged":
      return {
        kind: "plugin-cascade",
        name: outcome.name,
        scope,
        status: "skipped",
        reasons: ["up-to-date"],
        declaresAgents: false,
        declaresMcp: false,
      };
    case "skipped":
      return {
        kind: "plugin-cascade",
        name: outcome.name,
        scope,
        status: "skipped",
        reasons: [narrowSkipReason(outcome)],
        declaresAgents: false,
        declaresMcp: false,
      };
    case "failed":
      return {
        kind: "plugin-cascade",
        name: outcome.name,
        scope,
        status: "failed",
        reasons: [narrowFailReason(outcome)],
        declaresAgents: false,
        declaresMcp: false,
      };
    default:
      // Task 260525-cjr C2: exhaustiveness guard. A new partition
      // added to PluginUpdateOutcome without updating this switch
      // fails at compile time on `assertNever(outcome)`.
      return assertNever(outcome);
  }
}

/**
 * Narrow a `skipped` outcome to a closed-set Reason.
 *
 * Quick task 260525-aub: prefer the pre-narrowed `outcome.reasons[0]`
 * (populated by `plugin/update.ts` producers per CR-06) over the legacy
 * substring parse of `outcome.notes`. The notes-fallback is retained
 * for backward compatibility with test fixtures that build outcomes
 * without `reasons`. Once every producer populates `reasons`, the
 * fallback can be deleted -- today fixtures in
 * `tests/orchestrators/marketplace/update.test.ts` still construct
 * notes-only outcomes (e.g., the `narrowSkipReason fallback` test at
 * line 461) so the fallback stays as a transitional bridge.
 */
function narrowSkipReason(outcome: PluginUpdateSkippedOutcome): Reason {
  const firstReason = outcome.reasons[0];
  if (firstReason !== undefined) {
    return firstReason;
  }

  // Fallback: legacy substring parse of `notes`. Retained for backward
  // compatibility with notes-only outcome fixtures.
  const notes = outcome.notes;
  if (notes.length === 0) {
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
 * Narrow a `failed` outcome to a closed-set Reason.
 *
 * Quick task 260525-aub: prefer pre-narrowed `outcome.reasons[0]` over
 * legacy notes parsing (same rationale as `narrowSkipReason` above).
 * The fallback is `"unreadable manifest"` because most legacy update
 * failures bubble up from manifest re-reads; the catalog UAT in Wave 3
 * verifies.
 */
function narrowFailReason(outcome: PluginUpdateFailedOutcome): Reason {
  const firstReason = outcome.reasons?.[0];
  if (firstReason !== undefined) {
    return firstReason;
  }

  // Fallback: legacy substring parse of `notes`. Retained for backward
  // compatibility with notes-only outcome fixtures.
  const notes = outcome.notes;
  if (notes.length === 0) {
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
 * Quick task 260525-aub: test seam for the outcome -> cascade-row mapper.
 * Mirrors the `__test_outcomeToCascadeRow` re-export precedent in
 * `orchestrators/plugin/reinstall.ts`: the function stays private to the
 * orchestrator while tests can verify the `outcome.reasons` typed-Reason
 * preference over the legacy notes-parsing fallback.
 */
export { outcomeToCascadeRow as __test_outcomeToCascadeRow };
