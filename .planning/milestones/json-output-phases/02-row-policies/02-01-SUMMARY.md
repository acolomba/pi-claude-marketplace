---
phase: 02-row-policies
plan: "01"
subsystem: notifications
tags: [typescript, row-policy, presentation, corpus]
requires:
  - phase: 01-presentation-model
    provides: Resolved notification model and immutable output corpus
provides:
  - Total semantic policies for all 18 command contexts
  - One callback-free row grammar with defensive missing-policy facts
  - Exact ledger for 28 approved synthetic corpus replacements
  - Policy and collection-edge regression coverage
affects: [02-row-policies, presentation-consumers]
tech-stack:
  added: []
  patterns: [total policy maps, private status layout table, own-property policy lookup]
key-files:
  created:
    - .planning/phases/02-row-policies/02-CORPUS-CHANGES.json
  modified:
    - extensions/pi-claude-marketplace/shared/notify-context.ts
    - extensions/pi-claude-marketplace/shared/notification-resolve.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - tests/shared/notify-context.test.ts
    - tests/shared/notification-resolve.test.ts
    - tests/shared/notification-grammar.test.ts
    - tests/architecture/soft-dep-marker-policy.test.ts
key-decisions:
  - Preserve optional uninstalled-row versions because D-07 requires existing output.
  - Apply the user's explicit 28-record exception without adapters or baseline recapture.
  - Reuse fresh full-check evidence for pure test additions with focused and all-owner coverage.
requirements-completed: [PMOD-02]
actuals:
  tokens: 89053
  tasks: 2
  commits: 2
plan_head_before: 1c363b91e0fb401daec19fa33c2aff1c50161291
plan_head_after: aaa57348fc9d8a7c5e4159a18e522786450828ab
coverage:
  - id: PMOD-02-policies
    description: Total row policies and one shared grammar preserve command output.
    requirement: PMOD-02
    verification:
      - kind: unit
        ref: tests/architecture/soft-dep-marker-policy.test.ts
        status: pass
      - kind: other
        ref: node scripts/notify-corpus.mjs check
        status: pass
    human_judgment: false
  - id: PMOD-02-edges
    description: Defensive rows, duplicates, ordering, and empty collections retain their contracts.
    requirement: PMOD-02
    verification:
      - kind: unit
        ref: tests/shared/notification-resolve.test.ts
        status: pass
      - kind: unit
        ref: tests/shared/notification-grammar.test.ts
        status: pass
      - kind: other
        ref: npm run test:coverage:direct:all
        status: pass
    human_judgment: false
duration: 106min
completed: 2026-10-01
status: complete
---

# Phase 2 Plan 1: Row Policies Summary

All 18 command contexts now supply total semantic policy data to one shared row
grammar, with existing output preserved outside 28 explicitly approved synthetic
test occurrences.

## Performance

- Execution window: approximately 21:41–23:27 UTC on 2026-10-01, including the
  explicit approval checkpoint and required commit gates.
- Tasks: 2; committed implementation, tests, and corpus files: 48.
- Actual tokens: ceiling of the character count of `git diff
  1c363b91..aaa57348` divided by four. This includes the exact corpus patch.
- Commit count is measured from the persisted plan base through the recorded
  task head; the subsequent documentation commit is outside that interval.

## Accomplishments

- Migrated 18 contexts in 15 messaging modules. The fresh source census found
  69 actual render calls across 12 messaging test owners; all are migrated.
- Added total `RowPolicy` data, own-property lookup, and resolved missing-policy
  facts. Writable malformed rows retain their error severity floor; frozen rows
  retain their original severity without throwing.
- Centralized row text in one private 19-status layout table and formatter.
  Content reasons and dependency markers retain their independent command
  policies. Producer-status constraints remain on all four context wrappers.
- Pinned inherited names, duplicate reasons, adjacent equal rows, marketplace
  and plugin ordering, same-name rows across scopes, opposite pending snapshots,
  diagnostic trailers, empty/singleton collections, and compile-time null refusal.
- Replaced exactly 28 authorized synthetic occurrences: six dispatcher records,
  nineteen context records, and three summary records. The other 2,633
  occurrences, all severity/arity fields, corpus metadata, and the 206-state,
  26,848-byte production catalog remain unchanged.

## Task Commits

1. **Atomic row-policy migration and output fixtures:** `029250ee`
   (`refactor: replace row callbacks with semantic policies`).
2. **Defensive policies and collection-edge tests:** `aaa57348`
   (`test: pin row policy boundaries and collection ordering`).

No tracked files were deleted by either commit.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Intentional RED | Missing-policy assertion failed before implementation; RED evidence check passed | `/tmp/row-policy-red.json` |
| Migration focused suites | 679 passed | `/tmp/row-policy-focused-final.log` |
| Full `npm run check` | Passed; 7,572 unit tests, 312 suites, zero unit skips; 36 integration tests | `/tmp/row-policy-check4.log` |
| Full unit coverage | 100% functions, lines, and branches | Same full-check log |
| Type-member checks | Passed with three existing exceptions; seven of seven negative controls passed | Same full-check log and pre-commit log |
| Task 2 lint and typecheck | Passed | `/tmp/row-policy-task2-lint.log`, `/tmp/row-policy-task2-typecheck.log` |
| Task 2 focused suites | 220 passed | `/tmp/row-policy-task2-focused.log` |
| All-owner direct coverage | 253 pairs passed; every required owner counter met its total; 499.5 seconds | `/tmp/row-policy-direct-all.log`, `coverage/all-pairs.jsonl` |
| Immutable ledger verifier | `Approved substitutions: 28; unchanged occurrences: 2633; total: 2661` | Updated Task 1 automated verifier |
| Complete corpus | 2,661 baseline entries present; zero extra; 138.1 seconds | `/tmp/row-policy-corpus-approved.log` |
| Catalog | No diff from `e40d3dda` | `git diff --exit-code e40d3dda -- docs/output-catalog.md` |
| Mandatory pre-commit | All applicable hooks passed, including clean lint rerun | `/tmp/row-policy-precommit-task1.log`, `/tmp/row-policy-precommit-lint-retry.log` |
| Per-task Fallow audits | `warn`, no blocking verdict; zero dead-code or complexity errors | `/tmp/row-policy-fallow-task1.json`, `/tmp/row-policy-fallow-task2.json` |

The full check took 22m57s (22:05:20–22:28:17 UTC), including 439.1 seconds of
unit tests and 15.3 seconds of integration tests. Task 2 adds pure tests and no
notifications. The parent authorized reuse of that full check with focused,
typecheck, and all-owner direct coverage for Task 2; the final phase-wide check
remains in Plan 02. The final corpus check includes both tasks' working bytes.

The explicit pre-commit invocation included all Task 2 files and ran on the final
working tree. Task 1 was separated only in the index. SHA-256 checks confirmed
unchanged tested bytes, and staged Task 1 test files matched their saved versions.
That clean evidence covers both commits; a fresh Fallow audit preceded each.

## Deviations from Plan

1. **Output preservation:** The plan's uninstalled layout said to omit versions.
   Existing grammar and reconcile owner tests show an optional version is part
   of its output. The higher-priority D-07 preservation rule and parent approval
   retain the single-version layout.
2. **Required consumer and audit updates:** The migration also updates plugin
   shared context types, reconcile producer narrowing, corresponding tests, and
   the compatibility architecture test. Retired type-member declarations and
   exceptions were removed and surviving coordinates re-anchored. No new
   suppression was added.
3. **Measured caller count:** The planning count of 70 was stale. Source tracing
   found 69 direct calls; 84 render references also included 15 key enumerations.
   Both plans and validation now use the measured count; research history remains.
4. **Explicit corpus decision:** A complete capture exposed three additional
   summary-owner synthetic callbacks at original lines 2633, 2634, and 2640.
   Execution paused without changing these records. The user explicitly approved
   25→28 with "yes". Only those three additional triples were patched, and the
   immutable ledger and complete corpus then passed. No adapter, replay, or
   whole-baseline recapture was used.
5. **Execution order and check reuse:** While approval was pending, the parent
   authorized the independent pure-test task. Separate index staging preserved
   atomic task commits. Fresh full-check and pre-commit evidence was reused as
   described above, avoiding duplicate analysis of identical bytes.
6. **Worktree convention:** Execution used the existing `features/json` worktree
   sequentially. The user-required `features/*` branch convention superseded
   the GSD helper's incompatible agent-branch restriction.

The first lint hook reported changed files because a validation-document edit
occurred while ESLint ran; ESLint itself succeeded. No task-file bytes changed.
After all remaining hooks passed, the lint hook was rerun with repository writes
held and passed cleanly. There are no deferred implementation defects.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Plan Readiness

PMOD-02 is complete. Plan 02 can proceed with typed pending facts and final phase
verification. The orchestrator owns state, roadmap, requirement tracking, and
phase completion. This execution did not start Plan 02 or mark the phase complete.

## Self-Check: PASSED

All 48 task files and both recorded commits exist. The measured commit interval
contains exactly two commits. No unresolved stub markers were found in the
changed TypeScript files, and `git diff --check` passed.
