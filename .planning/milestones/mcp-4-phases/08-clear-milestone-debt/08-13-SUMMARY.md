---
phase: 08-clear-milestone-debt
plan: 13
subsystem: bridges-mcp (staging environment, collision exemption, stage notices)
tags: [d-08-06, avar-02, aname-03, afile-05, afile-06, debt-04, debt-02]

requires: [08-10, 08-11, 08-12]
provides:
  - "Required `StageMcpInput.env: ClaudeEnv`; `prepareStageMcpServers` passes `input.env` to substitution and stage.ts reads no `process.env` (D-08-06, AVAR-02)"
  - "`assertNoMcpCollisions` exempts only the exact key the plugin owns in the target (`Object.hasOwn(check.ours, name)`), so a folded rename walks the other sources (AFILE-05, ANAME-03)"
  - "Stage results carry one `override-restored` notice per dropped owned entry whose kept override the stage writes back, right after the override-kept notices, from `restoredOverrideNames` (AFILE-06)"
affects: [08-14 (docs), 08-21 (P4 IN-02, P3 IN-01 and P2 IN-02 ledger rows; DEBT-02/DEBT-04 verdicts)]

actuals:
  tokens: 7000
  tasks: 2
  commits: 2
plan_head_before: db3dafecc9e8e29003771cea91804ff5295ec29b
plan_head_after: 94097beb720b5d11856eaac215f9de1c9b8b1bb8

tech-stack:
  added: []
  patterns:
    - "A bridge input field that its callers' entry points default (D-08-06) is required at the bridge"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/mcp/types.ts
    - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
    - tests/bridges/mcp/types.test.ts
    - tests/bridges/mcp/stage.test.ts
    - tests/architecture/integration-materialization-gate.test.ts

key-decisions:
  - "Stage tests that do not drive a variable pass `env: {}`; the two AVAR-02 process-environment cases set or delete the process variable through a `setProcessVariable` helper that restores it in `t.after`"
  - "`overrideRestoredNotices` takes no `rewritesTarget` guard: a restorable name comes only from an owned entry, and an owned entry always makes the stage rewrite the target"

patterns-established: []

requirements-completed: []

duration: 16min
completed: 2026-10-10
status: complete
---

# Phase 08 Plan 13: Required staging environment, exact-key collision exemption, override-restored on stage Summary

**The MCP bridge now stages with only the environment its caller passes: `StageMcpInput.env` is required and the `?? process.env` fallback is gone. A plugin key renamed onto a spelling it owned only after `-`/`_` folding now goes through the other-source collision walk. A stage that drops a server with a kept override reports `override-restored`, the same way unstage does.**

## Performance

- **Duration:** about 16 min (2026-10-10T05:36Z to 05:52Z)
- **Tasks:** 2/2
- **Files modified:** 5 (2 sources, 3 tests)

## Findings closed

| Finding | Disposition | Commit |
| ------- | ----------- | ------ |
| P4 IN-02 (D-08-06, DEBT-04), final part | `StageMcpInput.env` is required and stage.ts holds no `process.env` read. With 08-11 and 08-12 every caller passes env | 84ff4aa0 |
| P3 IN-01 (DEBT-02; ANAME-03, AFILE-05) | the self-replace exemption keys on the exact owned key, so a folded rename walks the other sources and refuses a foreign full definition there | 94097beb |
| P2 IN-02 (DEBT-02; AFILE-06) | a stage that drops an owned entry with a restorable kept override emits `override-restored` for it after the override-kept notices | 94097beb |

## Task Commits

1. **Task 1 (tracer): Staging reads only the environment its caller passes.** Commit `84ff4aa0` (refactor). Pre-commit log `tmp/p8-13-precommit.log` ends `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed on the first attempt. The tracer gate re-ran the automated verify (green) before Task 2.
2. **Task 2: A folded rename still walks the other sources, and a dropped server's override restore is reported.** Commit `94097beb` (fix). Pre-commit log `tmp/p8-13-precommit2.log` ends `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed on the first attempt.

## Verify results (final lines)

- Task 1: `npm run typecheck` exit 0. `node --test` stage + types + integration-materialization-gate + mcp-variable-expansion: `ℹ tests 111`, `ℹ pass 111`, `ℹ fail 0`. `npm run test:coverage:direct -- <stage.ts> <types.ts>` exit 0, no shortfall printed.
- Task 2: `node --test` stage + unstage + mcp-config-notices + mcp-override-lifecycle: `ℹ tests 176`, `ℹ pass 176`, `ℹ fail 0`. `npm run test:coverage:direct -- <stage.ts>` exit 0, no shortfall printed.
- Fallow audit before the Task 2 commit: `verdict pass`, 8 clone groups, 0 introduced.
- Acceptance: `grep -n "process.env"` on stage.ts prints nothing; types.ts:44 holds `readonly env: ClaudeEnv;` and no `env?: ClaudeEnv`; the old "reads Pi's process environment" title is gone; the `assertNoMcpCollisions` awk prints `Object.hasOwn(check.ours, name) &&`; stage.ts:295 builds the `override-restored` notice.
- I did not run `npm run check`. The orchestrator runs it at the wave boundary.

## Mutation record

- Staging env: replacing `env: input.env` with `{ ...process.env, ...input.env }` failed the "empty env reports a variable Pi's process environment sets as missing" case (`ℹ fail 1`). Restored.
- Exemption: restoring the folded `foldedMatches(Object.keys(check.ours), name).length > 0` test failed the folded-rename case. Replacing the exemption with `false` failed the exact-key case. Restored each time.
- Restored notices: removing the staged-key filter failed one existing restage case (and tsc reported the unused parameter). Restored.

## Deviations from Plan

**1. Plugin name in the new cases**
- **Found during:** Task 2
- **Issue:** the plan's behavior names plugin `p` (`plugin_p_a-b_`). The neighboring ANAME-03 cases and the `preparePlugin` helper use `acme`.
- **Fix:** the new cases use `plugin_acme_a-b_` / `plugin_acme_a_b_`. Same behavior.

**2. Requirements not marked complete**
- DEBT-02 and DEBT-04 cover the whole phase. Plan 08-21 owns them.

**Total deviations:** 1 naming choice, with no change to behavior.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

Mitigations:
- T-08-28: only the exact owned key is exempt. A folded rename that lands on a key a user's `~/.config/mcp/mcp.json` defines in full now throws `McpServerCollisionError` naming that file, and the target keeps its bytes.
- T-08-29: a dropped server's restored override is reported as an `override-restored` fact, so the fold can cancel the earlier override-kept line.
- T-08-30: stage.ts reads no process environment. The new cases pass explicit environments, and the two process-variable cases restore the variable in `t.after`.

## Notes for later plans

- `restoredOverrideNames` covers owned entries in every server map, but the stage filters out only the staged keys. An owned entry under a staged key in a non-selected server map (the legacy `servers` key next to `mcpServers`) also writes its override back, but it gets no notice. Unstage reports from the same name list, so the two stay consistent. I did not change it because the plan prescribes the staged-key filter.
- 08-21: map P4 IN-02 to 08-11, 08-12 and `84ff4aa0`; P3 IN-01 and P2 IN-02 to `94097beb`.

## Self-Check: PASSED

- All five modified files exist.
- Commits 84ff4aa0 and 94097beb are ancestors of HEAD.
