---
phase: 08-clear-milestone-debt
plan: 07
subsystem: e2e harness, notify, platform, developer launch script
tags: [e2e, adet-02, notify-context, pi-sh, debt-02]

requires: []
provides:
  - "`readPid` in the adapter-detection e2e test refuses a PID that is not a positive integer, and the built-in-only case asserts the sentinel PID only after `assertCleanSession(run)` (P1 IN-09)"
  - "`inventoryEntries` fails when the inventory probe's field is not an array (P1 IN-11)"
  - "`dispatchRow` casts the looked-up render arm once, with a stated reason, and calls it directly (P1 IN-04)"
  - "The ADET-02 comment above `hasLoadedPiMcpAdapter` wraps near 78 columns and reads correctly (P1 IN-08)"
  - "`scripts/pi.sh --help` and CONTRIBUTING.md document the credential-less default home; the default-home path keeps a preset `PI_CODING_AGENT_SESSION_DIR` (P1 IN-10)"
affects: [08-21 ledger plan (P1 IN-04, IN-08, IN-09, IN-10, IN-11 closed here; IN-10's shell harness declined)]

actuals:
  tokens: 2200
  tasks: 3
  commits: 3
plan_head_before: f6b5f9d5a04dee5c484764b22331e52926b1fc06
plan_head_after: 64a49e4d7429a95a78a85143fa0b69ea8e274c26

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - tests/e2e/adapter-detection-rpc.test.ts
    - extensions/pi-claude-marketplace/shared/notify-context.ts
    - extensions/pi-claude-marketplace/platform/pi-api.ts
    - scripts/pi.sh
    - CONTRIBUTING.md

key-decisions:
  - "`dispatchRow` keeps the `Readonly<Record<string, unknown>>` view of the render map and casts the looked-up arm once to `RenderFn<PluginNotificationMessage> | undefined`. The typed view `Readonly<Record<string, RenderFn<PluginNotificationMessage> | undefined>>` fails `tsc` with TS2322, because function parameters are contravariant."

patterns-established: []

requirements-completed: []

duration: 6min
completed: 2026-10-10
status: complete
---

# Phase 08 Plan 07: e2e readers, one-cast dispatchRow, and the pi.sh default home Summary

**The adapter-detection e2e readers now fail on an empty PID file or a non-array inventory field instead of reading them as `0` or `[]`. `dispatchRow` reads its render arm with one commented cast. The ADET-02 comment reads correctly. `scripts/pi.sh` and CONTRIBUTING.md warn that the default home has no credentials, and the default home keeps a preset session directory.**

## Performance

- **Duration:** about 6 min (2026-10-10T04:04Z to 04:10Z)
- **Tasks:** 3/3
- **Files modified:** 5

## Findings closed

| Finding | Disposition | Commit |
| ------- | ----------- | ------ |
| P1 IN-09 | fixed: `readPid` calls `assert.fail` naming the file unless `Number.isInteger(pid) && pid > 0`. The built-in-only case reads the sentinel PID with `.catch(() => undefined)`, registers the `SIGKILL` cleanup only when a PID was read, and asserts the PID after `assertCleanSession(run)` | 6906fc3b |
| P1 IN-11 | fixed: `inventoryEntries` calls `assert.fail` naming the key when the field is not an array. `listedCommands` in `_rpc.ts` is unchanged, as planned | 6906fc3b |
| P1 IN-04 | fixed: one cast of the looked-up arm, with a two-line reason; the `as unknown as` call cast is gone. The fallback branch and its severity write are unchanged | d0459eea |
| P1 IN-08 | fixed: the block is rewrapped and the clause reads "or the `sourceInfo.source` of an extension command or of a tool contains \"pi-mcp-adapter\"" | d0459eea |
| P1 IN-10 | docs and session dir fixed. The shell regression harness for the script default is declined; plan 08-21 records the reason in the Phase 1 ledger | 64a49e4d |

## Task Commits

1. **Task 1: The adapter-detection e2e readers fail loudly on a bad PID file or a changed inventory shape.** Commit `6906fc3b` (test). Pre-commit log: `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed.
2. **Task 2: One cast in dispatchRow, and a readable ADET-02 comment.** Commit `d0459eea` (refactor). Pre-commit log: `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed.
3. **Task 3: The launch script documents the credential-less default home and keeps a preset session dir.** Commit `64a49e4d` (docs). Pre-commit log: `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Skipped (no build input staged); gitlint Passed.

## Verify results (final lines)

- Task 1: `PI_CM_E2E_REF=pinned node --test tests/e2e/adapter-detection-rpc.test.ts` gave `ℹ tests 7`, `ℹ pass 7`, `ℹ fail 0`, exit 0. `npm run typecheck` exit 0.
- Task 1 acceptance: `readPid` contains `Number.isInteger` (line 3 of the function). `inventoryEntries` has two `assert.fail` lines (the no-notify failure and the non-array failure). Order in the built-in-only case: `sentinelPid` read at line 378, cleanup at 379-385, `assertCleanSession(run)` at line 390, sentinel PID assertion at 391-392.
- Task 2: `node --test tests/shared/notify-context.test.ts tests/platform/pi-api.test.ts` gave `ℹ tests 66`, `ℹ pass 66`, `ℹ fail 0`, exit 0. `npm run test:coverage:direct -- <both sources>` exit 0 with no shortfall printed. No test case was added.
- Task 2 acceptance: the non-comment ` as ` count in `dispatchRow` is 2 (the arm cast and the existing severity-write cast; 3 at the start). The `unknown as` count is 0. `awk 'length>100'` over pi-api.ts prints nothing. `grep -n "of an extension"` prints line 237.
- Task 2 audit: `npx fallow audit --base "$(git merge-base origin/main HEAD)" --format json` gave verdict `pass`, 10 clone groups, exit 0.
- Task 3: `bash -n`, `--help` grep for `auth.json` and `models.json`, the CONTRIBUTING.md grep, and the `PI_CODING_AGENT_SESSION_DIR:-` grep all passed, exit 0. `--help` touches no home; I did not launch Pi.
- Task 3 acceptance: `grep -n "PI_CODING_AGENT_SESSION_DIR" scripts/pi.sh` gives line 29 (usage text), line 226 (`${PI_CODING_AGENT_SESSION_DIR:-$pi_home/sessions}` inside `if ((default_home))` at 224), line 228 (the `--home` branch, `$pi_home/sessions`), and line 230 (`mkdir -p`). `default_home=1` is set only at line 219, in the default branch.
- I did not run `npm run check`. The orchestrator runs it at the wave boundary.

## Deviations from Plan

**1. [Rule 1 - Accuracy] The `dispatchRow` JSDoc no longer described the cast**
- **Found during:** Task 2
- **Issue:** The JSDoc said the arm "is cast to the command's own `Msg` arm for the broad `PluginNotificationMessage`", which described the removed two-step cast.
- **Fix:** It now says the arm "is cast once to a renderer of the broad `PluginNotificationMessage` the cascade seam threads". The two other comments that mention `as unknown as` (the `MarketplaceRows` JSDoc and the `notifyWithContext` seam comment) describe the widening in `notifyWithContext`. They are still true and are unchanged.
- **Commit:** d0459eea

**2. Requirements not marked complete**
- DEBT-02 covers the whole phase. Plan 08-21 owns the phase-wide verdicts.

**Total deviations:** 1 (comment accuracy). **Impact:** none on behavior.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

Mitigations:
- T-08-17: `readPid` refuses a PID that is not a positive integer, so the cleanup can never run `process.kill(0, "SIGKILL")`.
- T-08-18: the default-home path keeps a preset `PI_CODING_AGENT_SESSION_DIR`.

## Next

Ready for 08-08.

## Self-Check: PASSED

- All five modified files exist.
- Commits 6906fc3b, d0459eea and 64a49e4d are ancestors of HEAD.
