---
phase: 74-bulk-update-grammar-refinement
reviewed: 2026-06-30T04:25:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - extensions/pi-claude-marketplace/shared/notify.ts
  - extensions/pi-claude-marketplace/shared/notify-context.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - docs/output-catalog.md
  - docs/messaging-style-guide.md
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: resolved
disposition:
  WR-01: fixed (commit 5e4f923e)
  WR-02: fixed (commit 36aa546e)
  WR-03: deferred (pre-existing dispatchRow seam; not introduced by Phase 74)
  IN-01: deferred (info-level hardening)
  IN-02: deferred (info-level maintainability)
---

> **Fix disposition (2026-06-30):** WR-01 (spurious no-op headline after a
> phase-3a abort) and WR-02 (tally-override seam hardened to a dedicated
> `notifyUpdateWithContext` wrapper) were fixed with a regression test;
> `npm run check` stayed green. WR-03 is pre-existing (the `dispatchRow`
> `readonly`-mutation + empty `catch {}` predates Phase 74, which only widened
> reachability) and was deferred per the surgical-changes guideline. IN-01 and
> IN-02 are info-level polish, deferred to a follow-up.


# Phase 74: Code Review Report

**Reviewed:** 2026-06-30T04:25:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the Phase 74 bulk-update grammar refinement (commits c5913f10, 543d4d20,
0ba03246) for UGRM-01 (suppress per-plugin `(skipped) {up-to-date}` rows on bulk
update + drop emptied marketplace groups), the never-silent `Plugin update:
nothing to update` no-op headline, and UGRM-02 (opt-in `tally` override on
`CascadeNotificationMessage` counting realized transitions only).

The three load-bearing properties the task asked me to verify all hold under trace:

1. **Skip-row suppression is partition-scoped and cardinality-gated.** The
   suppression predicate (`update.ts:1877`) is exactly
   `cardinality === "plural" && outcome.partition === "unchanged"`. It does NOT
   touch the `skipped` partition (so the `force-upgradable` decline survives) and
   does NOT touch the single-target path. A single-target up-to-date update keeps
   its `(skipped) {up-to-date}` row: with `cardinality === "single"` the `continue`
   is skipped, the `unchanged` partition maps to `(skipped) {up-to-date}` at
   `update.ts:1746-1757`, the no-op block is gated `cardinality === "plural"`, and
   `composeTally` returns `""` for a non-plural cardinality. No over-suppression.

2. **The no-op headline fires for every zero-realized-transition bulk case.** The
   gate `cardinality === "plural" && updatedCount === 0 && !hasErrorOrWarningRow`
   (`update.ts:1953`) covers both the empty post-suppression cascade (all
   up-to-date) and the info-skip-only survivor (force-upgradable decline). The
   headline is a hard-coded constant folded through the tally slot via
   `emitUpdateNoOpCascade` (`notify.ts:3429-3464`), so a `tally {count: 0}`
   collapse-to-`""` can never silently vanish the line. Confirmed against catalog
   states `all-up-to-date-noop` and `skip-force-upgradable-bulk` and the
   full-body test assertion at `update.test.ts:3241-3248`.

3. **The tally override is update-scoped and does not leak.** `tally?` is read
   ONLY in `composeTally` (`notify.ts:2637-2645`); the legacy info-row success
   math runs verbatim in the `else` branch when `tally` is absent. Every existing
   caller (install / reinstall / marketplace / import) omits the arg, so their
   summaries stay byte-identical. `notifyReconcileAppliedWithContext` does not
   forward a tally. The failure/warning categories still derive from
   `countRowsBySeverity`, so a mixed cascade composes `1 failure, 1 updated`.

The findings below are the residual edge-case and robustness gaps surfaced under
adversarial trace. None block the core contract, but the WARNING items are real
behavioral divergences worth fixing before this surface is considered settled.

## Warnings

### WR-01: Phase-3a abort with only up-to-date predecessors emits a spurious "nothing to update" headline after the failure notification

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:368-371`, `456-465`, `1953-1961`

**Issue:** When a phase-3a aggregate failure interrupts a bulk batch
(`isPhase3aAggregateFailure` is true), the failing plugin has already fired its
own `notifyDirectFailure` and is NOT pushed into `outcomes`. The batch then calls
`renderUpdateCascadeIfAny(ctx, pi, outcomes, cardinality)`, which emits a cascade
for the already-accumulated successful outcomes whenever `outcomes.length > 0`.

If every accumulated outcome ordered before the phase-3a failure was the
`unchanged` partition (the plugins iterated first were up-to-date, then a later
plugin phase-3a-failed), then in `renderUpdateCascadeAndNotify`:
`updatedCount === 0`, all `unchanged` rows are suppressed (bulk), and
`hasErrorOrWarningRow` is `false` (the failure lives in a separate, already-fired
notification — not in `outcomes`). The no-op gate at line 1953 therefore fires and
emits a SECOND notification reading `Plugin update: nothing to update` — directly
after a failure notification for the same `update` invocation. The user sees a
failure followed by "nothing to update," which is contradictory and misleading: a
plugin *was* operated on and *did* fail.

`outcomes.length > 0` is satisfiable here precisely because `unchanged` outcomes
ARE pushed to `outcomes` (only the phase-3a failure is withheld), so
`renderUpdateCascadeIfAny` proceeds rather than short-circuiting.

**Fix:** Gate the no-op headline on the batch having NOT aborted, e.g. thread an
`abortedByFailure` flag from the phase-3a branch into `renderUpdateCascadeIfAny`
and skip the no-op emission when set (fall through to the suppressed/empty body
which, for an all-`unchanged` accumulator, renders nothing — acceptable since the
failure was already reported). Alternatively, in the phase-3a abort path call a
render variant that never emits the never-silent headline:

```ts
// in renderUpdateCascadeIfAny, distinguish the abort caller:
function renderUpdateCascadeIfAny(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  outcomes: readonly TargetedOutcome[],
  cardinality: "single" | "plural",
): void {
  // A phase-3a abort already fired its own failure notification; suppress the
  // never-silent no-op headline so the user does not see "failure" + "nothing
  // to update" for the same invocation.
  if (outcomes.length > 0) {
    renderUpdateCascadeAndNotify(ctx, pi, outcomes, cardinality, /* allowNoOpHeadline */ false);
  }
}
```

### WR-02: `notifyWithContext`'s positional `tally` parameter is one type-only seam away from leaking into the wrong operation

**File:** `extensions/pi-claude-marketplace/shared/notify-context.ts:140-177`

**Issue:** `notifyWithContext` now takes seven positional parameters, the last
three of which (`kind?`, `cardinality?`, `tally?`) are all optional and the final
two share overlapping shapes at the call site. The only thing keeping the
update-scoped `tally` from being passed by a non-update caller is convention — the
parameter is structurally available to every caller. The design intent ("only the
bulk-`update` path passes it") is documented in a comment but not enforced by the
type system. A future call site that means to pass `cardinality` but mis-positions
its arguments (or copies the update call site) would silently attach a `tally`
override to install/reinstall/marketplace/import, changing their byte-frozen
summaries. The widening is invisible because `composeTally` happily renders any
`{ verb, count }` it receives.

This is a latent-coupling defect, not a live bug (no current non-update caller
passes it), but the byte-level output contract makes the blast radius large if it
regresses.

**Fix:** Make the override structurally update-only rather than a shared positional
param. Either (a) introduce a dedicated `notifyUpdateWithContext` wrapper that owns
the `tally` arg (mirroring `notifyUpdateNoOpWithContext`), leaving
`notifyWithContext`'s signature unchanged for every other op; or (b) collapse the
three trailing optionals into a single options object
(`{ kind?, cardinality?, tally? }`) so a mispositioned argument is a compile error
rather than a silent shape match.

### WR-03: `dispatchRow` mutates a `readonly` row field via a swallowed-throw cast — pre-existing, but now on the live no-op emission path

**File:** `extensions/pi-claude-marketplace/shared/notify-context.ts:292-298`

**Issue:** `dispatchRow` writes `(p as { severity?: "error" }).severity = "error"`
inside a `try/catch {}` that silently swallows the strict-mode throw on a
frozen/sealed object. Phase 74 routes the new `emitUpdateNoOpCascade` body through
`dispatchRow` (via `notifyUpdateNoOpWithContext` → `emitUpdateNoOpCascade` →
`composePluginLinesWith` → `renderPluginRowBody`), so this mutation seam is now
reachable on the no-op surface as well as the normal cascade. The empty `catch {}`
is an explicit anti-pattern (silent failure) and the `readonly`-field write defeats
the type model's immutability guarantee. If the write succeeds it mutates a row the
caller may still hold a reference to; if it throws it is silently dropped and the
envelope severity floor is quietly not applied.

Because this is a defense-in-depth path for an out-of-band drift that type-checked
call sites cannot reach, it is a WARNING rather than a BLOCKER — but it is worth
noting the Phase 74 changes widened the set of emitters that hit it.

**Fix:** Compute the fallback severity without mutating the input row — e.g. have
`dispatchRow` return the rendered line AND a severity contribution, or accumulate a
side-channel `fellBackToError` flag the emitter folds into `computeSeverity`,
rather than reaching into a `readonly` field through a cast. At minimum, the empty
`catch {}` should record the swallowed condition (a comment exists, but the
silent-drop behavior remains).

## Info

### IN-01: `composeTally` trusts `tally.count` without a non-negative guard

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:2637-2645`

**Issue:** `composeTally` renders the override category whenever
`message.tally.count > 0`. The count is supplied by the orchestrator as
`outcomes.filter(... partition === "updated").length`, which is structurally
non-negative today, so no live bug exists. But `composeTally` is a shared seam and
the contract ("realized transitions only") would silently mis-render if a future
caller passed a derived/decremented count. A defensive `Math.max(0, count)` or an
explicit comment that the field is a count (≥ 0 by construction) would harden the
seam.

**Fix:** Either assert/clamp the count, or add a one-line invariant comment stating
`tally.count` is a row count and therefore `>= 0` by construction.

### IN-02: `notifyUpdateNoOpWithContext` duplicates the widening-cast comment and envelope-build boilerplate from `notifyWithContext`

**File:** `extensions/pi-claude-marketplace/shared/notify-context.ts:195-215`

**Issue:** The new `notifyUpdateNoOpWithContext` repeats the
`const marketplaces: readonly MarketplaceNotificationMessage[] = rows;` widening
seam and the envelope-literal construction verbatim from `notifyWithContext`. This
is acceptable single-use duplication, but as the third near-identical
`notify*WithContext` wrapper (alongside `notifyWithContext` and
`notifyReconcileAppliedWithContext`) the envelope-build + widening boilerplate is a
candidate for a small shared helper. Not a defect; noted for maintainability since
each copy independently restates a subtle type-safety invariant in prose.

**Fix:** Optionally extract a private `buildCascadeEnvelope(context, rows, extras)`
helper the three wrappers share, so the widening-safety rationale lives in exactly
one place.

---

_Reviewed: 2026-06-30T04:25:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
