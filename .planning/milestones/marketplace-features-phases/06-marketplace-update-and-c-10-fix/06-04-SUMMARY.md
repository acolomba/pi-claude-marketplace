---
phase: 06-marketplace-update-and-c-10-fix
plan: "04"
subsystem: marketplace
tags: [marketplace-update, bare-update, mcp-notices, cucumber]

requires:
  - phase: 06-marketplace-update-and-c-10-fix
    plan: "03"
    provides: Autoupdate cascade coverage and the update step vertical
provides:
  - Real-Pi proof of bare-update scope order, insertion order, and adjacent MCP comment-loss notices
  - Repeat-run idempotency with no repeated notice
  - Continuation after an ordinary marketplace failure, single-scope and empty bare updates
  - Complete marketplace-not-added payloads for scoped, cross-scope, unscoped, and Unicode misses
  - Owner evidence for both concurrency backstops (removal and add after target selection)
affects: [marketplace-update, behavioral-tests]

actuals:
  tokens: 10500
  tasks: 2
  commits: 2
plan_head_before: 567e293069294324afb9b026393abbb4b9655a45
plan_head_after: fafe4feaa8486495ea62c21ef65dd6d7d3287c5e

tech-stack:
  added: []
  patterns:
    - The multi-result row step admits exactly one rowless kind, mcp-config-notices; its notices are compared as envelope fields
    - MCP fixtures write only files they create (`wx` flag) inside the publication root or the scope root

key-files:
  created:
    - features/lib/mcp-configuration.ts
    - features/step_definitions/mcp-configuration.steps.ts
  modified:
    - features/lib/published-marketplace.ts
    - features/marketplace/update.feature
    - features/step_definitions/command.steps.ts
    - features/step_definitions/marketplace/update.steps.ts
    - tests/orchestrators/marketplace/update.test.ts

key-decisions:
  - "Both tasks needed tests only; update.ts already met D-11, D-12, D-13, UPD-08, and UPD-09, so production is unchanged."
  - "The unscoped miss gets its own scenario because its payload has no scope field and one Outline table cannot state both shapes."
  - "The cross-scope miss is the qualified reason `marketplace not added to <requested> scope`, as docs/output-catalog.md defines (CMP-4 / SCOPE-01)."

patterns-established:
  - "A concurrent removal or add during a bare update is simulated from the autoupdate cascade seam, which runs between target selection and the next marketplace's lock."

requirements-completed: [UPD-07, UPD-08, UPD-09]

coverage:
  - id: D1
    description: "A bare update visits project marketplaces before user ones, in insertion order, with each MCP notice right after its producing cascade (D-11, D-13)."
    requirement: UPD-07
    verification:
      - kind: e2e
        ref: "features/marketplace/update.feature#A bare update preserves scope and insertion order with adjacent notices"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#a bare update emits each cascade's MCP notices before the next marketplace, project scope first"
        status: pass
    human_judgment: false
  - id: D2
    description: "Repeating a successful bare update reports every marketplace up to date, keeps every installed plugin, and emits no notice."
    requirement: UPD-07
    verification:
      - kind: e2e
        ref: "features/marketplace/update.feature#Repeating a bare update is up to date without repeated notices"
        status: pass
    human_judgment: false
  - id: D3
    description: "An ordinary marketplace failure keeps its registration and does not stop later project and user marketplaces (D-12)."
    requirement: UPD-07
    verification:
      - kind: e2e
        ref: "features/marketplace/update.feature#A bare update continues after a marketplace fails"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#a bare update keeps a failed marketplace registered and refreshes every later target"
        status: pass
    human_judgment: false
  - id: D4
    description: "A bare update with one populated scope refreshes only that scope's marketplace."
    requirement: UPD-07
    verification:
      - kind: e2e
        ref: "features/marketplace/update.feature#A bare update refreshes the only populated scope"
        status: pass
    human_judgment: false
  - id: D5
    description: "A bare update with no marketplaces reports an empty result, repeatably, and registers nothing."
    requirement: UPD-08
    verification:
      - kind: e2e
        ref: "features/marketplace/update.feature#A bare update with no marketplaces reports an empty result"
        status: pass
      - kind: e2e
        ref: "features/marketplace/update.feature#Repeating an empty bare update leaves it empty"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#repeated bare updates with no marketplaces emit the same empty result and record nothing"
        status: pass
    human_judgment: false
  - id: D6
    description: "A named miss fails as marketplace not added, with the requested scope and the cross-scope reason, without falling back to the other scope."
    requirement: UPD-09
    verification:
      - kind: e2e
        ref: "features/marketplace/update.feature#An update reports the marketplace missing from the requested scope"
        status: pass
      - kind: e2e
        ref: "features/marketplace/update.feature#An update without a scope reports a marketplace missing from both scopes"
        status: pass
    human_judgment: false
  - id: D7
    description: "A missing Unicode marketplace name comes back exactly in the validated payload."
    requirement: UPD-09
    verification:
      - kind: e2e
        ref: "features/marketplace/update.feature#A missing marketplace name preserves its Unicode spelling"
        status: pass
    human_judgment: false
  - id: D8
    description: "Concurrency backstops: a marketplace removed after target selection is skipped silently; one added after selection waits for the next run."
    requirement: UPD-07
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#a bare update skips a marketplace removed after target selection and refreshes the rest"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#a marketplace added after target selection waits for the next bare update"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-10-19
status: complete
---

# Phase 6 Plan 04: Bare Update Ordering and Misses Summary

**Bare `marketplace update` now has real-Pi proof of project-first, insertion-order results with each MCP comment-loss notice right after its cascade, plus continuation after failure, empty runs, and exact named misses.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-10-19T07:21:25Z
- **Completed:** 2026-10-19T07:36:30Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- The weak alphabetical bare-update scenario is replaced. Project holds zeta then alpha, user holds theta then beta, and the user sources are added first. zeta and theta each update a plugin that gains an MCP server over a commented `mcp-adapter.json`. The six payloads come in this order: zeta cascade, its project notice, alpha, theta cascade, its user notice, beta. Every envelope, the full notice array, and every row are compared.
- A repeat run reports all four marketplaces up to date with no notice, and `list` still shows both plugins at 1.10.0.
- The row step accepts the rowless `mcp-config-notices` payload and nothing else new. Any other non-cascade payload still fails.
- An early schema-invalid project marketplace fails with its cause row. alpha (project) and beta (user) still report, and zeta stays in `claude-plugins.json`.
- Single-scope, empty, and repeated empty bare updates are covered. The empty runs leave both `claude-plugins.json` files absent, and `marketplace list` stays empty.
- Named misses: four scoped rows (absent everywhere, and present only in the other scope), an unscoped miss, and the Unicode name `工具`.

## Task Commits

1. **Task 1: Prove scope order, insertion order, and adjacent MCP notices** - `87b69a22` (test)
2. **Task 2: Cover failure continuation, empty scopes, and named misses** - `fafe4fea` (test)

**Plan metadata:** this commit (docs).

## Files Created/Modified

- `features/lib/mcp-configuration.ts` - declares a never-started MCP server in a published plugin and writes the commented scope config
- `features/step_definitions/mcp-configuration.steps.ts` - the two MCP setup steps
- `features/lib/published-marketplace.ts` - `publishedPluginFile`, a contained path inside a published plugin
- `features/step_definitions/command.steps.ts` - rowless `mcp-config-notices` in the multi-result row step
- `features/step_definitions/marketplace/update.steps.ts` - `the user has updated every marketplace`, a verified multi-payload setup run
- `features/marketplace/update.feature` - nine new scenarios replacing one
- `tests/orchestrators/marketplace/update.test.ts` - five owner cases and shared bare-update helpers

## Deviations from Plan

### 1. Task 1 touched `published-marketplace.ts`

Task 1 lists five files. The MCP fixture needs a contained path inside a published plugin, and the containment check (`ownedTarget`) and the remote-kind error are private to `published-marketplace.ts`. So that file gained one exported function, `publishedPluginFile`, in the Task 1 commit. Task 2, which listed the file, needed no change to it.

### 2. Repeat setup step

`the user has run` accepts exactly one cascade, and the first bare update emits six payloads. The repeat scenario uses a new update-vertical step, `the user has updated every marketplace`. It runs the bare update and checks that every payload is a cascade with severity `info` or an MCP config notice.

### 3. The unscoped miss is its own scenario

The plan put the no-flag case in the `An update reports the marketplace missing from the requested scope` Outline. Its payload has no `scope` field. Both the field step and the record table fail on a stated column that no record has, so one Outline table cannot state both shapes. The Outline holds the four scoped rows. `An update without a scope reports a marketplace missing from both scopes` holds the unscoped case. The Unicode scenario is also unscoped.

### 4. Task 2 needed no production change

Task 2 is marked `tdd="true"`. Every new owner case and scenario passed on first run against the unchanged `update.ts`. The removal and late-add cases are backstop evidence for existing behavior, not RED tests for a defect. With no failing behavior there was no RED/GREEN pair, and `update.ts` is unchanged, as the plan allows. `workflow.tdd_mode` is off, so no gate commit is required.

---

**Total deviations:** 4 (2 fixture or step additions, 1 scenario split, 1 TDD no-op). **Impact:** test-only; no production, package, or contract change.

## Observations

- Measured wire values match 06-RESEARCH: a changed autoupdate cascade is `info` with `needs reload` true and tally success count 2; its notice is `warning` with `needs reload` false and no tally. The updated plugin row carries `requires pi-mcp-adapter`, because the headless Pi loads no adapter.
- A cross-scope miss uses the qualified token in place of `marketplace not added`, as docs/output-catalog.md defines it. The unscoped miss has no `scope` field.
- The owner case with a failed plugin carrying notices shows the cascade tally as one failure and success count 2. That count includes the updated marketplace header.

## Concurrency Evidence

- **UPD-07 backstop:** `a bare update skips a marketplace removed after target selection and refreshes the rest`. zeta's cascade, which runs after targets are selected and outside any lock, deletes alpha from project state. alpha's own locked transaction then finds no record and returns silently. No row, no `network unreachable`, and user beta still refreshes. Every refresh is a fresh per-marketplace locked read. No global snapshot is claimed.
- **UPD-08 backstop:** `a marketplace added after target selection waits for the next bare update`. zeta's cascade adds `late` to project state. The first run reports only zeta and alpha and leaves `late` untouched. The second run reports zeta, alpha, then `late`. Target selection is a snapshot of each scope's state read. Writes stay under the existing per-scope locks, and `node --test tests/transaction/with-state-guard.test.ts` passes alongside. No serializability across the command is claimed.

## Flagged assumptions from the spec-less probe

This plan owns none. The seven flagged items (UPD-01, UPD-02, UPD-10, and UPD-14 in 06-02; UPD-05, UPD-06, and UPD-13 in 06-03) stay flagged as their summaries record. This plan does not resolve them.

## Checks run

- Task 1 focused Cucumber (2 scenarios, 54 steps) passed.
- Task 2 focused Cucumber, the plan's exact name filter (10 scenarios, 75 steps), passed. The added unscoped-miss scenario passed in the whole-feature run.
- Whole `features/marketplace/update.feature`: 50 scenarios, 607 steps passed.
- `node --test tests/orchestrators/marketplace/update.test.ts tests/transaction/with-state-guard.test.ts`: 110 passed.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` passed. No production pair changed.
- `npm run check:features` passed after each task.
- Both commit hooks passed (`check:commit` included).
- Full `npm run check` passed at `fafe4fea` on Node v26.11.1 (exit 0): static checks, unpaired and integration tests, 199 scenarios and 2,172 steps, and 280 direct-coverage records. Remote rows stay excluded by `cucumber.json` and bound by `check:features`.
- `~/.pi/agent/pi-claude-marketplace/state.json` is still absent.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- `87b69a22` and `fafe4fea` descend from the plan head `567e2930`.
- `features/lib/mcp-configuration.ts` and `features/step_definitions/mcp-configuration.steps.ts` exist.
- No production source, package, or network behavior changed.

---

*Phase: 06-marketplace-update-and-c-10-fix*
*Completed: 2026-10-19*
