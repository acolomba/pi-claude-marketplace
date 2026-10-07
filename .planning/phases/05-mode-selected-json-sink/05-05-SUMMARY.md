---
phase: 05-mode-selected-json-sink
plan: "05"
subsystem: lifecycle
tags: [notifications, json, rpc, hooks, recovery]
requires:
  - phase: 05-01
    provides: Required mode validator, entry sink, and structured capture
  - phase: 05-02
    provides: Original-run delivery and protected formatter provenance
  - phase: 05-03
    provides: Reconcile diagnostics through the original run
  - phase: 05-04
    provides: Parent-run authentication carriers
provides:
  - Guarded load mutations with independent read-only discovery and warning containment
  - JSON/RPC load warnings using the original load run
  - Guarded session environment, autocomplete, and deferred shared-directory preparation
affects: [05-06, 05-07]
actuals:
  tokens: 13507
  tasks: 2
  commits: 3
plan_head_before: 11d7dd9969a87210df3601c05b305800c8a6ba31
plan_head_after: c554c134090c4e2d6699a19c6ea368dd8130f2a8
tech-stack:
  added: []
  patterns: [Live guards before lifecycle mutation, Independent lifecycle failure containment]
key-files:
  created:
    - .planning/phases/05-mode-selected-json-sink/05-05-RED-1.json
    - .planning/phases/05-mode-selected-json-sink/05-05-RED-2.json
  modified:
    - extensions/pi-claude-marketplace/index.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - tests/index.test.ts
    - tests/edge/register.test.ts
    - tests/shared/notification-dispatch.test.ts
    - tests/bridges/hooks/event-router.test.ts
    - tests/architecture/hooks-lifecycle.test.ts
    - tests/integration/hooks-dispatch-end-to-end.test.ts
    - .planning/phases/05-mode-selected-json-sink/05-VALIDATION.md
key-decisions:
  - Retain one original load run and independent catches for each warning and mutation stage.
  - Keep factory recovery independent of mode; guard fresh preparation in SessionStart.
  - Preserve supported user-hook dispatch after a project hydration failure.
patterns-established:
  - Read-only discovery follows guarded mutation preparation even when preparation rejects.
requirements-completed: ["MODE-02","JOUT-01","JOUT-05","TENB-01"]
coverage:
  - id: D1
    description: Unsupported load and session contexts cannot mutate disk, environment, or autocomplete, while existing resources remain discoverable.
    requirement: MODE-02
    verification:
      - kind: unit
        ref: tests/index.test.ts#unsupported loading preserves disk and environment while discovering existing resources
        status: pass
      - kind: other
        ref: node --test tests/index.test.ts tests/edge/register.test.ts tests/shared/notification-dispatch.test.ts tests/shared/debug-log.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Both load-warning kinds append valid JSON/RPC entries through the original run and contain append failures without losing independent work.
    requirement: JOUT-01
    verification:
      - kind: other
        ref: node --test tests/index.test.ts tests/edge/register.test.ts tests/shared/notification-dispatch.test.ts tests/shared/debug-log.test.ts
        status: pass
      - kind: other
        ref: node scripts/notify-corpus.mjs check
        status: pass
    human_judgment: false
  - id: D3
    description: SessionStart prepares eligible scopes after mode guards, contains stale capabilities, and preserves factory recovery and generation defenses.
    requirement: JOUT-05
    verification:
      - kind: unit
        ref: tests/bridges/hooks/event-router.test.ts#SessionStart prepares both scopes before json hooks run
        status: pass
      - kind: integration
        ref: tests/integration/hooks-dispatch-end-to-end.test.ts
        status: pass
      - kind: other
        ref: npm run check
        status: pass
    human_judgment: false
duration: 30min
completed: 2026-10-07
status: complete
---

# Phase 05 Plan 05: Guarded Load and Session Lifecycles Summary

**Load warnings use the original JSON/RPC run, unsupported contexts preserve discovery without new mutations, and shared hook directories are prepared only during guarded SessionStart.**

## Performance

- Started: 2026-10-07T12:40:16Z
- Verification completed: 2026-10-07T13:10:43Z
- Duration: approximately 30 minutes
- Tasks: 2
- Source/test files changed: 10; two RED records, validation, and this summary add four planning files.
- Actual tokens: 54,026 realized task-diff characters / 4, rounded up. This is not harness usage.
- Runtime: Node `v26.10.0`.

## Accomplishments

- Guarded load hydration, reconcile, PATH, session environment, and autocomplete work. Unsupported/stale mode access remains contained, and existing resource discovery still runs.
- Required the original load run in both warning helpers. Full JSON/RPC payload capture proves ordering, independent warning attempts, exclusive entry delivery, and retained committed state after append refusal.
- Moved fresh shared-directory creation from registration into supported SessionStart. Both eligible scopes are ready before hooks execute; sibling preparation failures, generation changes, and context/dispatch failures stay contained. Existing factory child shutdown and orphan recovery remain independent.

## Task Commits

1. **Task 1: Guard load mutations and contain load/session output failures** — `66d6e2f1` (`feat: guard load mutations and contain lifecycle output failures`).
2. **Task 2: Move fresh shared-directory creation behind SessionStart** — `f89156b1` (`fix: defer shared hook directories until guarded session start`).
3. **Task 2: Integration correction preserving independent hydration failure handling** — `c554c134` (`fix: preserve hook dispatch after project hydration failure`).

All three commits passed their required hooks. No commit was amended, rebased, or made with hooks disabled. The measured three-commit interval excludes this subsequent metadata commit.

## Verification

All commands ran with cwd pinned to this isolated worktree.

| Command | Observed result |
| --- | --- |
| `node --test tests/index.test.ts tests/edge/register.test.ts tests/shared/notification-dispatch.test.ts tests/shared/debug-log.test.ts` | 476 passed, zero failed or skipped. |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/index.ts extensions/pi-claude-marketplace/edge/register.ts extensions/pi-claude-marketplace/shared/notification-dispatch.ts` | Exit 0; all three owners at 100% lines/functions/branches. |
| `node --test tests/bridges/hooks/event-router.test.ts tests/index.test.ts` | 73 passed, zero failed or skipped. |
| `node --test tests/bridges/hooks/event-router.test.ts tests/index.test.ts tests/integration/hooks-dispatch-end-to-end.test.ts` | Final correction: 77 passed, zero failed or skipped. |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` | Exit 0 after the final correction; 100% lines/functions/branches. |
| `node_modules/.bin/fallow audit --base <task-base>` | Passed before each commit; bases `11d7dd99`, `66d6e2f1`, `f89156b1`. No audit findings. |
| `SKIP=npm-check pre-commit run --files <changed task files>` | Final runs passed. Prettier edits were restaged and fixers rerun. |
| `git commit` with normal hooks | All final task commits passed `npm run check:commit` and commit-message checks. |
| `npm run check` | Final exit 0 at `c554c134090c4e2d6699a19c6ea368dd8130f2a8`; static, unpaired, integration, and all direct pairs passed; 264 LCOV records. |
| `node scripts/notify-corpus.mjs check > /tmp/p05-05-corpus.log 2>&1` | Exit 0; 8888 passed, zero failed, one pre-existing optional resolver skip. |
| Saved-log missing/extra/count assertions | Passed: exact `Notify corpus check passed: 3149 baseline entries present, 0 extra.` and no missing/extra lines. |
| `git diff --exit-code 26cb0056 -- docs/output-catalog.md` | Exit 0, no output. |
| `git diff --check` and protected notification-call count | Passed; exactly two `ctx.ui.notify` calls remain inside `deliver`. Formatter-provenance controls passed unchanged. |

Final full-gate log: `/tmp/p05-05-full-check2.log`. Task logs are `/tmp/p05-05-owner3.log`, `/tmp/p05-05-router3.log`, and `/tmp/p05-05-router4.log`. No source, test, dependency, configuration, or tool input changed after the passing final full gate. RED evidence files already existed unchanged when it ran.

## TDD Gate Compliance

- **Task 1 RED:** The exact command and unmodified TAP are in `05-05-RED-1.json`. The named unsupported-load case discovered its seeded resource but failed because PATH and the plugin PATH ledger changed. The classifier returned `RED_EVIDENCE_OK`; semantic inspection confirmed the planned assertion failure.
- **Task 2 RED:** `05-05-RED-2.json` records the clean two-scope JSON case against the committed pre-change router. Both directories existed before SessionStart instead of being absent. The classifier returned `RED_EVIDENCE_OK`; there were no fixture/import failures.
- **GREEN:** Both planned behaviors and their direct owner coverage pass. Source and green tests were committed together as explicitly authorized because project hooks reject failing commits. No separate RED commit was attempted.
- **REFACTOR:** No separate cleanup commit was needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing architecture and integration contexts lacked mode**

- Found during Task 2's hook and the first full gate.
- Added explicit `mode: "print"` to the existing live SessionStart fixtures in `tests/architecture/hooks-lifecycle.test.ts` and `tests/integration/hooks-dispatch-end-to-end.test.ts`.
- All existing generation, hydration, scope, and dispatch assertions remain intact. These are the only source/test files added to the plan's ownership list.
- Verification: final hooks, 77 focused tests, and the full gate passed.
- Commits: `f89156b1`, `c554c134`.

**2. [Rule 1 - Bug] Restore independent dispatch after project hydration failure**

- Found during the first full gate: the new broad SessionStart catch would stop otherwise valid user hooks after a project hydration error.
- Restored the narrow hydration catch inside the supported-mode boundary in `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`.
- Verification: the unchanged integration dispatch assertion passes, direct coverage remains 100%, and the final full gate passes.
- Commit: `c554c134`.

**Total deviations:** Two auto-fixed issues (one blocker, one bug). No architectural change, dependency installation, or gate relaxation.

## Issues Encountered

- Task 1 commit attempts first reported test lint findings (braces, import order, unbound property expectation, typed reflection results, spacing), then the existing reserved-vocabulary guard rejected a new test label. The labels and test code were corrected; the guard was unchanged and the successful commit ran all hooks.
- The first directory RED used a recovery fixture whose PID writers independently create `_shared`. That was not adequate semantic evidence. Its changed assertion was restored; the clean new fixture was rerun against committed pre-change production and classified before restoring the guarded implementation. The retained record contains the valid rerun.
- The first full gate failed three integration cases; the mode fixtures and narrow hydration catch were fixed and committed before rerunning the entire gate successfully.
- Fallow symbol-impact timed out during caller research; CodeGraph and textual caller tracing supplied the call paths. A parallel Fallow review/audit produced cache warnings; a subsequent sequential audit was clean. The final required static Fallow gate passed.
- Initial sandboxed Git status encountered a read-only shared LFS temporary path. Required Git/check commands completed through the authorized automatic escalation mechanism, always in this isolated checkout.
- The GSD `--plan` evaluation-scope query matches phase-scoped commit subjects, which project commit policy forbids. The phase-directory resolver with `--since 11d7dd9969a87210df3601c05b305800c8a6ba31` instead resolves this summary's three task commits; Git ancestry also verifies them directly.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None.

## Next Phase Readiness

Ready for 05-06. Async-rewake/settle delivery and phase-wide closure remain assigned to 05-06/05-07. The accepted startup-streaming host limitation and unresolved planning assumptions/prohibitions remain unchanged. The corpus retains its one existing optional resolver skip; no new skip or stub was added.

STATE.md, ROADMAP.md, and shared requirement completion remain parent-owned and unchanged.

## Self-Check: PASSED

All created artifacts exist; all three task commits are reachable on this branch. Owner checks, final direct coverage, the full gate, exact corpus assertions, and catalog equality pass. Validation rows record observed results only.
