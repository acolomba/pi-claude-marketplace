---
phase: 03-read-time-verdicts
plan: "06"
subsystem: orchestrators/plugin (update runner)
tags: [mcp, update, reinstall, autoupdate, partial-consent, neutral-verdict, cucumber]

requires:
  - phase: 03-read-time-verdicts (03-01)
    provides: "resolutionFor(resolved, active) and readRecordMcpVerdict(record, source, active)"
  - phase: 03-read-time-verdicts (03-04)
    provides: "the D-MB-07 marker rule that the update rows render"
provides:
  - "ThreePhaseArgsBase.mcpImplementation and PreparePluginUpdateOptions.mcpImplementation (required)"
  - "the update candidate gate on the active implementation's view (resolveUpdateCandidate)"
  - "partialDegrade.kinds from the active view and newlyDegraded from the record's effective view (partialDegradeOf in update-swap.ts)"
  - "compatibilityBasis \"neutral\" on the swap's final write and the disabled pin refresh; the intent mark keeps the old basis"
  - "test/integration/mcp-verdict-update.test.ts and features/mcp-server/verdict-update.feature"
affects: [03-07 (apply convergence moves run through this runner), 03-09, phase 6 merge]

actuals:
  tokens: 19000
  tasks: 3
  commits: 3
plan_head_before: e1f1349443529d355109480b182b81dfd442c778
plan_head_after: c2e8b0f6704cdc7ee31991c57f8daedfa451808e

tech-stack:
  added: []
  patterns:
    - "Every update-runner builder names the run's MCP implementation; a builder with no run (apply's catalog move, an autoupdate run with no command) names \"none\" explicitly"
    - "A neutral-verdict writer sets compatibilityBasis right after replaceCompatibility in the same locked save"

key-files:
  created:
    - test/integration/mcp-verdict-update.test.ts
    - features/mcp-server/verdict-update.feature
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
    - test/orchestrators/plugin/update-preflight.test.ts
    - test/orchestrators/plugin/update-swap.test.ts
    - test/orchestrators/plugin/update-flow.test.ts
    - test/orchestrators/plugin/dependency-move.test.ts
    - test/orchestrators/plugin/materialize-latest.test.ts
    - test/orchestrators/plugin/reinstall-flow.test.ts
    - test/orchestrators/plugin/update-cascade.test.ts
    - test/orchestrators/plugin/install-flow-planning.test.ts
    - test/orchestrators/marketplace/update.messaging.test.ts
    - test/integration/mcp-server-records.test.ts
    - test/orchestrators/plugin/dependency-bindings.test.ts
    - test/orchestrators/plugin/install-flow-dependency-ledger.test.ts
    - test/orchestrators/plugin/operations.test.ts

key-decisions:
  - "Apply's catalog move runs the update runner with mcpImplementation \"none\": PluginConvergeTarget carries no implementation and apply.ts belongs to 03-07; the neutral view admits every move the plan admitted, so a switch never holds or fails a move"
  - "An autoupdate run with no command notification reads \"none\"; with one, it reads the command run's snapshot"
  - "newlyDegraded is read once at the start of the swap, before any record write, and only when the active view is partially available"
  - "A degrading swap whose prepared state no longer records the marketplace fails as marketplace-removed before it changes anything"
  - "The intent mark saves and restores the old basis around replaceCompatibility (P3-DC-21)"

patterns-established:
  - "Test fixtures that predate the view gate name mcpImplementation \"none\", the neutral view, so their behavior is the one they pinned before"

requirements-completed: [MREC-03, MREC-06]

coverage:
  - id: D1
    description: "The update candidate gate asks for --partial against the run's MCP implementation (sse needs --partial under builtin, not under adapter or none)"
    requirement: MREC-06
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/update-preflight.test.ts#D-P3-11: refuses a candidate that adds an sse server without partial permission under Pi's built-in MCP"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/update-flow.test.ts#D-P3-11: update without --partial under builtin leaves the record at 1.0.0 when the new version adds an sse server"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/verdict-update.feature (builtin and adapter profiles)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The update outcome's partialDegrade uses the active view; newlyDegraded compares it with the record's effective view under the same implementation"
    requirement: MREC-06
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/update-swap.test.ts#D-P3-12: a --partial update of a record that already drops its sse server under Pi's built-in MCP reports the degrade as not new"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/update-flow.test.ts#D-P3-12: the autoupdate cascade of a command run under Pi's built-in MCP reports the sse server as a new degrade"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/reinstall-flow.test.ts#D-P3-12 / D-P3-13: a reinstall under builtin of a plugin that now declares an sse server re-materializes it and names what that implementation drops"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every builder threads mcpImplementation (direct, reinstall, autoupdate, dependency move, converge)"
    requirement: MREC-06
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/dependency-move.test.ts#D-P3-11: refuses a move to a version that adds an sse server under the run's builtin MCP"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/update-flow.test.ts#D-P3-13: apply's catalog move of a version that adds an sse server lands with no degrade and no consent"
        status: pass
    human_judgment: false
  - id: D4
    description: "The swap's final write, the intent mark, and the disabled pin refresh store the neutral verdict with compatibilityBasis neutral (intent mark keeps the old basis)"
    requirement: MREC-03
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/update-swap.test.ts#D-P3-02"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/update-preflight.test.ts#D-P3-02: a disabled update rewrites a legacy pin whose only change is the neutral basis"
        status: pass
      - kind: integration
        ref: "test/integration/mcp-verdict-update.test.ts"
        status: pass
      - kind: integration
        ref: "test/integration/mcp-server-records.test.ts"
        status: pass
    human_judgment: false

duration: 85min
completed: 2026-11-04
status: complete
---

# Phase 3 Plan 06: Update consent and neutral writes in the update runner Summary

**`update` (and every caller of the shared update runner) now asks for `--partial` against the view of the MCP implementation the run uses, reports its partial rows and `newlyDegraded` in that view, and every update-path record write stores the neutral verdict with `compatibilityBasis: "neutral"`, so an sse version needs `--partial` under Pi's built-in MCP and updates freely under pi-mcp-adapter.**

## Performance

- **Duration:** about 85 min
- **Started:** 2026-11-04T16:20Z (approximate)
- **Completed:** 2026-11-04T17:45Z
- **Tasks:** 3 of 3
- **Files modified:** 20 (2 created, 18 modified)

## Accomplishments

- `PreparePluginUpdateOptions.mcpImplementation` and `ThreePhaseArgsBase.mcpImplementation` are required. `resolveUpdateCandidate` gates `resolutionFor(resolved, options.mcpImplementation)` with the existing partial switch, then narrows and returns the neutral candidate, which the swap records (D-P3-11). `widensPartialGate` still reads the stored neutral `installable` (D-P3-13).
- `update-swap.ts` gets `partialDegradeOf`: the outcome's `partialDegrade.kinds` come from the active view, and `newlyDegraded` is true when `readRecordMcpVerdict(preflight.record, …, args.mcpImplementation).effective.unsupported` is empty (D-P3-12). The read happens once, before the swap writes anything.
- The builders name the implementation: the direct update and reinstall from `opts.run.softDeps`, dependency moves from `context.softDeps`, the autoupdate run from its command notification's run (or `"none"` without one), and apply's catalog move `"none"` (see Deviations). Reinstall and autoupdate keep `partial: true`.
- D-P3-02: `applyAllSuccessRecordFields` and `refreshDisabledRecord` set `compatibilityBasis = "neutral"` right after `replaceCompatibility`; `nextDisabledPin` projects the basis, so an unchanged neutral disabled record is not rewritten; `markUpdateInProgress` keeps the old basis across `replaceCompatibility` (P3-DC-21).
- fallow reported no cycle after `update-swap.ts` imported `mcp-verdict-read.ts` (`npm run fallow` and `npm run check:static` exit 0).

## Task Commits

1. **Task 1: Update consent and update rows follow the active implementation** - `8515119` (feat)
2. **Task 2: The update path writes the neutral verdict with its basis** - `49306db` (feat)
3. **Task 3: Update consent scenarios** - `c2e8b0f` (test)

**Plan metadata:** the SUMMARY commit that follows these.

## Red proof per profile (cucumber)

Each scenario ran on the plan's base commit `e1f1349` (the five product files of Tasks 1 and 2 restored to that commit) with the new feature file.

| Scenario | Profile | On the base commit | Failing step and observed value |
|---|---|---|---|
| Updating to a version that adds an sse server asks for --partial, under Pi's built-in MCP (MREC-06) | builtin | failed | `Then the result has these fields:` read `needs reload: true` (the update went through as `updated`) instead of the held `partially-upgradable` row |
| Updating to a version that adds an sse server needs no --partial, under pi-mcp-adapter (MREC-06) | adapter | passed | Guard: the neutral gate already admitted the sse server, which the adapter runs. It protects the adapter twin from a gate that read the built-in view. |
| Updating with --partial to a version that adds an sse server reports it partially installed, under Pi's built-in MCP (MREC-03) | builtin | failed | `Then the result lists these plugins:` read `updated` with `requires pi-mcp-adapter` instead of `partially-installed` with `unsupported mcp, requires pi-mcp-adapter` |

GREEN: builtin `2 scenarios (2 passed)`; adapter `verdict-update.feature` + `features/plugin/update.feature` + `features/plugin/reinstall.feature` `51 scenarios (51 passed)`; builtin `features/mcp-server features/plugin` `49 scenarios (49 passed)`.

## TDD RED evidence (unit)

The commit hook refuses a failing-test-only commit, so each task committed tests and implementation together (P1-DC-28). RED was taken by restoring the task's product files to the commit before it and running the new cases with the TAP reporter under the non-DAC wrapper.

- **Task 1**, product at `e1f1349` (`--test-name-pattern "D-P3-1[123]"`): `not ok` on every built-in case, each on its assertion:
  - `update-preflight.test.ts` "D-P3-11: refuses a candidate that adds an sse server without partial permission under Pi's built-in MCP": a prepared candidate came back instead of the `skipped` / `partialUpgradable` row.
  - `update-swap.test.ts` "a --partial update that adds an sse server reports a new degrade under builtin…" and "…already drops its sse server…not new": `partialDegrade: undefined` instead of `{ kinds: ["mcpServers"], newlyDegraded: true|false }`; "a degrading swap whose prepared state no longer records the marketplace fails as removed": no rejection.
  - `update-flow.test.ts` "D-P3-11: update without --partial under builtin…": the record moved to 1.1.0 with an `(updated) {requires pi-mcp-adapter}` row; "D-P3-12: the autoupdate cascade of a command run under Pi's built-in MCP…": `partialDegrade: undefined`.
  - `dependency-move.test.ts` "D-P3-11: refuses a move … under the run's builtin MCP": `ok: true`.
  - `reinstall-flow.test.ts` "a reinstall under builtin…": row `(reinstalled) {requires pi-mcp-adapter}` instead of `{unsupported mcp, requires pi-mcp-adapter}` at warning.
  - Guards that passed on the base, as expected: the adapter and none rows of each pair, the no-command autoupdate row, and the converge row.
  - Semantic assessment: every failure is the target assertion on the planned behavior; no load, fixture, or syntax failure (TypeScript stripping ignores the new `mcpImplementation` fields at runtime on the base).
- **Task 2**, product at `8515119`: `not ok` on the four `mcp-verdict-update.test.ts` cases (no basis after update, reinstall, and disabled update; `undefined` basis beside the intent mark), on "D-P3-02: an all-success swap of a legacy record…", "a failed swap keeps the neutral basis…", "MREC-01 / D-MB-04 …" (`hasCompatibilityBasis: false`), the three disabled-pin cases in `update-preflight.test.ts`, the three `mcp-server-records.test.ts` basis expectations, and the two `reinstall-flow.test.ts` AGENT-01 record pins. "a failed swap keeps no basis on a legacy record" passed on the base: a guard that the intent mark does not invent a basis.

## Verification

- `npm run test:coverage:direct --` on update-preflight.ts, update-swap.ts, update-flow.ts, dependency-move.ts, reinstall-flow.ts, materialize-latest.ts, operations.ts, update-cascade.ts, install-flow-planning.ts, update.messaging.ts, dependency-bindings.ts, install-flow-dependency-ledger.ts: exit 0 (100% each).
- `npm run check:static`: exit 0 on the final tree (typecheck, lint, lint:workflows, fallow with both cycle runs, format, pairing, check:features).
- `npm run test:modules`: exit 0 after each task and on the final tree.
- `npm run test:integration`: exit 0.
- Cucumber as listed under the red proof.
- Acceptance greps: `mcpImplementation` in update-preflight.ts 5; `readRecordMcpVerdict` in update-swap.ts 2; `resolutionFor` in update-preflight.ts 2; `compatibilityBasis = "neutral"` in update-swap.ts 1; the basis lines in update-preflight.ts 2; `test -f test/integration/mcp-verdict-update.test.ts` and `features/mcp-server/verdict-update.feature` pass.

## Files Created/Modified

- `orchestrators/plugin/update-preflight.ts` - required `mcpImplementation`; the view gate; the neutral basis on the disabled refresh and in its projection
- `orchestrators/plugin/update-swap.ts` - required `mcpImplementation`; `partialDegradeOf`; the basis on the final write; the intent mark keeps the old basis
- `orchestrators/plugin/update-flow.ts` - the direct, autoupdate, and converge builders name the implementation
- `orchestrators/plugin/dependency-move.ts` - `moveArgs` takes `context.softDeps.mcpImplementation`
- `orchestrators/plugin/reinstall-flow.ts` - reinstall takes `opts.run.softDeps.mcpImplementation`
- `features/mcp-server/verdict-update.feature` - the consent pair and the partial row
- `test/integration/mcp-verdict-update.test.ts` - the real update, reinstall, failed update, and disabled update
- Unit and integration tests as listed in the frontmatter

## Decisions Made

See `key-decisions` above; each is also listed under Dubious Choices.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Apply's catalog move has no run to name**
- **Found during:** Task 1
- **Issue:** The plan has the converge entry thread `mcpImplementation` "from the options' run", but `PluginConvergeTarget` (orchestrators/types.ts, no plan's file) carries no implementation and its builder is in `reconcile/apply.ts` (03-07's file).
- **Fix:** `convergePluginWith` passes `"none"` with a D-P3-13 comment. 03-07's planner judges the move under the run's implementation and passes `partial` from the record's effective view, and the neutral view admits everything any implementation admits, so no move it runs is held. The cost: apply's move row under Pi's built-in MCP for an sse candidate shows `(updated)` rather than `(partially-installed)`.
- **Files modified:** update-flow.ts
- **Committed in:** `8515119`

**2. [Rule 3 - Blocking] Fixtures outside the plan's file list**
- **Found during:** Tasks 1 and 2 (typecheck, `test:modules`)
- **Issue:** The required option broke two fixtures outside `files_modified`; the basis broke one record pin.
- **Fix:** `dependency-bindings.test.ts` (2 lines, no sibling lists it) and `install-flow-dependency-ledger.test.ts` (1 line, 03-05 lists it) name `mcpImplementation: "none"`; `operations.test.ts` (1 line, no sibling lists it) expects `compatibilityBasis: "neutral"` on the reinstalled record. `install-flow-ledger.test.ts` needed no change: its basis pins are install and enable records.
- **Committed in:** `8515119`, `49306db`

**3. [Rule 2 - Correctness] A degrading swap needs the marketplace record**
- **Found during:** Task 1
- **Issue:** `readRecordMcpVerdict` needs the marketplace record the preflight read, which `PreparedPluginUpdate` carries only inside `state`.
- **Fix:** `partialDegradeOf` reads `preflight.state.marketplaces[marketplace]` and fails as `PluginUpdateConcurrencyError("marketplace-removed")` before any write when it is missing. A unit case pins it.
- **Committed in:** `8515119`

**4. [Rule 3 - Blocking] fallow cognitive complexity in a test helper**
- **Found during:** Task 1 (`check:static`)
- **Fix:** `update-preflight.test.ts`'s `prepare` takes the implementation as a third parameter with a default instead of an option with `??`.
- **Committed in:** `8515119`

**5. [Plan detail] The --partial update row under Pi's built-in MCP is a warning**
- **Found during:** Task 3
- **Issue:** The plan named the row but not its severity. The row carries `requires pi-mcp-adapter`, and D-P3-09 raises warning when an MCP marker shows.
- **Fix:** The scenario pins `severity: warning` with the attention summary.
- **Committed in:** `c2e8b0f`

**Total deviations:** 5 (3 blocking, 1 correctness, 1 plan detail). **Impact:** the planned behavior holds for every user-run path; apply's move row under Pi's built-in MCP stays in the neutral view until the converge target carries the implementation.

## Issues Encountered

- **The `mcp-verdict-read.ts` header is stale.** It says `update-swap.ts` and `update-preflight.ts` must not import the module and take the verdict as data. fallow measured no cycle for `update-swap.ts`, which now imports it. The file is 03-01's and outside this plan's list; its comment should drop `update-swap.ts` from that list (see Parent line candidates).
- **A refused update's note has an empty reason list.** The resolver adds no note for a blocked MCP server, so the skipped outcome's note reads `Plugin "hello" is no longer installable: ` (as a ws server's does today). Rows render the reasons (`unsupported mcp`), not the note; the unit cases pin the note as it is.
- **No WINDOWS.md entry** for the apply-row gap: the executor rules forbid editing `.planning/WINDOWS.md` from a parallel worktree.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

03-07's convergence passes `partial` from the record's effective view; with this plan's runner the move is never held by a switch. A follow-up can add `mcpImplementation` to `PluginConvergeTarget` and pass `run.softDeps.mcpImplementation` from `reconcile/apply.ts` so apply's move rows read the active view.

## Parent line candidates

- CHANGELOG: "`/claude:plugin update` asks for `--partial` only when the MCP implementation Pi runs would leave out a server of the new version, so an update that adds an sse server needs it under Pi's built-in MCP and not under pi-mcp-adapter. Updated, reinstalled, and refreshed records store the verdict that holds under every implementation."
- `orchestrators/plugin/mcp-verdict-read.ts` header (03-01's file, not frozen): drop `update-swap.ts` from the list of modules that must not import it; fallow found no cycle.
- `orchestrators/types.ts` `PluginConvergeTarget` + `reconcile/apply.ts` `runStep`: carry `mcpImplementation: run.softDeps.mcpImplementation`, and `convergePluginWith` passes `target.mcpImplementation` instead of `"none"`.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-03-13: `resolveUpdateCandidate` gates on the active view through a required option, and the built-in refusal scenario fails without it. T-03-14: each writer sets the basis right after `replaceCompatibility` inside the same `withStateGuard` / `withLockedStateTransaction` save; the intent mark keeps the old basis; unit and integration cases pin each writer. T-03-SC: no package was added. The new import of `mcp-verdict-read.ts` adds no git surface (BLOCK F and fallow pass).

## Dubious Choices

- **Phase 1 functions edited (P3-DC-02).** Severity: Medium. `applyAllSuccessRecordFields` and `markUpdateInProgress` (update-swap.ts) and `refreshDisabledRecord` / `nextDisabledPin` (update-preflight.ts) each gained the narrowest diff: one basis line, a save-and-restore of the old basis, and one projection field. Alternative: a wrapper that writes the basis outside these functions. Why dubious: the functions are Phase 1's record writers.
- **Cycle measurement.** Severity: Low. `update-swap.ts` imports `mcp-verdict-read.ts`, which reaches the frozen `recorded-servers.ts` and `install-outcome.ts`; both fallow runs reported no cycle. Alternative: pass the effective verdict as data from the preflight. Why dubious: a later import from `install-outcome.ts` into the update family would close a cycle that fallow would then report.
- **Apply's catalog move reads the neutral view.** Severity: Medium. See Deviation 1. Alternatives: add the field to `PluginConvergeTarget` and edit `apply.ts` (03-07's file), or make the field optional. Why dubious: the plan said every builder names the run's implementation; apply's move row under built-in reads `(updated)` for an sse candidate.
- **An autoupdate run with no notification reads `"none"`.** Severity: Low. Production always passes a notification; tests call `beginPluginUpdateRun()` bare. Alternative: make the notification required (breaks a test file outside this plan). Why dubious: a `??` default where the plan wanted none.
- **newlyDegraded is read before the swap starts.** Severity: Low. The plan said "before the outcome is built"; reading before any write keeps the old clone and record intact for the legacy re-resolve. Alternative: read after the finalize. Why dubious: a degrading swap does one more read before it prepares.
- **A missing marketplace in the prepared state fails the swap.** Severity: Low. Alternative: fall back to the stored verdict. Why dubious: defensive code for a state the preflight already ruled out.
- **Fixtures default to `"none"`.** Severity: Low. Existing fixtures name the neutral view, which reproduces what they pinned before; new cases name builtin or adapter. Alternative: `"adapter"` everywhere, which would change several existing expectations (a bare-elicitation candidate would need `--partial`). Why dubious: the fixtures do not exercise the production default of any single implementation.
- **The --partial update under built-in is a warning row.** Severity: Low. It follows D-P3-09 (an MCP marker raises warning). Alternative: keep explicit `--partial` at info. Why dubious: before this phase a user-requested partial update was info.
- **Claude-Session trailer.** Severity: Low. The commits end with `session_01EDUMG7S9uXh4o5dikBwum8`, as `.planning/CHILD-SESSION-BRIEF.md`, the plan, the executor rules, and every earlier commit on the branch require; this executor's harness suggested a different session URL. Alternative: the harness URL. Why dubious: two instructions disagree.

## Self-Check: PASSED

- FOUND: test/integration/mcp-verdict-update.test.ts
- FOUND: features/mcp-server/verdict-update.feature
- FOUND: 8515119, 49306db, c2e8b0f (ancestors of HEAD)

---
*Phase: 03-read-time-verdicts*
*Completed: 2026-11-04*
