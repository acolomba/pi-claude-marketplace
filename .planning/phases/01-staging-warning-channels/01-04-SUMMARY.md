---
phase: 01-staging-warning-channels
plan: 04
subsystem: update-reinstall
status: complete
tags: [update, reinstall, completion-cache, outcomes, types]
requires:
  - phase: "01-02"
    provides: "the typed `stagingWarnings` / `discoveryWarnings` carriers on the update and reinstall outcomes"
provides:
  - "PluginUpdateUpdatedOutcome.resourcesChanged: boolean (required), derived in update-swap.ts::stagedResourcesChanged from the five inventories, hooks excluded (D-PL1-18)"
  - "ReinstallReinstalledOutcome.resourcesChanged: boolean (required), copied by reinstallOutcomeFromRun (D-PL1-18)"
  - "A reinstall drops the completion cache once, in the shared swap; runPostSuccessMaintenance only removes the plugin-data directory (D-PL1-17)"
affects:
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/{update-swap,reinstall-record,reinstall-flow}.ts
tech-stack:
  added: []
  patterns:
    - "Derive a boolean from several name lists with `some` over one array, so the helper has no hand-written branch"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
    - test/orchestrators/plugin/update-swap.test.ts
    - test/orchestrators/plugin/update-row.test.ts
    - test/orchestrators/marketplace/update.messaging.test.ts
    - test/orchestrators/marketplace/update.test.ts
    - test/orchestrators/plugin/update-cascade.test.ts
    - test/orchestrators/types.test.ts
    - test/orchestrators/reconcile/notify.test.ts
    - test/orchestrators/plugin/reinstall-record.test.ts
    - test/orchestrators/plugin/reinstall.messaging.test.ts
    - test/orchestrators/plugin/reinstall-flow.test.ts
    - test/orchestrators/plugin/materialize-latest.test.ts
    - test/orchestrators/plugin/update-flow.test.ts
    - test/orchestrators/plugin/operations.test.ts
    - test/architecture/workflows-marker-coverage.test.ts
    - test/integration/plugin-layer-verbs.test.ts
key-decisions:
  - "Synthetic outcome literals (row, messaging, cascade and type tests) carry `resourcesChanged: true`; whole-outcome expectations from real fixtures carry the value the fixture implies: `false` only for the hooks-only `p1` fixture in operations.test.ts, `true` everywhere else. types.test.ts uses `false` on the CLEAN fixtures and `true` on the FULL ones, so both values compile."
  - "types.test.ts gains two `@ts-expect-error` proofs that omitting `resourcesChanged` does not compile, one per outcome type."
  - "The D-PL1-17 cache-failure case in reinstall-flow.test.ts now renders `none`, because only that arm folds maintenance warnings onto `notes`; under `default` its `notes === undefined` assertion would pass against the old code."
requirements-completed: [WRN-07]
coverage:
  - id: D1
    description: "The update runner's updated outcome reports whether the update touched a skill, prompt, agent, MCP server or workflow; hooks never count"
    requirement: WRN-07
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/update-swap.test.ts#D-PL1-18: resourcesChanged is ... (4 rows)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Reinstall outcomes carry the runner's resourcesChanged again; reinstall row bytes unchanged"
    requirement: WRN-07
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/reinstall-record.test.ts#D-PL1-18: a swapped candidate reporting resourcesChanged ... (2 rows)"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/reinstall.messaging.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "A reinstall drops the completion cache once; no cache deferral note exists"
    requirement: WRN-07
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/reinstall-flow.test.ts#PRL-13 / D-PL1-17, D-PL1-17 cache-drop failure, retry proof cache case, CONVERGED_SCHEDULE users"
        status: pass
    human_judgment: false
duration: ~45min
completed: 2026-10-27
estimate:
  tokens: 110000
  tasks: 3
actuals:
  tokens: 15600
  tasks: 3
  commits: 4
commits: 4
plan_head_before: 97fde69d8983f732c8c6eb33aae021d5395fd1a0
plan_head_after: 0c2307178bf863bf72c3ae45787fdc77a5283a22
---

# Phase 1 Plan 04: resourcesChanged and the single reinstall cache drop Summary

The update runner's `updated` outcome now states, in a required
`resourcesChanged`, whether the record before the swap or the names it staged
hold a skill, prompt, agent, MCP server or workflow. Reinstall copies that
value onto its outcome again. A reinstall also drops the completion cache only
once, in the shared swap, instead of a second time in its own maintenance.

## Performance

- **Duration:** about 45 minutes, including about 4 minutes spent waiting
  while the sibling executor's commit hook held my unstaged edits
- **Tasks:** 3 of 3
- **Files modified:** 19 (4 source, 15 test)

## Accomplishments

- `update-swap.ts::stagedResourcesChanged` (module-private) reads
  `record.resources.{skills, prompts, agents, mcpServers, workflows}` plus
  the five staged name lists and returns `some(names => names.length > 0)`.
  It does not read `record.resources.hooks`. `swapPluginUpdate`'s success
  literal sets `resourcesChanged` from it. That adds a plain property and no
  branch, so the function's complexity score does not change.
- `reinstallOutcomeFromRun` maps `resourcesChanged: run.resourcesChanged`.
  The reinstall row still says `needsReload: true`, and no renderer reads
  the field.
- `runPostSuccessMaintenance(opts, locations)` now only removes the
  plugin-data directory. It lost its `completionCache` parameter and its
  cache deferral note. Its doc comment and the module header sentence now
  name only the one side effect.

## Task Commits

1. **Task 1: Report whether an update changed loadable resources**:
   `ba532015` (feat). The commit hook passed: pre-commit fixers, TruffleHog,
   prettier, `npm run check:commit`, gitlint.
2. **Task 2: Restore resourcesChanged on the reinstall outcome**: `2236b1c0`
   (fix). The commit hook passed, with the same hooks.
3. **Task 3: Drop the completion cache once per reinstall**: `0c230717`
   (fix). The commit hook passed, with the same hooks. The first try failed
   before the hook ran: `index.lock` existed because the sibling executor was
   committing at that moment. I retried after its commit `41f39739` landed
   and checked byte for byte that my source diff had not changed.

The measured count `git rev-list --count 97fde69d..HEAD` is 4. One of the
four is the sibling plan 01-05's `41f39739`
(`feat(enable): carry staging warnings on the orchestrated outcome`). It
landed between my Task 2 and Task 3 commits on the same branch.

## Acceptance checks

- `awk '/export interface PluginUpdateUpdatedOutcome/,/^}/' ... | grep -c 'readonly resourcesChanged: boolean;'`: `1` (baseline 0).
- `grep -c 'resources.hooks' update-swap.ts`: `4` before, `4` after. The
  helper does not read hooks.
- `awk '/export interface ReinstallReinstalledOutcome/,/^}/' ... | grep -c 'readonly resourcesChanged: boolean;'`: `1` (baseline 0).
- `grep -c 'resourcesChanged: run.resourcesChanged' reinstall-record.ts`: `1` (baseline 0).
- `grep -c 'completion cache refresh deferred' reinstall-flow.ts`: `0` (baseline 1).
- `grep -c 'completionCache.dropMarketplaceCache(' reinstall-flow.ts`: `0` (baseline 1).
- `grep -c '"drop:cache", "drop:cache"' reinstall-flow.test.ts`: `0` (baseline 1).
- The reinstall messaging tests pass. The only change in that file is the 20
  added `resourcesChanged: true,` input lines. No expected row changed.

## Verification

- `npm run typecheck`: exit 0 after each task.
- Task 1 suites (12 unit files): 934 pass, 0 fail.
  `test/integration/plugin-layer-verbs.test.ts`: 16 pass.
  `npm run test:coverage:direct -- .../update-swap.ts`: exit 0 (100%).
- Task 2 suites (5 unit files): 250 pass, 0 fail. The integration test:
  16 pass. Direct coverage of `reinstall-record.ts`: exit 0.
- Task 3: `reinstall-flow.test.ts` 161 pass. Direct coverage of
  `reinstall-flow.ts`: exit 0. ESLint `--max-warnings 0` is clean on both
  files.
- Negative control (run once, not committed): I swapped `reinstall-flow.ts`
  back to its HEAD content and ran the cache and retry cases. Eleven failed,
  including all three changed cache cases. Then I restored the new file.
- The full `npm run check` was not run. It belongs to the wave gate after
  plans 01-04 and 01-05.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The cache-drop failure case did not test what its title claims**
- **Found during:** Task 3
- **Issue:** The old GAP-15 case at ~2917 ran in `default` render. That arm
  never puts maintenance warnings on `notes`, so asserting
  `notes === undefined` there would pass against the old code too. Its
  comment also described a `bridgeWarnings` loop that no longer exists.
- **Fix:** I renamed the case to D-PL1-17. It now runs with
  `render: "none"` and asserts `notes === undefined` and `notifications`
  `[]`, and I removed the stale comment. The negative control showed that it
  now fails against the old source.
- **Files modified:** test/orchestrators/plugin/reinstall-flow.test.ts
- **Commit:** 0c230717

**2. [Rule 2 - Missing proof] Compile-time proofs for the required members**
- **Found during:** Tasks 1 and 2
- **Issue:** Nothing showed that `resourcesChanged` cannot be left out. Some
  `@ts-expect-error` literals in types.test.ts would also have started
  failing for two reasons at once.
- **Fix:** Every `updated` and `reinstalled` literal in types.test.ts now
  carries the member, so each `@ts-expect-error` still tests only its own
  reason. I added one new `@ts-expect-error` case per outcome type for the
  missing member.
- **Files modified:** test/orchestrators/types.test.ts
- **Commits:** ba532015, 2236b1c0

### Notes

- `reinstallPluginWith` still has its IN-01 comment ("The underlying side
  effects (cache drop + data-dir rm) still fire above"). The shared-file rule
  limits this plan to `runPostSuccessMaintenance`, its one call, and the
  module header, so I left the comment alone. It is still loosely true,
  because the swap's drop runs earlier in the same function. Phase 7
  cleanup could reword it.
- The measured ripple matched the plan: 75 type errors in the 8 files the
  plan named for Task 1 and 23 in the 2 files for Task 2. At runtime,
  update-swap had 8 literals, materialize-latest 3, update-flow 3,
  operations 1 + 1, reinstall-flow 11 multi-line literals (the plan counts
  23 because it includes one-line projections), and the integration test 1.

## Backlog dispositions

- **LCORCH-01 b4: closed.** `resourcesChanged` is back on reinstall outcomes
  and comes from the update runner (D-PL1-18). A reinstall now drops the
  completion cache once, in the shared swap (D-PL1-17). Unit tests prove
  both, as D-PL1-19 records.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts (stagedResourcesChanged)
- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts (resourcesChanged: run.resourcesChanged)
- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts (two-parameter runPostSuccessMaintenance)
- FOUND commits: ba532015, 2236b1c0, 0c230717 (ancestors of HEAD)
