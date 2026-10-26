---
phase: 27-install-and-reconcile-reason-residue
reviewed: 2026-10-23T00:00:00Z
depth: standard
files_reviewed: 38
files_reviewed_list:
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/platform/git.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - features/lib/git-plugin.ts
  - features/marketplace/remove.feature
  - features/plugin/git-source.feature
  - features/plugin/install-dependencies.feature
  - features/plugin/reconcile.feature
  - features/step_definitions/plugin/git-source.steps.ts
  - test/architecture/catalog-uat/catalog-contract.test.ts
  - test/architecture/catalog-uat/fixtures/plugin-install.ts
  - test/orchestrators/import/execute.test.ts
  - test/orchestrators/marketplace/remove.test.ts
  - test/orchestrators/plugin/clone-cache.test.ts
  - test/orchestrators/plugin/dependency-index.test.ts
  - test/orchestrators/plugin/install-cascade.messaging.test.ts
  - test/orchestrators/plugin/install-cascade.test.ts
  - test/orchestrators/plugin/install-flow.test.ts
  - test/orchestrators/plugin/install.messaging.test.ts
  - test/orchestrators/reconcile/apply-outcomes.test.ts
  - test/orchestrators/reconcile/apply.test.ts
  - test/orchestrators/reconcile/notify.test.ts
  - test/platform/git-ops-fake.ts
  - test/platform/git.test.ts
findings:
  critical: 2
  warning: 5
  info: 5
  total: 12
status: issues_found
---

# Phase 27: Code Review Report

**Reviewed:** 2026-10-23
**Depth:** standard
**Files Reviewed:** 38
**Status:** issues_found

## Summary

I reviewed the uncommitted working-tree diff for INR-05, INR-06, REC-06, and
MPR-01. These checks ran:

- Direct coverage (`scripts/test-coverage-direct.mjs`) on the 12 changed
  source pairs.
- `node --test` on `install-flow.test.ts` and `apply.test.ts`: 402 passed, 0 failed.
- `cucumber-js` on the four changed features: 93 of 93 scenarios passed.
- A scratch copy of `install-cascade.test.ts`, kept in the session scratchpad,
  to test the root-range case.

INR-06 is sound. Without a single branch, isomorphic-git's fetch wants every
ref, so `tags: true` adds the tag-only commit. The new git-source scenario
would fail if the flag were missing. MPR-01 matches named uninstall: the
filtered index is used only for the refusal, and the full index is kept for
the dependency sweep. The quoted range form is gone from the docs, the catalog
fixtures, the features, and the tests. The update paths (`update-constraint-gate.ts`)
never read `CascadeConstraintFailure.range`, so the phase 18 boundary holds.

The main defects:

- INR-05 reads `member.ranges` where it should read the effective ranges. This
  blanks the range in every root-member probe cause on the reload
  missing-dependency path.
- One new branch has no direct coverage, so `npm run check` will fail.
- REC-06's rollback-partial and narrowed-reason handling covers only some of
  the places that build or read a failed install.

## Critical Issues

### CR-01: A root member's probe causes print an empty range (INR-05 regression on the MISS-01 path)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:665-686, 695-704`

**Issue:** `toMemberConstraintOutcome` and the `absent` arm of `probeMemberPin`
now render `renderDeclaredRanges(member.ranges)`. For the ROOT member,
`member.ranges` is always `[]`, because the closure walk seeds the root with an
empty list (`domain/dependency-closure.ts:272`). Its real constraint comes from
`options.rootRanges`, which is folded in only by `effectiveRanges` (line 760).
The probe itself still gets the effective intersected range, so the failure is
real, but the cause loses the constraint. The reload missing-dependency install
(`install-flow.ts:2852`, `rootRanges: opts.ranges`, driven by
`reconcile/apply.ts:793`) is a production caller. It now reports:

- `Dependency "bar@mp" has no release tag satisfying .`
- `could not be checked against  (authentication required).`

Before this change, those causes printed the probe's range or the intersected
`range` argument. A scratch test confirmed the defect. With
`rootRanges: ["^2.0.0"]` and a git-sourced root whose probe answers
`no-matching-tag`, `runInstallCascade` returns
`{"kind":"constraint-failed","failure":{"kind":"no-matching-tag","key":"bar@marketplace","range":""}}`.
No existing test covers a root-range probe failure. The `toIntersectionFailure`
arm is correct only because `resolveOneMember` passes it the effective
`ranges`.

**Fix:** Pass the effective ranges through instead of reading `member.ranges`,
and add a D-09-05 test for a root range that no tag satisfies, plus one for a
failed tag listing:
```ts
// resolveOneMember
return isUnconstrainedRange(intersected.range)
  ? { kind: "resolved", member }
  : probeMemberPin(options, member, ranges, intersected.range);

// probeMemberPin(options, member, declared: readonly string[], range: string)
//   absent arm:            range: renderDeclaredRanges(declared)
//   toMemberConstraintOutcome(member, declared, probed)
// toMemberConstraintOutcome(member, declared, probed)
//   no-matching-tag / tag-listing-failed: range: renderDeclaredRanges(declared)
```

### CR-02: The new `no-longer-installable` branch has no direct coverage, so `npm run check` fails

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts:680`

**Issue:** `scripts/test-coverage-direct.mjs` reports
`Incomplete direct coverage for .../reconcile/apply-outcomes.ts: branches 46/47`.
The condition
`err.shape.kind === "not-installable" || err.shape.kind === "no-longer-installable"`
is exercised only with `not-installable`
(`test/orchestrators/reconcile/apply-outcomes.test.ts`, "REC-06: narrows a
plugin that cannot be installed as install does"). NFR-6 requires 100% direct
coverage for every source-test pair, so the phase gate (success criterion 5)
fails as written.

**Fix:** Run the REC-06 case over both kinds:
```ts
for (const kind of ["not-installable", "no-longer-installable"] as const) {
  test(`REC-06: narrows a ${kind} plugin as install does`, () => {
    const error = new PluginShapeError({ kind, plugin: "formatter", reasons: [],
      unsupportedKinds: ["hooks"], partialable: true });
    assert.deepStrictEqual(installFailureReasonFields(error), {
      reason: "no longer installable", reasons: ["unsupported hooks"] });
  });
}
```

## Warnings

### WR-01: A dependency member's rollback partial never reaches import

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:1685-1687`, `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:1867-1868`

**Issue:** D-06 says the orchestrated install's failed outcome carries
`rollbackPartials` when there are any. That holds only on the
`handleInstallThrow` path. When a non-root cascade member fails with a partial
rollback, `unwrapCascade` (line 1011-1019) records the partials on
`sink.subject.rollbackPartials`. `handleCaughtInstallFailure` then routes to
`handleCascadeThrow`, whose orchestrated arm returns
`{ status: "failed", error, cause }` without them. Standalone `install`
renders `{rollback partial}` on that dependency's row
(`install-cascade.messaging.ts:449-450`), but import sees nothing. Import's
`DependencyCascadeError` arm (`execute.ts:1867`) would ignore the flag anyway,
because only the `unexpected-failure` arm reads `rolledBackPartial`. The user
is never told that files from the failed dependency may still be on disk.

**Fix:** In `handleCascadeThrow`, add
`...(subject.kind === "member" && subject.rollbackPartials.length > 0 && { rollbackPartials: subject.rollbackPartials })`
to the orchestrated return. In `dispatchFailedOutcome`, decide how the
dependency-failed row reports it, for example
`runtimeReason: "rollback partial"`. If the dependency row is deliberately out
of scope, record that next to D-06's deferral of the child rows.

### WR-02: Import's re-enable path drops `{rollback partial}`

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:1139-1143`

**Issue:** `enableOnePlannedPlugin`'s `failed` arm calls
`dispatchFailedOutcome(result, plugin, outcome.error, outcome.cause)` with no
rollback flag. `setPluginEnabled`'s typed outcome already sets
`reason: "rollback partial"` when the re-materialization's undo did not finish
(`enable-disable.ts:2908-2924`). Standalone `enable` renders
`{rollback partial}` too (`enableFailedRow`, line 3126). An import that
re-enables a disabled plugin therefore reports the error's classified reason
instead. That is the case REC-06 is about: "import reports a rollback-partial
install as `{rollback partial}`."

**Fix:**
```ts
dispatchFailedOutcome(result, plugin, outcome.error, outcome.cause, {
  rolledBackPartial: outcome.reason === "rollback partial",
});
```
Add an `execute.test.ts` case whose `setPluginEnabled` double returns that
outcome.

### WR-03: Reconcile's missing-dependency install still collapses an uninstallable plugin to `{no longer installable}`

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:837-847`

**Issue:** REC-06 covers "reconcile's own failed install". The phase replaced
`classifyOrchestratorThrow` with `installFailureReasonFields` only in
`applyPluginInstalls`. The `applyDependencyInstalls` failure arm still sets
`reason: result.reason ?? classifyOrchestratorThrow(result.error)`. A missing
dependency whose resolver verdict is `not-installable`, for example one with
an unsupported component, throws a `PluginShapeError` through
`handleInstallThrow`, because the root has no cascade subject. Its row reads
`{no longer installable}`, while the same plugin declared directly reads
`{unsupported component}`. Within one reload, the same fact gets two
different braces.

**Fix:**
```ts
...(result.reason === undefined
  ? installFailureReasonFields(result.error)
  : { reason: result.reason }),
```
Cover it in `apply.test.ts`.

### WR-04: Reconcile's failed install ignores the new `rollbackPartials`

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:720-740`

**Issue:** The phase goal is that the reasons read the same in every remaining
command. The orchestrated outcome now carries `rollbackPartials`, and both
`install` and (after this phase) `import` name them first. Reconcile's
`plugin-install-failed` row still classifies only the error
(`installFailureReasonFields(result.error)`). A rollback-partial install
during a reload therefore reads, for example, `{permission denied}` with no
sign that files may remain. This is the asymmetry this phase was meant to
close, now in the other direction.

**Fix:** When `result.rollbackPartials` is non-empty, set
`reason: "rollback partial"`, as `runtimeFailureReason` does for import, or
record the exclusion as a decision.

### WR-05: Feature tables are no longer aligned

**File:** `features/plugin/install-dependencies.feature:139-142, 160-163`

**Issue:** The edited `cause chain` cells are one character shorter: the
quotes were dropped, and `, ` replaced the space. The other cells were not
re-padded, so the edited rows are 278 and 269 characters wide, against 279
and 270 for the header. `.agents/skills/cucumber/rules/features.md` says
"Align the columns". `npm run check:features` does not check alignment, so
nothing catches it.

**Fix:** Re-pad both tables so every `|` lines up.

## Info

### IN-01: The probe's `no-matching-tag.range` is now dead data

**File:** `extensions/pi-claude-marketplace/domain/release-tag.ts:112`, `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts:66`, `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:654`

**Issue:** D-02 dropped the only reader of the probe's normalized range. Its
type in `update-constraint-gate.ts:333` already omits it. The field is still
computed and declared but never read.

**Fix:** Drop `range` from the `no-matching-tag` arm in `release-tag.ts` and
`dependency-tag-probe.ts`. Both are shared with phase 18, so coordinate the
change or record it for later.

### IN-02: `PinnedCommitMissingError`'s `options` parameter has no caller

**File:** `extensions/pi-claude-marketplace/shared/errors.ts:1185`

**Issue:** INR-06 removed the only `{ cause }` argument. The parameter is
dead, and it invites someone to chain the library advice back in.

**Fix:** Remove `options?: ErrorOptions`. The doc comment already says the
message is the whole cause.

### IN-03: `InstallMissingDependencyOutcome` carries `rollbackPartials` at runtime but its type does not declare them

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:2710-2720, 2924-2931`

**Issue:** `failedWithNotices = { ...failed, ... }` spreads the new field into
an object whose declared type has no such member. Spread properties escape
excess-property checks, so the data rides along without a type, and
`apply.ts` cannot read it (see WR-04).

**Fix:** Add `readonly rollbackPartials?: readonly RollbackPartial[]` to the
failed arm, or strip the field explicitly.

### IN-04: The new import test separated an existing comment from its test

**File:** `test/orchestrators/import/execute.test.ts:1552-1555`

**Issue:** The `// IMP-09: an unclassified failure carries the reason ...`
comment belongs to the next test ("names the reason install gives an
unclassified install failure"). It now sits above the new REC-06 test.

**Fix:** Move the REC-06 test above the IMP-09 comment.

### IN-05: The `reason` field does not follow D-05, and a doc comment is stale

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts:203-208, 622-626`

**Issue:** D-05 says "`reason` stays its first member". The implementation
keeps `reason` as the summary token `no longer installable`, which is not
`reasons[0]`, and the interface doc describes that behavior instead. The
`classifyOrchestratorThrow` doc still says "Import instead narrows them",
but reconcile's install row now narrows them too.

**Fix:** Update D-05 (or the code) so the two agree, and add reconcile to the
`classifyOrchestratorThrow` doc comment.

---

_Reviewed: 2026-10-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
