---
phase: 04-dependency-resolver-residue
plan: 06
subsystem: plugin-lifecycle
tags: [cucumber, dependency-plan, agents-bridge, phase-gate]
status: complete

requires:
  - "04-03: a move refusal shows file names (D-PL4-07)"
  - "04-05: both ledger builders pin the previewed commit (D-PL4-01)"
provides:
  - "RSV-01 scenario: an install that moves a dependency fetches its new git dependency once"
  - "Three RSV-04 scenarios: an occupied agent target refuses before any dependency moves or installs"
  - "Steps: a published plugin's agent, a user's file in a scope's agents directory, and that directory's files"
  - "Phase gate: npm run check exit 0 on 1610281c"
affects: [features/plugin/install-dependencies.feature, features/plugin/update-dependencies.feature]

actuals:
  tokens: 5275
  tasks: 3
  commits: 2
plan_head_before: dde2c87eec0cc4324d3df9e061870d99109fe8b6
plan_head_after: 1610281c8bd14b347db047932410e7a35aab52d5

tech-stack:
  added: []
  patterns:
    - "A scenario that refuses before anything lands compares the installation record and the user's files, not only the failed rows"

key-files:
  created: []
  modified:
    - features/plugin/install-dependencies.feature
    - features/plugin/update-dependencies.feature
    - features/lib/published-marketplace.ts
    - features/step_definitions/plugin/publishing.steps.ts
    - features/step_definitions/plugin/installation.steps.ts

key-decisions:
  - "The plain-update scenario records the measured row, including the reason `unreadable manifest` that the WR-C refusal now gets from update-flow's generic fallback (proposed as a backlog entry, not fixed here)"
  - "installation.steps.ts shares two private helpers (writeUserFile, fileRows) between the data-directory and agents-directory steps, so fallow dupes stays clean"

patterns-established: []

requirements-completed: [RSV-01, RSV-04]

metrics:
  started: 2026-10-27T04:16:28Z
  completed: 2026-10-27T04:37:32Z
---

# Phase 4 Plan 06: Resolver residue scenarios and phase gate Summary

Four cucumber scenarios prove RSV-01 and RSV-04 from the outside, and each one fails on the phase's base commit `2829db68`. An install that moves `lib` fetches its new unpinned git dependency `util` once. A user's file at an agent target refuses an install before either dependency moves, refuses an install before its installed dependency moves, and refuses a plain update before it installs the dependency the new version needs. The phase gate, `npm run check`, exited 0 on the combined tree.

## Commits

| Task | Commit | Title |
| ---- | ------ | ----- |
| 1 (tracer) | cef70cff | test(plugin): fetch a new git dependency once when an install moves one |
| 2 | 1610281c | test(plugin): refuse an occupied agent target before a dependency moves |
| 3 | (this SUMMARY) | docs commit by pathspec |

## What changed

- `features/plugin/install-dependencies.feature`:
  - "Installing a plugin whose installed dependency moves fetches the repository of its new git dependency once", after the user-scope marketplace scenario. It uses existing steps only.
  - "Installing a plugin whose second dependency's new version would overwrite a user's agent file fails before either dependency moves", after "…second dependency move fails keeps the first move and lists it".
  - "Installing a plugin whose new dependency would overwrite a user's agent file fails before its installed dependency moves", right after it.
- `features/plugin/update-dependencies.feature`: "Updating a plugin whose new version would overwrite a user's agent file fails before it installs the dependency that version needs", after the first scenario.
- `features/lib/published-marketplace.ts`: `publishAgent(published, plugin, agent)` beside `publishOutputStyle`. It writes `agents/<agent>.md` with front matter (`name`, `description`, `tools: Read, Grep`), so the agent converts (AG-11).
- `features/step_definitions/plugin/publishing.steps.ts`: `Given the published plugin {string} of the marketplace {string} has the agent {string}`, after the output-style pair. The `@fileoverview` names agents among the changes to an offered plugin.
- `features/step_definitions/plugin/installation.steps.ts`:
  - `Given the agents directory of the {word} scope holds the file {string} with the text {string}`. It requires an entry name, creates `<scope root>/agents/`, writes with `wx`, registers a release that removes the file, and asserts the text.
  - `Then the agents directory of the {word} scope holds these files:`. It fails on a missing directory and compares every file as `| file | text |` rows sorted by name.
  - Two private helpers, `writeUserFile` and `fileRows`, now serve the data-directory steps too. The commit hook's fallow dupes found two clone groups between the old and new steps, so the first commit attempt failed. The `@fileoverview` now names three setup steps.

## Scenario results

On this phase's tree, all four scenarios pass. `npx cucumber-js features/plugin/install-dependencies.feature features/plugin/update-dependencies.feature` passed 56/56. After the helper extraction, the same two files plus `features/plugin/uninstall.feature`, which uses the data-directory steps, passed 74/74. `npm run check:features` exited 0.

Measured values that differ from the plan's expectations:

- Scenario (c), the plain update, has the summary `A plugin operation has failed.`. Its row is `widget@tools` `failed`, reason `unreadable manifest`, version `1.1.0`, from `1.0.0`, and cause `Cannot replace agent target with non-previous content at {project dir}/.pi/agents/pi-claude-marketplace-widget-helper.md`. See Deviations.
- Scenario (b), the fresh dependency, has a `kit@tools` row with no reason, and its cause shows the full path, as the plan expected.

## RED evidence (Task 2 step 5)

The throwaway worktree was at `2829db68`, the parent of 04-01's first commit `92eb099a`. It was created with `git worktree add --detach` in the scratchpad, `node_modules` was symlinked, and this tree's `features/` was copied over the base's. `git status` there showed only the five plan files as changed. The worktree was removed with `git worktree remove --force` and pruned.

| Scenario | Result on base | First failing step | What the base did |
| -------- | -------------- | ------------------ | ----------------- |
| RSV-01: one fetch of `util` | failed | `Then the git host receives these requests:` | 4 rows: the `info/refs` + `git-upload-pack` pair twice |
| (a) second dependency's agent | failed | `Then the result has these fields:` (`needs reload` `true`) | With that cell relaxed, `Then the result lists these plugins:` failed: `aaa@tools` `updated` 1.0.0 → 2.0.0, and `zzz@tools` failed with the swap's basename cause and no reason |
| (b) new dependency's agent | failed | `Then the result has these fields:` (`needs reload` `true`) | With that cell relaxed, the row table failed: an extra `lib@tools` `updated` 1.2.0 → 2.0.0 row |
| (c) plain update's agent | failed | `Then the result has these fields:` (`needs reload` `true`) | With that cell relaxed, the row table failed: an extra `zcore@tools` `installed` 1.0.0 row, and `widget` showed no reason and version 1.0.0 |

The relaxed re-run changed only the scratch copy, to show that the row tables also discriminate. The record tables follow from the same moves.

RED counts from 04-05 (unit, mirror calls per install): a fresh dependency in the final closure went from 2 to 1, a fresh dependency in a materialize step went from 2 to 1, and the root after a move went from 2 to 1. Each pin list went from `[]` to `[HOST_HEAD]`.

## Verification (phase gate)

- Command: `npm run check`, run from the worktree root as the only command of its shell call, with no pipe.
- Exit status: 0.
- Commit: `1610281c8bd14b347db047932410e7a35aab52d5`, with a clean tree.
- Node: v26.12.1.
- Scope: the full gate on the phase's combined tree. It ran `check:static` (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features), `test:unpaired`, `test:integration`, `test:cucumber` (905/905 scenarios, 9041 steps), and `test:coverage:direct:all` (merged `coverage/direct.lcov`, 292 records).
- Both task commits passed the commit hook. The Task 2 hook ran `check:commit`, and its first attempt failed on fallow dupes, as noted above.
- This SUMMARY changes planning Markdown only, so the gate result applies to the SUMMARY commit as well.

## Deviations from Plan

**1. [Rule 3 - Blocking] Shared helpers in installation.steps.ts**
- **Found during:** Task 2, first commit attempt.
- **Issue:** `check:commit` failed `fallow dupes` with 2 clone groups. The new agents-directory Given and Then repeated the bodies of the data-directory Given and Then.
- **Fix:** extracted `writeUserFile` and `fileRows`, which both pairs of steps now call. The data-directory steps behave the same as before. `fileRows` reads recursively, so the agents Then also lists a nested file. That is stricter, and the plan asked for a flat directory.
- **Files:** `features/step_definitions/plugin/installation.steps.ts`.
- **Commit:** 1610281c.

**2. Commit title length.** The plan's example title for Task 1 has 75 characters, and gitlint failed the first attempt. The title became `test(plugin): fetch a new git dependency once when an install moves one`. No `--amend`, no `--no-verify`.

**3. Measured row for scenario (c).** The plan said to read the update's failed row from the run, so the scenario pins the row as measured. That row carries the reason `unreadable manifest`. On the base, the swap-time refusal showed no reason. Since 04-01, the WR-C check throws a plain `Error` out of `materializeLatestVersion`. `update-flow.ts::narrowDirectFailReason` gives an untyped error with no errno its generic fallback, `"unreadable manifest"`. The cause text is right, but the reason label is wrong for an occupied agent target. Fixing it needs a typed error or a new reason in `update-flow.ts` and the closed reason set. That is outside this plan's files, so it is not fixed here. It is proposed below as a backlog entry. If the label changes later, the scenario's `reasons` cell changes with it.

## Files outside the ROADMAP Files line

The ROADMAP Files line names `orchestrators/plugin/{dependency-plan,dependency-tag-probe}.ts`, `domain/release-tag.ts`, `install-flow.ts`, `install-outcome.ts`, and `update-swap.ts`. Their paired tests count as part of each source file. These files were edited outside it:

| File | Plan | Change |
| ---- | ---- | ------ |
| `extensions/pi-claude-marketplace/bridges/agents/target-check.ts` (new) | 04-01 | the write-free agent-target check |
| `test/bridges/agents/target-check.test.ts` (new) | 04-01 | its pair test |
| `extensions/pi-claude-marketplace/bridges/agents/index.ts` | 04-01 | one barrel export |
| `test/bridges/agents/index.test.ts` | 04-01 | one barrel binding case |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` | 04-02, 04-04 | the `toMemberConstraintOutcome` parameter type, and the `ResolvedCascadeMember.previewedCommit` field (Phase 3 owns this file) |
| `test/orchestrators/plugin/install-cascade.test.ts` | 04-02 | the probe-answer fakes lose `range` |
| `test/orchestrators/plugin/marketplace-tag-probe.test.ts` | 04-02 | two expectations lose `range` |
| `features/plugin/install-dependencies.feature` | 04-06 | the RSV-01 scenario and two RSV-04 scenarios |
| `features/plugin/update-dependencies.feature` | 04-06 | the RSV-04 plain-update scenario |
| `features/lib/published-marketplace.ts` | 04-06 | `publishAgent` |
| `features/step_definitions/plugin/publishing.steps.ts` | 04-06 | the agent step |
| `features/step_definitions/plugin/installation.steps.ts` | 04-06 | the agents-directory steps and the two shared helpers |

No file outside a plan's `files_modified` was touched in this plan.

## CHANGELOG line

- An install that moves a dependency now fetches each new git dependency once and installs the commit it checked. An install or update fails, and changes nothing, when your own file in `agents/` has the name of a new agent.

## Decision rows

| Decision | Rationale | Outcome |
| -------- | --------- | ------- |
| **D-PL4-01 (plugin-lifecycle, autonomous discuss 2026-10-26): a plugin the dependency plan previews installs the commit its preview resolved** — `previewInstall` returns the commit its preflight resolved. The plan carries it on each fresh member it schedules as `previewedCommit`, and on the root of an install plan through `rootCommit`. `memberLedgerPin` (install-flow.ts) gives each member's ledger pin: the release tag's commit and semver when `pin` is set (RESV-03, GV-01), else `previewedCommit` as `sourcePinOverride` alone. So the install takes the probe's pinned arm and reads the preview's per-commit copy with no network. A fresh dependency that `apply`'s MISS-01 step installs keeps its own resolve | Claude Code 2.1.310 fetches each closure member once (`mCo`) and has no separate preview, so one network resolve per fresh git plugin matches it. The second fetch could land a revision the plan never judged (UPDDEP-01). NFR-5 allows either, and NFR-3 favors installing what was checked | ✓ Good |
| **D-PL4-02 (plugin-lifecycle, autonomous discuss 2026-10-26): under `apply`, one bad fresh dependency still refuses the root before its moves land** — the plan previews every fresh node of the graph, including one only a moved dependency's new version needs and that MISS-01 installs later (`dependencyInstallsFollow`). A preview refusal fails the root's install with that member's row. No behavior change: the `dependencyInstallsFollow` doc, the `dependency-plan.ts` header, and a unit case pin the rule | Claude Code 2.1.310's `installResolvedPlugin` is all or nothing over the closure: a member that cannot install fails the root and rolls back (`Zs` / `xr`). `apply`'s config install mirrors that install. `resolveMissingDependencies` only logs, but it is MISS-01's counterpart, and MISS-01 keeps its own row. Matches D-03-07 and NFR-3 | ✓ Good |
| **D-PL4-03 (plugin-lifecycle, autonomous discuss 2026-10-26): the dependency resolver is not a complete solver** — when a conflict involves several tentative picks, the plan rules out the version of the first involved pick in walk order that still has one left, and a ruled-out version stays out. So a graph only an untried pair of versions solves is refused. The `dependency-plan.ts` header names the limit, and a unit case pins the refusal | Claude Code 2.1.310's resolver is one greedy pass with no backtracking (`o3s` post-order, `cWt` range intersection, `IOr` highest tag). It refuses these graphs too, and the UPD-DEP-D1 search already settles every graph it settles. A complete search would multiply judge calls and tag reads and gain no parity | ✓ Good |
| **D-PL4-04 (plugin-lifecycle, autonomous discuss 2026-10-26): an occupied agent target refuses before any dependency moves or installs** — a write-free agents-bridge check (`assertAgentTargetsFree`, `bridges/agents/target-check.ts`) applies the non-forced agents commit's rule: a target that holds a file no replaced index row of the plugin owns refuses with `Cannot replace agent target with non-previous content at <path>`. `assertUpdateNamesFree` runs it after the PI-6 names, so the move judge and the update's WR-C check refuse first, and `previewInstall` runs it for an install's root and fresh dependencies. The swap keeps a names-only check (`assertNamesFree`), so reinstall's forced overwrite (RINST-01, D-18-15) is unchanged. The commit-time refusals stay as a backstop. A plain update now refuses before it installs a missing dependency | A Pi capability gap licenses this: Claude Code 2.1.310 loads plugin agents from each plugin's own cache directory, so no shared directory can collide. Pi agents share `<scope>/agents/`. NFR-3 and UPD-DEP-D1 ("refuse before anything lands") settle the order, and the old swap-time refusal left earlier moves landed | ✓ Good |
| **D-PL4-05 (plugin-lifecycle, autonomous discuss 2026-10-26): the no-match tag answer carries no range** — the `no-matching-tag` arms of `SelectedReleaseTag` (`domain/release-tag.ts`) and `DependencyTagProbeResult` (`dependency-tag-probe.ts`) drop `range`. `install-cascade.ts::toMemberConstraintOutcome` drops it from its parameter type, and every caller renders the member's declared ranges | No caller read the field (LCCODE-01). Removing it leaves one source for the rendered range. No user-visible change, and no upstream position | ✓ Good |
| **D-PL4-06 (plugin-lifecycle, autonomous discuss 2026-10-26): a failed missing-dependency install declares its rollback partials** — the failed arm of `InstallMissingDependencyOutcome` (`install-flow.ts`) declares `rollbackPartials?: readonly RollbackPartial[]` with the REC-06 doc of `InstallPluginOutcome` (omitted when every undo finished, NREG-01). The value already arrived through `handleCaughtInstallFailure`. `apply` does not render it yet (LCORCH-01) | The type now states what the object carries, so a consumer can read it without a cast (LCCODE-01). No user-visible change | ✓ Good |
| **D-PL4-07 (plugin-lifecycle, autonomous discuss 2026-10-26): a dependency move refusal shows absolute paths as file names** — `dependency-plan.ts::unmovable` sets `moveRefusal: redactAbsolutePaths(cause)`, so the plan's refusal of an installed dependency reads like the swap's failed move row. A fresh dependency's preview refusal is a member refusal and keeps its full path, as its commit-time refusal did | The same failure reads the same wherever it is found (`failedMoveRow`, T-55-02-02). Claude Code has no counterpart, because it has no shared agents directory | ✓ Good |

## Backlog dispositions

Closed by this phase:

- **UPDDEP-01 b1** (an unpinned fresh git dependency resolved twice): closed by D-PL4-01. The RSV-01 scenario and three 04-05 unit cases pin it.
- **UPDDEP-01 b4** (the plan previews what `apply` installs later): closed by D-PL4-02. The refusal is kept and pinned.
- **UPDDEP-01 b5** (greedy search, not a complete solver): closed by D-PL4-03. The limit is recorded and pinned.
- **UPDDEP-01 b6** (agent-target refusals after earlier moves landed): closed by D-PL4-04, with D-PL4-07. Three RSV-04 scenarios pin it.
- **LCCODE-01 b2** (unread `no-matching-tag` range): closed by D-PL4-05.
- **LCCODE-01 b3** (undeclared `rollbackPartials`): closed by D-PL4-06.

Still open in UPDDEP-01: b2 (the offline refusal gives no next step), b3 (the preflight reads ranges from the catalog version), and b7 (`install-flow.ts` size, Phase 11).

New entry proposals:

- **Refusals after a move landed, outside agents.** These refusals still come after earlier moves have landed:
  - A workflow target refuses (`Cannot replace workflow target with non-previous content`) in a move's swap, in the workflows bridge's prepare or commit.
  - A disabled dependency that the plan re-enables runs the install ledger again, and its agents commit can refuse an occupied target.
  - The plan previews fresh nodes only. Both items are deferred in 04-CONTEXT.md.
- **The plain-update agent refusal reads as `unreadable manifest`.** Since D-PL4-04, an update whose new version's agent target is occupied refuses in WR-C with a plain `Error`. `update-flow.ts::narrowDirectFailReason` then gives it the generic fallback reason `unreadable manifest`. Before the phase, the swap-time refusal showed no reason. The cause text is right, but the label blames a manifest. A fix needs a typed error, with either a fitting closed-set reason or no reason. `features/plugin/update-dependencies.feature` pins the current row, so the fix updates that cell.
- **For TST-01:** the install-plan root's previewed commit (D-PL4-01, `rootCommit`) has unit proof only, because of a harness limit (RESEARCH A3). No step offers a git plugin whose catalog entry declares dependencies, and a git plugin's own `plugin.json` is not visible to the first walk before it is cloned. The proof is the 04-05 unit case in `install-flow.test.ts`.

## Uncertain choices (for user review)

From 04-CONTEXT.md:

1. **RSV-01 covers the install root too.** The root of an install plan installs its previewed commit (alternative: fresh dependencies only).
2. **RSV-01 leaves `apply`'s deferred dependencies out.** MISS-01 keeps its own resolve (alternative: thread the previewed commits across apply steps).
3. **RSV-02 keeps the refusal.** One bad fresh dependency refuses the root under `apply` too (alternative: skip previewing the nodes MISS-01 installs).
4. **RSV-03 records the limit.** No complete solver (alternative: a backtracking search).
5. **RSV-04 moves a plain update's refusal earlier.** WR-C refuses before the first cascade run installs a missing dependency. Scenario (c) pins this.
6. **RSV-04 extends to install previews.** `previewInstall` runs the agent-target check. Scenario (b) pins this.
7. **RSV-05 b2 removes the field.** The unread `range` is removed, not read.
8. **D-PL4-07 redacts the move refusal's paths.** A move refusal shows the file name only.

Made during planning and execution:

9. **`assertUpdateNamesFree` returns nothing.** Only the swap reads the generated names, so it calls the private `assertNamesFree`. The exported check returns `Promise<void>`.
10. **The fresh-dependency refusal keeps the full path, and the move refusal does not.** A fresh dependency's preview refusal is a member refusal and shows `{project dir}/.pi/agents/…`, as its commit-time refusal did. A move refusal shows only the file name (D-PL4-07). Scenarios (a) and (b) pin both forms.
11. **The install-plan root's previewed commit has unit proof only** (RESEARCH A3, see Backlog dispositions).
12. **Scenario (c) pins the `unreadable manifest` reason as measured.** Alternative: fix the label in this phase. It was not fixed, because the fix is in `update-flow.ts` and the closed reason set, outside this phase's Files line (see Backlog dispositions).
13. **The agents-directory Then lists files recursively.** It shares `fileRows` with the data-directory Then (Deviation 1). A nested file in `agents/` would show as `sub/name.md`, which is stricter than the plan's flat listing.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-14: the new Given writes only under the scenario's `scopeRoot`, refuses a name with a separator, writes with `wx`, and removes the file on release. T-04-15: the scenarios use the dir marketplace and the run's loopback git host only. T-04-16: the RED worktree was removed and pruned. T-04-SC: no package was installed.

## Self-Check: PASSED

- FOUND: features/plugin/install-dependencies.feature, features/plugin/update-dependencies.feature, features/lib/published-marketplace.ts, features/step_definitions/plugin/publishing.steps.ts, features/step_definitions/plugin/installation.steps.ts
- FOUND: cef70cff (ancestor of HEAD)
- FOUND: 1610281c (ancestor of HEAD)
- Acceptance greps: each of the four scenario titles prints 1, and `has the agent {string}` prints 1 in publishing.steps.ts.
