---
phase: 03-read-time-verdicts
plan: "05"
subsystem: plugin-install
tags: [mcp, mcp-builtin, install, enable, consent, partial, read-time-verdict]

requires:
  - phase: 03-read-time-verdicts
    provides: "resolutionFor(resolved, active) and the neutral resolver verdict (03-01); the D-MB-07 marker rule (03-04)"
provides:
  - "InstallLedgerOptions.consentView (required): the MCP implementation whose view the --partial gate reads"
  - "preflightInstallResolve gates on resolutionFor(resolved, consentView) and still hands statePhase the neutral resolution"
  - "InstallLedgerSummary.resolved is the run's active view, so install, cascade, enable, and promotion rows follow the implementation Pi runs"
  - "buildInstallLedgerOptions gates on run.softDeps.mcpImplementation; enable, the enable cascade member, the re-enable cascade member, and promotion gate on \"none\""
  - "features/mcp-server/verdict-install.feature: the MREC-06 consent pairs and the enable-after-switch scenario"
affects: [03-06, 03-07, 03-09]

actuals:
  tokens: 13516
  tasks: 2
  commits: 2
plan_head_before: e1f1349443529d355109480b182b81dfd442c778
plan_head_after: 3404ca92251a700c4bd56492bfb5f102b927168d

tech-stack:
  added: []
  patterns:
    - "The consent gate and the row read two different views: the gate reads the caller-named consentView, the summary reads the run's implementation, and the record keeps the neutral verdict"

key-files:
  created:
    - features/mcp-server/verdict-install.feature
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts
    - test/orchestrators/plugin/install-outcome.test.ts
    - test/orchestrators/plugin/install-flow-cascade-context.test.ts
    - test/orchestrators/plugin/enable-disable.test.ts
    - test/orchestrators/plugin/install-cascade.test.ts
    - test/orchestrators/plugin/install-flow-results.test.ts
    - test/orchestrators/plugin/install-flow-ledger.test.ts

key-decisions:
  - "The enable-after-switch scenario installs and disables through the run's adapter-profile Pi and enables from a fresh profile Pi that runs Pi's built-in MCP, as 03-01's switch scenario does, because a restart without pi-mcp-adapter lands on no MCP implementation, where the sse row reads installed"
  - "The gate narrows the neutral resolution with a second requirePartialInstallable after the view gate, so statePhase keeps receiving the neutral MaterializablePlugin with no cast"
  - "Existing tests that build InstallLedgerOptions by hand pass consentView \"none\", which keeps their earlier neutral gate"

patterns-established:
  - "A record-driven re-materialization passes consentView \"none\" next to its stored-installable partial flag; a fresh install takes the run's implementation from buildInstallLedgerOptions"

requirements-completed: [MREC-03, MREC-05, MREC-06]

coverage:
  - id: D1
    description: "The install gate asks for --partial against the named view: builtin refuses sse, adapter refuses bare elicitation, none refuses ws; the other views admit them"
    requirement: MREC-06
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/install-outcome.test.ts#MREC-06 / D-P3-11: the builtin view asks for --partial for an sse server and records nothing"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/install-outcome.test.ts#MREC-06 / D-MB-05: the none view installs an sse server without --partial"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/verdict-install.feature (adapter and builtin profiles)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The record stays neutral while the summary and the rows read the run's active view"
    requirement: MREC-03
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/install-outcome.test.ts#MREC-03 / D-P3-02: an sse install with --partial under Pi's built-in MCP records the neutral verdict and reads the built-in view"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/verdict-install.feature#Installing a plugin with an sse server with --partial reports it partially installed, under Pi's built-in MCP (MREC-03)"
        status: pass
    human_judgment: false
  - id: D3
    description: "buildInstallLedgerOptions gates on the run's implementation (user-run install, cascade members, import and apply fresh installs)"
    requirement: MREC-05
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/install-flow-cascade-context.test.ts#D-P3-11: builds member ledger options from shared and member inputs, gating consent on the run's MCP implementation"
        status: pass
    human_judgment: false
  - id: D4
    description: "Enable, the enable cascade member, the re-enable cascade member, and promotion never ask for --partial because of a switch"
    requirement: MREC-06
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/enable-disable.test.ts#MREC-06 / D-P3-13: enabling a plugin with an sse server under Pi's built-in MCP needs no --partial and reads partially installed"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/enable-disable.test.ts#D-P3-13 / D-MB-06: enabling a plugin under Pi's built-in MCP turns on its disabled dependency with an sse server without --partial"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/install-cascade.test.ts#D-P3-13 / D-MB-06: a disabled dependency with an sse server re-enables under Pi's built-in MCP without --partial"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/install-flow-results.test.ts#D-P3-13 / D-MB-06: re-materializes a disabled dependency with an sse server under Pi's built-in MCP without --partial"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/verdict-install.feature#Enabling a plugin installed under pi-mcp-adapter needs no --partial when pi runs its built-in MCP instead (MREC-06, D-MB-06)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Concurrency: the consent decision is taken inside the install ledger under the scope's state lock, from that transaction's own resolution"
    requirement: MREC-06
    verification: []
    human_judgment: true
    rationale: "Backstop truth by construction (the gate lives in preflightInstallResolve, which runs inside the lock owner's transaction); no test drives two Pi processes switching implementation mid-install"

duration: 45min
completed: 2026-11-04
status: complete
---

# Phase 3 Plan 05: Install consent per MCP implementation Summary

**The install ledger now asks for `--partial` against a view each caller names (`InstallLedgerOptions.consentView`, required): a user-run install, its cascade members, and fresh import and apply installs ask against the MCP implementation Pi runs, while enable, the enable and re-enable cascade members, and promotion pass `"none"` and never ask because of a switch. The ledger summary reads the run's active view, so an sse install with `--partial` under Pi's built-in MCP reports `partially-installed {unsupported mcp, requires pi-mcp-adapter}` while its record keeps the neutral verdict.**

## Performance

- **Duration:** about 45 min
- **Started:** 2026-11-04T16:18Z (first scratch log)
- **Completed:** 2026-11-04T17:03Z
- **Tasks:** 2 of 2
- **Files modified:** 12 (1 created, 11 modified)

## Accomplishments

- `InstallLedgerOptions.consentView: ActiveMcpImplementation` is required, with no default (D-P3-03). `preflightInstallResolve` gates on `resolutionFor(resolved, opts.consentView)` with the existing `--partial` switch, then narrows the neutral resolution with `requirePartialInstallable` (a view is `unavailable` exactly when the neutral resolution is, so this never throws). `statePhase` still stores the neutral verdict (D-P3-02).
- `runInstallLedger` projects `toInstallLedgerSummary(context, run.softDeps.mcpImplementation)`, so `summary.resolved` is the run's active view (MREC-03). Every row composer that reads the summary (install, cascade members, enable, promotion) now follows the active implementation.
- `buildInstallLedgerOptions` sets `consentView` to `run.softDeps.mcpImplementation` (D-P3-11, P3-DC-20). `materializeEnableRoot`, `buildEnableCascadeMemberPhase`, `buildReEnableMemberPhase` (as an override after the spread), and `materializePromotedRecord` set `consentView: "none"` and keep reading the stored neutral `installable` for `partial` (D-P3-13, D-MB-06).
- Unit cases: the three refusal views, the four admitting views, the neutral record under a built-in `--partial` install, a `"none"` gate under a built-in run, the options builder under a built-in run, and the four record-driven paths (enable, the enable cascade member, the re-enable cascade member, and promotion) under Pi's built-in MCP.
- `features/mcp-server/verdict-install.feature`: six scenarios (the sse and bare-elicitation consent pairs, the built-in `--partial` row, and enable after a switch).

## Task Commits

1. **Task 1: The install ledger gates on a named view and its rows read the active view** - `c39c80b` (feat)
2. **Task 2: Consent scenarios for install and for enable after a switch** - `3404ca9` (test)

**Plan metadata:** the SUMMARY commit that follows these.

## TDD RED evidence (unit)

The commit hook refuses a commit that holds only failing tests, so Task 1 committed its tests and its implementation together (P1-DC-28). RED was taken by restoring the five product files to the plan base `e1f1349` and running the new cases with `node --test --test-reporter=tap --test-name-pattern 'MREC-06|D-P3-1[13]|MREC-03 / D-P3-02'` over the five paired test files (exit 1, 14 tests, 8 pass, 6 fail):

- `not ok - MREC-06 / D-P3-11: the builtin view asks for --partial for an sse server and records nothing` and `... the adapter view asks for --partial for a bare-elicitation server ...`: `Missing expected rejection.` (the base gate read the neutral verdict and installed). `gsd-tools check tdd-red-evidence` on this TAP report with the builtin case as target: `RED_EVIDENCE_OK` (`target_test_failed`).
- `not ok - MREC-03 / D-P3-02: an sse install with --partial under Pi's built-in MCP ...` and `not ok - D-P3-13: a re-materialization gated on the none view ...`: the summary read `installable` (the neutral resolution), expected `partially-available` with `["mcpServers"]`.
- `not ok - MREC-06 / D-P3-13: enabling a plugin with an sse server under Pi's built-in MCP ...`: the row read `● foo-plugin v1.2.3 (installed) {requires pi-mcp-adapter}`, expected `◉ ... (partially-installed) {unsupported mcp, requires pi-mcp-adapter}`.
- `not ok - D-P3-11: builds member ledger options ...`: the options had no `consentView`.
- Passed on the base, as guards: the ws refusal under `"none"` (the neutral verdict already blocks ws), the four admitting views, and the three record-driven cases (enable cascade member, re-enable cascade member, promotion), because the base gate read the stored neutral `installable` and never asked.
- Semantic assessment: every failure is an assertion on the planned behavior, with no load or fixture fault. The guards do not prove the `"none"` overrides on their own, so each record-driven site was checked by a mutation: replacing `consentView: "none"` with the run's implementation (or with `"builtin"` in `install-cascade.ts`) made the enable, enable cascade member, re-enable member, and promotion cases fail. Each mutation was reverted before the commit.

## Cucumber red proof per profile

Each scenario ran on the plan base `e1f1349` (the five product files restored to it, then restored back to `c39c80b`).

| Scenario | Profile | On the base | Failing step and observed row, or guard reason |
|---|---|---|---|
| Installing a plugin with an sse server asks for --partial, under Pi's built-in MCP (MREC-06) | builtin | failed | `Then the result has these fields:` read severity `warning`, needs reload `true`, summary `A plugin operation needs attention.`: the base installed it |
| Installing a plugin with an sse server needs no --partial, under pi-mcp-adapter (MREC-06) | adapter | passed | Guard: the adapter view and the neutral verdict both run an sse server, so the base already installed it without `--partial` |
| Installing a plugin whose server needs an elicitation handler asks for --partial, under pi-mcp-adapter (MREC-06) | adapter | failed | `Then the result has these fields:` read severity `warning` and needs reload `true`: the base's neutral gate admitted it |
| Installing a plugin whose server needs an elicitation handler needs no --partial, under Pi's built-in MCP (MREC-06) | builtin | passed | Guard: Pi's built-in MCP and the neutral verdict both run the server |
| Installing a plugin with an sse server with --partial reports it partially installed, under Pi's built-in MCP (MREC-03) | builtin | failed | `Then the result lists these plugins:` read `installed` with `requires pi-mcp-adapter` instead of `partially-installed` with `unsupported mcp, requires pi-mcp-adapter` |
| Enabling a plugin installed under pi-mcp-adapter needs no --partial when pi runs its built-in MCP instead (MREC-06, D-MB-06) | adapter (`@own-implementation`) | failed | `Then the result lists these plugins:` read `installed` with `requires pi-mcp-adapter` instead of `partially-installed` with `unsupported mcp, requires pi-mcp-adapter`. The consent half is a guard: the base enable gate read the stored neutral `installable` and never asked |

Red seeds: builtin 366167, adapter 396972. GREEN after the change: builtin `3 scenarios (3 passed)` (seed 332878), adapter `3 scenarios (3 passed)` (seed 589837).

## Verification

- `npm run test:coverage:direct --` on the five sources: exit 0 (100% line, function, and branch).
- `npm run test:modules`: exit 0.
- `npm run test:integration`: exit 0.
- `npm run check:static`: typecheck, lint:workflows, fallow, format:check, test:corresponding, and check:features passed; lint failed once on an `import-x/order` finding in `install-outcome.ts`, which I fixed before the commit (`npx eslint --max-warnings 0` over every touched file then exited 0). `npm run check:features` exited 0 again with the new feature file.
- Cucumber, adapter: `features/mcp-server/verdict-install.feature features/plugin/partial-install.feature features/plugin/enable.feature`: 21 scenarios (21 passed), seed 259464.
- Cucumber, builtin: `features/mcp-server/verdict-install.feature`: 3 passed (seed 332878); the whole builtin profile `features`: 51 scenarios (51 passed), seed 100066.
- Cucumber, adapter CI shard `features/skill features/slash-command features/agent features/hook features/mcp-server features/workflow`: 405 scenarios (405 passed), seed 660604.
- Not run here (the post-merge wave gate owns it): the adapter shard `features/marketplace features/plugin` beyond the two files above, and `test:coverage:direct:all`.
- Acceptance greps: `consentView` in install-outcome.ts 4; `consentView: "none"` in enable-disable.ts 2, install-cascade.ts 1, install-flow-results.ts 1; `features/mcp-server/verdict-install.feature` exists (134 lines), `@own-implementation` 1.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts` - `consentView` option, the view gate in `preflightInstallResolve`, the active-view summary projection
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts` - `buildInstallLedgerOptions` passes the run's implementation
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` - enable root and enable cascade member pass `"none"`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` - the re-enable member overrides the spread with `"none"`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts` - promotion passes `"none"`
- `features/mcp-server/verdict-install.feature` - six MREC-06 / MREC-03 scenarios
- Unit tests as listed in the frontmatter

## Decisions Made

See `key-decisions` above. Each is also logged under Dubious Choices.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in the plan's scenario] The enable scenario cannot use a restart without pi-mcp-adapter**
- **Found during:** Task 2 (scenario design)
- **Issue:** The plan's form installs and disables under a profile Pi with pi-mcp-adapter, then `When the user restarts pi without pi-mcp-adapter`. pi-mcp-adapter writes `-builtin:mcp` to the user's settings, so that restart lands on no MCP implementation (03-01 measured it). Under no implementation the neutral view runs an sse server, so the enable row reads `installed {requires pi-mcp-adapter}`, not the planned `partially-installed`, and a wrong implementation that gated enable on the run's view would still pass, because the `"none"` view and the neutral one agree.
- **Fix:** The scenario installs and disables through the run's adapter-profile Pi, then `Given pi runs with the scripted model` starts a profile Pi that runs Pi's built-in MCP, and the user enables from it with one `When`. Same form as 03-01's switch scenario. The title says "when pi runs its built-in MCP instead".
- **Files modified:** `features/mcp-server/verdict-install.feature`
- **Committed in:** `3404ca9`

**2. [Rule 3 - Blocking] Test fixtures that build InstallLedgerOptions by hand**
- **Found during:** Task 1 (typecheck)
- **Issue:** The required option broke 46 literals in `install-outcome.test.ts`, 7 in `install-flow-ledger.test.ts`, and 1 helper in `install-cascade.test.ts`. All three files are in `files_modified`. No file outside the list needed a change.
- **Fix:** Each passes `consentView: "none"`, which keeps the earlier neutral gate those cases were written against. `install-flow-dependency-ledger.test.ts` needed no change: it builds options through `buildInstallLedgerOptions`.
- **Committed in:** `c39c80b`

**3. [Environment] Scratch path and attribution**
- Temp files went to the scratch subfolder the prompt names (`.../scratchpad/p3/exec-05/`), not the plan's `.../scratchpad/03-05/`. `pre-commit run` ran with `SKIP=npm-check` and no `env -u` wrapper; zizmor had no files to check. Inside the worktree, the hook's `check:commit` and prettier reported "(no files to check)", so I ran `check:static`, the touched pairs' direct coverage, `test:modules`, and `test:integration` by hand first.

**Total deviations:** 3 (1 plan bug, 1 blocking, 1 environment). **Impact:** the planned behavior holds under both profiles. The enable scenario reaches Pi's built-in MCP through a fresh Pi, not a restart.

## Issues Encountered

None beyond the deviations.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The update path (03-06) still gates update consent on its own; `InstallLedgerOptions` gained a required member, so any 03-06 or 03-07 code that builds the options by hand must name its view. The re-enable and promotion paths are ready for D-P3-13.

## Parent line candidates

- CHANGELOG: "`/claude:plugin install` asks for `--partial` only for an MCP server the implementation Pi runs cannot run: an sse server under Pi's built-in MCP, or one that needs an elicitation handler under pi-mcp-adapter. With no MCP implementation, only servers neither can run need it. `enable` never asks again after a switch."
- `docs/output-catalog.md`: the install refusal and the install/enable rows of an MCP plugin now follow the active implementation (catalog counters unchanged; no catalog fixture changed here).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-03-11: `preflightInstallResolve` gates on `resolutionFor(resolved, consentView)` with `consentView` required; the built-in sse refusal scenario and the unit refusals fail without it. T-03-12: the four record-driven sites pass `"none"` and the stored neutral installable; the enable-after-switch scenario and four unit cases prove it, each checked by a mutation. T-03-SC: no package was added; I used `npm ci` from the committed lockfile.

## Dubious Choices

- **The summary projection edit in `install-outcome.ts`.** Severity: Medium. `toInstallLedgerSummary` is shared by function, and the plan named it. It now takes the run's implementation and returns `resolutionFor(context.resolved, active)`, so every summary consumer (Phase 4's agent rows, Phase 2's registration, if they read `summary.resolved`) sees the active view, not the neutral one, for `state`, `unsupported`, and `droppedMcpServers`. `pluginRoot`, `mcpServers`, and `declaredMcpServers` are unchanged. Alternatives: a second summary member for the active view, which leaves every row composer to choose. Why dubious: a sibling that reads `summary.resolved.droppedMcpServers` expecting the neutral list now gets the active one.
- **The enable scenario uses a fresh built-in Pi instead of the planned restart.** Severity: Medium. Alternatives: two restarts (without the adapter, then `with pi's built-in mcp turned on`), which needs three `When` steps; or keep the restart and expect the no-implementation row, which does not discriminate a wrong gate. Why dubious: the plan named the restart step, and a fresh Pi is a weaker image of a user's switch.
- **A second `requirePartialInstallable` on the neutral resolution after the view gate.** Severity: Low. It is a type narrowing that cannot throw once the view passed. Alternatives: return the view's narrowed type and cast the neutral one, or make `resolutionFor` return a narrowed pair. Why dubious: dead control flow kept for the type system; it relies on the invariant "a view is unavailable exactly when the neutral resolution is", which lives in `resolutionFor`.
- **Existing hand-built test options pass `consentView: "none"`.** Severity: Low. Alternative: pass the implementation each case's run names (all `runWithNothingLoaded`, so also `"none"`). Why dubious: the literal hides that the view and the run agree only by coincidence.
- **The enable cascade member row stays `installed {dependency enabled, requires pi-mcp-adapter}` under Pi's built-in MCP.** Severity: Low. That row has always read `installed`, whatever its resolution; it now carries the active marker but not `partially-installed`. Alternative: derive the member row's status from the summary as the root row does. Why dubious: out of this plan's file scope by function, and a user sees `installed` beside a server Pi's built-in MCP cannot run.
- **Commit trailer session id.** Severity: Low. The harness reminder named `session_01EDUMG5p4jHecGXqAFGi3Do`; the project brief, the plan, and every earlier commit use `session_01EDUMG7S9uXh4o5dikBwum8`. I used the project's line. Alternative: the harness line. Why dubious: the two instructions conflict.
- **No WINDOWS.md entry.** Severity: Low. The orchestrator owns the ledger in parallel waves.

## Self-Check: PASSED

- FOUND: features/mcp-server/verdict-install.feature
- FOUND: c39c80b, 3404ca9 (ancestors of HEAD)

---
*Phase: 03-read-time-verdicts*
*Completed: 2026-11-04*
