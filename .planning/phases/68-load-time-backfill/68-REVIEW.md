---
phase: 68-load-time-backfill
reviewed: 2026-06-27T00:00:00Z
depth: deep
files_reviewed: 8
files_reviewed_list:
  - extensions/pi-claude-marketplace/shared/extension-version.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/domain/resolver.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: warnings_resolved
resolved:
  WR-01: 8093f48d
  WR-02: fd9282f3
  WR-03: df53b2df
---

# Phase 68: Code Review Report

**Reviewed:** 2026-06-27
**Depth:** deep
**Files Reviewed:** 8
**Status:** issues_found

## Summary

The load-time backfill implementation is correct against all six phase-specific
correctness risks. Verified directly:

1. **Stamp-on-gate-open is unconditional** — `applyBackfillForScope` always calls
   `withStateGuard(... lastReconciledExtensionVersion = EXTENSION_VERSION)` after
   the scan when the gate opened, regardless of how many (or zero) plugins were
   backfilled. The dedicated test passes.
2. **`loadState` normalization threads the stamp** — the rebuilt
   `{ schemaVersion: 2, ... }` object conditionally carries
   `lastReconciledExtensionVersion` when it is a string; the field is no longer
   silently dropped.
3. **Offline (NFR-5)** — the scan re-resolves through `resolveStrict` (cache-only)
   and re-materializes through `reinstallPlugin`, which also uses `resolveStrict`;
   the NFR-5 no-network test passes.
4. **Single notify (RECON-04)** — promotion rows are pushed onto the shared
   `outcomes[]` and ride the one existing `buildReconcileAppliedCascade` notify;
   the combined backfill+install test asserts exactly one cascade.
5. **No outer lock / atomic / containment** — backfill runs in the no-outer-lock
   apply region; `reinstallPlugin` and the stamp `withStateGuard` each self-lock;
   the stamp routes through `saveState` (SPLIT-02), no bare `atomicWriteJson`.
6. **`schemaVersion` stays 1|2** — the stamp is `Type.Optional(Type.String())`,
   additive, no bump; old docs validate unchanged.

`npm run typecheck` is clean and the 9 backfill tests pass. No Blockers. The
findings below are robustness/edge concerns that do not corrupt state or leak
network, but two of them can defeat the gate-close invariant or violate the
phase's own stated WR-05 contract on a narrow path.

## Warnings

### WR-01: Unsolicited `state.json` creation on a config-present / state-absent scope (WR-05 gap)

> **RESOLVED in `8093f48d`.** `ScopeReadResult` now carries `stateExisted`
> (from the existing on-disk probe). `applyBackfillForScope` skips the stamp
> write when no state.json exists on disk AND no force-installed plugin can be
> promoted (`hasForceInstalledPlugin`), so an absent-on-disk state.json is never
> created merely to record the stamp. Reconciled with D-68-03: an EXISTING
> state.json is still stamped on gate-open even with zero promotions (so the gate
> does not reopen every load); only the absent-file/no-work case is left
> untouched. The code's WR-05 comment was correct -- the gate logic was widened
> to honor it. Regression: `WR-01 / WR-05 ...` in `backfill.test.ts`.

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:824-836` (and `readPassForScope` `:214-219`)
**Issue:** The pristine-scope guard in `applyBackfillForScope` is
`if (state === undefined) return;`. But `readPassForScope` only leaves `state`
undefined for a strictly-pristine scope (no `state.json` **and** no config,
`:148-151`) or the invalid-config arm (`:210-212`). For a scope where
`state.json` is **absent but a config file is present** (`stateExists === false &&
configExists === true`), the read pass enters `withLockedStateTransaction`, loads
`DEFAULT_STATE` (ENOENT default), and returns it as a **defined** `state` at
`:219`. If the resulting plan is empty (e.g. an empty `claude-plugins.json` or a
hand-authored `claude-plugins.local.json` that declares nothing to install), the
gate opens (absent stamp != `EXTENSION_VERSION`), the scan finds nothing, and the
unconditional `withStateGuard` stamp write **creates a brand-new `state.json`**
(`{ schemaVersion: 2, lastReconciledExtensionVersion, marketplaces: {} }`) where
none existed. This contradicts the WR-05 invariant the code's own comments assert
("backfill MUST NOT create state.json there"). The `68-04-SUMMARY` only validates
WR-05 for the `state === undefined` case.
**Fix:** Gate the stamp write on the prior on-disk existence of `state.json`, not
on `state === undefined`. Either carry a `stateExisted: boolean` onto
`ScopeReadResult` (set from the `stateExists` probe already computed at
`readPassForScope:145`) and skip the stamp when it is false with empty
marketplaces, or only stamp when `state` came from an existing file:
```ts
// in ScopeReadResult: readonly stateExisted: boolean;
// in applyBackfillForScope, after the version-gate check:
if (!readResult.stateExisted && Object.keys(state.marketplaces).length === 0) {
  return; // nothing recorded and no state.json on disk -- do not create one (WR-05)
}
```

### WR-02: Backfill step is not throw-guarded — a stamp-write throw aborts the cascade and leaves the gate open

> **RESOLVED in `fd9282f3`.** The scope loop now calls
> `applyBackfillForScopeIsolated`, which wraps the scan + stamp in the same
> per-entry coercion the rest of the apply pass uses (mirroring
> `rebuildScopeRoutingTableIsolated`): a transient `StateLockHeldError`/EACCES
> becomes a structured `invalid-block` row (subject `state.json`, closed-set
> reason via `classifyReadPassThrow`) instead of propagating. The gate stays
> open and self-heals next load (retry-safe, NFR-3); the sibling scope's
> accumulated cascade is never aborted; NFR-1 atomicity is unaffected (the failed
> write never committed). Regression: `WR-02 ...` in `backfill.test.ts` (held
> scope lock). The `runPostSuccessMaintenance` exposure noted in the finding is
> covered by the same wrapper, since it propagates through `applyBackfillForScope`.

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1042` (call site) and `:830-835` (stamp write)
**Issue:** In the `applyReconcile` scope loop, the per-scope try/catch wraps only
`readPassForScope` (`:1002-1025`). `applyPlan` (`:1035`) and
`applyBackfillForScope` (`:1042`) run outside any try/catch. `applyPlan` is safe
because its sub-operations each coerce per-entry throws into typed `failed`
outcomes. `applyBackfillForScope` does **not** apply that discipline to its own
stamp write: the unconditional `withStateGuard(loc, ...)` can throw
`StateLockHeldError` (a concurrent process holds the scope lock) or an EACCES on
`saveState`. Because nothing catches it, the throw propagates out of
`applyReconcile`, aborting the entire single cascade for **both** scopes — and,
critically, the stamp is never written, so the gate stays **open** and the
offline scan re-fires on every subsequent load until the write finally succeeds.
The same exposure exists for `runPostSuccessMaintenance` inside `reinstallPlugin`
on the `render: "none"` success path (`reinstall.ts:276`, awaited unguarded).
This partially re-opens phase risk #1 ("the gate must close or it re-scans
forever").
**Fix:** Wrap the scan + stamp in the same per-entry coercion the rest of the
apply pass uses, so a transient lock-held / EACCES surfaces as a structured row
(or is swallowed as a benign retry) instead of aborting the cascade:
```ts
try {
  await applyBackfillForScope(opts, scope, readResult, outcomes);
} catch (err) {
  // Coerce to a structured failure row (mirror the readPass catch); the gate
  // stays open and retries next load -- retry-safe (NFR-3), never aborts the
  // sibling scope's accumulated cascade (WR-01 isolation).
  outcomes.push({ kind: "invalid-block", scope, basename: "state.json",
    reason: classifyReadPassThrow(err), cause: new Error(redactAbsolutePaths(errorMessageOf(err))) });
}
```

### WR-03: Scan iterates the stale read-pass snapshot, not post-`applyPlan` state — possible duplicate/redundant promotion row

> **RESOLVED in `df53b2df`.** `scanForceInstalledBackfills` now builds an
> `alreadyTouched` set from the accumulated outcomes for this scope (every row
> carrying a `plugin`) and skips any plugin already represented before calling
> `reinstallPlugin`, so a single load can never emit two rows for one plugin nor
> clobber a just-applied transition with a redundant overwrite. Note: the
> specific ENABLE path in the finding is not reachable through the real planner
> (`isRecordedButDisabled` requires `installable === true`, which a force-installed
> plugin is not), but the dedupe is the correct general guard; the regression
> (`WR-03 ...` in `backfill.test.ts`) injects a same-load `plugin-enabled` outcome
> via a test seam to exercise it directly.

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:838-853` (`scanForceInstalledBackfills`)
**Issue:** `applyBackfillForScope` scans `readResult.state`, the snapshot captured
during the read pass **before** `applyPlan` ran. `applyPlan` may have mutated
`state.json` in the same load (install / enable / uninstall). The uninstall case
is handled defensively (`reinstallPlugin` re-reads fresh state and returns a
`skipped` partition, which `maybeBackfillPlugin` drops at `:899-903`). But the
**enable** case is not: if `applyPlan` re-enables a force-installed plugin (which
re-materializes it via install and emits an `installed`/promotion outcome), the
stale snapshot still shows that plugin as force-installed, so backfill re-resolves
it, and — if its supported set grew — re-materializes it a second time and pushes
a `plugin-backfilled` outcome for the same plugin. The cascade can then show the
same plugin twice in one load (one row from the enable, one from the backfill),
plus a redundant overwrite write.
**Fix:** Re-read fresh state for the scan after `applyPlan`, or skip plugins
already represented in `outcomes` for this scope/marketplace/plugin tuple before
calling `reinstallPlugin`. Minimal version — dedupe against accumulated outcomes:
```ts
const alreadyTouched = new Set(
  outcomes.filter((o) => "plugin" in o && o.scope === scope)
    .map((o) => `${o.marketplace} ${o.plugin}`));
// skip when alreadyTouched.has(`${marketplace} ${plugin}`)
```

## Info

### IN-01: `(force-installed)` backfill row emits empty `reasons` — user sees no degradation detail

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts:515-526`
**Issue:** The partial-backfill arm pushes `reasons: []`, so the rendered
`(force-installed)` row carries no `{contains <kind>}` marker explaining which
components are still unsupported. A user reading the cascade sees a degraded row
with no indication of what remains skipped. The inline comment acknowledges the
byte-exact token is "frozen later" (deferred to Phase 70 / the SEV ladder in
Phase 69), so this is an intentional deferral, but it is worth flagging that the
row is currently information-poor.
**Fix:** Carry the re-resolved `unsupported` kinds onto `PluginBackfilledOutcome`
and thread them into `reasons` when Phase 69/70 finalizes the token; tracked here
so it is not lost.

### IN-02: Inline `import("...").ResolvedPlugin` type annotation instead of a top-level `import type`

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:880-882` (`resolveRecordedPluginOffline` return type)
**Issue:** The return type is written as
`Promise<import("../../domain/resolver.ts").ResolvedPlugin | undefined>` using an
inline dynamic-import type, while the rest of the file (and the value import
`resolveStrict` added in this diff) imports from `domain/resolver.ts` at the top.
The inline form is inconsistent with the file's import style and harder to grep.
**Fix:** Add `ResolvedPlugin` to a top-level `import type { ResolvedPlugin } from
"../../domain/resolver.ts";` and reference it bare in the signature.

### IN-03: `supportedSetGrew` compares array lengths — a duplicate kind in `resolved` yields a false "grew"

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:868-876`
**Issue:** The guard `if (resolved.length <= recorded.length) return false;` then
`recorded.every((kind) => new Set(resolved).has(kind))` treats array length as a
set-size proxy. If `resolved` ever contains a duplicate kind (e.g. `["a","a"]`
vs recorded `["a"]`), the length check passes (2 > 1) and `every` is satisfied,
so it reports "grew" and triggers an unnecessary overwrite reinstall even though
the genuine supported set ({a}) is unchanged. The resolver is not expected to emit
duplicate kinds, so this is defensive only.
**Fix:** Compare deduped set sizes rather than raw array lengths:
```ts
const recordedSet = new Set(recorded);
const resolvedSet = new Set(resolved);
if (resolvedSet.size <= recordedSet.size) return false;
return [...recordedSet].every((k) => resolvedSet.has(k));
```

---

_Reviewed: 2026-06-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
