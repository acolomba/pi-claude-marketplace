---
phase: 05-mode-selected-json-sink
plan: "06"
subsystem: hooks
tags: [notifications, json, rpc, lifecycle, recovery]
requires:
  - phase: 05-05
    provides: Guarded load and session lifecycles and original-run raw transport
provides:
  - Exclusive JSON/RPC rewake summaries with terminal cleanup and stale-context containment
  - Stop-cap warning delivery that preserves the completed loop-protection transition
  - Required callback runs for both hook notification helpers
affects: [05-07]
actuals:
  tokens: 7348
  tasks: 2
  commits: 2
plan_head_before: 76f842ae02284b49368104cd583e850f2d74b3ac
plan_head_after: fbb7b0ca8fa9e9bb07f5f7be28fa015616435c6e
tech-stack:
  added: []
  patterns: [Callback-owned notification runs, Cleanup before transport, Cap transition before delivery]
key-files:
  created:
    - .planning/phases/05-mode-selected-json-sink/05-06-RED-1.json
    - .planning/phases/05-mode-selected-json-sink/05-06-RED-2.json
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - tests/bridges/hooks/async-rewake/registry.test.ts
    - tests/bridges/hooks/settle.test.ts
    - tests/shared/notification-dispatch.test.ts
    - tests/architecture/hooks-cap-notify.test.ts
    - tests/architecture/presentation-sink.test.ts
    - .planning/phases/05-mode-selected-json-sink/05-VALIDATION.md
key-decisions:
  - Keep output catches separate from executor failures and independent supported rewake injection.
  - Preserve exact formatter provenance while removing the last transitional text-only raw helper.
patterns-established:
  - Hook roots validate mode and open a real run; dispatcher helpers never open their own runs.
requirements-completed: ["JOUT-01", "JOUT-05", "MODE-02", "TENB-01"]
coverage:
  - id: D1
    description: Rewake summaries append complete exclusive JSON/RPC entries and preserve empty and whitespace behavior.
    requirement: JOUT-01
    verification:
      - kind: unit
        ref: tests/bridges/hooks/async-rewake/registry.test.ts#settles rewake with json and persists terminal cleanup
        status: pass
      - kind: unit
        ref: tests/shared/notification-dispatch.test.ts#rewake dispatch preserves whitespace and duplicates in rpc
        status: pass
    human_judgment: false
  - id: D2
    description: Terminal cleanup and valid independent injection survive delivery failures while stale modes and generations suppress fresh work.
    requirement: JOUT-05
    verification:
      - kind: other
        ref: node --test tests/bridges/hooks/async-rewake/registry.test.ts tests/shared/notification-dispatch.test.ts tests/architecture/hooks-async-rewake.test.ts
        status: pass
      - kind: other
        ref: npm run check
        status: pass
    human_judgment: false
  - id: D3
    description: Stop-cap warnings retain warning facts and severity and cannot reset the cap or repeat after delivery failure.
    requirement: MODE-02
    verification:
      - kind: other
        ref: node --test tests/bridges/hooks/settle.test.ts tests/shared/notification-dispatch.test.ts tests/architecture/hooks-cap-notify.test.ts
        status: pass
      - kind: other
        ref: node scripts/notify-corpus.mjs check
        status: pass
    human_judgment: false
duration: 29min
completed: 2026-10-07
status: complete
---

# Phase 05 Plan 06: Guarded Hook Notification Runs Summary

**Async-rewake summaries and Stop-cap warnings use callback-owned JSON/RPC runs while terminal cleanup, independent exit-2 injection, and loop protection survive output failures.**

## Performance

- Started: 2026-10-07T13:21:59Z
- Verification completed: 2026-10-07T13:50:12Z
- Tasks: 2
- Source/test files changed: 8; two RED records, validation, and this summary add four planning files.
- Runtime: Node `v26.10.0`.
- Actual tokens: 29,392 realized task-diff characters / 4. The ledger measures two task commits before metadata close-out.

## Accomplishments

- Rewake finalization removes the child and schedules terminal PID persistence before mode/output handling. Stale generations cannot emit. Supported append or sink failures preserve valid independent exit-2 injection, and stale mode/isIdle accesses stay contained.
- Both raw hook helpers require the root run and use the common live transport selector. Only a zero-length rewake summary is suppressed; whitespace and duplicate payloads remain data. Original text bytes and argument counts remain pinned.
- Stop callbacks validate mode before fresh hooks, pass one real run through both continuation lanes, and record the cap before the narrow warning catch. Failed delivery neither resets the cap nor causes another warning or capped reentry. StopFailure observations and executor-rejection behavior remain intact.

## Task Commits

1. **Task 06.1: Guard async-rewake transport and completion** — `4520b0ea36bcecb30232f201186eb3f73b8fa9c8` — `feat: route async rewake output through guarded callback runs`.
2. **Task 06.2: Preserve Stop loop protection across delivery failures** — `fbb7b0ca8fa9e9bb07f5f7be28fa015616435c6e` — `feat: contain Stop cap delivery while retaining loop protection`.

Both commits passed all required hooks. This metadata commit contains the summary, validation observations, and RED evidence. No task commit deleted a tracked file. No amend, rebase, force-add, or hook bypass was used.

## Verification

All commands ran in the isolated worktree on Node `v26.10.0`.

| Command | Observed result |
| --- | --- |
| `node --test tests/bridges/hooks/async-rewake/registry.test.ts tests/shared/notification-dispatch.test.ts tests/architecture/hooks-async-rewake.test.ts` | Exit 0; 295 tests, no failures/skips; `/tmp/p05-06-owner1.log`. |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts extensions/pi-claude-marketplace/shared/notification-dispatch.ts` | Exit 0; both owners at 100% lines/functions/branches; `/tmp/p05-06-coverage1.log`. |
| `node --test tests/bridges/hooks/settle.test.ts tests/shared/notification-dispatch.test.ts tests/architecture/hooks-cap-notify.test.ts` | Exit 0; 292 tests, no failures/skips; `/tmp/p05-06-owner2.log`. |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/settle.ts extensions/pi-claude-marketplace/shared/notification-dispatch.ts` | Exit 0; both owners at 100% lines/functions/branches; `/tmp/p05-06-coverage2.log`. |
| `node_modules/.bin/fallow audit --base HEAD` before each task commit | Passed; task bases `76f842ae` and `4520b0ea`; no new issues. |
| `SKIP=npm-check pre-commit run --files <task files>` | Final passes exited 0; formatter edits were restaged and rechecked. |
| Both task `git commit` commands with hooks | Final attempts passed `npm run check:commit` and commit-message checks; logs `/tmp/p05-06-commit1b.log` and `/tmp/p05-06-commit2c.log`. |
| `npm run check` | Exit 0 at `fbb7b0ca8fa9e9bb07f5f7be28fa015616435c6e`; static, unpaired, integration, and all 264 direct pairs passed; `/tmp/p05-06-full-check.log`. |
| `node scripts/notify-corpus.mjs check > /tmp/p05-06-corpus.log 2>&1` | Exit 0; 8911 passed, zero failed, one pre-existing optional resolver skip. |
| Node strict assertions on the saved corpus log | Passed: exact 3149-present/0-extra success line and no `missing in ` or `extra in ` lines. |
| `git diff --exit-code 26cb0056 -- docs/output-catalog.md` | Exit 0, no output. |
| Both `gsd-tools.cjs check tdd-red-evidence ... --raw` commands | `RED_EVIDENCE_OK` before implementation and at close-out. |
| `git diff --check`, task ancestry, shared-state diff, and stub scan | Passed; shared STATE.md and ROADMAP.md are unchanged; no new stubs or skips. |

Final source/test/dependency/configuration inputs did not change after the passing full gate. The RED JSON records already existed unchanged during that gate. Final planning Markdown edits reuse that result under local-verification policy.

## TDD Gate Compliance

- **Task 1 RED:** The target completed real terminal cleanup and independent exit-2 handling but observed no JSON entry. The final evidence uses the schema's existing `text` field. An initial expected-field mistake was corrected and RED was re-observed against committed pre-change production before retaining the classified record in `05-06-RED-1.json`.
- **Task 2 RED:** Unsupported initial mode allowed Stop to become active. The exact public-handler test failed the planned state assertion, with no fixture/import failure. Complete TAP and semantic assessment are retained in `05-06-RED-2.json`.
- **GREEN:** Complete hook payloads, containment, direct owner coverage, and full handoff checks pass. Green source and tests were committed together as explicitly authorized because hooks reject failing commits.
- **REFACTOR:** No separate refactor commit was needed. The obsolete text-only dispatcher helper was removed with its final caller migration.

## Decisions Made

Followed the accepted callback-run and failure-containment decisions. Inventory lookup failures retain the existing unloaded soft-dependency fallback. The protected Stop preparation catches do not swallow executor rejections. No new transport, wire field, model injection, or logger was introduced.

## Deviations from Plan

**1. [Rule 3 - Blocking] Retarget exact sink assertions for the completed hook migration.**

- Found during Task 1 direct-coverage preparation and Task 2 final caller migration.
- Added `tests/architecture/presentation-sink.test.ts` to the ownership list for the necessary exact call-shape updates already authorized by the parent.
- Task 1 removes an unreachable empty guard from the remaining cap-only transitional path. Task 2 removes that now-orphaned helper and its extra internal delivery call.
- The gate still requires exactly two UI calls inside `deliver`, no stray UI/delivery mentions, exact formatter provenance, and the unchanged literal set. It now also pins the hook group's route through the common selector.
- Verification: task hooks, direct coverage, full gate, and unchanged corpus/catalog. Commits: `4520b0ea`, `fbb7b0ca`.

Total deviations: one necessary assertion migration, with no gate relaxation. `tests/architecture/hooks-async-rewake.test.ts` required no edit because it calls the registry rather than the migrated dispatcher helper; its existing assertions pass unchanged.

## Issues Encountered

- Initial sandboxed Git status failed when the LFS filter tried to write shared metadata. Required Git/check commands succeeded through authorized automatic escalation with cwd retained in this worktree.
- The first task commit failed seven spacing checks. Task 2 attempts found three spacing checks and a reserved test-only vocabulary literal. All were corrected, and successful retries ran every hook.
- A broad experimental Stop catch swallowed the existing executor-rejection contract. Owner tests caught it; the catch was narrowed before commit and the unchanged assertion passes.
- The GSD plan-only evaluation resolver returned no matches because it searches phase-scoped commit subjects, which project policy forbids. Exact task hashes and the persisted ledger verify this branch's two commits. The phase-directory resolver with the recorded base returned both hashes and eight changed source/test files through its reported phase-range fallback.
- No supplied project-root pin block was present. All operations stayed in the provided isolated checkout; branch and worktree-sentinel assertions ran before task commits.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None.

## Next Phase Readiness

Ready for 05-07. Phase-wide verification and assumption/prohibition assessments remain parent-owned. In particular, P-05-02 remains a judgment assessment; passing payload/text checks do not silently resolve it. The existing optional resolver skip and accepted host startup-streaming limitation remain unchanged. Logs under `/tmp` are session-local; committed RED records and this summary retain the evidence.

Shared STATE.md, ROADMAP.md, and requirement completion remain parent-owned and unchanged.

## Self-Check: PASSED

Both RED records and this summary exist. Both exact task hashes are ancestors of HEAD, and the persisted ledger measures two task commits. Owner/direct checks, every task acceptance criterion, the full handoff gate, exact corpus assertions, and catalog equality pass. No new stubs, skips, dependencies, or unintended deletions remain.
