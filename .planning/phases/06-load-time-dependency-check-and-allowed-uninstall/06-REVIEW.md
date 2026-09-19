---
phase: 06-load-time-dependency-check-and-allowed-uninstall
reviewed: 2026-09-19T05:04:14Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - docs/dependency-resolution.md
  - docs/output-catalog.md
  - docs/plugin-enablement.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
findings:
  critical: 1
  warning: 8
  info: 3
  total: 12
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-09-19T05:04:14Z
**Depth:** standard
**Files Reviewed:** 19 source files (plus the 26 paired test/gate files read as evidence)
**Status:** issues_found

## Summary

Reviewed the LOAD-01 / LOAD-02 / LOAD-03 implementation: the new
`orchestrators/reconcile/dependency-verdict.ts` fixpoint walk, the eighth plan
bucket and its apply step, the `dependencyDisabled` record marker and its
clear/preserve asymmetry, three new closed-set reasons, and the removal of
uninstall's `dependents remain` refusal.

Toolchain gate is green and was run, not assumed: `npx tsc --noEmit` exits 0,
`npx eslint extensions tests eslint.config.js --max-warnings=0` exits 0,
`npx fallow health --fail-on-issues` exits 0, the 915 unit + architecture cases
across the touched suites pass, and direct pair coverage is 100% for
`dependency-verdict.ts` (38/38 branches), `apply.ts` (155/155) and
`uninstall.messaging.ts` (22/22). The fixpoint termination proof, the
cycle case with its own 5s bound, the lift/re-hold pair and the convergence
end-to-end cases are genuinely discriminating tests.

The defects below are the ones the gate cannot see. One is a report-loss on a
failure path the module explicitly built isolation for. The rest are a
half-wired plan bucket (`pending` never sees the verdict, and two projection
sites never learned the bucket exists), a fail-closed posture that now fires on
every reload for an ordinary stale record, three comments that state invariants
the code does not hold, and a missing architectural gate on a file that asserts
the property the gate exists to pin.

## Critical Issues

### CR-01: A throw in the marker stamp discards every dependency-disable row after the plugins were already disabled

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:802-841`, called at `:958`

`applyDependencyDisables` accumulates its rows into a local `rows` array and
pushes them into `outcomes` only on the last line, *after* the stamp write:

```ts
  if (transitioned.length > 0) {
    await stampDependencyDisabled(opts, plan.scope, transitioned);
  }

  outcomes.push(...rows);
```

`stampDependencyDisabled` takes its own `withStateGuard` lock and can throw
`StateLockHeldError` (`proper-lockfile` is `retries: 0`) or an EACCES — exactly
the two failures the call-site comment at `:955-957` names as the reason for
wrapping the step in `runScopeIsolated`. But `runScopeIsolated`
(`orchestrators/reconcile/backfill.ts:144-160`) swallows the throw and pushes a
single `invalid-block` row for `state.json`. Because `outcomes.push(...rows)`
never runs, every `plugin-dependency-disabled` row and every
`plugin-disable-failed` row produced by this step is lost.

The disables themselves are *not* rolled back: `setPluginEnabled` already
committed each one (record flipped, artifacts unstaged) before the stamp was
attempted. The user therefore gets plugins silently removed from their session
plus one generic `state.json` failure row, with no plugin names, no
`{dependency unsatisfied}` brace and no remedy — the precise outcome LOAD-01
exists to prevent. The next pass re-derives the verdict and re-plans, so the
disable is re-attempted with `status: "skipped"` (idempotent) and *still*
produces no row: the explanation is lost permanently, not just for one pass.

The sibling `applyPluginToggles` (`:683-741`) pushes into `outcomes` inside the
loop; this step is the only one that defers, and the deferral buys nothing — no
other producer appends to `outcomes` between the loop and the stamp, so the
ordering is identical either way.

**Fix:**

```ts
    if (result.status === "disabled") {
      transitioned.push(op);
      outcomes.push(dependencyDisabledOutcome(op, result.version));
    } else if (result.status === "failed") {
      outcomes.push({
        kind: "plugin-disable-failed",
        scope: op.scope,
        marketplace: op.marketplace,
        plugin: op.plugin,
        reason: result.reason,
      });
    }
  }

  if (transitioned.length > 0) {
    await stampDependencyDisabled(opts, plan.scope, transitioned);
  }
}
```

Drop the `rows` local entirely and add a case that injects a throwing
`saveState`/held lock into the stamp write and asserts the disable rows still
reach the cascade beside the `invalid-block` row.

## Warnings

### WR-01: `/claude:plugin pending` previews `(will enable)` for a plugin the next reload holds down

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts:207`

`pending.ts` calls `planReconcile(mergedViewForPlanning(...), state, scope)` with
three arguments, so it takes the `NO_HELD_DECLARERS` default
(`plan.ts:742`). With an empty verdict,
`isHeldByUnsatisfiedDependency` (`plan.ts:424-426`) always returns `false`, so
`classifyDeclaredPlugin` (`plan.ts:522-529`) pushes a
`PlannedPluginEnable` for every record that is declared-enabled and
recorded-disabled — including exactly the records the check is holding down.

The result: a user with a held-down plugin sees `◍ <plugin> (will enable)` from
`pending` on every invocation, and the reload that follows does not enable it.
This directly contradicts DIFF-01 SC #2 (pending previews what the next reload
applies). The inverse gap is the same root cause: `pending` also cannot preview
the `(will disable)` rows LOAD-01 will produce.

This is recorded as backlog item `PENDING-VERDICT-01` (D-06-25), so it is a
known deferral rather than an oversight — but it ships as a wrong preview on a
user-facing read surface, so it belongs in the review record.

**Fix:** either have `pending.ts` compute its own verdict (it already holds the
scope's `state` and `ScopedLocations`, and the walk is offline), or suppress the
enable row for a record carrying `dependencyDisabled === true` in the
verdict-less path so the preview at least does not assert an action that will
not happen.

### WR-02: Two plan-consuming projections never learned about the eighth bucket

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts:454-464` and `:398-430`

`isReconcilePlanListEmpty` enumerates `marketplacesToRemove`, `pluginsToInstall`,
`pluginsToUninstall`, `pluginsToEnable`, `pluginsToDisable` and
`sourceMismatches` — not `pluginsToDependencyDisable`. The pending projection
loop in the same file has a `for (const o of plan.pluginsToDisable)` arm and no
arm for the new bucket.

Both are inert *today* only because `pending.ts` is the sole consumer and never
populates the bucket (WR-01). The moment `PENDING-VERDICT-01` is implemented,
a scope whose only pending change is a load-time disable will be reported as
`Pending: next reload will apply 0 actions.` and its rows will vanish from the
projection. This is the same "optional-field silent-omission" class the project
has already shipped repeatedly: adding a member to a closed structure compiles
clean at every derivation site.

**Fix:** add `p.pluginsToDependencyDisable.length === 0 &&` to
`isReconcilePlanListEmpty` and a `will disable` arm for the bucket in the
projection now, while the bucket is still empty and the change is behaviour-free,
rather than as part of the later `pending` work.

### WR-03: One stale record aborts the whole scope's check and emits an error row on every reload

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts:192-195, 255-271`; `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:982-1010`

`buildScopeDeclarationDetail` returns the failure arm on the *first* record whose
declarations cannot be established, and `readRecordDeclarations` treats
`lookupDeclaredPlugin(manifest, name).kind === "absent"` as such a failure
(`"not declared by its marketplace"`). A plugin record whose marketplace has
since dropped that plugin from its `marketplace.json` — ordinary drift, not
corruption — therefore:

1. aborts the satisfaction walk for the **entire scope**, so no other plugin in
   that scope is ever checked (the LOAD-01 protection is off), and
2. makes `reportUnreadableDeclarer` push a `plugin-disable-failed` outcome with
   reason `unreadable`, which renders as `⊘ <plugin> (failed) {unreadable}` at
   **error** severity — on every single reload, forever, for a plugin nothing
   tried to disable and that is otherwise working.

`tests/orchestrators/reconcile/apply.test.ts:4262` pins exactly this shape, and
`tests/index.test.ts:677-687` had to start writing a `marketplace.json` into its
seed precisely because the previously-tolerated state now trips this path — that
diff is the smell.

Both consequences break RECON-05 (a reload over an unchanged tree must be
silent) and the row's `plugin-disable-failed` kind mislabels a plugin that is
running fine as a failed disable.

**Fix:** separate the two failure classes. A declarer that cannot be read should
be skipped as a *declarer* (its own declarations unknown) without ending the
walk for the rest of the scope — the fail-closed obligation is "never read it as
'declares nothing' when deciding to remove something", which does not require
abandoning the other records' verdicts. Failing that, at minimum suppress the
repeat emission (the row states an unchanged fact) and classify
`"not declared by its marketplace"` at warning rather than error.

### WR-04: `plan.ts` claims to be the only reader of the persisted marker; it is not

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:628`

```
 * This is the ONLY place the stored marker is read.
```

`extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts:125`
also reads it:

```ts
  return isRecordedButDisabled(record) && record.dependencyDisabled !== true;
```

There are exactly two readers repo-wide (`rg dependencyDisabled` confirms).
The claim is load-bearing — a maintainer trusting it will reason that the
verdict cannot be influenced by persisted state, which is precisely what
`isDisabledIndependently` does do (deliberately, and documented at
`dependency-verdict.ts:106-120`).

**Fix:** restate as the true invariant, e.g. "This is the only place the marker
decides an ACTION; `dependency-verdict.ts::isDisabledIndependently` reads it to
tell the check's own hold from a user's disable, and never to decide whether the
hold continues."

### WR-05: The step-7 ordering rationale states something the code cannot do

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:916-920`

```
 *   7. ... and after the install step so a plugin installed in this
 *      same pass is held down in this same pass rather than the next one.
```

`plan.pluginsToDependencyDisable` is built in the read pass
(`apply.ts:210`, `plan.ts:648-691`) from the satisfaction verdict, which is
computed over the pre-install state snapshot. A plugin installed during step 4
has no record in that snapshot, is therefore not a declarer in
`buildScopeDeclarationDetail`'s map, and cannot appear in the bucket. It is held
down on the *next* pass, not this one.

The first half of the sentence (running after step 6 so a config-disabled record
answers idempotently) is correct; the second half is not, and it will send the
next maintainer looking for a same-pass guarantee that does not exist.

**Fix:** drop the install clause and, if same-pass holding is desired, record it
as a separate known gap.

### WR-06: `dependency-verdict.ts` asserts it is network-free but no gate pins it

**File:** `tests/architecture/gate-targets.ts:38-135` (NETWORK_FREE_TARGETS); claim at `extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts:3-8, 40-52`

The new module's header states the walk is "computed offline as pure data" and
composes `dependency-index.ts`, whose own header says "the network-free gate
pins this file so nothing can" name a git surface. `dependency-index.ts`,
`plan.ts`, `notify.ts`, `pending.ts` and `uninstall.ts` are all in
`NETWORK_FREE_TARGETS`. `dependency-verdict.ts` is not.

The phase did add the new file to `DISABLED_STATE_TARGETS`
(`gate-targets.ts:374-377`), so the omission from the network gate reads as an
oversight rather than a decision. CONVENTIONS.md is explicit that a claimed
architectural property wants a gate that would fire on a planted violation; this
one has a comment only. The module sits directly on the load path, where NFR-5
matters most.

**Fix:** add
`"extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts"`
to `NETWORK_FREE_TARGETS` with a comment mirroring the `dependency-index.ts`
entry's rationale.

### WR-07: A non-semver recorded version now silently disables a working plugin at load time

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts:186-197` (via `domain/dependency-range.ts::recordedVersionSatisfies:265-268`)

`recordedVersionSatisfies` runs the recorded version through
`valid(recorded) ?? coerce(recorded)?.version` and returns `false` when the
result does not satisfy the range. This project records PI-7 fallback versions
of the form `hash-<12hex>` and `sha-<12hex>` for sources with no declared
version. `coerce` on such a string extracts an arbitrary digit run, so a
dependency recorded as, say, `hash-1a2b3c4d5e6f` will fail essentially any
non-wildcard declared range.

D-03-04 records this coercion as an accepted tradeoff, but that acceptance was
written for install-time *candidate selection*, where the cost is a failed
install the user is looking at. Here the cost is different in kind: an already
installed, already working dependent is disabled and unstaged on the next
`/reload`, with a remedy (`Update "x@mp" to satisfy >=2.0.0 <3.0.0-0`) the user
cannot act on because the dependency has no semver version to move to. The
header at `dependency-verdict.ts:29-33` inherits the tradeoff by reference
without noting that the consequence changed.

**Fix:** decide explicitly. Either exempt a recorded version that
`semver.valid()` rejects from the out-of-range arm (treat "cannot be compared"
as satisfied, consistent with the `isUnconstrainedRange` short-circuit right
above it), or keep the behaviour and document it in
`docs/dependency-resolution.md` so an operator who hits it can recognize it.
Silently inheriting an install-time tradeoff into an auto-disable is the option
that should not stand.

### WR-08: The read-pass state lock is now held across a per-record filesystem walk on every session start

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:196-213`

`buildScopeSatisfactionVerdict` is awaited inside `readPassForScope`'s
`withLockedStateTransaction` closure. The walk does one manifest lookup plus one
own-manifest probe per recorded plugin (`dependency-index.ts:179-215`), so the
critical section now scales with the number of installed plugins rather than
being a bounded config+state read.

`proper-lockfile` is configured `retries: 0` and is not re-entrant, so two Pi
processes starting concurrently against the same scope now have a materially
wider window in which the second gets `ELOCKED` → `StateLockHeldError`. That is
caught (`classifyReadPassThrow`) and degrades to an `invalid-block` row, which
means **reconcile does not run at all for that scope on that session** — a
silently skipped convergence pass, not just a slow one.

The in-code justification ("the closure is already async and already reads the
filesystem through `migrateFirstRunConfig` and `loadMergedScopeConfig`") is true
but compares an O(1) read to an O(records) one.

**Fix:** if the snapshot-consistency argument for computing inside the lock
holds (it does), at least bound the exposure — e.g. skip the walk entirely when
the scope records zero plugins, and consider whether the own-manifest probes can
be hoisted out of the locked region and re-validated cheaply against the
snapshot afterwards.

## Info

### IN-01: The widened cause-trailer predicate is guarded by producer discipline, not by construction

**File:** `extensions/pi-claude-marketplace/shared/notification-grammar.ts:1636-1656`

`composePluginLinesWith` now renders `renderIndentedCauseChain(p.cause, "    ")`
for `disabled` and `uninstalled` rows in addition to `failed` and
`manual recovery`. That chain walk does not redact absolute paths (stated at
`apply-outcomes.ts:210-214`), so the safety of the two new channels rests
entirely on every producer of a `(disabled)` / `(uninstalled)` row continuing to
omit `cause` or to build it from token-validated `name@marketplace` keys. Today
that holds (all nine producers checked), but it is a convention recorded in
comments rather than a type or a gate. The same edit also now runs
`manualRecoveryLeaks(p.cause)` over those two statuses, where a
`ManualRecoveryError` can never be the cause — harmless, but dead work.

**Fix:** consider a narrow `redactedCause` helper at the two new producers, or a
gate case asserting that no `disabled` / `uninstalled` producer outside
`reconcile/apply-outcomes.ts` and `plugin/uninstall.messaging.ts` sets `cause`.

### IN-02: `NO_HELD_DECLARERS` freezes the wrapper but not the array

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:742`

```ts
const NO_HELD_DECLARERS: ScopeSatisfactionVerdict = Object.freeze({ ok: true, unsatisfied: [] });
```

`Object.freeze` is shallow: the shared `unsatisfied` array is mutable at runtime.
Nothing mutates it today (the type is `readonly UnsatisfiedDeclaration[]`), but
the whole point of naming the constant at module scope was to share one instance
across every verdict-less call.

**Fix:** `Object.freeze({ ok: true, unsatisfied: Object.freeze([]) })`, or drop
the outer freeze and rely on the readonly type consistently.

### IN-03: A check-held record is indistinguishable from a user disable outside the reconcile cascade

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts` / `info.ts` (unchanged this phase)

The `dependencyDisabled` marker is read only by the planner and the verdict
walk. `list` and `info` render a held-down plugin as a plain `(disabled)` row,
identical to one the user disabled. Once the reconcile cascade scrolls away, the
only way to recover the reason is another `/reload`. Worth a follow-up item if
operators report confusion; not a defect in this phase's scope.

---

_Reviewed: 2026-09-19T05:04:14Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
