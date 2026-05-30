// orchestrators/marketplace/update.ts
//
// MU-1, MU-4, MU-5, MU-6, MU-7, MU-8, MU-9 + RH-1/RH-2/RH-5 + SC-6 + NFR-5.
//
// Plan 18-05 / Phase 18 Wave 2 (V1 -> V2 notify migration). All 6 V1
// severity-named wrapper callsites (lines 220, 584, 586, 599, 631, 647 in
// the pre-migration file) are replaced with `notify(ctx, pi, ...)` calls
// constructing discriminated `NotificationMessage` payloads. Severity,
// reload-hint, soft-dep marker, and per-row glyph dispatch are owned by
// the V2 renderer in `shared/notify.ts` (D-16-04 / D-16-09 / D-16-11 /
// D-16-12 / D-16-14). See add.ts (Wave 1 pilot) for the NotificationMessage
// construction recipe.
//
// Successful outcomes -> V2 NotificationMessage payloads:
//   - autoupdate OFF (manifest-only refresh): `{ marketplaces: [{ name,
//     scope, status: "updated", plugins: [] }] }`. RESEARCH Risks #4
//     silent contract change: V1 suppressed the reload-hint here; V2
//     emits it because `mp.status === "updated"` is state-changing per
//     D-16-12. Catalog UAT fixture `autoupdate-off-manifest-refresh` at
//     docs/output-catalog.md:801-806.
//   - autoupdate ON (cascade): `{ marketplaces: [{ name, scope, status:
//     "updated", plugins: outcomes.map(outcomeToCascadePluginMessage) }] }`.
//     Per D-18-03 the cause-chain MOVES from marketplace-level to
//     per-plugin `PluginFailedMessage.cause` (D-16-08). Glyph flip on
//     `unchanged` -> `skipped {up-to-date}` per RESEARCH Risks #5 (V2 ⊘
//     vs V1 ●). Catalog UAT fixture `mixed-outcomes` at
//     docs/output-catalog.md:813-822.
//   - mp-level failure (clone/manifest unreachable): `{ marketplaces:
//     [{ name, scope, status: "failed", plugins: [] }] }`. D-18-02
//     DROPS the V1 retry-hint trailer (`err.retryHint` stays internal
//     to MarketplaceUpdateError for programmatic inspection) AND drops
//     the marketplace-level cause-chain (V2 confines `cause?: Error` to
//     per-plugin variants per D-16-08). Catalog UAT fixture
//     `mp-failure-network` at docs/output-catalog.md:828-832.
//   - empty targets (no marketplaces configured): `{ marketplaces: [] }`
//     renders the `(no marketplaces)` D-16-17 sentinel.
//   - cache-leak DROP (D-18-01 precedent extension): the V1
//     post-success cache-cleanup warning is gone; the underlying
//     `rm()` still runs.
//
// Per-row soft-dep markers (D-16-15) are driven by the per-plugin
// `dependencies: Dependency[]` field on `PluginUpdatedMessage` /
// `PluginInstalledMessage` / `PluginReinstalledMessage`, threaded
// through the notify-time `softDepStatus(pi)` probe (D-16-14).
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
//           // MU-7: per-plugin outcomes feed outcomeToCascadePluginMessage construction
//
//   3. Compose user-visible output via a single V2 notify(ctx, pi, ...)
//      call per orchestration (see Plan 18-05 header comment above for
//      the catalog UAT fixtures bound to each shape). Empty targets,
//      mp-level failure, autoupdate-OFF success, and autoupdate-ON
//      cascade each map to a distinct NotificationMessage shape;
//      severity and reload-hint are renderer-computed (D-16-11 /
//      D-16-12) and MUST NOT be composed by callers.
//
// D-14 sequence (Pattern 3, RESEARCH §3): fetch + (symbolic HEAD)
// forceUpdateRef + checkout, OR (detached HEAD) checkout directly.
// NO `pull` (D-13).

import path from "node:path";

import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { dropMarketplaceCache } from "../../shared/completion-cache.ts";
import {
  MarketplaceNotFoundError,
  MarketplaceUpdateError,
  PluginShapeError,
  assertNever,
  composeErrorWithCauseChain,
  errorMessage,
} from "../../shared/errors.ts";
import { notify } from "../../shared/notify.ts";
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
  PluginFailedMessage,
  PluginNotificationMessage,
  Reason,
} from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";
import type {
  PluginUpdateFailedOutcome,
  PluginUpdateFn,
  PluginUpdateOutcome,
  PluginUpdateSkippedOutcome,
} from "../types.ts";

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
   * for whether `pi-subagents` / `pi-mcp-adapter` are loaded. Plan 18-00
   * (Wave 0) promoted this from optional `pi?` to required so the
   * Wave 1/2 V1->V2 notify migration in Plan 18-05 has a non-null
   * reference at every call site. Plan 18-05 (this plan) deletes the
   * former `NULL_PROBE` fallback now that every `notify(ctx, pi, ...)`
   * call requires a real `pi`; the V2 renderer threads `softDepStatus(pi)`
   * internally at notify-time per D-16-14.
   */
  readonly pi: ExtensionAPI;
}

export interface UpdateAllMarketplacesOptions {
  readonly ctx: ExtensionContext;
  readonly scope?: Scope;
  readonly cwd: string;
  readonly gitOps?: GitOps;
  readonly pluginUpdate?: PluginUpdateFn;
  /**
   * See `UpdateMarketplaceOptions.pi` for the Plan 18-00 / 18-05
   * promotion rationale.
   */
  readonly pi: ExtensionAPI;
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
    pi: opts.pi,
    name: opts.name,
    scope: resolved.scope,
    locations: resolved.locations,
    gitOps,
    ...(opts.pluginUpdate !== undefined && { pluginUpdate: opts.pluginUpdate }),
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

  // CMC-10 + D-16-17: empty-set succeeds silently. The V2 renderer
  // emits the planner-chosen "(no marketplaces)" sentinel when
  // `message.marketplaces` is the empty array (see notify.ts:1158);
  // callers MUST NOT compose the sentinel text. See add.ts (Wave 1
  // pilot) for the NotificationMessage construction recipe.
  if (targets.length === 0) {
    notify(opts.ctx, opts.pi, { marketplaces: [] });
    return;
  }

  // Process sequentially per CONTEXT.md (parallel refresh is a deferred perf optimization).
  for (const t of targets) {
    await refreshOneMarketplace({
      ctx: opts.ctx,
      pi: opts.pi,
      name: t.name,
      scope: t.scope,
      locations: t.locations,
      gitOps,
      ...(opts.pluginUpdate !== undefined && { pluginUpdate: opts.pluginUpdate }),
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
  readonly pi: ExtensionAPI;
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
      // JSON-mode outcome aggregation in tests) and by the
      // narrowFailReason notes-substring back-compat fallback below,
      // so the cause-chain trailer is composed inline here. The V2
      // user-visible cause-chain trailer renders via
      // PluginFailedMessage.cause (D-18-03) at the 4-space indent the
      // V2 renderer owns (D-16-08); the `outcome.cause` stamp below
      // carries the raw `err` for that path.
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
        // Plan 18-05 / D-18-03: carry the raw `err` so the V2 cascade
        // mapper (outcomeToCascadePluginMessage) can attach it to
        // PluginFailedMessage.cause for the 4-space-indent cause-chain
        // trailer (D-16-08). `notes` above is retained for the legacy
        // non-notify consumers (test fixtures + outcome aggregators) and
        // for the narrowFailReason notes-substring fallback (CR-06).
        ...(err instanceof Error && { cause: err }),
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
 * Plan 18-05 / D-18-03: map a `PluginUpdateOutcome` to a discriminated
 * `PluginNotificationMessage`. The V2 renderer (`renderPluginRow` in
 * shared/notify.ts) owns the icon dispatch, the version-arrow
 * composition, the reasons-brace composition, and the per-row soft-dep
 * marker injection. The mapper's job is structural -- pick the variant
 * that matches the partition and forward the partition-specific fields.
 *
 * Per-partition mapping:
 *   - `updated`   -> `PluginUpdatedMessage{ from, to, dependencies }`
 *                    Renderer composes `<name> v<from> → v<to> (updated)`
 *                    (D-16-04). MSG-SD-3 allows the soft-dep marker;
 *                    `dependencies` carries the declared kinds that the
 *                    notify-time probe combines with `softDepStatus(pi)`.
 *   - `unchanged` -> `PluginSkippedMessage{ reasons: ["up-to-date"] }`
 *                    Glyph flip per RESEARCH Risks #5: V1 mapped this to
 *                    a trivial-skip ● glyph; V2 routes `skipped` through
 *                    the warning severity ladder (D-16-11) -> ⊘ glyph.
 *   - `skipped`   -> `PluginSkippedMessage{ reasons: [<narrowed>] }`
 *                    Narrowed via `narrowSkipReason` for back-compat with
 *                    notes-only fixtures (CR-06 transitional bridge).
 *   - `failed`    -> `PluginFailedMessage{ reasons: [<narrowed>], cause? }`
 *                    Per D-18-03 the cause-chain MOVES from the
 *                    marketplace level to per-plugin; the cascade catch
 *                    in `cascadeAutoupdates` stamps `outcome.cause` so
 *                    the renderer emits a 4-space-indent trailer below
 *                    the failed row (D-16-08).
 *
 * `scope` is forwarded so the V2 renderer's orphan-fold logic
 * (`renderScopeBracket(plugin.scope, mp.scope)` per Phase 17.2) can
 * suppress the redundant `[<scope>]` bracket when the plugin scope
 * matches the marketplace scope.
 */
function outcomeToCascadePluginMessage(
  outcome: PluginUpdateOutcome,
  scope: Scope,
): PluginNotificationMessage {
  // Task 260525-cjr C2: PluginUpdateOutcome is now a discriminated
  // union; the switch exhausts all 4 partitions and ends with an
  // `assertNever` so any future variant addition fails at compile time.
  switch (outcome.partition) {
    case "updated":
      return {
        status: "updated",
        name: outcome.name,
        scope,
        from: outcome.fromVersion,
        to: outcome.toVersion,
        // CMC-13 / D-15-02: declared kinds drive the per-row soft-dep
        // marker (MSG-SD-3). The V2 renderer narrows on `dependencies`
        // membership ("agents" / "mcp") + the notify-time probe; we
        // forward the boolean flags as the conventional Dependency[]
        // representation.
        dependencies: [
          ...(outcome.declaresAgents ? (["agents"] as const) : []),
          ...(outcome.declaresMcp ? (["mcp"] as const) : []),
        ],
      };
    case "unchanged":
      return {
        status: "skipped",
        name: outcome.name,
        scope,
        // RESEARCH Risks #5: glyph flips ● -> ⊘ on this row vs V1; the
        // V2 renderer routes `skipped` through warning severity per
        // D-16-11 -> ICON_UNINSTALLABLE (⊘) per shared/notify.ts:903-911.
        reasons: ["up-to-date"],
      };
    case "skipped":
      return {
        status: "skipped",
        name: outcome.name,
        scope,
        reasons: [narrowSkipReason(outcome)],
      };
    case "failed":
      return {
        status: "failed",
        name: outcome.name,
        scope,
        reasons: [narrowFailReason(outcome)],
        // Plan 18-05 / D-18-03: the per-plugin cause-chain trailer.
        // `outcome.cause` is populated by the cascadeAutoupdates catch
        // (line ~346) where the raw thrown Error is in scope; failed
        // outcomes produced by plugin/update.ts (no err in scope) leave
        // this undefined and the renderer simply omits the trailer.
        ...(outcome.cause !== undefined && { cause: outcome.cause }),
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
  //
  // WR-06: a `partition: "skipped"` outcome with no reasons AND no notes
  // is a producer-contract violation -- the previous code masked it as
  // `"up-to-date"` (a SUCCESS reason), so the operator read
  // `skipped {up-to-date}` and assumed nothing was wrong while in fact
  // the producer failed to populate its outcome. Map empty-notes to
  // `"unreadable manifest"` instead so the brace surfaces a real failure
  // classification rather than a false success claim (mirrors the
  // narrowFailReason symmetric fallback below).
  const notes = outcome.notes;
  if (notes.length === 0) {
    return "unreadable manifest";
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

  // WR-06: no-substring-match -> SAME treatment as empty-notes; do not
  // mask the unknown-class skip as `"up-to-date"`.
  return "unreadable manifest";
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
    // A marketplace refresh failure renders as the V2 header
    // `⊘ <name> [<scope>] (failed)`. The MarketplaceNotificationMessage
    // shape carries no `cause` (SNM-10 confines `cause` to plugin-level
    // variants), so surface the underlying MarketplaceUpdateError cause
    // (and its retry-hint, carried in the cause chain) via a synthetic
    // failed-plugin child whose `cause` drives the depth-5 cause-chain
    // trailer the renderer appends. Mirrors the reinstall synthetic-failed
    // recipe (orchestrators/plugin/reinstall.ts).
    const typedReasons = reasonsFromCascadeError(err);
    const failedRow: PluginFailedMessage = {
      status: "failed",
      name,
      reasons: typedReasons ?? (["network unreachable"] as const),
      cause: err instanceof Error ? err : new Error(errorMessage(err)),
    };
    notify(ctx, pi, {
      marketplaces: [{ name, scope, status: "failed", plugins: [failedRow] }],
    });
    return;
  }

  // D-03-INV (Plan 06-05): post-state-commit completion-cache invalidation.
  // Manifest refresh may have changed the plugin set; drop the cached
  // plugin index so the next completion read rebuilds from the freshly
  // updated marketplace.json. Defense-in-depth try/catch.
  try {
    await dropMarketplaceCache(await locations.pluginCacheFile(name), scope, name);
  } catch {
    // Plan 18-05 / D-18-01 precedent extension: the V1 cache-leak
    // user-visible warning (`"Marketplace ... updated; completion cache
    // refresh deferred: <err>"`) is DROPPED entirely -- there is no V2
    // NotificationMessage shape that represents "primary mutation
    // succeeded but a follow-up cleanup leaked", and emitting a second
    // notify() after the primary would double severity routing without
    // a catalog fixture to gate against. The cache-cleanup `rm()` still
    // happens above; only the user-facing warning disappears.
  }

  // CASCADE OUTSIDE the outer guard (D-08). Honors MU-4 literal
  // "persisted before any plugin cascade runs".
  const outcomes = await cascadeAutoupdates(snapshot, name, scope, pluginUpdate);

  // CMC-32 binding: when autoupdate is OFF (manifest-only refresh)
  // emit the bare marketplace row. RESEARCH Risks #4 (silent contract
  // change): V1 emitted NO reload-hint on this arm; V2 DOES emit it
  // because notify()'s reload-hint trigger ladder (D-16-12) fires when
  // `mp.status === "updated"` (catalog UAT fixture
  // `autoupdate-off-manifest-refresh` at docs/output-catalog.md:801-806).
  // See add.ts (Wave 1 pilot) for the NotificationMessage construction recipe.
  if (!snapshot.autoupdate || pluginUpdate === undefined) {
    notify(ctx, pi, {
      marketplaces: [{ name, scope, status: "updated", plugins: [] }],
    });
    return;
  }

  // V2 cascade per D-18-03 -- per-plugin PluginFailedMessage.cause /
  // PluginUpdatedMessage{from,to,dependencies} / PluginSkippedMessage.
  // notify() owns: severity (D-16-11 -- any failed -> error; any
  // skipped/manual recovery -> warning; otherwise info), reload-hint
  // (D-16-12 -- any plugin status in {installed, updated, reinstalled,
  // uninstalled} fires the trailer; mp.status "updated" alone also
  // fires per shouldEmitReloadHint), and the per-row soft-dep marker
  // (D-16-14 / D-16-15 -- single probe per notify call, threaded into
  // every renderPluginRow). Caller-supplied plugin order is honored
  // verbatim (D-16-06).
  notify(ctx, pi, {
    marketplaces: [
      {
        name,
        scope,
        status: "updated",
        plugins: outcomes.map((o) => outcomeToCascadePluginMessage(o, scope)),
      },
    ],
  });
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
 * Plan 18-05 / D-18-03: test seam for the V2 outcome -> plugin-message
 * mapper. Renamed from `outcomeToCascadeRow` (V1 PluginCascadeRow return)
 * to `outcomeToCascadePluginMessage` (V2 PluginNotificationMessage
 * return). Tests verify the `outcome.reasons` typed-Reason preference
 * over the legacy notes-parsing fallback (Quick task 260525-aub) AND
 * the new V2 discriminated-union construction (D-18-03 per-plugin cause
 * + glyph flip on `unchanged` -> `skipped {up-to-date}` per RESEARCH
 * Risks #5).
 */
export { outcomeToCascadePluginMessage as __test_outcomeToCascadePluginMessage };
