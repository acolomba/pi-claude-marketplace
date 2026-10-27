---
phase: 01-staging-warning-channels
plan: 01
subsystem: staging-warnings
status: complete
tags: [warnings, bridges, install, update, reinstall, diagnostics, cucumber]
requires: []
provides:
  - "shared/staging-warnings.ts: DiscoveryWarning, HygieneWarning, StagingWarning, discoveryWarning(), hygieneWarning(), partitionStagingWarnings() (D-PL1-01)"
  - "Tagged `warnings` on the skills, commands, agents, mcp and workflows prepare results (D-PL1-02)"
  - "InstallLedgerContext / InstallLedgerSummary typed as DiscoveryWarning[] / HygieneWarning[] (D-PL1-03, D-PL1-04 discovery half)"
  - "surfaceDiscoveryWarnings(ctx, run, { plugin, scope, verb, warnings }) with the seven-verb union and the scope-naming header (D-PL1-05, D-PL1-06)"
  - "features/plugin/staging-warnings.feature with three scenarios (D-PL1-19)"
affects:
  - extensions/pi-claude-marketplace/bridges/{skills,commands,agents,mcp,workflows}
  - extensions/pi-claude-marketplace/orchestrators/plugin/{install-outcome,install-flow,update-swap,update-flow,reinstall-flow,shared}.ts
tech-stack:
  added: []
  patterns:
    - "Producer-side warning tags partitioned by one classifier"
key-files:
  created:
    - extensions/pi-claude-marketplace/shared/staging-warnings.ts
    - test/shared/staging-warnings.test.ts
    - features/plugin/staging-warnings.feature
  modified:
    - extensions/pi-claude-marketplace/bridges/skills/types.ts
    - extensions/pi-claude-marketplace/bridges/skills/stage.ts
    - extensions/pi-claude-marketplace/bridges/commands/types.ts
    - extensions/pi-claude-marketplace/bridges/commands/stage.ts
    - extensions/pi-claude-marketplace/bridges/agents/types.ts
    - extensions/pi-claude-marketplace/bridges/agents/stage.ts
    - extensions/pi-claude-marketplace/bridges/mcp/types.ts
    - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
    - extensions/pi-claude-marketplace/bridges/workflows/types.ts
    - extensions/pi-claude-marketplace/bridges/workflows/stage.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - features/step_definitions/plugin/publishing.steps.ts
    - test/bridges/{skills,commands,agents,mcp,workflows}/{types,stage}.test.ts
    - test/orchestrators/plugin/{install-outcome,install-flow,update-swap,update-flow,reinstall-flow,shared}.test.ts
decisions:
  - "The skills, commands and workflows producers pass `discoveryWarning` to `map` by reference: an inline arrow at the noop site was a second function the direct-coverage gate counted as uncovered."
  - "The install-outcome partition case pairs the agents D-07 duplicate with an agents conversion note as its hygiene warning: the resolver refuses every plugin whose mcp entries would make the mcp bridge warn, so no install can carry an mcp warning."
metrics:
  duration: "51m"
  completed: "2026-10-27"
estimate:
  tokens: 155000
  tasks: 2
actuals:
  tokens: 23600
  tasks: 2
  commits: 2
plan_head_before: b3d0a5f098d7b37910e1489a9ad136e34f6e7b6a
plan_head_after: 58a2111a3a2439d496073dff5cce56610ca9f964
commits: 2
---

# Phase 1 Plan 01: Tagged staging warnings and scope-naming headers Summary

Every bridge now tags its staging warnings at the producer. One classifier,
`partitionStagingWarnings`, splits them for install and the update swap. A
standalone install now reports an agent skipped for a duplicate name, and every
staging diagnostic header names the plugin's scope:
`Plugin "<name>" [<scope>] <verb>; ...`.

## Tasks

| Task | Name | Commit | Hook |
| ---- | ---- | ------ | ---- |
| 1 (tracer) | Tag staging warnings at the bridges and show a duplicate agent on install | d13f32e9 | `npm run check:commit` Passed, gitlint Passed |
| 2 | Name the plugin scope in every staging diagnostic header | 58a2111a | `npm run check:commit` Passed, gitlint Passed |

### Task 1

- New leaf module `shared/staging-warnings.ts` with no imports, and its paired
  test. The test includes the D-PL1-04 `@ts-expect-error` negative: a
  `HygieneWarning` does not satisfy `DiscoveryWarning[]`.
- The five bridge `Stage*CommitResult.warnings` members are
  `readonly StagingWarning[]`. Skills, commands and workflows tag `discovery`.
  Mcp tags `hygiene`. Agents tags index corruptions and conversion notes
  `hygiene` and the D-07 duplicates `discovery`, in the old order. Hooks,
  discover modules, `Unstage*Result` and `ConvertedAgent` keep strings.
- `install-outcome.ts`: the context and summary members are typed. One
  module-private `collectStagingWarnings` replaces the five direct pushes.
  Each commit leak is pushed as `hygieneWarning(leak)`.
- `update-swap.ts::collectUpdateWarnings` partitions the five handles in bridge
  order. It returns the discovery messages, plus the hygiene messages in
  cascade mode only.
- `splitStagingWarnings` and its tests are deleted. No reference remains in
  `extensions/` or `test/`.
- `install-flow.ts::collectPostCommitWarnings` maps both arrays to `.message`.
- New scenario: "Installing a plugin whose agents share a name reports the
  skipped agent".

### Task 2

- `surfaceDiscoveryWarnings` takes `scope: Scope`. Its verb is the
  seven-member union of D-PL1-06, written inline. The header subject is
  `Plugin "<name>" [<scope>] <verb>`.
- Install passes `scope`, update passes `target.scope` (the helper now takes
  `UpdateCascadeOutcome[]`), and reinstall passes `outcome.scope`.
- 19 header pins now carry `[project]`, which is every fixture's scope.
  `shared.test.ts` has a singular `[project]` case, a plural `[user]` case, and
  one data-row test per verb.
- Two new scenarios: "Updating a plugin whose new version has colliding skills
  reports the skip under a header that names the scope" and "Reinstalling a
  plugin whose skills collide reports the skip under a header that names the
  scope". A new `Given` gives the published plugin a second skill whose
  generated name collides with its first.

## Scenario failures before each production change

- Task 1, before any bridge change: the tracer scenario failed at
  `the command reports these results:`. The command emitted only the
  `cascade` payload, and no `diagnostic` payload followed the install row.
- Task 2, on the code Task 1 left: all three scenarios failed on the header
  bytes. Actual: `Plugin "demo" installed; ...`, `Plugin "demo" updated; ...`,
  `Plugin "demo" reinstalled; ...`. Expected: the same with ` [project]`
  after the plugin name.
- All three scenarios pass after the changes. Before the Task 1 commit, the
  full cucumber suite ran green: 902 scenarios, 8993 steps.

## Verification

- `npm run typecheck`: exit 0 after each task.
- Task 1 owner tests (15 modules): 1040 pass, 0 fail. Direct coverage of the
  ten Task 1 sources: 100%.
- Task 2 owner tests: install-flow, update-flow and reinstall-flow have 718
  pass, and the `surfaceDiscoveryWarnings` group has 12 pass. Direct coverage
  of the four Task 2 sources: 100%.
- `npm test` (whole unit suite, before the Task 2 commit): exit 0.
- `npm run check:features`: exit 0 after each task. `npm run fallow`: exit 0
  after each task.
- Commit hooks: both commits passed `npm run check:commit`, TruffleHog,
  prettier and gitlint.
- Tracer feedback gate (auto mode off, `end-of-phase`, automated `<verify>`):
  the verify chain was re-run end to end and passed before Task 2 started.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reinstall PDEF-01 case pinned the old hygiene routing of agents duplicates**

- **Found during:** Task 2 (running `reinstall-flow.test.ts`)
- **Issue:** `PDEF-01: reinstall stages every agent directory` asserted that a
  direct reinstall carries no `notes`. Under D-PL1-02 the agents duplicate is
  a discovery warning, so it now rides `notes` and `discoveryWarnings`. The
  Task 1 commit hook did not catch this because the hook covers only staged
  source-test pairs, and this pair was not staged.
- **Fix:** The case now asserts the exact duplicate message on both members.
- **Files modified:** `test/orchestrators/plugin/reinstall-flow.test.ts`
- **Commit:** 58a2111a

**2. [Rule 3 - Blocking] The update-flow header comment named the deleted splitter**

- **Found during:** Task 1
- **Issue:** Task 1's acceptance requires zero `splitStagingWarnings`
  references, and the `update-flow.ts` module header still named the
  splitter. The plan put this comment rewrite in Task 2.
- **Fix:** The module header paragraph was rewritten in Task 1. The helper doc
  was rewritten in Task 2, as planned.
- **Commit:** d13f32e9

**3. Producer form differs from the acceptance grep**

- The plan's grep `(discoveryWarning|hygieneWarning)\(` over
  `bridges/*/stage.ts` expects 5 files. It finds 2 (agents, mcp). Skills,
  commands and workflows tag with `.map(discoveryWarning)`, because an inline
  arrow at the noop site was an extra function that direct coverage reported
  uncovered (skills 10/11, commands 8/9). All five producers still tag
  through the constructors (`grep -lE '(discoveryWarning|hygieneWarning)\(|map\(discoveryWarning\)'`
  finds 5).

**4. Verb union formatting differs from the acceptance grep**

- The grep `"install failed" | "update failed" | "reinstall failed"` finds 0
  matches. Prettier writes the union one member per line, because the whole
  union does not fit in 100 columns. All seven members are present, and the
  seven data-row tests pin them.

**5. Install-outcome partition case uses an agents conversion note as its hygiene warning**

- The plan asked for "one agents D-07 duplicate and one mcp hygiene warning".
  The resolver refuses every plugin whose mcp entries would make the mcp
  bridge warn (`malformed mcp server ... must be object`), so no install
  ledger run can carry an mcp warning. The case pairs the D-07 duplicate with
  an agents conversion note (`[helper] dropped tools: WebFetch`). This also
  proves the split inside the agents bridge. Mcp's hygiene tag is pinned in
  `test/bridges/mcp/stage.test.ts`.

**6. The tracer scenario's install row shows `requires pi-subagents`**

- The cucumber harness does not load pi-subagents. An install with agents
  therefore reports the soft-dependency reason and a `warning` cascade with
  the summary `A plugin operation needs attention.` The scenario states both.

## Backlog dispositions

- **WCHAN-01:** producer half done. The agents D-07 skips are tagged
  discovery, the other agents warnings hygiene, and one classifier serves
  install and the update swap. The renderer half (`surfaceDiscoveryWarnings`
  takes `readonly DiscoveryWarning[]`, plus the renderer `@ts-expect-error`)
  lands in plan 01-02.

## Requirement status

`WRN-02` and `WRN-03` stay unchecked in `.planning/REQUIREMENTS.md`. This plan
delivers the WRN-03 producer half and the WRN-02 header half. The cascade
rendering of WRN-02 and the renderer's `DiscoveryWarning[]` type of WRN-03
land in later plans of this phase. `requirements.mark-complete` was run and
then reverted, because it marked both requirements complete.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-01-01 holds: every diagnostic line still goes through `redactAbsolutePaths`.
The agents-skip scenario and the standalone PDEF-01 install-flow case pin the
redacted basenames (`second.md`, `shared-later.md`). T-01-02 holds: index
corruptions, conversion notes and cleanup leaks are tagged hygiene and stay in
`bridgeWarnings`. The new install-outcome case pins which half each warning
lands in.

## Self-Check: PASSED
