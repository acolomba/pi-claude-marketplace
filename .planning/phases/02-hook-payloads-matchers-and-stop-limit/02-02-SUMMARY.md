---
phase: 02-hook-payloads-matchers-and-stop-limit
plan: "02"
subsystem: hooks
tags: [hook-payloads, glob, grep, tool-input, cucumber]
requires:
  - phase: 02-hook-payloads-matchers-and-stop-limit
    provides: Plan 02-01's native tool identity and pre-tool input translation
provides:
  - Exact Glob and Grep hook input translation with all-or-original rewrite decoding
  - Shared translated input in successful, failed, and background tool hooks
  - Real command-hook evidence for search rewrites and failed Read translation
affects: [hook-results, hook-matchers, background-hooks]
actuals:
  tokens: 15786
  tasks: 3
  commits: 3
plan_head_before: d97fb5eb9c9e76c2832064b681c91212f0b80bdd
plan_head_after: 45317714112907adbb3930cf06744deb509a4713
tech-stack:
  added: []
  patterns: [shared native-to-hook input codec, exact search rewrite decoding]
key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/hooks/tool-input-search.ts
    - test/bridges/hooks/tool-input-search.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/tool-input.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts
    - features/hook/tool-use.feature
    - features/hook/tool-failure.feature
key-decisions:
  - Rejected search replacements preserve the entire native call and issue the existing ignored-rewrite notice.
  - LS remains native-shaped pending an evidenced upstream schema.
patterns-established:
  - Success and failure payloads call the same input mapper used by pre-tool hooks.
requirements-completed: []
coverage:
  - id: D1
    description: Glob and Grep hooks receive exact search inputs, and only equivalent rewrites change real searches.
    requirement: PG-HOOK-01
    verification:
      - kind: unit
        ref: node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/tool-input-search.test.ts test/bridges/hooks/tool-input.test.ts
        status: pass
      - kind: e2e
        ref: npx cucumber-js --profile adapter --name "A Glob hook|A Grep hook|An unsupported Grep rewrite" features/hook/tool-use.feature
        status: pass
    human_judgment: false
  - id: D2
    description: Successful Read, Write, Bash, Glob, and Grep hooks receive the input that executed under locked tool names.
    requirement: PG-HOOK-01
    verification:
      - kind: unit
        ref: test/bridges/hooks/payloads/post-tool-use.test.ts and test/domain/components/hook-tool-names.test.ts
        status: pass
      - kind: e2e
        ref: npx cucumber-js --profile adapter --name "Successful tool hooks receive the translated input that executed" features/hook/tool-use.feature
        status: pass
    human_judgment: false
  - id: D3
    description: Failed and background tool hooks retain the same translated input and real failure envelope.
    requirement: PG-HOOK-01
    verification:
      - kind: unit
        ref: test/bridges/hooks/payloads/post-tool-use-failure.test.ts, test/architecture/hooks-translators.test.ts, and test/bridges/hooks/async-rewake/registry.test.ts
        status: pass
      - kind: e2e
        ref: npm run test:cucumber:profile -- --profile adapter features/hook/tool-failure.feature
        status: pass
    human_judgment: false
duration: ~45min
completed: 2026-11-13
status: complete
---

# Phase 02 Plan 02: Hook Search Inputs and Shared Tool Payloads Summary

**Exact Glob and Grep hook inputs now drive accepted search rewrites, while successful, failed, and background hooks share translated tool input.**

## Performance

- **Duration:** Approximately 45 minutes; the entry time was not captured, so this is an estimate.
- **Completed:** 2026-11-13T00:00:35Z
- **Tasks:** 3
- **Files modified:** 14
- **Diff size:** 63,145 characters / 4 = 15,786 estimated tokens

## Accomplishments

- Glob and Grep search options round-trip through the hook contract, preserving native-only limits and rejecting any replacement whose full semantics cannot execute in Pi.
- Successful tool payloads use the same translated input as pre-tool hooks; the eight canonical tool names remain unchanged.
- Failed Read hooks report `file_path`, the actual joined error, and `is_interrupt: false` without a fabricated success response; background serialization uses the shared translators.

## Task Commits

| Task ID | Task | Commit |
| --- | --- | --- |
| 02-02-01 | Translate equivalent Glob and Grep requests on the live hook path | `c69bf7affbaea9fb648777ce0247b65a8e294930` |
| 02-02-02 | Send translated input to successful result hooks | `f5d604718b0cfd60e7c3e7cb2478e41cca9f0651` |
| 02-02-03 | Carry the same input contract through failure and background payload construction | `45317714112907adbb3930cf06744deb509a4713` |

Each task was committed separately with normal commit hooks. The three commits are measured from `plan_head_before` through `plan_head_after`.

## Verification

- Final seven owner test modules: **7 passed, 0 failed**.
- Direct coverage for `tool-input-search.ts`, `tool-input.ts`, `post-tool-use.ts`, and `post-tool-use-failure.ts`: **passed**.
- Search rewrite Cucumber scenarios: **3 passed, 47 steps passed**.
- Successful translated-input Cucumber outline: **5 passed, 75 steps passed**.
- Complete `features/hook/tool-failure.feature`: **10 passed, 143 steps passed**.
- `npm run check:features` and targeted ESLint: **passed** during task execution.
- Fallow audit against `d97fb5eb9c9e76c2832064b681c91212f0b80bdd`: **no issues in 14 changed files**.
- The combined-tree `npm run check` gate belongs to the parent after both Wave 2 plans merge; it was not run in this isolated worktree.

## Evidence Limits

- LS remains native-shaped with path and limit validation. This does not establish an upstream Claude LS schema.
- PowerShell mapping is covered as a pure codec contract; no live PowerShell executable was run.
- Search scenarios exercise real Pi command hooks and executions. The success and failure payload scenarios exercise their respective real hook paths.

## Decisions Made

- A search rewrite is accepted only when every supplied execution option has an exact native equivalent. Rejected candidates leave the whole original tool call intact.
- The task-level `tdd="true"` markers were implemented with behavior tests and one green commit per task. The project's `workflow.tdd_mode` is disabled, and the requested atomic task commits ran normal hooks. No separate RED commits were made.

## Deviations from Plan

**[Rule 3 - Blocking] Enabled Pi search tools in the isolated Cucumber fixture.** Found during Task 02-02-01: the fixture's isolated settings did not expose `find` and `grep`, so real search command-hook scenarios could not execute. Updated `features/step_definitions/hook/tool-use.steps.ts` to enable those tools. The three search scenarios then passed. Included in `c69bf7affbaea9fb648777ce0247b65a8e294930`.

**Total deviations:** 1 auto-fixed blocking fixture issue. **Impact:** No change to production scope or sibling-owned files.

## Issues Encountered

Initial commit-hook runs exposed formatting, lint, and test-fixture issues. Those were corrected before their respective task commits; every recorded commit passed normal hooks. No package upgrades or tool wrappers were added.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Requirement Status

The plan contributes to PG-HOOK-01 but does not complete the full requirement. `requirements-completed` remains empty; the parent owns shared requirement updates.

## Self-Check: PASSED

The created search source and paired test exist. All three task commits are ancestors of the plan head. Focused owner, direct-coverage, behavioral, and audit checks passed. No shared orchestration artifact was modified.

## Next Phase Readiness

Ready for the parent to merge both Wave 2 plans and run the combined-tree `npm run check` gate. PG-HOOK-01 remains open for the rest of the phase.
