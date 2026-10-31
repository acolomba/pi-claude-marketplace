---
phase: 27-install-and-reconcile-reason-residue
verified: 2026-10-23T13:30:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".planning/phases/27-install-and-reconcile-reason-residue/27-01-PLAN.md"
  - ".planning/phases/27-install-and-reconcile-reason-residue/27-01-SUMMARY.md"
  - "docs/output-catalog.md"
  - "extensions/pi-claude-marketplace/orchestrators/import/execute.ts"
  - "extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts"
  - "extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts"
  - "extensions/pi-claude-marketplace/orchestrators/types.ts"
  - "extensions/pi-claude-marketplace/platform/git.ts"
  - "extensions/pi-claude-marketplace/shared/errors.ts"
  - "features/lib/git-plugin.ts"
  - "features/marketplace/remove.feature"
  - "features/plugin/git-source.feature"
  - "features/plugin/install-dependencies.feature"
  - "features/plugin/reconcile.feature"
  - "features/step_definitions/plugin/git-source.steps.ts"
  - "test/architecture/catalog-uat/catalog-contract.test.ts"
  - "test/architecture/catalog-uat/fixtures/plugin-install.ts"
  - "test/orchestrators/import/execute.test.ts"
  - "test/orchestrators/marketplace/remove.test.ts"
  - "test/orchestrators/plugin/clone-cache.test.ts"
  - "test/orchestrators/plugin/dependency-index.test.ts"
  - "test/orchestrators/plugin/install-cascade.messaging.test.ts"
  - "test/orchestrators/plugin/install-cascade.test.ts"
  - "test/orchestrators/plugin/install-flow.test.ts"
  - "test/orchestrators/plugin/install.messaging.test.ts"
  - "test/orchestrators/reconcile/apply-outcomes.test.ts"
  - "test/orchestrators/reconcile/apply.test.ts"
  - "test/orchestrators/reconcile/notify.test.ts"
  - "test/platform/git-ops-fake.ts"
  - "test/platform/git.test.ts"
  - "test/shared/errors.test.ts"
covered_digest: "v3:sha256:b0a2899b04db6420a4cc76476b4c907cd66c15df0698fa97f6b0eb15ca257941"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 27: Install and Reconcile Reason Residue Verification Report

**Phase Goal:** The reasons phases 22-24 aligned read the same in every remaining command.
**Verified:** 2026-10-23
**Status:** passed
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `{version conflict}` and `{no matching version}` causes print the declared ranges joined with `, `, unquoted, so a `||` range keeps its meaning (INR-05) | VERIFIED | `install-cascade.ts::renderDeclaredRanges` (`ranges.join(", ")`, bounded by `renderConstraintRange`) feeds every `CascadeConstraintFailure.range` arm: intersection failure, installed-unsatisfied, probe no-matching-tag, tagless-source `absent`, and tag-listing-failed. `resolveOneMember` passes `renderDeclaredRanges(effectiveRanges(...))`, so the root's caller ranges are included (REVIEW CR-01 fixed). The cause sentences in `install-cascade.messaging.ts` dropped the quotes. Tests: `INR-05 a conflict names each declared range apart, so a range with \|\| keeps its meaning` asserts `^1.0.0 \|\| ^2.0.0, ^3.0.0`. Two root-range cases (no matching tag, failed tag listing) pass. `install-dependencies.feature` shows `^1.0.0, ^2.0.0` and `satisfy ^2.0.0.`. No quoted range cause is left in features, docs, or tests. |
| 2 | A pin the remote lacks fails with a cause that names the commit and gives no git-library advice; a pin only a tag reaches installs through the ref-hint clone (INR-06) | VERIFIED | `PinnedCommitMissingError(sha)` no longer takes `ErrorOptions` and `asPinnedCommitMissing` chains nothing. The recovery fetch in `clone-cache.ts::checkoutPinWithRefetch` passes `tags: true`, and `platform/git.ts::fetch` forwards it to isomorphic-git. `git-source.feature`: the cause chain is now only `A fresh clone from the git host does not hold the commit 0123…`. The new tag-only scenario installs version 2.0.0 (revision 2), and its Given step asserts that no branch contains the tag. **Mutation check:** removing `tags: true` in a scratch copy makes that scenario fail (status `failed`, not `installed`). |
| 3 | Reconcile's failed install shows install's narrowed reasons, and `import` shows `{rollback partial}` (REC-06) | VERIFIED | `apply-outcomes.ts::installFailureReasonFields` returns `narrowResolverReasons(...)` for `not-installable` / `no-longer-installable`. It is wired into both `applyPluginInstalls` and `applyDependencyInstalls` (WR-03 fixed). `notify.ts::failedRowReasons` renders `reasons` on the row. Status stays `failed` (D-05). `classifyInstallFailure` carries `rollbackPartials`, and `import/execute.ts` maps them to `runtimeReason: "rollback partial"`. Tests: `reconcile.feature` "…pi supports only in part with the reason install gives" shows `{unsupported component}`. **Mutation check:** going back to `classifyOrchestratorThrow` makes it fail with `no longer installable`. `execute.test.ts` "REC-06: names a rollback the failed install could not finish as rollback partial" renders `⊘ broken (failed) {rollback partial}`. |
| 4 | `marketplace remove` is not refused by a dependent that is disabled (MPR-01) | VERIFIED | `withoutDisabledHolders` moved to `dependency-index.ts` and is exported. `remove.ts::runRemoveLockBody` passes the filtered index to `refuseHeldRemovals` only, so the cascade keeps the full index (D-07). Named uninstall uses the same helper. Tests: `remove.feature` "…goes ahead when only a disabled plugin of the local layer needs one of its plugins". **Mutation check:** passing the unfiltered index makes that scenario fail. The unit tests `MPR-01: a layer remove is not refused…` and `UNI-01 / MPR-01: dropping disabled holders…` pass. |
| 5 | `npm run check` stays green | VERIFIED | Taken from the caller: `npm run check` passed on this exact tree (6955 cucumber steps, direct coverage merged with no shortfall). I did not rerun it, as instructed. Spot checks: 11 paired unit files gave 793/793 passing. The four phase features gave 93/93 scenarios and 1065/1065 steps passing in a hermetic HOME. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `orchestrators/plugin/install-cascade.ts` | declared-range renderer on every constraint arm | VERIFIED | `renderDeclaredRanges` is used in 5 places, and the effective ranges reach the probe |
| `orchestrators/plugin/install-cascade.messaging.ts` | unquoted cause sentences | VERIFIED | 5 sentences changed |
| `shared/errors.ts` | `PinnedCommitMissingError` without chained cause | VERIFIED | the constructor takes only `sha` |
| `platform/git.ts`, `marketplace/shared.ts` | `tags` on `FetchOptions` and the `GitOps.fetch` port | VERIFIED | forwarded only when defined |
| `orchestrators/plugin/clone-cache.ts` | recovery fetch with `tags: true` | VERIFIED | mutation-proven |
| `orchestrators/reconcile/apply-outcomes.ts`, `apply.ts`, `notify.ts` | narrowed reasons on reconcile's failed install | VERIFIED | both install arms are wired, and the row renders `reasons` |
| `orchestrators/types.ts`, `install.messaging.ts`, `install-flow.ts`, `import/execute.ts` | `rollbackPartials` on the failed outcome, read by import | VERIFIED | the root install path and the re-enable path (`outcome.reason === "rollback partial"`) |
| `orchestrators/plugin/dependency-index.ts`, `marketplace/remove.ts`, `plugin/uninstall.ts` | shared `withoutDisabledHolders` | VERIFIED | one definition with two callers |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| `resolveOneMember` | `probeMemberPin` / `toMemberConstraintOutcome` | `renderDeclaredRanges(ranges)` with `ranges = effectiveRanges(...)` | WIRED |
| `checkoutPinWithRefetch` | `platform/git.ts::fetch` | `gitOps.fetch({ ..., tags: true })` → `git.fetch({ tags })` | WIRED |
| `handleInstallThrow` (orchestrated) | `classifyInstallFailure` | `capture.rollbackPartials` | WIRED |
| `installOnePlannedPlugin` | `runtimeFailureReason` | `rolledBackPartial` option | WIRED |
| `applyPluginInstalls` / `applyDependencyInstalls` | `installFailureReasonFields` | spread into `plugin-install-failed` | WIRED |
| `runRemoveLockBody` | `refuseHeldRemovals` | `withoutDisabledHolders(index, tx.state)` | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Paired unit tests | `node --test` on 11 changed test files (hermetic HOME) | 793 pass, 0 fail | PASS |
| Phase features | `cucumber-js` on git-source, install-dependencies, reconcile, remove (hermetic HOME) | 93/93 scenarios, 1065/1065 steps | PASS |
| INR-06 tag fetch is what makes the tag-only pin install | scratch copy with `tags: true` removed, `git-source.feature:282` | scenario fails (`failed` instead of `installed`) | PASS (test discriminates) |
| MPR-01 filter is what lets remove proceed | scratch copy with the unfiltered index, remove scenario | scenario fails | PASS (test discriminates) |
| REC-06 reconcile narrowing | scratch copy using `classifyOrchestratorThrow` | scenario fails with `no longer installable` | PASS (test discriminates) |

### Probe Execution

Not applicable: the phase declares no probes.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| --- | --- | --- | --- |
| INR-05 | 27-01 | SATISFIED | Truth 1 |
| INR-06 | 27-01 | SATISFIED | Truth 2 (the direct fetch of an unreachable sha is out of scope by the orchestrator's decision) |
| REC-06 | 27-01 | SATISFIED | Truth 3 |
| MPR-01 | 27-01 | SATISFIED | Truth 4 |

No orphaned requirements: REQUIREMENTS.md maps exactly these four to Phase 27.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (added lines of c39befeb) | - | TBD/FIXME/XXX/TODO/HACK | none found | - |
| `orchestrators/reconcile/dependency-verdict.ts` | 204 | contradictory declarations joined with a space (`ranges.join(" ")`) in the load-time "Update X to satisfy …" remedy | Info | Outside INR-05's literal scope (`{dependency version unsatisfied}`, not `{version conflict}`/`{no matching version}`), but the range form differs from install's |
| `import/execute.ts` | 1139-1143 | WR-02 fix (re-enable path reads `outcome.reason === "rollback partial"`) has no unit test | Info | The expression has no branch, so direct coverage cannot catch a regression here |

## For the user

- Deferred by binding decision (D-06): import shows only `{rollback partial}`, without install's per-phase child rows. Import's outcome shape has no slot for them.
- Deferred by binding decision (REVIEW-FIX WR-01): in an import cascade, a dependency's rollback partial stays `{dependency failed}` on the root row. The user is not told that files from the failed dependency may remain on disk.
- Deferred by binding decision (WR-04): reconcile's own failed-install row does not show rollback-partial children or the `{rollback partial}` token. A partial rollback during a reload reads as the error's classified reason.
- Divergence kept by binding decision (D-05): reconcile's row keeps status `failed` where install and import show narrowed reasons on their own rows. `reason` stays the summary token `no longer installable`, and `reasons` carries the narrowed list.
- Out of scope by orchestrator decision: installing a pinned sha that no branch or tag reaches (a direct fetch of the sha). It still fails clean with the commit-naming cause.
- Divergence (D-03): `PinnedCommitMissingError` deliberately drops isomorphic-git's error as `cause`, against the "wrap with `{ cause }`" convention.
- Remaining range-form mismatch outside INR-05's scope: the load-time `{dependency version unsatisfied}` remedy joins contradictory declarations with a space (`dependency-verdict.ts:204`), and `update`'s constraint gate prints the effective range in parentheses (Phase 18 territory, which this phase did not touch). Decide whether either should follow the `, ` form.
- Untested fix: import's re-enable path now reports `{rollback partial}` (WR-02), but no unit case pins it.
- Deferred review info items: IN-01 (the probe's `no-matching-tag.range` field is now unread), IN-03 (`rollbackPartials` rides on the missing-dependency outcome without being declared in its type), and IN-04 (an IMP-09 comment now sits above the wrong test in `execute.test.ts`).
- Edge-case assumption: in import, a rollback partial is reported only on the unclassified-failure arm. A `PathContainmentError` with partials would read `{rollback partial}` in import but a bare row in install. I judged this unreachable in practice and left it unverified.
- Skipped check: I did not rerun `npm run check`, as instructed. Truth 5 relies on the caller's report that it passed on this tree, plus my spot checks above.

## Gaps Summary

None. All four requirements are implemented, wired, and pinned by tests that fail when the change is reverted. The remaining items above are deliberate deferrals or out-of-scope observations, not gaps against the success criteria.

---

_Verified: 2026-10-23_
_Verifier: Claude (gsd-verifier)_
