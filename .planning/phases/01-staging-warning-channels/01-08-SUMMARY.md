---
phase: 01-staging-warning-channels
plan: 08
subsystem: staging-warnings
status: complete
tags: [warnings, update, dependencies, mcp, notices, phase-gate]
requires:
  - "01-03: AGIDX-01 forced agents commit (phase gate scope)"
  - "01-06: CandidateReport / swapAfterSettle failed outcome with reported warnings"
  - "01-07: cascade staging diagnostics (phase gate scope)"
provides:
  - "SettleCascadeRun installed arm, DependencyStepsResult and both UpdateDependencySettlement arms carry optional mcpConfigNotices (D-PL1-16)"
  - "materialize-latest.ts puts the settle's notices ahead of the update's own on the updated, refused and swap-failed outcomes (D-PL1-16)"
  - "update-flow.ts::surfaceUpdateMcpConfigNotices reads the failed arm (D-PL1-23)"
  - "The phase merge payload: CHANGELOG line, Decision rows, Backlog dispositions, Uncertain choices"
affects:
  - extensions/pi-claude-marketplace/orchestrators/plugin/{dependency-settle,update-swap,install-flow,materialize-latest,update-flow}.ts
tech-stack:
  added: []
  patterns:
    - "Optional notice members spread through mcpConfigNoticesMember, so a settle with no notices keeps its shape (NREG-01)"
key-files:
  created:
    - .planning/phases/01-staging-warning-channels/01-08-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - features/plugin/staging-warnings.feature
    - test/orchestrators/plugin/dependency-settle.test.ts
    - test/orchestrators/plugin/install-flow.test.ts
    - test/orchestrators/plugin/materialize-latest.test.ts
    - test/orchestrators/plugin/update-flow.test.ts
decisions:
  - "dependency-settle.ts and materialize-latest.ts reuse `orchestrators/marketplace/shared.ts::mcpConfigNoticesMember` (as uninstall.ts and enable-disable.ts do) instead of a new local copy."
  - "`StepRun.notices` is a required internal member (empty for a move and a refusal), so `runDependencySteps` accumulates with one spread and stays inside the complexity ceilings."
  - "`materializeLatestVersion` still routes to `swapAfterSettle` only when the settle carried rows: notices come only from members that each report a row."
requirements: [WRN-06, WRN-01, WRN-02, WRN-03, WRN-04, WRN-05, WRN-07]
metrics:
  duration: "~45m"
  completed: "2026-10-27"
estimate:
  tokens: 105000
  tasks: 2
actuals:
  tokens: 8659
  tasks: 2
  commits: 1
plan_head_before: c0e1d241512891c8e01ef9e831a9b6b389b2aa80
plan_head_after: 7adfd8c7926aa3400bd3b02b07fffcb1a5601021
commits: 1
---

# Phase 1 Plan 08: Dependency MCP notices on update, and the phase gate Summary

`/claude:plugin update` now shows the MCP config notices of the dependencies
its settle installs. They come before the update's own notices, on success,
after a settle step refuses, and after the swap fails (WRN-06, D-PL1-16,
D-PL1-23). The full `npm run check` gate is green on the phase's last code
commit.

## Tasks

| Task | Name | Commit | Hook |
| ---- | ---- | ------ | ---- |
| 1 | Show the MCP config notices of the dependencies an update installs | 7adfd8c7 | TruffleHog, prettier, `npm run check:commit`, gitlint: all Passed (first attempt) |
| 2 | Run the phase gate and write the phase's merge payload | (this SUMMARY's docs commit) | `npm run check` exit 0, `SKIP=npm-check pre-commit run --all-files` exit 0, no fix commits needed |

### Task 1 (D-PL1-16, D-PL1-23)

- `dependency-settle.ts`: the `installed` arm of `SettleCascadeRun` and both
  arms of `DependencyStepsResult` gain `mcpConfigNotices?`. `StepRun` gains
  `notices`. `runStep` forwards a materialize step's notices, and a move or a
  refusal reports none. `runDependencySteps` accumulates them in step order
  and spreads them on every return arm, the two catch arms included.
  `settlePlanned` and `settleDependencies` put them on both settlement arms,
  the first run's `installed` result included.
- `update-swap.ts`: only the `UpdateDependencySettlement` type changed. Both
  arms gain `mcpConfigNotices?`.
- `install-flow.ts::saveRootClosure`: the `installed` arm now spreads
  `settled.mcpConfigNotices` through the file's own `mcpConfigNoticesMember`.
  No other function in the file changed. `installAfterMoves` ignores the new
  member.
- `materialize-latest.ts`: the refused arm's failed outcome carries the
  settle's notices. `swapAfterSettle` takes the whole settlement and puts the
  settle's notices ahead of the swap outcome's own on its success return, and
  carries them on its catch's failed outcome. Two small helpers keep both
  functions inside the ceilings: `settleNoticesFirst` merges the two lists,
  and `ownNotices` reads the swap outcome's own notices.
- `update-flow.ts::surfaceUpdateMcpConfigNotices` reads `failed` outcomes too.
  A phase-3a failure never joins `outcomes`, so its notices still render
  once, from the separate `failed` parameter.
- `dependency-move.ts` is untouched (Deferred). This plan's acceptance
  command `git log --format=%h d13f32e9^..HEAD -- .../dependency-move.ts`
  prints nothing.

## Scenario failure before the change

New scenario in `features/plugin/staging-warnings.feature`: "Updating a plugin
whose new version needs a dependency with an MCP server reports that
dependency's MCP config notice".

- On the unchanged code it failed at `the command reports these results:`.
  The command emitted only the `cascade` payload, and no
  `mcp-config-notices` payload followed it.
- My first expected table also had the wrong cascade severity. `lib`'s MCP
  server needs pi-mcp-adapter, which the harness does not load, so the
  cascade is `warning` with `A plugin operation needs attention.`, and the
  `lib@fixtures` row has `requires pi-mcp-adapter`. I corrected the tables to
  the rendered bytes.
- Red check on the final scenario: with only the new `saveRootClosure` spread
  line disabled, the scenario failed again on the missing
  `mcp-config-notices` row. With the line restored, it passes. The whole
  feature file passes: 11 scenarios, 121 steps.

## Verification

- `npm run typecheck`: exit 0.
- Owner tests (`dependency-settle`, `install-flow`, `materialize-latest`,
  `update-flow`, `update-swap`): 895 pass, 0 fail.
- `npm run test:coverage:direct --` for the five touched sources: exit 0
  (100%).
- ESLint `--max-warnings 0` on the ten touched TypeScript files: exit 0.
  Prettier: clean after one `--write` on `dependency-settle.test.ts`.
- `npm run fallow`: exit 0. No new clone group, cycle or complexity finding.
- `npm run check:features`: exit 0.
- `npx cucumber-js features/plugin/staging-warnings.feature`: exit 0.

New unit cases:

- `dependency-settle.test.ts`: notices of every slice that landed in step
  order, where a move and a slice with none add none; a move that throws after
  a slice landed keeps that slice's notices; a slice that throws after an
  earlier slice landed keeps the earlier notices; a first run with notices
  settles with them; a planned settle carries its final closure's notices; a
  settle that refuses after a slice landed carries that slice's notices.
- `materialize-latest.test.ts`: an updated outcome lists the settle's notices
  ahead of the swap's own; a refused settle's failed outcome carries them; a
  swap that fails after the settle carries them.
- `update-flow.test.ts`: "D-PL1-23 / WRN-06: a direct update whose settle
  refused shows the notices of the dependencies it installed after the
  cascade".
- `install-flow.test.ts` (`createUpdateDependencyResolver`): "D-PL1-16:
  reports the MCP config notices of the dependency it installs". It drives
  the real settle port over a commented `mcp-adapter.json`.

## Phase gate

- Command: `npm run check > <scratchpad>/check.txt 2>&1; echo "check exit: $?"`.
  It ran in the foreground, unpiped, and its exit status was read on its own.
- Exit status: **0**.
- Commit: `7adfd8c7926aa3400bd3b02b07fffcb1a5601021`, clean tree
  (`git status --short` printed nothing).
- Node: `v26.12.1`.
- Scope: the full tree, so every commit of this phase (`d13f32e9` to
  `7adfd8c7`). It ran `check:static` (typecheck, lint, lint:workflows, fallow,
  format:check, test:corresponding, check:features: all passed),
  `test:unpaired`, `test:integration`, `test:cucumber` (912 scenarios, 9105
  steps passed), and `test:coverage:direct:all` (292 records merged into
  `coverage/direct.lcov`). Wall time 3m16s (07:44:10Z to 07:47:26Z).
- `SKIP=npm-check pre-commit run --all-files`: exit 0. It found nothing, in
  this phase's files or elsewhere.

## Deviations from Plan

### Auto-fixed Issues

None.

### Plan notes

**1. The swap route keeps its rows-only condition.** The plan asked to route
`materializeLatestVersion` into `swapAfterSettle` "whenever the settle carried
rows or notices". It still routes on rows only. A notice comes only from a
cascade member, and every member that lands reports a row, so a settlement
with notices always has rows. A notices-only branch could not be reached in
production, and it would add `dependencyRows: []` to the outcome (NREG-01).
Simplicity rule (AGENTS.md).

**2. One unit case compares a projection.** The case "a move that throws
after a slice landed keeps that slice's notices" compares
`[ok, row statuses, notices]`. The failed move row carries a redacted copy of
the thrown error, and the existing GHB-03 cases compare the same projection.
Every other new case compares whole values.

**3. Scenario tables.** The cascade severity and the dependency row's
`requires pi-mcp-adapter` reason come from the harness, which does not load
pi-mcp-adapter. The `mcp-config-notices` payload is exactly the one the plan
names.

## CHANGELOG line

The parent session adds this bullet under `## [Unreleased]` and replaces
`#NNN` with the PR number:

```markdown
- Staging warnings show for `enable`, failed installs, updates and reinstalls, `marketplace update`, autoupdate and `apply`, name the plugin's scope, and report duplicate agent names. `update` shows its dependencies' MCP config notices, and a forced reinstall keeps hand-named agents index rows. (#NNN)
```

It has 40 words. The changelog skill prefers one sentence of 25 words or
fewer. If the parent session wants that, the same content splits into a top
line ("Staging warnings show for every staging verb and cascade, under a
header that names the plugin's scope.") plus one sub-bullet per change.

## Decision rows

Rows for the Key Decisions table of `.planning/PROJECT.md`, in the D-141-03
format. Replace `#NNN` with the PR number.

| Decision | Rationale | Outcome |
| -------- | --------- | ------- |
| **D-PL1-01: one tagged staging warning type** (PR #NNN, 2026-10-27): `shared/staging-warnings.ts` defines `DiscoveryWarning`, `HygieneWarning`, `StagingWarning`, the two constructors and `partitionStagingWarnings` | Every bridge zone and the orchestrators import it, and no bridge may import a sibling bridge or an orchestrator, so the type lives in the leaf `shared/` layer | -- Locked |
| **D-PL1-02: each bridge tags its warnings at the producer** (PR #NNN, 2026-10-27): skills, commands and workflows warnings are discovery; mcp warnings are hygiene; the agents D-07 duplicate-name skips are discovery and index corruptions and conversion notes are hygiene; `discover.ts` modules keep strings; a commit cleanup leak is wrapped `hygieneWarning(leak)` at the orchestrator | The producer knows what a warning means, and the orchestrator does not. The agents split is what WCHAN-01 asked for. Keeping the commit functions' string leak return leaves the contract that uninstall and the rollback paths share | -- Locked |
| **D-PL1-03: one classifier** (PR #NNN, 2026-10-27): `splitStagingWarnings` is deleted, and install, the update swap and reinstall partition with `partitionStagingWarnings`; `InstallLedgerContext` and `InstallLedgerSummary` hold `DiscoveryWarning[]` and `HygieneWarning[]` | One classifier removes the drift D-141-05 accepted at install's phase sites | -- Locked |
| **D-PL1-04: the renderer accepts discovery warnings only** (PR #NNN, 2026-10-27): `surfaceDiscoveryWarnings` takes `readonly DiscoveryWarning[]`, pinned by `@ts-expect-error` cases | A hygiene warning reaching a standalone diagnostic is now a compile error, not a test-coverage question | -- Locked |
| **D-PL1-05: the staging diagnostic header names the scope** (PR #NNN, 2026-10-27): `Plugin "<name>" [<scope>] <verb>; N declared component(s) has/have a note(s).` on every verb | The bracketed scope matches the row grammar, and it closes the UPCASC-01 parity gap for install, update and reinstall at once | -- Locked |
| **D-PL1-06: closed header verb union** (PR #NNN, 2026-10-27): `installed`, `updated`, `reinstalled`, `enabled`, `install failed`, `update failed`, `reinstall failed` | A closed union makes the compiler name every header site | -- Locked |
| **D-PL1-07: one placement rule** (PR #NNN, 2026-10-27): after a command's rows, one `notifyDiagnostic` per plugin with discovery warnings, in row order, then the MCP config notices; lines redacted with `redactAbsolutePaths` (NFR-9) | One rule for every verb and cascade keeps the output order predictable: row, then the detail that qualifies it, then the file notices | -- Locked |
| **D-PL1-08: cascades render the discovery half only** (PR #NNN, 2026-10-27): the update and reinstall cascades show discovery warnings; hygiene warnings stay on the orchestrated payload (D-19-01) | The header says declared components have notes, which is false over hygiene lines such as an index corruption. It also gives standalone verbs and cascades one rule | -- Reversed by D-PL1-25 |
| **D-PL1-25: cascades render both halves** (PR #NNN, 2026-10-27): `marketplace update`, autoupdate and `apply`'s catalog moves, backfills and enables show each plugin's discovery notes, then its hygiene warnings, in one diagnostic per plugin under `Plugin "<name>" [<scope>] <verb>; N declared component(s) ...; N staging warning(s).`; the standalone verbs keep the discovery half. It reverses D-PL1-08 and amends D-PL1-05, D-PL1-07 and D-PL1-12 in cascades | WRN-02 asks for the warnings each plugin's materialization produced, and a cascade must not drop a cleanup leak or an index corruption. One clause per half keeps the header true, and discovery-only diagnostics keep their bytes | -- Locked |
| **D-PL1-09: the three cascades** (PR #NNN, 2026-10-27): `marketplace update` and autoupdate (one path, `cascadeAutoupdates`) render after the cascade rows through `update.messaging.ts`; `apply` renders its catalog moves and enables after its install post-commit block | The two marketplace cascades share one code path, so one call covers both. The reconcile backfill UPCASC-01 named no longer exists, because a growth move goes through the update runner | -- Locked |
| **D-PL1-10: the update runner carries tagged warnings** (PR #NNN, 2026-10-27): the `updated` and `failed` arms of `PluginUpdateOutcome` carry `stagingWarnings?` (both halves, omitted when empty); the string fold into `notes` is removed | The warnings start inside the runner, but the rows render after it. The typed carrier lets every consumer pick its half | -- Locked |
| **D-PL1-11: reinstall carries the discovery half typed** (PR #NNN, 2026-10-27): `ReinstallReinstalledOutcome.discoveryWarnings` and the new `ReinstallFailedOutcome.discoveryWarnings` are `readonly DiscoveryWarning[]`; `notes` keeps its orchestrated string fold | Reinstall renders only the discovery half, and its orchestrated readers keep the existing `notes` bytes | -- Locked |
| **D-PL1-12: enable renders its root's discovery warnings** (PR #NNN, 2026-10-27): standalone enable shows one `enabled` diagnostic after its row and before the MCP notices; the orchestrated `enabled` outcome carries `stagingWarnings` for `apply`; the dependencies an enable re-enables are not rendered | Enable re-materializes like install, so it owes the same report (ENWARN-01). Members stay unrendered, as the install cascade's members do | -- Locked |
| **D-PL1-13: a failed install shows its staging warnings** (PR #NNN, 2026-10-27): `InstallFailureCapture` keeps the warnings of the phases that ran, and the standalone failure renders the discovery half after the `(failed)` row with `install failed`; the orchestrated failure outcome does not carry them | The warnings explain why a retry can help (WARN-01). apply's and import's failed-install rows are a later phase's work | -- Locked |
| **D-PL1-14: a failed update or reinstall shows its staging warnings** (PR #NNN, 2026-10-27): a phase-3 failure puts the prepared handles' warnings on the `failed` outcome, and a throw before it reports them through the `CandidateReport` holder; the direct update renders `update failed`, reinstall `reinstall failed` | Every prepared handle is known at a phase-3 failure, and the holder carries the earlier ones through a throw, so no catch site loses them | -- Locked |
| **D-PL1-15: a forced agents commit replaces only rows this staging produced** (PR #NNN, 2026-10-27): under `force`, a foreign-preserved row is replaced only when its `generatedName` is among this staging's new names; every other foreign-preserved row keeps its file and row | It never deletes a user-named file that the current version does not replace (AGIDX-01) | -- Locked |
| **D-PL1-16: a settle reports the MCP config notices of the dependencies it installs** (PR #NNN, 2026-10-27): the settle's cascade runs, steps and both settlement arms carry `mcpConfigNotices`; `materialize-latest.ts` puts them ahead of the update's own on every outcome; a dependency move's notices are not included | The dependencies rewrote the user's MCP file first, so the user hears about it, in the order it happened (LCORCH-01 b3, AFILE-04) | -- Locked |
| **D-PL1-17: reinstall drops the completion cache once, in the shared swap** (PR #NNN, 2026-10-27): reinstall's own maintenance keeps only the data-dir removal, and the "completion cache refresh deferred" note goes away | The swap already drops the cache, so reinstall's second drop was the duplicate LCORCH-01 b4 named | -- Locked |
| **D-PL1-18: `resourcesChanged` comes back on reinstall, derived from the runner** (PR #NNN, 2026-10-27): the runner's `updated` arm carries a required `resourcesChanged` (any skill, prompt, agent, MCP server or workflow before or after the swap), and `reinstall-record.ts` maps it onto the reinstall outcome; no renderer reads it | The runner reports the inventory now, so the field is right. The reinstall row keeps its byte-pinned `needsReload: true` | -- Locked |
| **D-PL1-20: apply's header verbs** (PR #NNN, 2026-10-27): `plugin-converged` renders `updated` (or `update failed`), `plugin-backfilled` `updated`, `plugin-enabled` `enabled` | Each verb names what the step did to the plugin | -- Locked |
| **D-PL1-21: apply's held-down "move then enable" path is unchanged** (PR #NNN, 2026-10-27): only the outcomes `runStep` already pushes through `grownMoveOutcomes` and `convergedMoveOutcomes`, and the enable step, carry warnings | Rendering that path needs an edit in `apply.ts::runStep`, which is at the cognitive ceiling and which a later phase edits | -- Locked |
| **D-PL1-22: an aborted direct update renders only the failed target's diagnostic** (PR #NNN, 2026-10-27): targets that succeeded before the abort render no staging diagnostic | It keeps the existing abort rule, and the user still gets the one diagnostic that explains the failure | -- Locked |
| **D-PL1-24: the warnings report holder extends `CandidateReport` / `recordCandidate`** (PR #NNN, 2026-10-27): the swap reports from `prepareUpdateHandles`' catch and once after prepare succeeds, before the intent-mark `try`; the install failure diagnostic renders only in `handleInstallThrow`'s standalone branch | It reuses the existing per-target holder, leaves the intent-mark block untouched, and keeps a cascade member's failure from rendering under the root's header | -- Locked |
| **D-141-05 amended by D-PL1-03** (PR #NNN, 2026-10-27): the accepted drift is gone. Install, the update swap and reinstall all partition through `partitionStagingWarnings`, so a change to the split is made in one place | `splitStagingWarnings` is deleted, and install no longer classifies inline at its phase sites | -- Amended |

## Backlog dispositions

| Entry | Disposition | Decisions | Commits | Proof |
| ----- | ----------- | --------- | ------- | ----- |
| ENWARN-01 | Closed | D-PL1-12, D-PL1-07 | 97fde69d, 41f39739, d915c147 (apply renders the enable) | Scenarios "Enabling a plugin whose skills collide reports the skip install reports, under a header that names the scope" and "Apply that enables a plugin whose skills collide reports the skip under its header" |
| UPCASC-01 | Closed | D-PL1-05, D-PL1-07, D-PL1-08 (reversed by D-PL1-25), D-PL1-09, D-PL1-20, D-PL1-25 | 58a2111a (header), d8d46674, d915c147 | Scenarios "A marketplace update with autoupdate on reports a moved plugin's skip under its header" and "Apply that moves a plugin to its catalog version reports the moved plugin's skip under its header"; for D-PL1-25, the two "... reports the moved plugin's skip and its dropped agent field under one header" scenarios |
| WCHAN-01 | Closed | D-PL1-01, D-PL1-02, D-PL1-03, D-PL1-04 | d13f32e9, cc945def, e173016c | The `@ts-expect-error` cases in `test/shared/staging-warnings.test.ts` and `test/orchestrators/plugin/shared.test.ts`, plus `npm run typecheck`; scenario "Installing a plugin whose agents share a name reports the skipped agent" |
| WARN-01 | Closed | D-PL1-13, D-PL1-14, D-PL1-24 | cd02a3e5, 6bc5603f, 3356955f | Scenarios "An install that fails in its mcp phase reports the skill the skills phase skipped after the failed row", and the update and reinstall variants of it |
| AGIDX-01 | Closed | D-PL1-15 | b6177e7c | Unit case "D-PL1-15: force replaces a staged row whose bytes a user changed and keeps a hand-named row with its file" in `test/bridges/agents/stage.test.ts` |
| LCORCH-01 b3 | Closed | D-PL1-16, D-PL1-23 | 7adfd8c7 | Scenario "Updating a plugin whose new version needs a dependency with an MCP server reports that dependency's MCP config notice"; unit cases in `dependency-settle.test.ts`, `materialize-latest.test.ts`, `update-flow.test.ts` and `install-flow.test.ts` |
| LCORCH-01 b4 | Closed | D-PL1-17, D-PL1-18 | ba532015, 2236b1c0, 0c230717 | Unit cases "D-PL1-17: a reinstall whose completion-cache drop fails still reinstalls and notes no cache deferral" (`reinstall-flow.test.ts`), "D-PL1-18: resourcesChanged is ..." (`update-swap.test.ts`, 4 rows) and "D-PL1-18: a swapped candidate reporting resourcesChanged ..." (`reinstall-record.test.ts`, 2 rows) |

The other LCORCH-01 bullets stay open. After this phase, the entry keeps the
`marketplace add` classification, rollback-partial detail, tag-ref refresh and
installed-copy containment bullets.

## Uncertain choices (for user review)

1. ~~**Cascades render the discovery half only (D-PL1-08).** Shipped: the
   `marketplace update`, autoupdate, `apply` and reinstall cascades show only
   discovery warnings. The hygiene half stays on the orchestrated payload.
   The install cascade's existing `postCommitWarnings` (both halves, rendered
   by `apply` and `import`) is unchanged.~~ Resolved 2026-10-27: reversed by
   D-PL1-25.
2. **Commit cleanup leaks are tagged at the orchestrator (D-PL1-02).**
   Shipped: `commitPrepared*` still returns `string | undefined`, and the
   install ledger pushes `hygieneWarning(leak)` at its one push site.
3. **AGIDX-01 matches this staging's new names only (D-PL1-15).** Shipped: a
   forced commit replaces a foreign-preserved row only when this staging
   produces its `generatedName`. A file and row that an earlier version
   shipped, and that the current version does not, stay in place.
4. **`resourcesChanged` has no reader (D-PL1-18).** Shipped: the field is
   back on the reinstall outcome, derived from the runner. The reinstall row
   keeps `needsReload: true`, so a hooks-only reinstall still shows the
   `/reload` hint.
5. **Failure header verbs (D-PL1-06).** Shipped: `install failed`,
   `update failed` and `reinstall failed`.
6. **Agents conversion notes stay hygiene (D-PL1-02).** Shipped: only the D-07
   duplicate-name skips are discovery. Dropped-field and dropped-tool notes
   are hygiene and do not render standalone.
7. **Apply's install warnings keep their generic block (Deferred).** Shipped:
   "N post-install warnings surfaced from reconcile installs." is unchanged.
   Only apply's catalog moves and enables use the per-plugin header, so one
   `apply` run can show both shapes.
8. **Cascade header for hygiene lines (D-PL1-25).** Shipped: one diagnostic
   per plugin, with one clause per half, such as `Plugin "demo" [project]
   updated; 1 declared component has a note; 1 staging warning.` The
   alternatives were a second diagnostic for the hygiene half, or one
   generic `N staging warnings` header over all lines.
9. **A dependency move reports no staging warnings (found in PR review).**
   Shipped: when an update or `apply` moves a dependency to a new version,
   `dependency-move.ts::runDependencyMove` drops the staging warnings and MCP
   notices of that move, so no diagnostic shows them. D-PL1-16 covers only
   the dependencies a settle installs. Carrying them needs a member on
   `DependencyMoveRun`, the settle step, `UpdateDependencySettlement` and
   `UpdateDependencyRow`, and `dependency-move.ts` is outside this phase's
   files. Proposed as a backlog entry for the parent to record.
10. **A forced commit can drop a foreign row whose target path differs
    (D-PL1-15, found in PR review, not reproduced).** Under `force`, a
    foreign-preserved agents-index row whose `generatedName` this staging
    produces but whose `targetPath` differs from the new entry's falls in
    neither the replaced nor the kept set of
    `bridges/agents/stage.ts::partitionPreviousEntries`. The row leaves the
    index and its file stays on disk untracked. It needs a hand-edited index.
    Proposed as a backlog entry: either remove the file as D-PL1-15 states,
    or keep the row and warn.
11. **A cascade move that fails in its mcp phase shows `not in manifest`
    (pre-existing, found while adding a scenario).** In a `marketplace
    update` cascade, a runner `failed` outcome with no typed reason goes
    through `update.messaging.ts::narrowFailReason`, whose fallback is
    `not in manifest`. A direct `update` of the same failure shows
    `unreadable`. The scenario "A marketplace update with autoupdate on
    reports a moved plugin that fails in its mcp phase under an update failed
    header" pins today's value. Proposed as a backlog entry: carry typed
    reasons on the runner's `failed` arm, then update that table cell.
    Resolved by the merge of the git-errors phase: the scenario now shows
    `unreadable` with its cause.
12. **The package note is a discovery staging warning (merge with the
    package-dependencies phase).** Shipped: the packages phase pushes its
    note as `discoveryWarning(note)`, so `update`, the `marketplace update`
    and autoupdate cascades and `apply` show it in the D-PL1-05 per-plugin
    diagnostic, which names the scope, and in no separate block.
    D-PL9-21 says the WRN-02 shared placement replaces its cascade call;
    `apply`'s separate package-note block went too, so the note does not
    print twice.

## Docs note for CLN-03

`docs/output-catalog.md` does not describe the per-plugin staging diagnostic:
the `Plugin "<name>" [<scope>] <verb>; N declared components have notes.`
header, its seven verbs, or where it sits after the rows and before the MCP
config notices. In a cascade, the header also carries the
`; N staging warning(s)` clause for hygiene lines (D-PL1-25), so the docs
describe the whole header. The docs cleanup phase (CLN-03) adds it.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

Phase threat register, with evidence:

- **T-01-01 (mitigate) holds.** Every diagnostic line goes through
  `redactAbsolutePaths` in the one renderer. The agents-skip scenario pins
  the redacted basenames (01-01).
- **T-01-02 (mitigate) holds.** Index corruptions, conversion notes and
  cleanup leaks are tagged hygiene at the producer. The install-outcome
  partition case pins which half each warning lands in (01-01).
- **T-01-03 (accept).** Credentials in warning text: the diagnostic payload
  already passes through `redactCredentials`.
- **T-01-04 (mitigate) holds.** `surfaceDiscoveryWarnings` takes
  `readonly DiscoveryWarning[]`, pinned by `@ts-expect-error`. The
  hygiene-only `surfaceStagingDiagnostics` case renders nothing (01-02).
- **T-01-05 (mitigate) holds.** Forced removal is limited to staged-name
  rows, and every replaced row still passes `assertPathInside`. The NFR-10
  escape case keeps a staged-name escaping row under test (01-03).
- **T-01-06 (accept).** A kept hand-named row whose target equals a new
  entry's target makes the commit refuse before it writes.
- **T-01-07 and T-01-08 (accept).** A failed swap cache drop is debug-logged
  only (D-19-01). `resourcesChanged` is informational, and nothing reads it
  (01-04).
- **T-01-09, T-01-10 and T-01-11 (mitigate) hold.** The enable diagnostic
  goes only through the redacting renderer. Only the root's warnings are
  collected, and only a `fresh` outcome renders (01-05).
- **T-01-12, T-01-13 and T-01-14 (mitigate) hold.** Failure-path
  diagnostics go through the same renderer. The install diagnostic renders
  only in the standalone branch. Each catch site creates one `CandidateReport`
  per target (01-06).
- **T-01-15 (mitigate) holds, T-01-16 (accept).** Cascades render only
  through `surfaceCascadeStagingDiagnostics`, which shows both halves
  (D-PL1-25). There is one diagnostic per moved or enabled plugin with any
  staging warning, every line redacted, under a header with one clause per
  half (01-07).
- **T-01-17 (mitigate) holds.** The settle now carries the notices to the
  update outcome, so the user hears about every rewrite of their MCP file
  (AFILE-04). A notice names only its kind, scope and file name, never a
  path. The scenario pins the payload
  `[{"kind":"comments-dropped","scope":"project","file":"mcp-adapter.json"}]`.
- **T-01-18 (mitigate) holds.** `npm run check` ran unpiped, and its own exit
  status (0) is recorded above. No failure needed a fix or a waiver.
- **T-01-SC (accept).** This phase installed no package.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts
- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
- FOUND: features/plugin/staging-warnings.feature
- FOUND: 7adfd8c7 (ancestor of HEAD)
- `git log --format=%h d13f32e9^..HEAD -- CHANGELOG.md .planning/PROJECT.md .planning/BACKLOG.md`
  printed nothing, and `git status --short` on those files printed nothing.
