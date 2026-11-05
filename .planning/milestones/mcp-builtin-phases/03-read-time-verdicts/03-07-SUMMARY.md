---
phase: 03-read-time-verdicts
plan: "07"
subsystem: reconcile
tags: [mcp, reconcile, apply, pending, convergence, amig-01, mcp-builtin, read-time-verdict]

requires:
  - phase: 03-read-time-verdicts
    provides: "resolutionFor (03-01), readRecordMcpVerdict (03-01), the neutral install verdict and basis (03-01), the D-MB-07 marker rule (03-04)"
provides:
  - "ConvergenceInput.mcpImplementation (required); convergence reads the record's effective view and the candidate's view under the run's implementation"
  - "newlyDroppedKinds: a move needs consent only for a kind the candidate drops and the record does not; partial comes from the record's effective view"
  - "resolvePendingForceInstalls(plans, locate, mcpImplementation): the (will partially install) preview in the active view"
  - "composePendingReport, readPassForScope, and openScopePass take the run's implementation (pending, apply, load)"
  - "AMIG-01: removal rows read resolutionFor(resolved, \"adapter\"); applyNeutralVerdict writes the neutral verdict with compatibilityBasis \"neutral\""
  - "features/mcp-server/verdict-apply.feature; test/integration/mcp-verdict-migration.test.ts"
affects: [03-06, 03-08, 03-09]

actuals:
  tokens: 13500
  tasks: 3
  commits: 3
plan_head_before: e1f1349443529d355109480b182b81dfd442c778
plan_head_after: 9bcc43b901bd24f70d1d8c33fbd37de84779cea6

tech-stack:
  added: []
  patterns:
    - "A catalog move compares the candidate's resolutionFor view with the record's readRecordMcpVerdict view under the same implementation, so a switch alone is never a new degrade"
    - "The reconcile entry points take the implementation from run.softDeps.mcpImplementation and pass it down explicitly; no default"

key-files:
  created:
    - features/mcp-server/verdict-apply.feature
    - test/integration/mcp-verdict-migration.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts
    - test/orchestrators/reconcile/convergence.test.ts
    - test/orchestrators/reconcile/pending.test.ts
    - test/orchestrators/reconcile/apply.test.ts
    - test/orchestrators/reconcile/read-pass.test.ts
    - test/orchestrators/reconcile/notify.test.ts
    - test/orchestrators/reconcile/mcp-migration.test.ts
    - test/integration/mcp-migration.test.ts

key-decisions:
  - "Consent is the candidate view's unsupported kinds minus the record's effective unsupported kinds, only for a partially-available candidate view; move.partial is !effective.installable (D-P3-13, P3-DC-10)"
  - "The apply scenarios switch from pi-mcp-adapter to Pi's built-in MCP with a fresh profile Pi (the verdict-list precedent), because a restart without pi-mcp-adapter lands on no implementation, where an sse verdict does not change"
  - "AMIG-01 writes the neutral verdict for every moving record that lacks the basis, so a legacy record moved by the load is converted once (D-P3-16, D-P3-02)"

patterns-established:
  - "Reconcile threading: composePendingReport, readPassForScope, openScopePass, and ConvergenceInput each require mcpImplementation"

requirements-completed: [MREC-03, MREC-06]

coverage:
  - id: D1
    description: "Convergence holds a move only for a new degrade under the active implementation and passes partial from the record's effective view (D-P3-13)"
    requirement: MREC-06
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/convergence.test.ts#D-P3-13: a record with an sse server moves to a candidate that keeps it, partial true under builtin"
        status: pass
      - kind: unit
        ref: "test/orchestrators/reconcile/convergence.test.ts#D-P3-13: a candidate that adds an sse server to a stdio record needs consent under Pi's built-in MCP"
        status: pass
      - kind: unit
        ref: "test/orchestrators/reconcile/apply.test.ts#D-P3-13: a candidate that adds an sse server is declined under Pi's built-in MCP and writes nothing"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/verdict-apply.feature#Apply after pi switches from pi-mcp-adapter to its built-in MCP moves a plugin with an sse server to its new version without asking (MREC-06)"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/verdict-apply.feature#A second apply after a switch from pi-mcp-adapter to Pi's built-in MCP has nothing to change (MREC-06)"
        status: pass
    human_judgment: false
  - id: D2
    description: "pending previews (will partially install) in the active implementation's view (D-P3-15)"
    requirement: MREC-03
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/notify.test.ts#D-P3-15: previews an install with an sse server as partial under builtin"
        status: pass
      - kind: unit
        ref: "test/orchestrators/reconcile/pending.test.ts#D-P3-15: a planned install with an sse server renders \"will partially install\" under builtin"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/verdict-apply.feature#Pending previews a declared plugin with an sse server as will partially install, under Pi's built-in MCP (D-P3-15)"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/verdict-apply.feature#Pending previews a declared plugin with an sse server as will install, under pi-mcp-adapter (D-P3-15)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A switch alone plans no move, shows no load row, and pending lists nothing (D-P3-14, D-P3-15)"
    requirement: MREC-03
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/convergence.test.ts#D-P3-14: a record whose catalog changed nothing plans no move after a switch to Pi's built-in MCP"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/verdict-apply.feature#Pi restarting with its built-in MCP shows no new load row for a plugin with an sse server, and pending lists nothing to apply (D-P3-14, D-P3-15)"
        status: pass
    human_judgment: false
  - id: D4
    description: "AMIG-01 stages the adapter subset, names the adapter's blocking feature, and writes the neutral verdict with its basis (D-P3-16)"
    requirement: MREC-03
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/mcp-migration.test.ts#D-P3-16 (three cases)"
        status: pass
      - kind: integration
        ref: "test/integration/mcp-verdict-migration.test.ts (bare-elicitation and ws owners through the real load)"
        status: pass
    human_judgment: false

duration: about 100 min
completed: 2026-11-04
status: complete
---

# Phase 3 Plan 07: Reconcile surfaces follow the active MCP implementation Summary

**Apply's convergence now reads the record and its catalog candidate under the run's active MCP implementation. It holds a move for consent only when the candidate drops a kind the record does not already drop, and it passes `partial` from the record's effective view, so a switch of implementation alone never holds a move. `pending` previews `(will partially install)` in the active view. The load's AMIG-01 move still stages pi-mcp-adapter's subset and names the adapter's feature, and it writes the neutral verdict with `compatibilityBasis: "neutral"`.**

## Performance

- **Duration:** about 100 min
- **Started:** 2026-11-04 (plan base `e1f1349`)
- **Completed:** 2026-11-04
- **Tasks:** 3 of 3
- **Files modified:** 16 (2 created, 14 modified)

## Accomplishments

- `convergence.ts`: `ConvergenceInput` has a required `mcpImplementation`, so `MoveCascadeInput` has it too, and the `base` objects in `settleMoveCascade` and `releaseOnLandedMoves` carry it. `recordMove` reads the record through `readRecordMcpVerdict` and sets `partial: !effective.installable`. The new helper `newlyDroppedKinds` returns the kinds of the candidate's `resolutionFor` view that `effective.unsupported` does not list, only for a `partially-available` view. `supportedSetGrew` still reads the stored sets.
- `notify.ts`: `resolvePendingForceInstalls(plans, locate, mcpImplementation)` tests `resolutionFor(resolved, mcpImplementation).state` (D-P3-15).
- `pending.ts`: `composePendingReport` requires `mcpImplementation`. `pendingReconcile` passes `opts.run.softDeps.mcpImplementation`.
- `read-pass.ts`: `readPassForScope` takes the implementation, and `ScopePassInput` requires it. `apply.ts` and `load.ts` pass `opts.run.softDeps.mcpImplementation` to `openScopePass`, `readPassForScope`, `planConvergenceCascade`, and `composePendingReport`.
- `mcp-migration.ts`: `stagedSource` is unchanged (the adapter subset, MSEL-04). `removalRow` reads `resolutionFor(action.resolved, "adapter").droppedMcpServers`, so a bare-elicitation server keeps its `unsupported-feature` row. `applyNeutralVerdict` (the old `applyDroppedServers`) computes `effectiveMcpCompatibility(record, { kind: "recorded", servers: mcpServerConfigsOf(declaredMcpServers), bundle }, "none")`. It writes the result through `replaceCompatibility` and then sets `compatibilityBasis = "neutral"`, unless the record already holds that verdict and the basis. The module header now describes this.
- `features/mcp-server/verdict-apply.feature`: three `@own-implementation` scenarios, plus a `@builtin-only`/`@adapter-only` pending pair.

## Task Commits

1. **Task 1: Convergence and the pending preview follow the active implementation**: `5fce565` (feat)
2. **Task 2: AMIG-01 stays explicit about the adapter and writes the neutral verdict**: `c4f6502` (fix)
3. **Task 3: Apply and pending after a switch**: `9bcc43b` (test)

Before each commit I ran these by hand, and each exited 0: `check:static`, plus the touched pairs' `test:coverage:direct` at 100% (convergence, notify, pending, read-pass, apply, load, and mcp-migration). Before Task 2's commit I also ran `test:integration`. The hook printed "(no files to check)" for `check:commit` in this worktree, as expected.

## TDD RED evidence

The commit hook refuses a commit that holds only failing tests, so each task committed its tests and its implementation together (P1-DC-28). To get the RED runs, I copied the plan base's product files back with `git show e1f1349:<file>`, ran the new cases, and then restored the plan's files.

- **Task 1** (TAP, `--test-name-pattern "D-P3"` over convergence, notify, pending, and apply tests; exit 1). Every failure is a `testCodeFailure` with expected and actual values on the planned assertion:
  - `convergence`: `D-P3-13: ... partial true under builtin` failed (base `partial: false`). `D-P3-13: a candidate that adds an sse server to a stdio record needs consent under Pi's built-in MCP` failed (base moved it, because the neutral candidate resolves installable).
  - `notify`: `D-P3-15: previews an install with an sse server as partial under builtin` failed (empty set).
  - `pending`: `D-P3-15: ... renders "will partially install" under builtin` failed (`(will install)`).
  - `apply`: `D-P3-13: a candidate that adds an sse server is declined under Pi's built-in MCP and writes nothing` failed (base moved it).
  - Guards that passed on the base, as expected: the adapter rows, the record that is partial for outputStyles, and `D-P3-14` (no move for an unchanged catalog). They pin that the adapter reading and the no-switch cases did not change.
- **Task 2** (TAP over the unit and integration migration tests; exit 1, 7 failures). `D-P3-16: a server only Pi's built-in MCP runs is left out ...` failed with `cause: 'not-declared'` where `cause: 'unsupported-feature', feature: 'bareElicitationCapability'` was expected. The base read the neutral `droppedMcpServers`, which no longer lists that server. The two legacy-record unit cases failed with no `compatibilityBasis`. Both new integration cases failed. `AMIG-01: an unsupported server is removed ...` (unit) and `AMIG-01: /reload removes an undeclared server ...` (integration) failed, because the base cleared the basis.

## Cucumber red proof (the plan base's product files restored, then the plan's files restored)

| Profile | Scenarios run | Failed on base | Guards (passed on base) |
|---|---|---|---|
| adapter, verdict-apply (seed 587068) | 4 | none | all 4. The two apply scenarios guard against a runner that gates on the active view without this plan's `partial` flag (plan 03-06). On this base the runner gates on the neutral verdict, so the move lands either way. The restart scenario guards D-P3-14 (a switch adds no load row). The adapter pending twin pins the adapter view. |
| builtin, verdict-apply (seed 778685) | 1 | the `@builtin-only` pending preview: no `partial` on the base | none |

## Final runs (after the last commit)

- `npm run test:cucumber:profile -- --profile adapter features/mcp-server/verdict-apply.feature features/plugin/apply.feature features/plugin/pending.feature`: 76/76 scenarios, seed 479223.
- `npm run test:cucumber:profile -- --profile builtin features`: 49/49 scenarios, seed 484447.
- Extra: `npm run test:cucumber:profile -- --profile adapter features/mcp-server features/plugin/reconcile.feature features/plugin/autoapply.feature features/plugin/git-source.feature`: 149/149 scenarios, seed 295839.
- `npm run check:static`, `npm run test:modules`, `npm run test:unpaired`, and `npm run test:integration` all exited 0. `check:features` passed inside `check:static`.
- Not run here (the post-merge wave gate owns them): `test:coverage:direct:all` and the full adapter `features/marketplace features/plugin` shard. I ran the touched pairs one by one.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `orchestrators/reconcile/load.ts` changed although `files_modified` does not list it**
- **Found during:** Task 1
- **Issue:** The load calls `openScopePass` and `composePendingReport`. Both now require the implementation, which the must-haves ask for ("the load's read pass take from their run").
- **Fix:** `load.ts` passes `opts.run.softDeps.mcpImplementation` in two places. Its pair (`load.test.ts`) needed no change and stays at 100% direct coverage. No other plan in this wave touches `load.ts`.
- **Commit:** `5fce565`

**2. [Rule 1 - Bug] The switch in the apply scenarios lands on Pi's built-in MCP, not on no implementation**
- **Found during:** Task 3
- **Issue:** The plan's form is `When the user restarts pi without pi-mcp-adapter`. The adapter writes `-builtin:mcp` to the user settings, so that restart lands on no implementation (03-01's key decision). Under no implementation an sse server is not blocked, so the scenario would pin no switch effect and would not guard the 03-06 coupling the plan names.
- **Fix:** The two apply scenarios install through the adapter-profile shared Pi, then use `Given pi runs with the scripted model` (a fresh Pi that runs the built-in MCP, the `verdict-list.feature` precedent). The apply is then the only `When`. The load-row scenario uses `Given the user's pi settings turn off pi's built-in mcp`, `Given pi runs with the scripted model` (no implementation), and `When the user restarts pi with pi's built-in mcp turned on`. The titles say which switch each scenario makes.
- **Commit:** `9bcc43b`

**3. [Rule 3 - Blocking] The default record of the migration unit suite carries the neutral basis**
- **Found during:** Task 2
- **Issue:** After the change, every move of a legacy record (no basis) writes `state.json`. That would have changed 23 existing move-mechanics cases (write logs, state bytes) whose subject is not the verdict.
- **Fix:** `pluginRecord` in `test/orchestrators/reconcile/mcp-migration.test.ts` now carries `compatibilityBasis: "neutral"`. A new helper, `legacyPluginRecord`, drops the basis. Three new D-P3-16 cases use it (ws legacy, bare-elicitation legacy, plain legacy). The old "MREC-01: ... loses its neutral basis" case is now the ws legacy case, which asserts that the basis is kept.
- **Commit:** `c4f6502`

**4. [Rule 2 - Missing] Unit cases for the threading in `pending.ts` and `apply.ts`**
- **Found during:** Task 1
- **Issue:** Without them, a hard-coded implementation in `pending.ts` or `apply.ts` would pass every unit test.
- **Fix:** I added a `pendingReconcile` pair (builtin and adapter runs) and one `applyReconcile` decline case under a built-in run.
- **Commit:** `5fce565`

**5. [Environment] Scratch path and the commit trailer**
- Temp files went to the scratch subfolder that the prompt names (`.../scratchpad/p3/exec-07/`), not the plan's `.../scratchpad/03-07/`. `pre-commit` ran with `SKIP=npm-check,trufflehog`.

**Total deviations:** 5 (2 blocking, 1 bug, 1 missing test, 1 environment). **Impact:** the planned behavior holds under both profiles. Only the compile-forced `load.ts` lies outside `files_modified`.

## Issues Encountered

None beyond the deviations.

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

- **Coupling with 03-06:** the first apply scenario pins the row `demo updated {requires pi-mcp-adapter}` as this tree reports it. With 03-06's runner, the move gets `partial: true` from this plan. 03-06 may also change what row the runner reports for a partial move under the built-in MCP (for example `unsupported mcp, requires pi-mcp-adapter`). If it does, the post-merge gate shows it in `features/mcp-server/verdict-apply.feature`, and the row expectation must follow the runner's row.
- `orchestrators/reconcile/README.md` still describes the consent decline in general terms ("needs `--partial` consent"), which stays true. I did not edit it.

## Parent line candidates

- CHANGELOG: "`apply` and `pending` read plugin verdicts under the MCP implementation Pi runs: switching between pi-mcp-adapter and Pi's built-in MCP never makes `apply` ask for `--partial`, and `pending` previews `(will partially install)` only where the active implementation cannot run a server. The load-time move of legacy `mcp.json` entries records the implementation-neutral verdict."

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-03-15: `newlyDroppedKinds` holds every move whose candidate drops a kind the record's effective view does not drop. The convergence, apply, and cucumber cases pin both the held case and the unheld case. T-03-16: the AMIG-01 write uses `effectiveMcpCompatibility(..., "none")` and sets the basis after `replaceCompatibility`. The unit and integration cases pin the ws and bare-elicitation owners. T-03-SC: no package was added; `npm ci` from the committed lockfile only.

## Dubious Choices

- **The consent rule now also holds a move of a record that is already partial for another kind, when the candidate drops a new kind.** Severity: Medium. Alternatives: keep the D-12 rule "a record already installed partial moves without consent" and ask only when the record is installable. Why dubious: the plan's action and D-P3-13 ask for "kinds the candidate drops that the record does not". For a record that is partial for outputStyles, a candidate that also drops lsp is now declined, where the base moved it. No existing unit or cucumber case covered that combination. The behavior case "a record already partial ... keeps today's rule" is pinned only where the candidate drops nothing new.
- **The apply and load-row scenarios switch to the built-in MCP instead of restarting without pi-mcp-adapter.** Severity: Medium. Alternatives: the plan's restart form, which lands on no implementation and pins nothing about an sse verdict; or two restarts in one scenario. Why dubious: the titles and steps differ from the plan's text.
- **AMIG-01 converts every moving legacy record to the neutral basis.** Severity: Medium. Alternative: write only when the neutral verdict differs from the stored one. Why dubious: the first reload after an upgrade now writes `state.json` and stamps `updatedAt` even for a plain stdio move. But without the basis, a legacy record whose bare-elicitation server was dropped would keep reading installable under the adapter. The plan says "lacks the basis → write".
- **`applyNeutralVerdict` passes the record itself, with its basis, to `effectiveMcpCompatibility`.** Severity: Low. For an already-neutral record that stores a `mcpServers` kind, that kind stays as an implementation-independent block even if the source no longer declares a blocked server. Alternative: compute it from the record without its basis. Why dubious: an edge case that only a neutral record with legacy `mcp.json` entries reaches. I followed the plan's call literally.
- **The migration suite's default record carries the neutral basis.** Severity: Low. Alternative: update 23 existing cases to the new state write. Why dubious: the old cases now seed a record shape that a released build did not write. The legacy behavior is pinned by the three new cases.
- **The apply-after-switch scenario pins `updated {requires pi-mcp-adapter}`.** Severity: Medium (coupling). Alternative: wait for 03-06's row. Why dubious: 03-06 may change the row, and then the post-merge gate fails here.
- **`applyDroppedServers` was renamed to `applyNeutralVerdict`.** Severity: Low. Why dubious: the plan names the old function. The name changed because the function no longer acts only on dropped servers.
- **The commit trailer uses session `01EDUMG7S9uXh4o5dikBwum8` (the brief and the plan), not the harness reminder's session id.** Severity: Low. Why dubious: two instructions disagreed. The user's standing brief takes precedence over the reminder.
- **`read-pass.test.ts` has only compile-forced edits.** Severity: Low. Alternative: a case that observes the read pass's settled moves. Why dubious: `readPassForScope`'s result does not expose the moves, so a wrong implementation there is caught only by the apply and pending cases.

## Self-Check: PASSED

- FOUND: features/mcp-server/verdict-apply.feature (140 lines), test/integration/mcp-verdict-migration.test.ts (158 lines)
- FOUND: 5fce565, c4f6502, 9bcc43b (ancestors of HEAD); `git rev-list --count e1f1349..HEAD` = 3 before this SUMMARY commit
- Acceptance greps: `mcpImplementation` in convergence.ts 5, `readRecordMcpVerdict` in convergence.ts 2, `mcpImplementation` in notify.ts 2; `compatibilityBasis = "neutral"` in mcp-migration.ts 1; `resolutionFor(action.resolved, "adapter")` 1; `@own-implementation` in verdict-apply.feature 3; `check:features` exit 0.

---
*Phase: 03-read-time-verdicts*
*Completed: 2026-11-04*
