---
phase: 67-list-filters-completion-reinstall-repair
plan: 01
subsystem: api
tags: [reinstall, cli, flags, completion, edge-handler, orchestrator]

# Dependency graph
requires:
  - phase: 65-force-install-update-flag
    provides: "the install/update --force flag whose meaning reinstall's command-local --force used to overload"
provides:
  - "reinstall is a pure repair primitive: overwrite of collisions + foreign content is unconditional"
  - "reinstall --force errors as an UNKNOWN flag at every surface (handler, usage, router help, completion)"
  - "completion provider no longer special-cases reinstall positional extraction"
affects: [list-filters-completion, force-install-severity, prd-section-11-reconcile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Unconditional bridge overwrite gate: reinstall always passes { force: true } to replacePreparedAgents"
    - "Edge flag retirement: drop the flag from the extractLocalFlag pass-through list so it falls into the shared UNKNOWN-flag arm"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/edge/router.ts
    - extensions/pi-claude-marketplace/edge/completions/provider.ts
    - tests/edge/handlers/plugin/reinstall.test.ts
    - tests/edge/router.test.ts
    - tests/edge/completions/provider.test.ts
    - tests/orchestrators/plugin/reinstall.test.ts

key-decisions:
  - "reinstall --force is rejected by the shared extractLocalFlag scanner (message: Unknown flag: \"--force\".), consistent with every other unknown flag like --frobnicate"
  - "the overwrite-everything code path is promoted to unconditional by deleting the force option/branch, not by defaulting force=true"

patterns-established:
  - "Pattern: retire a command-local flag by removing it from the pass-through allow-list so the existing UNKNOWN-flag arm rejects it"

requirements-completed: [RINST-01]

# Metrics
duration: 20min
completed: 2026-06-27
---

# Phase 67 Plan 01: Reinstall --force Retirement Summary

**reinstall is now a pure repair primitive: overwrite of collisions and foreign content is unconditional, and `reinstall --force` errors as an UNKNOWN flag at the handler, usage string, router help, and completion provider.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-27T17:08:00Z
- **Completed:** 2026-06-27T17:26:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Deleted reinstall's command-local `--force` plumbing across all orchestrator sites (both option bags, the per-target relay spread, the `runLockedReinstall` destructure, and the `replaceAll` parameter).
- Made the agents-bridge overwrite gate unconditional: `replacePreparedAgents(handles.agents, { force: true })` with no ternary.
- Stripped `--force` from the edge handler USAGE + parse loop, the router `TOP_LEVEL_USAGE` reinstall help line, and the completion provider (flag entry + reinstall positional-extraction special-case).
- Inverted the coupled edge/router/completion tests to the no-force contract and repurposed the orchestrator foreign-content tests to assert unconditional overwrite.
- `npm run check` green; closed-set tripwire unchanged at 22 STATUS_TOKENS / 17 PLUGIN_STATUSES / 7 MARKETPLACE_STATUSES.

## Task Commits

Each task was committed atomically:

1. **Task 1: Invert reinstall tests to the no-force contract (test-first, RED)** - `f7b05492` (test)
2. **Task 2: Make reinstall overwrite unconditional and strip --force from every surface** - `6b1937d0` (feat)
3. **Task 3: Lockstep docs cleanup + full-suite byte gate** - no-op (docs carry no `reinstall --force` reference; see Deviations). Verified by the metadata commit.

**Plan metadata:** committed separately with this SUMMARY.

## Files Created/Modified
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` - Removed `force?` from `ReinstallPluginOptions`/`ReinstallPluginsOptions`, the relay spread, the destructure, and the `replaceAll` param; `replacePreparedAgents` now called with `{ force: true }` unconditionally (RINST-01 / D-67-03 comment).
- `extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts` - USAGE no longer lists `[--force]`; `extractLocalFlag` called with `[]`; deleted the `let force` / `--force` parse arm and the orchestrator-call `force` spread.
- `extensions/pi-claude-marketplace/edge/router.ts` - `TOP_LEVEL_USAGE` reinstall line drops `[--force]`.
- `extensions/pi-claude-marketplace/edge/completions/provider.ts` - Removed the reinstall `--force` flag completion block and the `rawHead === "reinstall" ? ["--force"]` positional-extraction special-case (also removed the now-unused `rawHead`).
- `tests/edge/handlers/plugin/reinstall.test.ts` - Bare reinstall over foreign content now asserts `(reinstalled)`; `reinstall --force` asserts an unknown-flag usage error; USAGE asserts no `[--force]`; added `--force` to the PRL-01 unknown-flag array.
- `tests/edge/router.test.ts` - Reinstall help-line assertion flipped to `doesNotMatch /reinstall.*\[--force\]/`.
- `tests/edge/completions/provider.test.ts` - Reinstall flag completion asserts `--force` absent; removed the `reinstall --force completion` test.
- `tests/orchestrators/plugin/reinstall.test.ts` - Removed `force: true` from the two `reinstallPlugin` calls; repurposed the foreign-content rejection test (PRL-10) to assert unconditional overwrite.

## Decisions Made
- `reinstall --force` is rejected by the shared `extractLocalFlag` scanner with the message `Unknown flag: "--force".` (and the reinstall usage block), identical to how any other unrecognized long flag is handled. This is the most consistent end state once `--force` is removed from the pass-through allow-list.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's Task 1 acceptance criteria specified the wrong unknown-flag message**
- **Found during:** Task 1 / Task 2 (handler parse path)
- **Issue:** The plan asserted `reinstall <ref> --force` would yield `Unknown option: "--force".` from the handler's positional-parse loop. In reality, once `--force` is removed from the `extractLocalFlag` pass-through list, the shared scanner rejects it FIRST with `Unknown flag: "--force".` before the positional loop ever runs. The positional-loop `Unknown option:` arm is unreachable for `--force` (it was already effectively dead, since `extractLocalFlag` rejects all non-pass-through long flags). The plan's two directives (pass-through `[]` AND `Unknown option:` message) are mutually exclusive.
- **Fix:** Implemented the consistent behavior (pass-through `[]`, rejected by `extractLocalFlag` as `Unknown flag:`) and wrote the test to assert the true message via `startsWith('Unknown flag: "--force".')` plus the reinstall usage prefix. D-67-03 ("errors as an UNKNOWN flag") is satisfied either way.
- **Files modified:** tests/edge/handlers/plugin/reinstall.test.ts
- **Verification:** Test passes GREEN after Task 2; behavior matches the existing `--frobnicate` unknown-flag test.
- **Committed in:** f7b05492 (Task 1) / 6b1937d0 (Task 2)

**2. [Rule 3 - Blocking] Orchestrator test file not listed in the plan referenced the removed `force` option**
- **Found during:** Task 2 (typecheck + orchestrator test run)
- **Issue:** `tests/orchestrators/plugin/reinstall.test.ts` (not in the plan's `files_modified`) had three sites depending on the removed behavior: two `reinstallPlugin({ ..., force: true })` calls (PRL-10 rollback, GAP-11 success) that would fail `tsc` excess-property checks, and one test (PRL-10 "replacement failure rolls back earlier bridges") that used foreign-content rejection as the trigger for a mid-cascade failure -- a path that no longer exists under unconditional overwrite.
- **Fix:** Removed `force: true` from both calls (overwrite is now always on, so the assertions hold unchanged), updated their titles/comments to the RINST-01 contract, and repurposed the foreign-content rejection test to assert unconditional overwrite of foreign agent content across all bridges. Dropped that test's plugin-data-dir preservation assertion because post-success maintenance intentionally removes the data dir on a successful reinstall.
- **Files modified:** tests/orchestrators/plugin/reinstall.test.ts
- **Verification:** `npm run typecheck` exits 0; all 4 reinstall/router/provider/orchestrator-reinstall test files pass (155 tests).
- **Committed in:** 6b1937d0 (Task 2 commit)

**3. [Note - No-op] Task 3 docs cleanup was a no-op**
- **Found during:** Task 3
- **Issue:** Neither `docs/output-catalog.md` nor `docs/messaging-style-guide.md` references `reinstall --force` (verified by grep). All `force` mentions in those docs concern the Phase 65/66 install/update `--force` flag and the derived force-installed/force-upgradable states, which are out of scope.
- **Fix:** No edit required (the plan sanctions a no-op edit). No `<!-- catalog-state: ... -->` block changed; no rendered byte form changed.
- **Files modified:** none
- **Verification:** `grep -rn "reinstall --force" docs/output-catalog.md docs/messaging-style-guide.md` returns no matches.

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking) + 1 documented no-op
**Impact on plan:** All auto-fixes necessary to keep `npm run check` green and to honor D-67-03 truthfully. No scope creep -- only files in the same coupled surface as the planned change were touched.

## Issues Encountered
- During the full `npm run check`, an unrelated hooks-bridge test ("Block F / D-60-06: registerHooksBridge twice does not throw (idempotent)" in `tests/architecture/hooks-exec.test.ts`) flaked once under parallel execution. It passed 3/3 in isolation and the immediately-following full `npm run check` exited 0. Pre-existing parallelism flake, unrelated to this plan's changes; logged here rather than fixed (out of scope).

## Closed-set tripwire evidence
- `tests/architecture/notify-closed-set-locks.test.ts` passes: `STATUS_TOKENS.length === 22`, `PLUGIN_STATUSES.length === 17`, `MARKETPLACE_STATUSES.length === 7`. No token bump (none expected for 67-01).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `--force` is now owned solely by install/update; the last overloaded meaning on the command surface is gone. Ready for the remaining Phase 67 plans (list filters LIST-01, completion candidate sets LIST-02) and the Phase 70 PRD §11 reconcile.

## Self-Check: PASSED
- `.planning/phases/67-list-filters-completion-reinstall-repair/67-01-SUMMARY.md` exists.
- Task commits `f7b05492` (test) and `6b1937d0` (feat) exist in history.

---
*Phase: 67-list-filters-completion-reinstall-repair*
*Completed: 2026-06-27*
