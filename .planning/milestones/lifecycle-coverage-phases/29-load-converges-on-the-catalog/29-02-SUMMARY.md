---
phase: 29-load-converges-on-the-catalog
plan: 02
subsystem: reconcile
tags: [reconcile, load, apply, read-pass, resources_discover, cucumber]

requires:
  - phase: 29-load-converges-on-the-catalog
    provides: "29-01: /claude:plugin apply and EdgeDeps.applyReconcile"
provides:
  - "orchestrators/reconcile/load.ts: createLoadReconcile(reader) and LoadReconcileOptions; a load runs no apply step and no backfill"
  - "orchestrators/reconcile/read-pass.ts: ReconcileStateReader, readPassForScope, runScopeIsolated, and the shared per-scope steps openScopePass / closeScopePass / notifyScopePasses (ScopePassInput, ScopePassAccumulators)"
  - "delisted-plugins.ts exports reportUnreadableDeclarer; apply-outcomes.ts exports sourceMismatchOutcomes"
  - "index.ts drives createLoadReconcile({ loadState }) from resources_discover; createApplyReconcile({ loadState }) now serves only the apply verb"
  - "apply.feature holds the reload scenarios that changed state, plus one that applies a whole hand edit and finds pending empty"
affects: [29-03, 29-05, 29-08, apply, pending, reconcile, load]

actuals:
  tokens: 47400
  tasks: 2
  commits: 2
plan_head_before: 4aff68ddc4768fc3e0807c95780c1b7060c72b7a
plan_head_after: 3965d17b51e2f5ee31e53484ea7fbb224cb7b5f4

tech-stack:
  added: []
  patterns:
    - "A reconcile pass over both scopes is openScopePass -> caller's own steps -> closeScopePass per scope, then notifyScopePasses once"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts
    - test/orchestrators/reconcile/read-pass.test.ts
    - test/orchestrators/reconcile/load.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/delisted-plugins.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
    - extensions/pi-claude-marketplace/index.ts
    - test/orchestrators/reconcile/apply.test.ts
    - test/orchestrators/reconcile/backfill.test.ts
    - test/orchestrators/reconcile/delisted-plugins.test.ts
    - test/orchestrators/reconcile/apply-outcomes.test.ts
    - test/index.test.ts
    - features/plugin/reconcile.feature
    - features/plugin/apply.feature
    - features/plugin/git-source.feature

key-decisions:
  - "apply and the load share openScopePass / closeScopePass / notifyScopePasses in read-pass.ts; fallow dupes reported two clone groups between apply.ts and load.ts until the per-scope prologue, epilogue and emission moved there"
  - "readPassFailureOutcome, migrateScopeIsolated and rebuildScopeRoutingTableIsolated stay module-private in read-pass.ts; their owner cases run through openScopePass and closeScopePass"
  - "hasSuppressingRow is module-private in delisted-plugins.ts now that reportUnreadableDeclarer, its only outside consumer, lives there"
  - "The load passes no reason to the MCP move, so the move skips only the owners the plan installs, uninstalls or disables; the reload-only dependency-install bucket is not skipped at load"

patterns-established:
  - "openScopePass returns the readable scope's ScopeReadResult, or undefined after it pushed the rows that stop the scope (read-pass throw, invalid config, layer gap)"

requirements-completed: [APL-03, APL-01]

coverage:
  - id: D1
    description: "A load changes no installation state: a hand-declared, a dropped, a declared-disabled, a declared-enabled and a dependency-short record all leave state.json and the config byte-identical, and the load stays silent"
    requirement: APL-03
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/load.test.ts"
        status: pass
      - kind: unit
        ref: "test/index.test.ts#APL-03 / D-21: a reload event leaves a missing dependency uninstalled and its dependent's record unchanged"
        status: pass
      - kind: e2e
        ref: "features/plugin/reconcile.feature#A new session after a hand edit of the config changes no installation state"
        status: pass
    human_judgment: false
  - id: D2
    description: "A load still runs the MIG-01 config migration, the MCP move with the read pass's plan, the per-session not-in-manifest and unreadable-declarer warnings, the invalid-config and source-mismatch rows, and the hook routing rebuild, with WR-01 isolation per scope"
    requirement: APL-03
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/read-pass.test.ts"
        status: pass
      - kind: unit
        ref: "test/orchestrators/reconcile/load.test.ts"
        status: pass
      - kind: e2e
        ref: "features/plugin/reconcile.feature#Every new session warns about an installed plugin that its catalog no longer offers and keeps it working"
        status: pass
    human_judgment: false
  - id: D3
    description: "The reload scenarios that changed state run /claude:plugin apply with their assertions kept, and apply of a whole hand edit leaves pending empty"
    requirement: APL-01
    verification:
      - kind: e2e
        ref: "features/plugin/apply.feature"
        status: pass
      - kind: e2e
        ref: "features/plugin/git-source.feature#Apply reports a declared plugin whose clone the git host refuses as source missing"
        status: pass
    human_judgment: false
  - id: D4
    description: "index.ts composes exactly one createLoadReconcile({ loadState }) and calls loadReconcile({ ctx, run, cwd: event.cwd, hooksRouting }) from resources_discover"
    requirement: APL-03
    verification:
      - kind: unit
        ref: "test/index.test.ts#APL-03: the discover handler hands the load reconcile the event's cwd and no reason"
        status: pass
    human_judgment: false

duration: 46min
completed: 2026-10-24
status: complete
---

# Phase 29 Plan 02: Read-Only Load Summary

**A session start or `/reload` now runs `createLoadReconcile`, which reads, migrates the config format, moves MCP entries, reports the per-session warnings and rebuilds hook routing, and never installs, uninstalls, enables, disables or backfills. The reload scenarios that used to change state now run `/claude:plugin apply`.**

## Performance

- **Duration:** 46 min
- **Started:** 2026-10-24T14:21:10Z
- **Completed:** 2026-10-24T15:07:26Z
- **Tasks:** 2
- **Files modified:** 17 (4 created, 13 modified)

## Accomplishments

- `orchestrators/reconcile/load.ts`: `createLoadReconcile(reader)` runs, per scope and project first, the shared read pass and MCP move (`openScopePass`), the source-mismatch rows, then `closeScopePass` (unreadable declarer, delisted plugins, routing rebuild), and ends with one `notifyScopePasses`. It calls no `applyPlan`, no dependency install, no backfill and no post-commit or MCP-config notice surface.
- `orchestrators/reconcile/read-pass.ts`: the read pass moved out of `apply.ts` unchanged, `runScopeIsolated` moved out of `backfill.ts`, and the per-scope prologue, epilogue and emission that `apply` and the load share. Both modules stay outside `NETWORK_SEAMS`; `npm run lint` (BLOCK F) passes.
- `apply.ts` keeps `createApplyReconcile` as its only export and behaves as before, including the `reason` gate on dependency installs. `reportUnreadableDeclarer` moved to `delisted-plugins.ts` and the source-mismatch fold to `apply-outcomes.ts::sourceMismatchOutcomes`.
- `index.ts` composes `createLoadReconcile({ loadState })` beside `createApplyReconcile({ loadState })` and calls `loadReconcile({ ctx, run, cwd: event.cwd, hooksRouting })` inside the same try/catch that reports `notifyReconcileAborted`.
- Scenarios: reconcile.feature gains "A new session after a hand edit of the config changes no installation state" and a rewritten description. Its seven state-changing scenarios (plus the line-14 one already in apply.feature) moved to apply.feature, which now has nine `Apply ...` scenarios. git-source.feature's two refused-clone scenarios run apply.

## Task Commits

1. **Task 1: End-to-end read-only load** - `7c6a5e92` (feat). Tracer gate: the `<verify>` chain (owner tests, direct coverage of read-pass.ts, load.ts, apply.ts and index.ts, `npm run lint`, `npm run fallow`, the new scenario) was re-run green before the commit, so expansion went ahead.
2. **Task 2: The reload scenarios that changed state run apply** - `3965d17b` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts`: read pass, `runScopeIsolated`, `openScopePass`, `closeScopePass`, `notifyScopePasses`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts`: `createLoadReconcile`, `LoadReconcileOptions`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`: per-scope loop rebuilt on the shared steps; header and GHB-03 comments now name the `apply` command
- `extensions/pi-claude-marketplace/orchestrators/reconcile/{backfill,delisted-plugins,apply-outcomes}.ts`: the moves above
- `extensions/pi-claude-marketplace/index.ts`: the load composition
- Tests: `read-pass.test.ts` and `load.test.ts` (new); `apply.test.ts` lost six read-pass cases; `backfill.test.ts` lost the two `runScopeIsolated` cases (now in read-pass.test.ts); `delisted-plugins.test.ts` and `apply-outcomes.test.ts` gained the direct cases; `test/index.test.ts` rewritten as listed under Deviations
- `features/plugin/{reconcile,apply,git-source}.feature`

## Decisions Made

- The per-scope prologue (read pass, read-pass failure row, MCP move, invalid-config stop), the epilogue (unreadable declarer, delisted plugins, routing rebuild) and the final emission are shared functions, because fallow dupes fails on the clone groups the two copies formed.
- The load passes no `reason` to the MCP move. The move therefore skips only the owners the plan installs, uninstalls or disables. Before this plan a reload also skipped the dependency-install bucket's owners; nothing installs those at load now.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] fallow dupes reported two clone groups between apply.ts and load.ts**
- **Found during:** Task 1 (`npm run fallow`)
- **Issue:** The per-scope read-and-move prologue and the epilogue plus emission were the same code in both passes.
- **Fix:** Added `openScopePass`, `closeScopePass` and `notifyScopePasses` (with `ScopePassInput` and `ScopePassAccumulators`) to read-pass.ts. As a result `readPassFailureOutcome`, `migrateScopeIsolated` and `rebuildScopeRoutingTableIsolated`, which the plan listed as exports, are module-private, and read-pass.test.ts covers them through `openScopePass` and `closeScopePass`.
- **Files modified:** read-pass.ts, load.ts, apply.ts, read-pass.test.ts
- **Committed in:** `7c6a5e92`

**2. [Rule 3 - Blocking] `hasSuppressingRow` lost its only outside consumer**
- **Found during:** Task 1
- **Issue:** With `reportUnreadableDeclarer` in delisted-plugins.ts, the export had no production consumer, which fallow dead-code reports.
- **Fix:** Made it module-private. Its direct test became the `RECON-04` cases of `describe("reportUnreadableDeclarer")`, and the existing cases moved into `describe("reportDelistedPlugins")` (one describe per entrypoint).
- **Committed in:** `7c6a5e92`

**3. [Rule 1 - Bug] An index.ts case relied on the load disabling a plugin**
- **Found during:** Task 1 (`node --test test/index.test.ts`)
- **Issue:** "a refused reconcile append retains committed state and independent PATH work" seeded a missing dependency so the load would disable a plugin and emit. A read-only load does neither.
- **Fix:** Rewritten as "a refused load append leaves install state untouched and still runs the independent PATH work": an invalid config makes the load emit, the append is refused twice (cascade and abort line), state.json stays byte-identical, and the enabled plugin's bin is on PATH.
- **Committed in:** `7c6a5e92`

**4. [Rule 1 - Bug] The "apply a whole hand edit" scenario's row order**
- **Found during:** Task 2
- **Issue:** The plan listed the rows as alpha, demo, beta, gamma. Apply reports in its step order: demo `uninstalled`, alpha `installed`, gamma `installed` (an enable row reads `installed`, as in "Apply enables ..."), beta `disabled`.
- **Fix:** The table states the order and statuses the command reports.
- **Committed in:** `3965d17b`

---

**Total deviations:** 4 auto-fixed (2 blocking, 2 bugs).
**Impact on plan:** All four were needed for `npm run check`. Behavior is the one the plan specifies. Also outside `files_modified`: none. The apply.feature Background now offers alpha, beta and gamma as well as demo, for the moved scenarios.

## Issues Encountered

None beyond the deviations above. The apply.test.ts cases removed as read-pass-owned: the two CFG-03 invalid-local cases, both LAYER-06 gap cases, the WR-01 lock-held case and the MIG-01 refused-write case. The CFG-03 unparseable-base case, the WR-01 sibling-scope case and the AMIG-01/NFR-2 position cases stay, because their subject is the apply pass.

## Verification

- Task 1 `<verify>`: the seven owner modules passed; direct coverage passed for read-pass.ts, load.ts, apply.ts and index.ts (also delisted-plugins.ts, backfill.ts, apply-outcomes.ts); `npm run lint` exited 0; `npm run fallow` exited 0; the new scenario passed (1 scenario, 9 steps).
- Task 2 `<verify>`: apply, reconcile and git-source features passed (33 scenarios); `npm run check:features` exited 0; `npm run test:cucumber` passed 774 scenarios.
- The commit hook's `npm run check:commit` passed on both commits.
- Full gate: `npm run check` at `3965d17b` (Node v26.12.1) exited **0**. Log tail:

```
passed fallow (5.4 s)
passed format:check (7.7 s)
passed test:corresponding (3.7 s)
passed check:features (3.3 s)
16 hooks (16 passed)
774 scenarios (774 passed)
7389 steps (7389 passed)
Merged LCOV: coverage/direct.lcov (284 records)
CHECK_EXIT=0
```

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- The load reports only the rows it reported before (invalid config, layer gap, source mismatch, the two per-session warnings, routing failures). It does not yet print the pending block (29-08).
- `apply` still passes no `reason`, so the MISS-01 dependency install runs nowhere until 29-05 removes the gate. The LOAD-01 dependency-disable runs only through `apply`.
- A new pass composes `openScopePass` -> its own steps -> `closeScopePass`, then `notifyScopePasses`.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

---
*Phase: 29-load-converges-on-the-catalog*
*Completed: 2026-10-24*
