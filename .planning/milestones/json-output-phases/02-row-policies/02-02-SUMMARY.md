---
phase: 02-row-policies
plan: "02"
subsystem: notifications
tags: [typescript, retained-workflows, presentation, corpus]
requires:
  - phase: 02-row-policies
    provides: Callback-free row policies and the approved 28-record corpus ledger
provides:
  - Readonly retained staging facts on both pending message carriers
  - One invocation-level scan and shared text composition
  - Exact count, name, empty-collection, and scan-count regression evidence
  - Completed automated validation evidence for PMOD-02 and PMOD-05
affects: [presentation-consumers]
tech-stack:
  added: []
  patterns: [specific readonly presentation facts, grouped optional advisory fields]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-summary.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/shared/notify-context.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - scripts/check-unused-type-members.contracts.json
    - tests/shared/notification-summary.test.ts
    - tests/orchestrators/reconcile/pending.test.ts
    - .planning/phases/02-row-policies/02-VALIDATION.md
key-decisions:
  - Group the two optional advisory fields in the existing seventh argument to satisfy max-params.
  - Let the existing scan helper omit an empty facts field for both pending branches.
  - Preserve all notification occurrences and the production catalog without further baseline edits.
requirements-completed: [PMOD-05, PMOD-02]
actuals:
  tokens: 10458
  tasks: 2
  commits: 2
plan_head_before: d1a04dd43516694840a28e6c95fc46a0d2fe3ca6
plan_head_after: a6b843ffc3f644d9db8e0ba7d50d2ece9ebf4ac6
coverage:
  - id: PMOD-05-facts
    description: Both pending carriers retain scanner facts and unchanged complete messages.
    requirement: PMOD-05
    verification:
      - kind: unit
        ref: tests/orchestrators/reconcile/pending.test.ts
        status: pass
      - kind: unit
        ref: tests/architecture/catalog-uat/catalog-contract.test.ts
        status: pass
    human_judgment: false
  - id: PMOD-05-edges
    description: Empty collections, optional counts, Unicode names, and supplied order retain exact output.
    requirement: PMOD-05
    verification:
      - kind: unit
        ref: tests/shared/notification-summary.test.ts
        status: pass
      - kind: other
        ref: npm run typecheck
        status: pass
    human_judgment: false
  - id: PMOD-02-output
    description: Full gates preserve the catalog and the exact approved corpus exception.
    requirement: PMOD-02
    verification:
      - kind: other
        ref: npm run check
        status: pass
      - kind: other
        ref: node scripts/notify-corpus.mjs check
        status: pass
    human_judgment: false
duration: 82min
completed: 2026-10-02
status: complete
---

# Phase 2 Plan 2: Retained Workflow Facts Summary

Pending messages now carry retained staging names and optional envelope counts;
one shared text path renders both message arms without changing their output.

## Performance

- Execution window: approximately 23:30 UTC on 2026-10-01 through 00:52 UTC on
  2026-10-02, including diagnosis and mandatory checks.
- Tasks: 2; task files changed: 14.
- Actual tokens: ceiling of the character count of `git diff
  d1a04dd4..a6b843ff` divided by four.
- Commit count is measured from the persisted plan base through the task head.
  The subsequent summary commit is outside that interval.

## Accomplishments

- Added readonly `RetainedWorkflowStaging` facts to cascade and pending-empty
  carriers. String advisories retain their existing separate field.
- Pending scans once, outside the scope loop, and forwards the same observations
  to either message arm. Empty observations omit the optional field. The producer
  no longer imports or invokes the sentence composer.
- Central dispatch and context dispatch compose retained text through the existing
  formatter. Raw advisory lines remain first; rows, blank lines, four-space
  indentation, tally, reload text, severity, and notify arity remain unchanged.
- Converted the two pending catalog fixtures to facts without editing expected
  catalog text. No corpus baseline, metadata, ledger, scanner, or run model changed.
- Added compile-time refusals for string/null facts and null counts, exact pure
  assertions for empty/zero/one/three/absent counts and Unicode/whitespace names,
  and a real filesystem spy proving one staging-root enumeration across both scopes.
- Recorded all five applicable edge checks and threat references in VALIDATION.md.

## Task Commits

1. **Carry facts through both message arms:** `8684a28f`
   (`refactor: carry retained workflow staging as facts`).
2. **Verify edges and record automated evidence:** `a6b843ff`
   (`test: verify retained workflow fact boundaries`).

Neither task commit deleted a tracked file.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Intentional RED | Fact-based catalog fixtures failed on exactly the two retained advisory states before implementation; RED evidence validation passed | `/tmp/pending-facts-red.log`, `/tmp/pending-facts-red.json` |
| Focused typecheck and eight owners | Passed; 363 tests, no failures or skips, 3.1s | `/tmp/pending-facts-typecheck.log`, `/tmp/pending-facts-focused.log` |
| Changed wrapper and raw-advisory caller | 138 tests passed, 4.4s | `/tmp/pending-facts-options-focused.log` |
| Changed-owner direct coverage | Six sources passed at 100% lines, branches, and functions | `/tmp/pending-facts-direct-{types,summary,dispatch,context,pending,add}.log` |
| Complete direct-pair review | Prior 253-pair run passed; unchanged owners reused with parent authorization and all six changed pairs rerun | `/tmp/row-policy-direct-all.log` and the six logs above |
| Final `npm run check` | Passed, 23m33s; 7,580 unit tests in 312 suites; 36 integration tests; zero failures or skips | `/tmp/pending-facts-check-final.log` |
| Unit coverage | 100% functions, lines, and branches | Same final-check log |
| Type-member checks | Three existing exceptions; seven of seven negative controls passed; no new suppression | Same final-check log |
| Whole corpus | All 2,661 baseline entries present, zero extra, 136s | `/tmp/pending-facts-corpus.log` |
| Immutable ledger | `Approved substitutions: 28; unchanged occurrences: 2633; total: 2661` | `/tmp/pending-facts-ledger-final.log`; exact 02-01 Task 1 command |
| Catalog | No diff from `e40d3dda`; 206 states and 26,848 bytes | Final catalog-contract owner and Git diff |
| Mandatory pre-commit | Every applicable hook passed, including direct coverage and type-member negative controls; 15m26s | `/tmp/pending-facts-precommit.log` |
| Per-task Fallow | Both verdicts `warn`, zero dead-code errors and zero complexity findings | `/tmp/pending-facts-fallow-task1.json`, `/tmp/pending-facts-fallow-task2.json` |

The final full check ran from 00:06:19 to 00:29:52 UTC on 2026-10-02, with normal
concurrency and no heap override. The corpus ran from 00:30:22 to 00:32:38 UTC.
Its existing optional pi-subagents resolver test reported module unavailability
in that harness; the ordinary full check passed every unit and integration test
with zero skips. No test was disabled or weakened.

The direct coverage branch/function/line counters, all fully covered, are:
notification-types 26/3/776; notification-summary 102/17/501;
notification-dispatch 45/18/426; notify-context 9/4/177; pending 37/8/316;
marketplace/add 161/19/1089. Existing scanner tests prove containment, read-failure
handling, and absent counts; pure formatter and carrier tests preserve those facts.

All 14 task-file SHA-256 values matched after pre-commit. No repository writes
occurred during its execution. Separate index staging produced atomic commits;
the parent authorized reuse of the clean hook evidence for identical working
bytes. Each task commit received a fresh Fallow audit.

## TDD Gate Compliance

The catalog migration supplied an intentional failing behavioral check before
implementation, and the RED evidence checker accepted it. The plan is `execute`,
the runtime TDD mode is false, and the plan explicitly requires one coordinated
carrier/consumer commit without an intermediate failing commit. The RED state
was not committed; the first implementation commit passed all required gates.

## Deviations from Plan

1. **[Rule 3 - Blocking issue] Seven-argument limit.** The proposed eighth
   parameter violated ESLint `max-params: 7`. The existing seventh parameter now
   accepts a `Pick` of the two optional carrier fields. The sole existing raw
   advisory caller in marketplace/add was adjusted and its direct owner passed.
   Conditional omission preserves `exactOptionalPropertyTypes` behavior.
2. **[Rule 3 - Blocking issue] Existing complexity threshold.** Adding omission
   branches to pendingReconcile exceeded Fallow's cognitive threshold. The
   existing scan helper now returns the optional-field object, shared by both
   branches, and the redundant empty-message helper was removed. No suppression
   or speculative abstraction was introduced.
3. **[Rule 1 - Bug] Stale declaration coordinate.** An earlier full run and an
   isolated architecture retry failed while parsing empty analyzer output. A
   direct diagnostic exited 2 and identified the dispatch contract at line 201,
   which had shifted to line 202. The existing contract was re-anchored; direct
   analysis and the complete final check passed. Peak RSS was 2,609,396 KiB;
   resource exhaustion was not the cause. Other shifted existing coordinates
   were maintained as planned, with no new exceptions.
4. **Verification reuse.** With parent authorization, the prior 253-pair direct
   run covers unchanged owners and six fresh direct runs cover changed sources.
   The final full check and corpus ran again on the final source bytes. Clean
   pre-commit evidence was reused across the two index-separated task commits.
5. **Existing worktree.** Execution remained sequential on `features/json`.
   The user's required branch convention supersedes the GSD helper's incompatible
   agent-branch namespace. No new worktree or cleanup action was introduced.

There are no unresolved implementation defects, new stubs, or deferred checks.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Handoff

PMOD-02 and PMOD-05 have complete automated execution evidence. The parent owns
independent phase verification, STATE/ROADMAP updates, requirement tracking,
and phase completion. This executor did not advance or mark the phase complete.

## Self-Check: PASSED

All 14 task files and both recorded task commits exist. The persisted base and
recorded task head contain exactly two commits. The final diff adds no stub
markers, and `git diff --check` passed. All task-file hashes match the bytes that
passed pre-commit; the production catalog and corpus baselines remain unchanged.
