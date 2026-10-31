---
phase: 01-presentation-model
plan: 10
subsystem: notify
tags: [notify, presentation-model, notification-run, soft-dep-snapshot, plugin-install, import, sc-3]

requires:
  - phase: 01-presentation-model
    provides: "01-06 command-root NotificationRun and SubcommandHandler (args, ctx, run); 01-08 import and reconcile runs; 01-09 import and reconcile hand their run to the nested add"
provides:
  - "InstallPluginOptions.run: the install severity stamp and the soft-dep markers read one snapshot (D-05)"
  - "composeInstalledRow(installCtx, run) stamps companionSeverity(..., run.softDeps)"
  - "makeInstallHandler(hooksRouting, completionCache) and makeImportHandler(deps, hooksRouting) return SubcommandHandler and take no pi"
  - "ImportClaudeSettingsOptions has no pi; import and reconcile hand their run to the nested install (D-07)"
  - "The SC-3 / D-08 two-answer probe case in tests/edge/register.test.ts"
affects: [01-11 onward (remaining pi-taking orchestrators), 01-16 removal of the ToolInventory branch]

actuals:
  tokens: 13888
  tasks: 2
  commits: 2
plan_head_before: bdce9cdfaaed50f0e8c75dc193d9c6fd7a1122f3
plan_head_after: 17fac6679cb6180bc3cc03523362689b780a8e8c

tech-stack:
  added: []
  patterns:
    - "A two-answer inventory (t.mock.fn with a mockImplementationOnce sequence behind a strict registrar's property expectation) proves one probe per command: a second probe changes the emitted bytes"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/orchestrators/plugin/operations.test.ts
    - tests/orchestrators/plugin/reinstall-flow.test.ts
    - tests/orchestrators/plugin/update-flow.test.ts
    - tests/edge/handlers/plugin/install.test.ts
    - tests/edge/handlers/plugin/import.test.ts
    - tests/orchestrators/import/execute.test.ts
    - tests/edge/register.test.ts
    - tests/architecture/workflows-marker-coverage.test.ts
    - tests/architecture/cross-op-convergence.test.ts
    - tests/architecture/config-state-consistency.test.ts
    - tests/integration/workflow-kind-inversion.test.ts
    - tests/integration/transaction-lifecycle-cascade.test.ts
    - tests/integration/fold-adoption.test.ts
    - tests/integration/concurrent-install-child.ts

key-decisions:
  - "install-flow.test.ts's makeCtx takes Partial<SoftDepStatus> over an all-false default and returns a run seed; the two WDEP-02 cases pass workflowEngineLoaded as a boolean, since the `workflow` vs `workflow_control` discrimination is the probe's and stays owned by the pi-api and notification-run suites"
  - "Seed installs keep their exact snapshot: reinstall-flow's seed install, whose inventory reported subagent and mcp, now passes runWithSoftDeps({ piSubagentsLoaded: true, piMcpAdapterLoaded: true, workflowEngineLoaded: false }), so the corpus bytes do not move"
  - "The SC-3 registrar exposes getAllTools as a property expectation with atLeast(3); the exact count is asserted on the context-owned t.mock.fn, and a later read answers `subagent` so a second probe changes the bytes rather than throwing"

patterns-established:
  - "D-05 install: the router's run stamps the success row's severity and composes its markers"

requirements-completed: [PMOD-01]

coverage:
  - id: D1
    description: "Plugin install renders from the command run: InstallPluginOptions.run replaces pi, the success row's severity reads run.softDeps, and every standalone emission passes the run"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/operations.test.ts"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/install.test.ts"
        status: pass
      - kind: unit
        ref: "tests/architecture/workflows-marker-coverage.test.ts"
        status: pass
      - kind: unit
        ref: "tests/architecture/cross-op-convergence.test.ts"
        status: pass
      - kind: unit
        ref: "tests/architecture/config-state-consistency.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Import is fully off pi and reconcile shares its run with the nested install (D-07); the install and import handlers take no pi"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/import/execute.test.ts"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/import.test.ts"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts"
        status: pass
      - kind: integration
        ref: "npm run test:integration"
        status: pass
    human_judgment: false
  - id: D3
    description: "SC-3 proven through the registered command: one probe (three reads) per command, and one snapshot feeds both the warning severity and the {requires pi-subagents} marker"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/edge/register.test.ts#one soft-dep snapshot drives both the severity stamp and the markers of a registered install (SC-3, D-08)"
        status: pass
      - kind: unit
        ref: "tests/edge/register.test.ts#rebuilds completion rows through the cache that owns a successful registered install"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/register.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Emitted bytes are unchanged: the wire corpus and the output catalog match, and npm run check passes"
    requirement: PMOD-01
    verification:
      - kind: other
        ref: "node scripts/notify-corpus.mjs check"
        status: pass
      - kind: other
        ref: "git diff --exit-code 2f173031 -- docs/output-catalog.md"
        status: pass
      - kind: other
        ref: "npm run check"
        status: pass
    human_judgment: false

duration: 67min
completed: 2026-09-30
status: complete
---

# Phase 1 Plan 10: Install on the Command Run and the SC-3 Proof Summary

**Plugin install stamps its severity and composes its soft-dep markers from the command's one run snapshot, import no longer carries `pi`, and a registered-install case with a two-answer inventory proves SC-3.**

## Performance

- **Duration:** about 67 min
- **Started:** 2026-09-30T01:38Z
- **Completed:** 2026-09-30T02:45Z
- **Tasks:** 2
- **Files modified:** 23

## Accomplishments

- `InstallPluginOptions` carries `readonly run: NotificationRun` in place of `pi`. `failedRowOutcome`, `handleInstallThrow`, the marketplace-not-added row, the cascade-failure row, and the success row all read `run`.
- `composeInstalledRow(installCtx, run)` stamps `companionSeverity({ declaresAgents, declaresMcp, declaresWorkflows }, run.softDeps)`. The `softDepStatus` import is gone from `install-flow.ts`, so install has no second probe (D-05).
- `makeInstallHandler(hooksRouting, completionCache)` returns `SubcommandHandler` and forwards the router's run. `makeImportHandler(deps, hooksRouting)` takes no `pi`. `register.ts` calls both without `pi`.
- `ImportClaudeSettingsOptions` has no `pi`. The nested install gets `run: opts.run`. Reconcile passes `run: opts.run` to the nested install and keeps `pi` only for uninstall, enable, and backfill (D-07).
- A new registered-install case proves SC-3 (D-08). The inventory answers `[]` for three reads and `subagent` after that. The single notification is the warning summary with `{requires pi-subagents}`, and `getAllTools` is read exactly three times.

## Task Commits

1. **Task 1: Install stamps severity and renders markers from the command run** - `a21e5310` (refactor)
2. **Task 2: SC-3 proof, one snapshot per registered command** - `17fac667` (test)

## Probe Pins Restated

- `install.test.ts` (handler): the delegating cases moved from 6 (materialise) and 3 (gate refusal, disabled landing) to 0. The header and the matrix case say why: the handler hands install no tool inventory, and D-05 has install read the run for both severity and markers. The per-row `toolProbes` field is gone.
- `install-flow.test.ts`: the D-141-03 standalone discovery-warning case moved from `createNotificationBoundary(2, 6)` to `(2, 0)`.
- `register.test.ts`: the registered install case moved from `{ runs: 1, probingEmissions: 2 }` to `{ runs: 1, probingEmissions: 0 }`: three root reads.
- `execute.test.ts`: the header no longer mentions a strict `pi` for the nested install. The two cases that state the install's options expect `run`.

## SC-3 Spot Check

After Task 1, install has no inventory to probe, so the spot check planted the second probe one level up. The router got a run whose `softDeps` getter re-opens a run on every read. The severity stamp read the first snapshot (`[]`, warning) and the renderer read the second (`subagent`, no marker). The SC-3 case failed on the missing `{requires pi-subagents}` with the warning summary still present. `register.ts` was then restored with `git checkout --` on that one file, and the case passed again.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Three more suites passed `pi` to `installPlugin`**
- **Found during:** Task 1 (typecheck)
- **Issue:** `tests/orchestrators/plugin/reinstall-flow.test.ts` (two seed installs) and `tests/orchestrators/plugin/update-flow.test.ts` (five seed installs) pass `pi` to `installPlugin`. Neither file is in the plan's list.
- **Fix:** Each seed passes a run with the same snapshot its inventory reported: `runWithNothingLoaded()`, or the subagent-and-mcp seed shown in `key-decisions`.
- **Verification:** Both suites pass. The corpus check reports the same 7 extras as before.
- **Committed in:** `a21e5310`

**2. [Rule 2 - Stale contract prose] `ApplyReconcileOptions.pi` listed install among its forwards**
- **Found during:** Task 1
- **Issue:** `orchestrators/reconcile/types.ts` said the inventory goes to the nested install. That file is not in the plan's list.
- **Fix:** The doc lists uninstall, enable, and backfill, and says the nested add, remove, and install read `run`.
- **Committed in:** `a21e5310`

**3. [Rule 2 - Stale comment] `workflow-kind-inversion.test.ts` said the test's `pi` decides the reconcile marker**
- **Found during:** Task 1
- **Issue:** The reconcile-applied cascade reads the run. The comment named `pi`.
- **Fix:** The comment names the run.
- **Committed in:** `a21e5310`

**4. [Plan inventory] `apply.test.ts` and `scripts/check-unused-type-members.contracts.json` needed no change**
- `apply.test.ts` has no case that states the options handed to the nested install, and it passes unchanged. No type-member pin sits in a changed file, and `lint:type-members` passes.

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 prose), plus 1 inventory note.
**Impact on plan:** No scope change. The corpus, the catalog, and `npm run check` show no byte change.

## Issues Encountered

- `fallow audit --base HEAD` before the Task 1 commit returned `warn` with one introduced clone: `edge/handlers/plugin/install.ts:52-65` against `edge/handlers/plugin/update.ts:36-49`. It is in the `dup:c77b3abb6f87acd9` family that the 01-08 and 01-09 summaries record as pre-existing. The two handler bodies had the same shape before, and the signature change moved the clone boundary. The audit before the Task 2 commit returned `pass`. No `fallow-ignore` marker was added.
- The acceptance grep `rg -n "readonly pi"` over `install-flow.ts` matches `readonly pinVersionOverride`. That is a different field. The word-bounded `rg -n "readonly pi\b"` prints nothing over `install-flow.ts` and `execute.ts`.
- The first focused run failed on the registered-install case in `register.test.ts`. It still stated `probingEmissions: 2`. The plan names this change ("keeps only the three root reads"), and the case now states 0.

## Verification

- Task 1 verify: the ten-suite focused run plus `reinstall-flow` and `update-flow` passed 789/789 after the register restatement. `npm run test:integration` passed 36/36. `rg -n "softDepStatus"` over `install-flow.ts` and `import/execute.ts` prints nothing. The corpus check passed.
- Acceptance: `rg -n "companionSeverity\(" -A1 install-flow.ts` shows `run.softDeps`.
- Task 2 verify: `node --test --test-name-pattern="SC-3" tests/edge/register.test.ts` passed 1/1. `npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/register.ts` reported `Direct coverage passed` (branches 15/15, functions 9/9, lines 179/179).
- Pre-commit on each task's files passed every hook, including typecheck, lint, fallow, direct coverage on changed pairs, and the type-member gates.
- `node scripts/notify-corpus.mjs check`: `2622 baseline entries present, 7 extra` (the same 7 extras as after 01-09).
- `git diff --exit-code 2f173031 -- docs/output-catalog.md`: empty.
- `npm run check`, unpiped and logged: `CHECK_EXIT=0`. Unit 7357/7357, integration 36/36.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

- Ready for 01-11. Install and import render from the run. `ApplyReconcileOptions.pi` now only feeds uninstall, enable, and backfill.

## Self-Check: PASSED

- Commits `a21e5310` and `17fac667` exist on `features/json`.
- Every modified file listed above is in the combined diff from `bdce9cdf`.
