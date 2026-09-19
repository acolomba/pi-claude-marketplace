---
phase: 06-load-time-dependency-check-and-allowed-uninstall
reviewed: 2026-09-19T08:40:00Z
depth: standard
iteration: 2
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
  critical: 0
  warning: 6
  info: 3
  total: 9
status: issues_found
---

# Phase 06: Code Review Report (iteration 2)

**Reviewed:** 2026-09-19T08:40:00Z
**Depth:** standard
**Files Reviewed:** 19 source files, plus `tests/architecture/gate-targets.ts`,
`tests/orchestrators/reconcile/notify.test.ts`,
`extensions/pi-claude-marketplace/orchestrators/reconcile/README.md`,
`extensions/pi-claude-marketplace/domain/{dependency-range,dependencies,name,dependency-orphans}.ts`,
`extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts` and
`extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` read as evidence
**Status:** issues_found

## Summary

This is a re-review of the seven fixes applied on top of the phase 06 diff
(`979eadb0`, `046a981b`, `f826eb2d`, `67c325f4`, `fc7ac102`, `e907d1bd`,
`8a11b66c`), plus a re-confirmation of the two findings the fixer declined.

**Verification run, not assumed:** `npx tsc --noEmit` exits 0.
`node --test tests/orchestrators/reconcile/ tests/architecture/` is 625 pass /
0 fail. `REASONS.length` is pinned at 58 in
`tests/architecture/notify-closed-set-locks.test.ts:93` and matches the
`docs/output-catalog.md:63` prose; the retired `dependents remain` token has no
occurrence left anywhere under `extensions/`, `tests/` or `docs/`.

**The seven applied fixes hold.** Each was traced through the source rather than
read off the fix report:

| Finding | Verdict |
| --- | --- |
| CR-01 | **Fixed.** `apply.ts:841,843` push into `outcomes` inside the loop; the `rows` local is gone and `stampDependencyDisabled` is the last statement (`:853-855`). No producer appends between the loop and the stamp, so row order is genuinely unchanged. |
| WR-02 | **Fixed, with a doc gap** — see WR-10. `notify.ts:475` counts the bucket; `notify.ts:415` folds it into the `will disable` loop. The no-double-naming claim is real: `plan.ts:726` passes `acc.disable` into `claimedPluginKeys`, and `buildDependencyDisableBucket` skips a claimed key at `plan.ts:665`. Both new table cases are discriminating. |
| WR-04 | **Fixed.** `plan.ts:627-634` now says "the only place the stored marker decides an ACTION" and names the second reader. `rg dependencyDisabled` confirms exactly two decision readers (`plan.ts:641`, `dependency-verdict.ts:133`); `state-io.ts:190` is serialization, not a decision. |
| WR-05 | **Fixed.** `apply.ts:934-937` drops the same-pass install claim and states the pre-install-snapshot reason. Confirmed against `apply.ts:217` (verdict) preceding `applyPluginInstalls` at `:948`. |
| WR-06 | **Fixed.** `gate-targets.ts:108-116` adds the module to `NETWORK_FREE_TARGETS`. No test pins the array's length or order, so the addition is purely additive, and `no-orchestrator-network.test.ts` (offender + near-miss controls, `visited` deep-compare) passes over the widened set. |
| WR-07 | **Documented arm applied as declared.** `dependency-verdict.ts:34-41` names the changed consequence; `docs/dependency-resolution.md:202` describes the case. The doc's escape hatch is correct: with no declared constraint, `constraintsByKey` yields an empty range list, `intersectDependencyRanges` returns `WILDCARD` (`dependency-range.ts:204-206`) and `isUnconstrainedRange` short-circuits (`dependency-verdict.ts:200`). Behaviour is unchanged, which is what the fixer said. |
| WR-08 | **Comment-only, as declared.** `apply.ts:207-216` now names the per-record cost and the `ELOCKED` consequence. The zero-record claim checks out: `buildScopeDeclarationDetail` (`dependency-index.ts:259-268`) runs its body once per record and does no work outside the loops. The structural half is still open by decision. |

**The two declined findings are still open and still accurately described.**
`pending.ts:207` still calls `planReconcile` with three arguments, so the
verdict-less default stands (WR-01). `dependency-index.ts:193-195` still returns
the failure arm on an `absent` manifest entry, `buildScopeDeclarationDetail`
still returns on the first failure, and `apply.ts:1019-1025` still pushes
`plugin-disable-failed` / `unreadable` (WR-03). Both are re-listed below so this
artifact stands alone; neither is re-litigated.

**What is new.** Four defects the first pass did not record. Three are
claim-versus-code drift about the eighth bucket and about the security
provenance of an interpolated identifier — the same class as WR-04, which was
accepted as worth fixing. One is that the CR-01 fix ships with nothing pinning
it.

## Warnings

### WR-01 (carried from iteration 1, still open): `/claude:plugin pending` previews `(will enable)` for a plugin the next reload holds down

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts:207`

Re-confirmed unchanged. `planReconcile(mergedViewForPlanning(outcome, state), state, scope)`
takes the `NO_HELD_DECLARERS` default (`plan.ts:746,766`), so
`isHeldByUnsatisfiedDependency` (`plan.ts:424-426`) is always `false` and
`classifyDeclaredPlugin` (`plan.ts:523-529`) pushes a `PlannedPluginEnable` for
every declared-enabled / recorded-disabled record, including the ones the check
holds down. Contradicts DIFF-01 SC #2.

The fixer declined both remedies with reasons recorded in `06-REVIEW-FIX.md`
(the primary one is backlog item `PENDING-VERDICT-01` / D-06-25; the fallback
would create a second marker-reads-an-action site, contradicting the invariant
restated for WR-04). Not re-litigated here.

**Fix:** as before — `PENDING-VERDICT-01`. Nothing in this iteration changes the
shape of the remedy.

### WR-03 (carried from iteration 1, still open): one stale record aborts the whole scope's check and emits an error row on every reload

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts:192-195, 255-271`;
`extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:999-1026`

Re-confirmed unchanged. `readRecordDeclarations` still treats
`lookupDeclaredPlugin(manifest, name).kind === "absent"` as an unreadable
declarer (`:193-195`), and `buildScopeDeclarationDetail` still `return`s that
failure on the first record that hits it (`:262-264`), so one record whose
marketplace dropped it from `marketplace.json` turns off LOAD-01 for the whole
scope and produces `⊘ <plugin> (failed) {unreadable}` at error severity on every
reload.

The fixer declined it as a D-05-07 posture decision with a wider blast radius
than a review fix (the same `readRecordDeclarations` serves uninstall's
dependents guard through `buildScopeDeclarationIndex`). Not re-litigated.

**Fix:** as before. One thing to add for the carrier: `06-REVIEW-FIX.md` notes
WR-03 has no backlog item. It should get one before the phase closes, because
unlike WR-01 nothing else tracks it.

### WR-09 (new): the eighth bucket is documented as seven in four places, including a self-contradiction inside `plan.ts`

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:3` versus the same file's `:749`

`plan.ts` opens with

```ts
// DIFF-01 pure bidirectional 7-bucket diff between MergedConfig and
```

while `planReconcile`'s own doc comment 746 lines later says

```ts
 * DIFF-01 pure bidirectional 8-bucket diff. Produces a `ReconcilePlan`
```

and `types.ts:5,242` agrees on eight. One file states both counts about one
function. Three more sites were left at seven by the phase:

- `extensions/pi-claude-marketplace/orchestrators/reconcile/README.md:22` ("a pure bidirectional 7-bucket diff"), `:26` ("## The 7-bucket model") and `:28` ("into seven action buckets"), whose numbered list then stops at `7. sourceMismatches` — the new bucket is absent entirely, and `sourceMismatches` is numbered as the seventh where `types.ts:30` numbers it eighth.
- `tests/architecture/reconcile-planner-purity.test.ts:13` ("a pure bidirectional 7-bucket diff").
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:15` still shows the read pass calling `planReconcile(merged, state, scope)` with no `verdict` argument, which is the signature the phase changed.

This matters more than ordinary prose rot in this repo: the README is the
layer's contract document, the bucket list there is what a maintainer counts
against when adding a ninth bucket, and the project's own memory records the
"optional-field silent-omission" class — a member added to a closed structure
that compiles clean at every derivation site — as having shipped repeatedly.
A count that disagrees with itself inside one file is exactly the signal that
class needs to stay loud.

**Fix:** renumber `README.md:22,26,28` and its list to eight, inserting
`pluginsToDependencyDisable` before `sourceMismatches` to match `types.ts:23-32`;
change `plan.ts:3` and `reconcile-planner-purity.test.ts:13` to "8-bucket"; and
update the `apply.ts:15` composition sketch to
`planReconcile(merged, state, scope, verdict)`.

### WR-10 (new): the WR-02 fix changed the projection loop but not the projection's own bucket-to-row contract

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts:346-351` and `:28-33`

`buildReconcilePendingNotification`'s doc comment enumerates the
bucket → row mapping the function implements:

```
 *   - pluginsToInstall      -> child row { status: "will install" }
 *   - pluginsToUninstall    -> child row { status: "will uninstall" }
 *   - pluginsToDisable      -> child row { status: "will disable" }
 *   - pluginsToEnable       -> child row { status: "will enable" }
```

`pluginsToDependencyDisable` is not in that list, even though commit `046a981b`
added its projection nine lines below (`:415`). The module header carries the
same list at `:22-33` and is likewise missing it. The mapping is the only place
that states which token a bucket previews as; a maintainer implementing
`PENDING-VERDICT-01` reads it, finds seven entries, and concludes the held-down
bucket has no preview — which is precisely the wrong conclusion now that it
does.

This is a completeness gap in the WR-02 fix itself, not pre-existing drift: the
fixer wrote a new `LOAD-01 / WR-02` comment inside the loop body and left the
contract comment directly above it stale.

**Fix:** add a line to both lists, e.g.

```
 *   - pluginsToDependencyDisable
 *                           -> child row { status: "will disable" }, folded
 *                              into the pluginsToDisable loop (LOAD-01); the
 *                              planner's claimedPluginKeys guarantees the two
 *                              buckets never name one plugin twice
```

### WR-11 (new): the CR-01 fix ships with nothing pinning it

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:820-856`; `tests/orchestrators/reconcile/apply.test.ts`

The emission point is now the whole fix: moving the two `outcomes.push` calls
back below `stampDependencyDisabled` restores the original defect and keeps
every one of the 625 cases in `tests/orchestrators/reconcile/` and
`tests/architecture/` green. I re-ran them to confirm the suite cannot see the
difference. The only thing defending the fix is the header comment at `:809-818`.

The fixer's reason for deferring is sound as far as it goes — the stamp and the
`setPluginEnabled` write that precedes it take the same lock and write the same
`state.json`, so an external `chmod` or lock hold fails step one instead — but
the conclusion drawn from it (leave it unpinned) is the weaker of the two
available ones. The project's own convention is that a dependency which is hard
to fail in a test wants to become an explicit collaborator: `applyDependencyDisables`
already receives `opts: ApplyReconcileOptions`, and the update family precedent
shows an injected transaction seam is an accepted shape here.

This is a WARNING rather than a re-raised BLOCKER because the code is presently
correct; the risk is regression, not current behaviour.

**Fix:** either inject the stamp write as a seam on `ApplyReconcileOptions` (the
`InstallLedgerTransaction.runPhases` precedent) and add a case asserting both
the `plugin-dependency-disabled` row and the `invalid-block` row reach the
cascade when the stamp throws, or — at minimum — add a source-level assertion in
the reconcile suite that `applyDependencyDisables` pushes before it stamps, so
the ordering is pinned by something other than a comment.

### WR-12 (new): the T-06-01 / T-06-02 provenance claim is false for half of every interpolated key

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts:317-321, 329-333` (used at `:342, :403`);
`extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts:162-166` (used at `:181`)

Both new cause lines justify themselves the same way. `apply-outcomes.ts:329-332`:

```
 * T-06-02: the two interpolated keys are built from names that passed
 * `domain/dependencies.ts`'s token pattern, which admits no control, bidi,
 * ANSI, whitespace or quote character -- so a hostile plugin name cannot forge
 * a row here.
```

Only one of the two keys has that provenance. `held.dependency` does — it is
built in `dependency-verdict.ts:167` from an `AddressedDependency`, whose `name`
passed `TOKEN_PATTERN` (`domain/dependencies.ts:47`,
`/^[A-Za-z0-9][-A-Za-z0-9._]{0,255}$/`). `dependent` does not:

```ts
const dependent = `${held.plugin}@${held.marketplace}`;   // apply-outcomes.ts:342
```

`held.plugin` / `held.marketplace` come from `parsePluginKey(entry.dependent)`
(`plan.ts:670`), and `entry.dependent` is the DECLARER key the walk built from
the state document — `` `${name}@${marketplace.name}` `` at
`dependency-index.ts:184`, where `name` is an `Object.keys(marketplace.plugins)`
entry. The only validation a recorded name ever passes is
`domain/name.ts::assertSafeName`, which rejects exactly four things: empty,
`.`/`..`, `/` or `\`, and ASCII control characters (`name.ts:25-54`). It admits
`"`, `,`, spaces, and every non-ASCII bidi control including U+202E.

The identical claim in `uninstall.messaging.ts:162-166` covers
`` `required by ${args.dependents.join(", ")}` `` (`:181`), whose members are
`findDependents`' holder keys — the same state-derived keys.

Both strings are handed to `new Error(...)` and rendered through
`renderIndentedCauseChain` (`notification-grammar.ts:1066-1073`), which the
phase's own `apply-outcomes.ts` header notes performs no redaction and no
sanitization. A marketplace that publishes a plugin named
`x" or uninstall "victim@mp` therefore renders

```text
    cause: Install "dep@mp" or uninstall "x" or uninstall "victim@mp@mp"
```

and a name carrying U+202E reverses the remainder of the line. The install path
does not stop either name: nothing between `marketplace.json` and the state
record applies `TOKEN_PATTERN` to a plugin name.

Impact is bounded — it is notification-text forgery, not path escape or
execution, and `assertPathInside` still governs every write — which is why this
is a WARNING. What makes it worth fixing is that a future reader will trust the
comment and reuse the pattern where the bound does not hold.

**Fix:** two options, and the first is cheap. Either state the real provenance
in both comments (the dependency half is token-validated; the dependent half is
a recorded key bounded only by `assertSafeName`, so the sentence is
quote-forgeable by a hostile plugin name and that is accepted), or validate the
recorded half before interpolating — run the parsed `plugin` / `marketplace`
through the same token predicate and fall back to a key-less sentence when it
fails. Do not leave a security-phrased comment asserting a guarantee the code
does not provide.

## Info

### IN-02 (carried from iteration 1, still open): `NO_HELD_DECLARERS` freezes the wrapper but not the array

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:746`

Unchanged: `Object.freeze({ ok: true, unsatisfied: [] })` is shallow, so the
shared `unsatisfied` array is mutable at runtime. Nothing mutates it today. Out
of the iteration-1 fix scope (`critical_warning`), so still open by process, not
by decision.

**Fix:** `Object.freeze({ ok: true, unsatisfied: Object.freeze([]) })`.

### IN-03 (carried from iteration 1, still open): a check-held record is indistinguishable from a user disable outside the reconcile cascade

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts` / `info.ts` (unchanged this phase)

Unchanged. `rg dependencyDisabled` confirms the marker still has exactly two
decision readers, neither on a read surface, so `list` and `info` render a
held-down plugin as a plain `(disabled)` row. Worth a follow-up item if
operators report confusion.

Iteration 1's IN-01 (widened cause-trailer guarded by producer discipline) is
not carried forward as an Info item: WR-12 above supersedes it with a concrete,
provable instance.

### IN-04 (new): a failed marker stamp leaves the record re-planned and re-driven on every reload, permanently

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:799-803, 853-855`

`stampDependencyDisabled`'s header says a crash between the two writes is
survivable because "the next pass re-derives the same verdict, keeps the record
down and plans no enable for it, so the hold survives the gap." The hold does
survive — confirmed through `isDisabledIndependently` (`dependency-verdict.ts:133`)
and `classifyDeclaredPlugin` (`plan.ts:523-529`). What the header does not say
is that the marker never recovers.

`isAlreadyDependencyDisabled` (`plan.ts:641`) requires the marker, so an
un-stamped held record stays in `pluginsToDependencyDisable` forever.
`applyDependencyDisables` then calls `setPluginEnabled` on it every reload,
which takes the already-disabled idempotent arm (`enable-disable.ts:876`) and
returns `skipped` — so `transitioned` stays empty and the stamp is never
retried. The user-visible surface stays silent (no row is produced, RECON-05
holds), but the scope is permanently non-empty in the plan and re-drives a no-op
through the enablement seam on every session start. That is the exact churn
`isAlreadyDependencyDisabled`'s own doc comment says it exists to prevent.

Info rather than Warning: it needs a failed stamp to reach, it is invisible to
the user, and the plugin ends up in the correct state.

**Fix:** either re-stamp on the `skipped` arm when the planner routed the record
through the dependency-disable bucket, or extend the `stampDependencyDisabled`
header to record that a failed stamp is not self-healing so the next reader is
not surprised by the permanent re-plan.

---

_Reviewed: 2026-09-19T08:40:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 2_
