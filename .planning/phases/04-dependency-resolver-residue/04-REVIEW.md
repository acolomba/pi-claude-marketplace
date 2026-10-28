---
phase: 04-dependency-resolver-residue
reviewed: 2026-10-28T17:15:25Z
depth: standard
files_reviewed: 44
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/agents/index.ts
  - extensions/pi-claude-marketplace/bridges/agents/index-mutation.ts
  - extensions/pi-claude-marketplace/bridges/agents/marker.ts
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
  - extensions/pi-claude-marketplace/bridges/agents/target-check.ts
  - extensions/pi-claude-marketplace/domain/release-tag.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/shared/errors-bridges.ts
  - features/lib/published-marketplace.ts
  - features/plugin/install-dependencies.feature
  - features/plugin/update-dependencies.feature
  - features/step_definitions/plugin/installation.steps.ts
  - features/step_definitions/plugin/publishing.steps.ts
  - features/support/pi-process.ts
  - features/support/world.ts
  - test/bridges/agents/index.test.ts
  - test/bridges/agents/stage.test.ts
  - test/bridges/agents/target-check.test.ts
  - test/domain/release-tag.test.ts
  - test/orchestrators/plugin/dependency-plan.test.ts
  - test/orchestrators/plugin/dependency-tag-probe.test.ts
  - test/orchestrators/plugin/install-cascade.test.ts
  - test/orchestrators/plugin/install-flow-cascade-context.test.ts
  - test/orchestrators/plugin/install-flow-dependency-ledger.test.ts
  - test/orchestrators/plugin/install-flow-ledger.test.ts
  - test/orchestrators/plugin/install-flow-planning.test.ts
  - test/orchestrators/plugin/install-outcome.test.ts
  - test/orchestrators/plugin/marketplace-tag-probe.test.ts
  - test/orchestrators/plugin/update-swap.test.ts
findings:
  critical: 1
  warning: 1
  info: 0
  total: 2
status: issues_found
reviewed_commit: 92501edf2f60f1b12370a0d2766923438f469553
---

# Phase 04: Code Review Report

**Reviewed:** 2026-10-28
**Depth:** standard
**Files Reviewed:** 44
**Status:** issues_found

## Summary

Fresh review of the integrated implementation of RSV-01..RSV-05 and
D-PL4-01..07, following the Phase 11 install-flow owners and the later
agent-error and Phase 1 fixes. One reproducible blocker remains: an agent
name held by a foreign index row passes preview when its target file is
absent, then refuses after an earlier dependency move has committed.
There is also one inaccurate outcome-contract comment.

The file list records the files inspected for this phase's behavior and
its current callers/tests; it is not a claim that all unrelated behavior
in the large integrated owner suites was re-audited. The scope resolver
reported `degraded` / `phase-range` / `no-task-commit-rows` and included
later milestone work. The review therefore used the six Phase 4 plans,
the previous 24-file review, and the current split owners to follow the
explicit RSV scope supplied by the orchestrator.

## Narrative Findings (AI reviewer)

### Critical Issues

### CR-01: Foreign agent-index ownership still refuses after an earlier move commits

**Classification:** BLOCKER
**File:** `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-a-14710/extensions/pi-claude-marketplace/bridges/agents/target-check.ts:34-48`
**Related:** `bridges/agents/stage.ts:127-145`,
`orchestrators/plugin/dependency-move.ts:167-218`,
`orchestrators/plugin/install-flow-planning.ts:252`.

**Issue:** The write-free check discards the `other` partition of the
agents index and checks only existing target files. The actual staging
operation first runs `findOwnershipConflicts(otherEntries, names)` and
throws `AgentOwnershipConflictError`, even when the target file is
absent. The state-based PI-6 check cannot cover a stale index row whose
owner/resource is no longer present in `state.json`.

This leaves a deterministic, already-readable refusal until execution.
A two-move install can update its first dependency and then fail the
second one; the plan could have rejected the operation before either
move. A missing target does not make the foreign index claim
replaceable under the actual bridge's AG-9 rule.

**Reproduction, executed on the reviewed tree:** A hermetic Node module
used the existing public install fixture (`withHermeticHome`,
`seedCatalogScope`, `publishCatalog`, `makeCtx`) and real bridge:

1. Install `aaa@mp` and `zzz@mp` at 1.0.0.
2. Publish `app@mp` requiring `aaa@^2.0.0,zzz@^2.0.0`, publish both
   dependencies at 2.0.0, and give `zzz` a valid `agents/helper.md`.
3. Write a valid `agents-index.json` row for
   `pi-claude-marketplace-zzz-helper`, owned by
   `zzz@old-catalog`, pointing at its usual target in `agents/`.
   Leave that target absent and leave `old-catalog` absent from state.
4. Call the public `owner.installPlugin` for `app@mp`.

Measured result:

```json
{
  "status": "failed",
  "versions": {
    "aaa": "2.0.0",
    "zzz": "1.0.0"
  }
}
```

The outcome reported `aaa@mp` updated and `zzz@mp` failed.
A separate bridge-level reproduction with the same missing-target /
foreign-owner condition printed:

```text
preview: accepted missing target with foreign index owner
prepare: AgentOwnershipConflictError
```

Both reproductions cleaned their temporary directories. No repository
source or test was changed.

**Fix:** Retain both partitions in `assertAgentTargetsFree`; run the
same AG-9 ownership check as `prepareStagePluginAgents` before checking
target files, throwing the same typed error and structured conflicts.
Prefer a shared ownership assertion so preview and staging cannot drift.
Keep the existing commit-time checks. Add a paired missing-target /
foreign-index test and a behavioral two-move regression that requires
both records to remain at 1.0.0. This directly addresses prior IN-03;
the duplicated-rule concern in prior WR-03 is related and is not counted
again as a separate finding.

### Warnings

### WR-01: The rollback-partial contract still says apply does not render it

**Classification:** WARNING
**File:** `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-a-14710/extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts:170-175`
**Related:** `orchestrators/reconcile/apply.ts:583-649,890`.

**Issue:** The `InstallMissingDependencyOutcome` field comment says
"`apply` does not render them yet (LCORCH-01)". The current
`applyDependencyInstalls` failure arm forwards this outcome to
`installFailedOutcomes`, which reads `rollbackPartials`, projects
per-phase detail, and emits `rollback partial` rows. This is an
inaccurate description of a public outcome contract after the later
integration; it directs future consumers to treat already-supported
reporting as unfinished work.

**Fix:** Remove the obsolete sentence, keeping the description of the
failed undo steps and omission when every undo succeeds. If a consumer
is named, identify the current `applyDependencyInstalls` /
`installFailedOutcomes` path.

## Disposition of the previous review

| Previous ID | Current disposition | Evidence |
|-------------|---------------------|----------|
| WR-01: untyped occupied-target error / unreadable-manifest reason | Resolved | Both bridge sites throw `AgentTargetOccupiedError`; `update-flow.ts:908,1146` suppress the unrelated reason for cascade/direct paths. The update scenario expects an empty reasons cell. |
| WR-02: inconsistent full-path/basename messages | Resolved | `errors-bridges.ts:61-69` redacts the error message at construction. Current move, fresh-dependency and direct-update scenarios all expect the basename. |
| WR-03: separate preview/commit rules | Subsumed by CR-01 | The ownership/refusal logic remains separate, and there is no shared-fixture parity test. This review demonstrates a concrete mismatch rather than counting the same concern twice. `AGTARGET-01` remains the existing maintenance carrier. |
| WR-04: only first target tested | Resolved | `target-check.test.ts:134-149` supplies a free first target and an occupied second target. |
| IN-01: names-only function comment / export naming | Comment resolved; no defect reported for the name | `update-swap.ts:1404-1435` documents the private names check and public agent-target wrapper. The export name alone does not establish a bug. |
| IN-02: rollback-partial consumer claim | Later integration made the replacement comment stale | Runtime propagation and apply rendering now exist; current inaccurate text is WR-01 above. |
| IN-03: AG-9 absent from preview | Confirmed, escalated to CR-01 | Both bridge-level and public two-move reproductions establish the late refusal. |
| IN-04: agents-directory setup cleanup | No leak established | The run's `Before` hook removes all sandbox contents and `AfterAll` removes its root (`features/support/pi-process.ts:118-166`); the user file also has its own release. The directory is intentionally a setup precondition. |

## Other reviewed paths and limits

- The fresh-member commit map is keyed by member key. `previewFresh`
  returns the preflight commit, and `schedule` attaches it to materialize
  and final entries. The install root travels through `rootCommit`.
- Both current ledger builders call `memberLedgerPin`. A release-tag
  pin takes precedence; an ordinary preview commit supplies only
  `sourcePin`, which becomes `sourcePinOverride`. The pinned clone
  probe reads that commit. The existing cases assert one mirror resolve,
  the pinned commit, installed records, and the real git request pair.
- D-PL4-02 still previews fresh dependencies deferred by apply. D-PL4-03
  deliberately keeps the greedy, incomplete search; the test checks the
  exact four rounds and six judge calls. The recorded completeness limit
  is not a newly discovered defect.
- Reinstall's forced overwrite continues through the swap's names-only
  check and the force-aware commit check.
- The no-match tag result has no range field; the cascade derives the
  reported range from the declaration. Listing failure is a separate arm.
- Failed missing-dependency outcomes still carry the original partial
  rollback detail through the result projection. The REC-06 test now
  lives in `install-flow-ledger.test.ts:6766`.
- Deferred workflow-target and re-enable refusals remain documented in
  `MOVEREFUSE-01`. This review does not silently expand RSV-04 to those
  separately recorded cases.

## Validation and review evidence

- Reviewed commit: `92501edf2f60f1b12370a0d2766923438f469553`,
  branch `agent-reverify-a`, Node `v26.12.1`.
- Reused the orchestrator's same-session `npm run check`, exit 0 at
  `99747f39`: 1124 scenarios, 11468 steps, 309 LCOV records.
  Independently checked that
  `git diff 99747f39 -- . ':(exclude,glob).planning/**/*.md'` is empty
  and there are no untracked build inputs. The only pre-existing working
  change was planning STATE.md.
- The orchestrator's focused evidence covers 11 unit modules and four
  scenarios / 57 steps. Passing coverage does not exercise CR-01's
  absent-target / foreign-index combination.
- Independently executed two disposable Node reproductions for CR-01
  on the current code; both exited 0 and printed the observed mismatch.
- Used CodeGraph first. It identified stale indexed split modules, which
  were read directly from disk for this review.
- `fallow review --base 2829db68 --brief` could not create its temporary
  attribution worktree. The read-only fallback
  `fallow review --base 2829db68 --brief --gate all` exited 0 and reported
  dead code 0, complexity 0, duplication 0. Its 683-file integrated range
  served only as orientation; it is neither the phase scope nor evidence
  against the runtime finding.
- No structural-findings payload or external-reviewer evidence was
  supplied. Source, unit-test assertions, behavioral scenarios, and
  current callers were inspected directly.
- Only this report was written. No source fixes, test changes, or commits
  were made by the reviewer.

---

_Reviewer: gsd-code-reviewer_
_Depth: standard_
