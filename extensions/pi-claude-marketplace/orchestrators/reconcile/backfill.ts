// orchestrators/reconcile/backfill.ts
//
// BFILL-01..03: the load-time backfill pass. A partially-installed record whose
// manifest entry has since grown its supported-component set is re-resolved
// offline and re-materialized, so a plugin that was degraded at install time
// becomes whole without the user running anything.
//
// It lived inside apply.ts and its two entry points were reached through
// `__test_` re-exports, while its tests already had a file of their own
// (tests/orchestrators/reconcile/backfill.test.ts). A concern with its own
// test file and its own name is a module; extracting it is what turns those
// seams into an interface (FLOW-09).

import { PLUGIN_ENTRY_VALIDATOR } from "../../domain/components/plugin.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { resolveStrict } from "../../domain/resolver.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { isRecordedButDisabled } from "../../persistence/state-io.ts";
import { errorMessage } from "../../shared/errors.ts";
import { EXTENSION_VERSION } from "../../shared/extension-version.ts";
import { redactAbsolutePaths } from "../../shared/notify.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";
import { reinstallPlugin } from "../plugin/reinstall.ts";

import {
  classifyOrchestratorThrow,
  classifyReadPassThrow,
  dependenciesFromInstall,
} from "./apply-outcomes.ts";

import type { PerEntryOutcome } from "./apply-outcomes.ts";
import type { ApplyReconcileOptions, ScopeReadResult } from "./types.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * BFILL-01 / BFILL-02 / D-68-03: the load-time backfill step. Runs as a sibling
 * inside applyReconcile's per-scope apply region with NO outer lock (CR-01):
 * the stamp `withStateGuard` takes its own per-scope lock and proper-lockfile is
 * not re-entrant.
 *
 * Gate (BFILL-02): the supported-kind boundary can only move when the extension
 * version changes, so the scan fires ONLY when the persisted
 * `lastReconciledExtensionVersion` differs from `EXTENSION_VERSION` (an absent
 * stamp = scan-once per D-68-01). An equal stamp returns immediately -- no scan,
 * no write, state.json mtime preserved (RECON-05).
 *
 * A pristine scope (no state.json) carries no read-pass snapshot, so backfill is
 * skipped there -- it must never create an unsolicited state.json (WR-05).
 *
 * WR-01: a config-present / state.json-absent scope DOES carry a snapshot (the
 * read pass loads DEFAULT_STATE), so `state` is defined even though no state.json
 * exists on disk. With zero partially-installed plugins to promote, the stamp write
 * would CREATE an unsolicited state.json purely to record the version -- the same
 * WR-05 violation. That case is skipped silently below.
 *
 * Stamp-on-gate-open (D-68-03): whenever the gate opened AND a state.json already
 * exists (or there is real backfill work), the running version is stamped
 * UNCONDITIONALLY -- even with zero partially-installed plugins to promote -- so the
 * gate closes and does not reopen on the next load. The stamp is written via
 * withStateGuard -> saveState (the sole sanctioned state.json writer, SPLIT-02 /
 * NFR-1), never a bare atomicWriteJson.
 */
async function applyBackfillForScope(
  opts: ApplyReconcileOptions,
  scope: Scope,
  readResult: ScopeReadResult,
  outcomes: PerEntryOutcome[],
): Promise<void> {
  const state = readResult.state;
  if (state === undefined) {
    // Pristine scope -- nothing recorded, no state.json to stamp (WR-05).
    return;
  }

  if (state.lastReconciledExtensionVersion === EXTENSION_VERSION) {
    // Gate closed: the extension version has not moved since the last
    // reconcile, so the supported-kind boundary cannot have moved either.
    // No scan, no write -- RECON-05 mtime invariant preserved.
    return;
  }

  // WR-01: no state.json on disk AND nothing to promote -- skip silently. The
  // stamp write below would otherwise bring an unsolicited state.json into
  // existence purely to record the version (WR-05). When state.json already
  // exists, stamping it (even with zero promotions) stays correct per D-68-03.
  if (!readResult.stateExisted && !hasForceInstalledPlugin(state)) {
    return;
  }

  // Gate OPEN. Scan every partially-installed plugin and re-materialize the ones
  // whose supported set grew; promotion rows fold into `outcomes` (RECON-04).
  const anyFailure = await scanForceInstalledBackfills(opts, scope, state, outcomes);

  // SF-02: a partially-installed plugin was scanned but its backfill FAILED -- a
  // genuine `failed` partition, OR a per-plugin manifest-I/O throw caught inside
  // the scan; not a benign no-growth / concurrent-uninstall. Leave the version
  // gate OPEN so the next load retries -- symmetric with the WR-02 self-heal (a
  // THROW from the stamp write also keeps the gate open). Skipping the stamp
  // leaves state.json untouched (RECON-05 mtime invariant preserved).
  if (anyFailure) {
    return;
  }

  // D-68-03 (stamp-on-gate-open): close the gate even when nothing was
  // backfilled. SPLIT-02 / NFR-1: route through withStateGuard -> saveState,
  // never a bare atomicWriteJson. CR-01: this takes its own per-scope lock; the
  // surrounding apply region holds no outer lock.
  const loc = locationsFor(scope, opts.cwd);
  await withStateGuard(loc, (fresh) => {
    fresh.lastReconciledExtensionVersion = EXTENSION_VERSION;
  });
}

/**
 * WR-02: throw-isolated wrapper around `applyBackfillForScope`. The stamp
 * `withStateGuard` (and the per-plugin re-materialize) can throw a transient
 * `StateLockHeldError` (a concurrent process holds the scope lock) or an EACCES
 * on saveState. Mirrors `rebuildScopeRoutingTableIsolated`: coerce the throw
 * into a structured `invalid-block` row (subject `state.json`, closed-set
 * reason) so a transient failure NEVER aborts the single cascade for both
 * scopes. The gate stays open and the scan self-heals on the next load --
 * retry-safe (NFR-3); NFR-1 atomicity is unaffected (the failed write simply
 * did not commit).
 */
export async function applyBackfillForScopeIsolated(
  opts: ApplyReconcileOptions,
  scope: Scope,
  readResult: ScopeReadResult,
  outcomes: PerEntryOutcome[],
): Promise<void> {
  await runScopeIsolated(scope, outcomes, () =>
    applyBackfillForScope(opts, scope, readResult, outcomes),
  );
}

/**
 * The throw-to-`invalid-block` coercion both isolated wrappers apply. A
 * transient `StateLockHeldError` or EACCES becomes a structured row (subject
 * `state.json`, closed-set reason) carrying a redacted cause, so one scope's
 * transient failure never aborts the cascade for the other.
 */
export async function runScopeIsolated(
  scope: Scope,
  outcomes: PerEntryOutcome[],
  op: () => Promise<void>,
): Promise<void> {
  try {
    await op();
  } catch (err) {
    outcomes.push({
      kind: "invalid-block",
      scope,
      basename: "state.json",
      reason: classifyReadPassThrow(err),
      cause: new Error(redactAbsolutePaths(errorMessage(err))),
    });
  }
}

/**
 * WR-01: true iff any recorded plugin in this scope is partially-installed
 * (compatibility.installable === false) -- the only kind the backfill scan can
 * promote. Decides whether a stamp write is worth bringing a state.json into
 * existence for: with none and no state.json on disk, the file stays absent.
 */
function hasForceInstalledPlugin(state: ExtensionState): boolean {
  for (const mp of Object.values(state.marketplaces)) {
    for (const record of Object.values(mp.plugins)) {
      if (!record.compatibility.installable) {
        return true;
      }
    }
  }

  return false;
}

/**
 * BFILL-01 / D-68-03: scan the read-pass snapshot's partially-installed plugins
 * (compatibility.installable === false; clean/installed plugins have nothing to
 * backfill) and re-materialize each whose supported set grew. Iterates the
 * snapshot; reinstallPlugin self-locks and re-reads fresh state per plugin
 * (CR-01).
 *
 * RECON-04 single-emit: the snapshot predates applyPlan, which may have re-materialized a
 * partially-installed plugin in the SAME load (e.g. a disable/enable that emits its
 * own transition row). Skip any plugin already represented in this scope's
 * accumulated outcomes so a single load can never emit two rows for one plugin
 * (nor clobber a just-applied transition with a redundant overwrite).
 *
 * SF-02: returns `true` iff at least one scanned plugin's backfill FAILED -- a
 * genuine `failed` partition surfaced by `maybeBackfillPlugin`, OR a THROW out of
 * `maybeBackfillPlugin` (e.g. a corrupt / permission-denied cached marketplace
 * manifest), not a benign no-growth / concurrent-uninstall -- so the caller can
 * keep the version gate OPEN and retry.
 *
 * Per-plugin fault isolation: each `maybeBackfillPlugin` call is wrapped in
 * try/catch. A throw from ONE plugin (SF-02 lets a manifest I/O error propagate)
 * is surfaced as a plugin-scoped `(failed)` row and flips `anyFailure`, then the
 * loop CONTINUES so healthy SIBLING plugins -- including ones under a different,
 * readable marketplace -- are still scanned and promoted. Without this guard a
 * single corrupt manifest would unwind the whole loop into the outer WR-02
 * wrapper's single generic `state.json (failed)` row and block every still-
 * unscanned sibling on every load.
 */
export async function scanForceInstalledBackfills(
  opts: ApplyReconcileOptions,
  scope: Scope,
  state: ExtensionState,
  outcomes: PerEntryOutcome[],
): Promise<boolean> {
  const alreadyTouched = new Set<string>();
  for (const o of outcomes) {
    if (o.scope === scope && "plugin" in o) {
      alreadyTouched.add(`${o.marketplace} ${o.plugin}`);
    }
  }

  let anyFailure = false;
  for (const [marketplace, mp] of Object.entries(state.marketplaces)) {
    for (const [plugin, record] of Object.entries(mp.plugins)) {
      const failed = await backfillOnePluginIsolated(
        opts,
        { scope, marketplace, mp, plugin, record },
        alreadyTouched,
        outcomes,
      );
      anyFailure = anyFailure || failed;
    }
  }

  return anyFailure;
}

/**
 * Per-plugin fault isolation for one scanned record. Applies the D-68-03
 * partially-installed filter, the ENBL-08 disabled-record filter and the
 * RECON-04 already-touched dedupe (all three benign skips returning `false`), then runs
 * `maybeBackfillPlugin` inside a try/catch.
 *
 * SF-02 lets a genuine manifest I/O error (corrupt / permission-denied cached
 * manifest) propagate out of `maybeBackfillPlugin`. Without this guard that throw
 * unwinds the whole scan loop into the outer WR-02 wrapper, coercing the WHOLE
 * scope to a single generic `state.json (failed)` row and skipping promotion of
 * every still-unscanned SIBLING (including healthy ones under other marketplaces).
 * Instead surface a plugin-scoped `(failed)` row -- the same outcome shape + reason
 * classifier as the SF-01 `failed`-partition branch in `maybeBackfillPlugin` -- and
 * return `true` so the caller keeps the version gate OPEN (this plugin retries next
 * load) while still scanning its siblings. The WR-02 wrapper stays as the net for
 * throws OUTSIDE the loop (e.g. the stamp write).
 */
async function backfillOnePluginIsolated(
  opts: ApplyReconcileOptions,
  target: {
    scope: Scope;
    marketplace: string;
    mp: StateMarketplaceRecord;
    plugin: string;
    record: StatePluginRecord;
  },
  alreadyTouched: ReadonlySet<string>,
  outcomes: PerEntryOutcome[],
): Promise<boolean> {
  const { scope, marketplace, mp, plugin, record } = target;
  // D-68-03: scan ONLY partially-installed plugins.
  if (record.compatibility.installable) {
    return false;
  }

  // ENBL-08: never scan a record the user disabled. Promoting a disabled record
  // would restore that plugin's hooks, MCP servers and PATH entries at load time
  // with no command and no prompt. Reinstall now refuses a disabled record
  // itself, so this is no longer the only thing standing between the scan and
  // that reversal -- it stays as the caller-side guard, so the scan does no
  // pointless work and the promotion policy stays visible beside the scan's
  // other filters. Availability and disabled-ness are orthogonal axes (ENBL-05),
  // so the filter above does not cover this one. Read through the single
  // predicate rather than the boolean, so this site cannot drift from the rule
  // `persistence/state-io.ts` owns.
  if (isRecordedButDisabled(record)) {
    return false;
  }

  // RECON-04: applyPlan already touched this plugin this load -- don't double-emit /
  // re-materialize over it.
  if (alreadyTouched.has(`${marketplace} ${plugin}`)) {
    return false;
  }

  try {
    return await maybeBackfillPlugin(opts, scope, marketplace, mp, plugin, record, outcomes);
  } catch (err) {
    outcomes.push({
      kind: "plugin-install-failed",
      scope,
      marketplace,
      plugin,
      reason: classifyOrchestratorThrow(err),
    });
    return true;
  }
}

type StateMarketplaceRecord = ExtensionState["marketplaces"][string];
type StatePluginRecord = StateMarketplaceRecord["plugins"][string];

/**
 * BFILL-01: re-resolve one partially-installed plugin offline (NFR-5) and, if its
 * supported set strictly grew (the boundary moved for THIS plugin -- D-68-03,
 * avoiding needless mtime churn), re-materialize it in place via the
 * partial-capable reinstall primitive at the SAME recorded version (no upgrade --
 * D-68-02). The promotion folds into the single cascade as a
 * `PluginBackfilledOutcome` whose `installable` boolean drives the
 * (installed)-vs-(partially-installed) projection.
 *
 * SF-01 / SF-02: returns `true` iff the re-materialize FAILED (a genuine
 * failure, surfaced as a plugin-scoped (failed) row), so the caller keeps the
 * version gate OPEN and retries next load. Benign outcomes (no growth,
 * concurrent uninstall, successful promotion) return `false`.
 */
async function maybeBackfillPlugin(
  opts: ApplyReconcileOptions,
  scope: Scope,
  marketplace: string,
  mp: StateMarketplaceRecord,
  plugin: string,
  record: StatePluginRecord,
  outcomes: PerEntryOutcome[],
): Promise<boolean> {
  const resolved = await resolveRecordedPluginOffline(mp, plugin);
  if (resolved === undefined || resolved.state === "unavailable") {
    // Unresolvable / structurally broken -- cannot backfill (NFR-5 cache-only;
    // a resolve failure is the truthful "skip" default, never a crash). A
    // manifest-unreadable I/O throw never reaches here -- SF-02 lets it propagate
    // out of resolveRecordedPluginOffline to the per-plugin catch in
    // scanForceInstalledBackfills, which surfaces a plugin-scoped (failed) row and
    // keeps the gate open. A legitimately absent/invalid entry is benign, NOT a
    // failure, so this scan may still close the gate.
    return false;
  }

  if (!supportedSetGrew(record.compatibility.supported, resolved.supported)) {
    return false;
  }

  // CR-01: render: "none" self-locking re-materialize. The recorded version is
  // preserved by reinstall (D-68-02).
  const outcome = await reinstallPlugin({
    ctx: opts.ctx,
    pi: opts.pi,
    scope,
    cwd: opts.cwd,
    marketplace,
    plugin,
    render: "none",
  });

  if (outcome.partition === "skipped") {
    // Two benign shapes reach here and neither is a failure: the record was
    // removed under us (concurrent uninstall), or it was disabled under us
    // between this scan's state SNAPSHOT and reinstall's own fresh read
    // (ENBL-05 -- reinstall refuses a disabled record). The ENBL-08 filter
    // above reads the snapshot, so it cannot see a cross-process disable that
    // lands after it. Either way there is no promotion row and nothing to
    // retry, so the gate may still close.
    return false;
  }

  if (outcome.partition === "failed") {
    // SF-01: render: "none" makes reinstallPlugin CATCH its own throw and RETURN
    // a `failed` outcome (reinstall.ts handleSinglePluginFailure), so a genuine
    // re-materialize failure (EACCES / EIO / bridge failure) never throws and the
    // WR-02 wrapper -- which only catches THROWS -- never sees it. Surface a
    // plugin-scoped (failed) row on the same cascade instead of silently dropping
    // it, mirroring the applyPluginInstalls failure arm (T-55-02-02: carry ONLY
    // the closed-set reason, never the raw notes text). Prefer the pre-narrowed
    // `reasons[0]`; absent it, classify the composed notes. Return `true` so the
    // caller keeps the version gate OPEN and the scan retries this plugin next
    // load (symmetric with the WR-02 self-heal).
    outcomes.push({
      kind: "plugin-install-failed",
      scope,
      marketplace,
      plugin,
      reason:
        outcome.reasons?.[0] ?? classifyOrchestratorThrow(new Error(outcome.notes.join("; "))),
    });
    return true;
  }

  outcomes.push({
    kind: "plugin-backfilled",
    scope,
    marketplace,
    plugin,
    ...(outcome.version !== "" && { version: outcome.version }),
    dependencies: dependenciesFromInstall(outcome),
    // The re-resolved installability selects the row: a fully promoted plugin
    // (unsupported now empty) -> `installable` -> (installed); a partial
    // re-materialize stays `partially-available` -> (partially-installed).
    installable: resolved.state === "installable",
    // SEV-05 / D-69-04: carry the re-resolved dropped-component kinds so the
    // `(partially-installed)` row composes a factual `{reasons}` brace through the
    // shared `narrowUnsupportedKinds` seam. The `installable` arm projects to
    // the brace-less `(installed)` row, so its unsupported set is empty.
    unsupported: resolved.state === "partially-available" ? resolved.unsupported : [],
    // SURF-05 / WARN-01 / WR-04: the other two ledger signals, threaded exactly
    // as the install and enable arms thread them. The orphan-rewake fact rides
    // this backfill's own offline resolution; the malformed-frontmatter kinds
    // ride the reinstall outcome, because the re-materialize is what produced
    // them. Each is omitted when empty (NREG-01).
    ...(resolved.orphanRewake === true && { orphanRewake: true }),
    ...(outcome.degradedKinds !== undefined &&
      outcome.degradedKinds.length > 0 && { degradedKinds: outcome.degradedKinds }),
  });
  return false;
}

/**
 * BFILL-01 / NFR-5: re-resolve a recorded plugin from its cached marketplace
 * manifest with NO network (resolveStrict). Returns the resolved plugin, or
 * `undefined` ONLY when the entry is legitimately absent from the manifest or
 * fails the per-entry validator -- a benign "not backfillable this load".
 *
 * SF-02: a genuine I/O throw (manifest unreadable/corrupt) or a resolver throw
 * is NOT swallowed here. It propagates to the per-plugin catch in
 * `scanForceInstalledBackfills`, which surfaces a plugin-scoped `(failed)` row
 * AND keeps the version gate OPEN so the scan self-heals on the next load --
 * rather than being silently indistinguishable from a legitimately-absent entry
 * (which would wrongly close the gate). Per-plugin isolation there means the throw
 * does not unwind the scan past its healthy siblings.
 */
async function resolveRecordedPluginOffline(
  mp: StateMarketplaceRecord,
  plugin: string,
): Promise<import("../../domain/resolver.ts").ResolvedPlugin | undefined> {
  const manifest = await loadMarketplaceManifest(mp.manifestPath);
  const entry = manifest.plugins.find((p) => p.name === plugin);
  if (entry === undefined || !PLUGIN_ENTRY_VALIDATOR.Check(entry)) {
    return undefined;
  }

  return await resolveStrict(entry, { marketplaceRoot: mp.marketplaceRoot });
}

/**
 * D-68-03: true iff `resolved` is a STRICT superset of `recorded` (the supported
 * set grew for this plugin). A strictly larger set that still contains every
 * recorded kind means the supported-kind boundary moved in this plugin's favour;
 * an equal-or-smaller set is skipped so backfill never re-materializes (and
 * churns state.json) for a plugin whose boundary did not move.
 */
function supportedSetGrew(recorded: readonly string[], resolved: readonly string[]): boolean {
  if (resolved.length <= recorded.length) {
    return false;
  }

  const resolvedSet = new Set(resolved);
  return recorded.every((kind) => resolvedSet.has(kind));
}
