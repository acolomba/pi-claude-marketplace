---
phase: 04-ssh-sources-and-transport-selection
plan: 21
subsystem: install notifications
tags: [system-git, ssh, notification, clone-note, install, gap-closure]
requires:
  - phase: 04-ssh-sources-and-transport-selection
    provides: "04-19: the clone member on PluginDisabledMessage; 04-14: the install's clone notes, marketplaceBlockClone, underMarketplaceName"
provides:
  - "The DFEN-04 disabled requesting row names its own clone (WINDOWS #130, standalone install)"
  - "A refused dependency plan, a failed dependency move, and a cascade failure name the requesting plugin's clone on its {dependency failed} row (WINDOWS #131)"
  - "A D-MF-04 add of another marketplace that recorded a clone note gets a bare block of its own after the install's block (WINDOWS #132)"
affects: [04-22, 04-23, 04-24, D-SG-22]
actuals:
  tokens: 14150
  tasks: 3
  commits: 3
plan_head_before: 913c3b987a7ec33612c5acf2af1cf90bd8bdfa02
plan_head_after: 70dcea1
tech-stack:
  added: []
  patterns:
    - "addedMarketplaceBlocks(notes, scope, marketplace, names): one bare { name, scope, clone, plugins: [] } block per other added marketplace whose add kept a note"
    - "addedMarketplaceNames(carried, adds): the install's add names, carried adds first, then saved, then unsaved, each once"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts
    - test/orchestrators/plugin/install-cascade.messaging.test.ts
    - test/orchestrators/plugin/install-flow.test.ts
    - test/orchestrators/plugin/install-flow-planning.test.ts
    - test/orchestrators/plugin/install-flow-dependency-ledger.test.ts
    - test/orchestrators/plugin/install-flow-ledger.test.ts
    - test/orchestrators/plugin/install-flow-results.test.ts
    - test/orchestrators/plugin/install-flow-cascade-context.test.ts
    - features/plugin/git-source.feature
    - features/plugin/install-dependencies.feature
    - features/plugin/cross-scope-install.feature
key-decisions:
  - "The requesting plugin's {dependency failed} row of composeCascadeFailureMessage reads its own key's note, so a version-conflict refusal after the preview cloned names the clone there"
  - "A cascade failure whose subject is a member also offers that member's marketplace as an extra-block candidate, so a D-MF-04 add whose clone failed (it is in no add list) still shows its note"
  - "The #132 block is stated in the plugins table (a bare block is one record with marketplace fields only); the marketplaces step refuses a result whose install block has plugin rows"
requirements-completed: [SG-SSH-04, SG-SSH-02]
coverage:
  - id: D1
    description: "A GitHub install that lands disabled (defaultEnabled: false) names its clone on the (disabled) {installs disabled} row"
    requirement: SG-SSH-04
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/install-cascade.messaging.test.ts#DFEN-04: a disabled requesting plugin's row names its own clone and keeps its reason and hint"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/install-flow.test.ts#D-SG-22, DFEN-04: an install that lands disabled names its clone under the disabled row"
        status: pass
      - kind: e2e
        ref: "features/plugin/git-source.feature#Installing a github plugin whose entry installs it disabled names its clone on the disabled row"
        status: pass
    human_judgment: false
  - id: D2
    description: "A refused dependency plan or a failed dependency move after the install cloned names the clone on the requesting plugin's failed row (and the block's add note on the block)"
    requirement: SG-SSH-04
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/install-flow-planning.test.ts#D-SG-22: an install whose plan refuses after its preview cloned names the clone on the failed row"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/install-flow-dependency-ledger.test.ts#D-SG-22: a failed move names the requesting plugin's clone on its row and the block's on its block"
        status: pass
      - kind: e2e
        ref: "features/plugin/install-dependencies.feature#Installing a github plugin whose installed dependency no release moves inside its version constraint names the plugin's clone on its failed row"
        status: pass
    human_judgment: false
  - id: D3
    description: "A D-MF-04 add of a dependency's GitHub marketplace names its clone on a bare block after the install's block, on success and on failure; no note, no block"
    requirement: SG-SSH-02
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/install-flow-results.test.ts#D-SG-22 / D-MF-04: the blocks of the marketplaces an install added"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/install-flow-ledger.test.ts#D-SG-22 / D-MF-04: an install names its dependency marketplace's add clone on a block after its own"
        status: pass
      - kind: e2e
        ref: "features/plugin/cross-scope-install.feature#Installing a plugin into the project scope that adds the github marketplace of its dependency names that add's clone"
        status: pass
    human_judgment: false
duration: 98min
completed: 2026-11-26
status: complete
---

# Phase 4 Plan 21: Install clone notes on the disabled, dependency-failure, and D-MF-04 paths Summary

**A standalone `/claude:plugin install` now names every GitHub clone it runs: the DFEN-04 disabled row carries its own note, a refused dependency plan or failed move names the requesting plugin's clone on its `{dependency failed}` row, and a D-MF-04 add of another marketplace gets a bare block with its add's note after the install's block.**

## Performance

- **Duration:** 98 min
- **Started:** 2026-11-26T19:21:01Z
- **Completed:** 2026-11-26T20:59:00Z
- **Tasks:** 3
- **Files modified:** 16

PLAN_BASE: `913c3b987a7ec33612c5acf2af1cf90bd8bdfa02`

## Accomplishments

- WINDOWS #130 (standalone install): `composeCascadeMemberRows` reads the root key's note whatever the requesting row's status, so `(disabled) {installs disabled}` shows the clone line under the row and the enable hint after it. With no note for the key the row is the same object.
- WINDOWS #131: `installAfterMoves` passes `opts.transportContext?.notes` to both port projections (`projectCaughtFailure`, `projectFailedMoves`); `projectFailedInstallDependencyPlanMoves` notes the requesting row (`withCloneNote`, by `<plugin>@<marketplace>`) and its block (`marketplaceBlockClone`); `composeCascadeFailureMessage` notes the requesting plugin's `{dependency failed}` row. Moved rows keep the update runner's notes.
- WINDOWS #132: `addedMarketplaceBlocks` in `install-flow-results.ts` turns the install's added marketplaces (from `addedMarketplaceNames` in `install-flow-cascade-context.ts`: carried, saved, unsaved, each once) into `{ name, scope, clone, plugins: [] }` blocks, skipping the install's own marketplace and every name with no note. Every standalone report appends them with `single` cardinality: installed (and landed disabled), disable-cascade-failed, promoted, standalone failure, cascade failure, and the two dependency-plan failures. Orchestrated installs compose no rows and are unchanged.

## Task Commits

1. **Task 1 (tracer): the disabled row names its clone** - `80ba44a` (feat, RED and GREEN in one commit)
2. **Task 2: a refused plan or failed move names the clone** - `e9a8634` (feat, RED and GREEN in one commit)
3. **Task 3: a D-MF-04 add names its clone on its own block** - `70dcea1` (feat, RED and GREEN in one commit)

RED and GREEN share each commit because the commit hook runs typecheck and every architecture test, so a failing-test-only commit cannot pass it (the 04-08 precedent). Each RED ran locally first, against the pre-task sources (each task's own source files written back from `HEAD`, the tests kept).

Tracer gate (Task 1, interactive `end-of-phase`, automated-only verify): the verify re-ran green (unit 82/82, scenario 1/1), so expansion continued with no checkpoint.

## TDD Gate Compliance (red runs)

**Task 1.** `node --import scripts/isolated-pi-home.mjs --test test/orchestrators/plugin/install-cascade.messaging.test.ts test/orchestrators/plugin/install-flow.test.ts`: `tests 82, pass 80, fail 2`:
- `DFEN-04: a disabled requesting plugin's row names its own clone and keeps its reason and hint` (actual row had no `clone` member)
- `D-SG-22, DFEN-04: an install that lands disabled names its clone under the disabled row` (actual lines lacked `SSH not configured, cloning via HTTPS: ...` under the disabled row)

Scenario RED (adapter), "Installing a github plugin whose entry installs it disabled names its clone on the disabled row": `1 scenario (1 failed)`; the plugins table lacked the `clone note` and `clone url` columns. Semantic assessment: both units and the scenario failed on the planned assertion (the missing note), nothing else.

**Task 2.** Same runner over `install-flow-planning.test.ts install-flow-dependency-ledger.test.ts install-flow-results.test.ts`: `tests 82, pass 79, fail 3`:
- `D-SG-22: a failed move names the requesting plugin's clone on its row and the block's on its block` (missing block and row note lines)
- `D-SG-22: an install whose plan refuses after its preview cloned names the clone on the failed row` (no clone line under `app (failed) {dependency failed}`)
- `D-SG-22: an install whose dependency move fails after it cloned names the clone on its row` (same)

Scenario RED (adapter), "Installing a github plugin whose installed dependency no release moves ... names the plugin's clone on its failed row": `1 scenario (1 failed)`; the `app` row had no clone cells. Semantic assessment: assertion failures on the planned note.

**Task 3.** Ledger cases (`--test-name-pattern="D-SG-22 / D-MF-04"`): `tests 2, fail 2`, each missing the `● deps-mp [project]` block and its `Cloning via HTTPS` line. The `install-flow-results` and `install-flow-cascade-context` cases failed to load (`does not provide an export named 'addedMarketplaceBlocks'` / `'addedMarketplaceNames'`): the helpers are new, so their RED is a load failure, not an assertion; the ledger cases and the scenario carry the assertion-level RED for this task. Scenario RED (adapter), "Installing a plugin into the project scope that adds the github marketplace of its dependency names that add's clone": `1 scenario (1 failed)`; no `tools` record with `marketplace clone note` cells.

All GREEN runs: every named suite `fail 0`; each new scenario passed.

## Files Created/Modified

- `orchestrators/plugin/install-cascade.messaging.ts` - disabled requesting row and `{dependency failed}` root row read their own key's note
- `orchestrators/plugin/install-flow-planning.ts` - port types take `notes` and `addedMarketplaces`; `installAfterMoves` passes both
- `orchestrators/plugin/install-flow-dependency-ledger.ts` - the failed-move block notes its root row, its block, and appends the added-marketplace blocks
- `orchestrators/plugin/install-flow-results.ts` - `addedMarketplaceBlocks`, `failedMemberMarketplace`; promoted, install-throw, and cascade-throw blocks append them
- `orchestrators/plugin/install-flow-ledger.ts` - installed, disable-cascade-failed, promoted, and catch sites pass the add names
- `orchestrators/plugin/install-flow-cascade-context.ts` - `addedMarketplaceNames`
- Unit tests for each pair listed in key-files; three scenarios (below)

## New and re-baselined scenarios

New (not re-baselines):

- `features/plugin/git-source.feature`: "Installing a github plugin whose entry installs it disabled names its clone on the disabled row"
- `features/plugin/install-dependencies.feature`: "Installing a github plugin whose installed dependency no release moves inside its version constraint names the plugin's clone on its failed row"
- `features/plugin/cross-scope-install.feature`: "Installing a plugin into the project scope that adds the github marketplace of its dependency names that add's clone" (Outline, one `@github` Examples row)

Re-baselined: none. No existing scenario in any feature file changed: both full suites pass with no edit outside the three new scenarios, so no scenario outside this plan's files needs a post-merge re-baseline either.

Rebaseline audit: `git diff -U0 913c3b9..HEAD -- features` filtered with `grep '^[-+][^-+]' | grep -v -i 'clone\|Cloning via\|retrying with\|SSH not configured'` printed only added lines of the three new scenarios (their steps, data rows, the manifest doc string, and the `@github` Examples block). No removed line (`grep -c '^-[^-]'` = 0).

## Suite counts (final tree, `env -u GIT_CONFIG_COUNT`)

- `npm run --silent check:static`: passed (also passed in each commit hook)
- `npm run --silent check:features`: passed
- `npm run --silent test:modules`: passed (exit 0)
- `npm run --silent test:integration`: passed (exit 0)
- cucumber `--profile adapter features`: 2403 scenarios, 2397 passed, 6 failed. Five are the known fd-dependent Glob baselines in `features/hook/tool-use.feature` (lines 296, 355, 443, 1696, 1834). The sixth, `features/marketplace/update.feature:479` "Reordering a manifest array changes the github marketplace, whose refresh names its clone transport", failed in its `Before` hook on an ssh launch left over from another scenario under the four-executor load; re-run alone it passed (`1 scenario (1 passed)`). It runs no install code.
- cucumber `--profile builtin features`: 260 scenarios, 260 passed
- Direct coverage at 100% for all six changed sources

`npm run check` was not run here; the wave gate runs it on the merged tree.

## Decisions Made

- The `{dependency failed}` root row of a cascade failure reads its own note (`composeCascadeFailureMessage`). Without it the version-conflict refusal, which is a cascade-failure subject naming the dependency, could not name the root's clone as the plan's behavior requires. `dependencyRefusal` (update's settle) passes no notes and filters the root row out, so it is unchanged.
- A failed `member` subject's marketplace joins the extra-block candidates: a D-MF-04 add whose clone fails throws before it joins `addedMarketplaces`, but its note is kept under the marketplace's name, so the block still names the attempts. A closure refusal ran no add and adds no block (unit case).
- `addedMarketplaceNames` orders carried adds (WR-E, first pass of a two-pass install) before saved and unsaved ones, each once.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The cascade failure's requesting row did not read its note**
- **Found during:** Task 2
- **Issue:** The planning failure reaches `handleCascadeThrow`, whose `composeCascadeFailureMessage` built the root `{dependency failed}` row bare, so passing notes alone could not put the root's clone on it.
- **Fix:** The root row goes through `withCloneNote(..., args.rootKey)`; a unit case pins it.
- **Files modified:** `install-cascade.messaging.ts` (in the plan's files_modified, listed under Task 1), its test
- **Committed in:** e9a8634

**2. [Rule 2 - Missing critical] A failed D-MF-04 add's note had no block**
- **Found during:** Task 3
- **Issue:** The add list holds an add only after it records, so the add that failed cloning (the case the retry lines matter most for) would show nothing.
- **Fix:** `failedMemberMarketplace` adds the failed member's marketplace to the candidates in `handleCascadeThrow`; a ledger case pins it.
- **Files modified:** `install-flow-results.ts`
- **Committed in:** 70dcea1

**3. [Rule 3 - Blocking] The #132 block is stated in the plugins table, not the marketplaces table**
- **Found during:** Task 3
- **Issue:** The acceptance grep expects `the result lists these marketplaces` in `cross-scope-install.feature`, but that step fails on any block with plugin rows (`marketplaceRowRecords`), and the install's own block always has them. The plan forbids step-definition changes.
- **Fix:** The scenario states all three records in `the result lists these plugins:`, which yields one record with marketplace fields only for a bare block (`pluginRecords`), so the `tools` block, its order, and its `marketplace clone note`/`marketplace clone url` cells are still compared whole. The grep for the marketplaces step stays 0; `marketplace clone note` appears in the new scenario.
- **Files modified:** `features/plugin/cross-scope-install.feature`
- **Committed in:** 70dcea1

**4. [Rule 2] The planning and failed-move projections also append the #132 blocks**
- **Found during:** Task 3
- **Issue:** The plan names the installed, disable-cascade-failed, promoted, standalone failure, and cascade failure blocks; a planning-run refusal and a failed move are reported by the dependency ledger's projections, which would have dropped the carried adds' notes.
- **Fix:** `installAfterMoves` passes `addedMarketplaceNames(carried)` to both; `install-flow-planning.ts` and `install-flow-dependency-ledger.ts` were touched again (both in files_modified).
- **Committed in:** 70dcea1

**Total deviations:** 4 auto-fixed (1 bug, 2 missing critical, 1 blocking). **Impact:** all inside the plan's file list; no notification type, step definition, or shared artifact changed.

## Issues Encountered

- The first Task 1 commit attempt lost ESLint to the kernel's OOM killer (four executors share one memory limit); the retry passed. The first Task 2 attempt failed lint on an import order (`import-x/order`), fixed with `eslint --fix`.
- `node_modules/.cache/optional-peers` was empty in this worktree; `node scripts/install-test-peers.mjs` (the project's own step, which `test:cucumber:profile` also runs) filled it.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-65: each row reads only its own `<plugin>@<marketplace>` key through `withCloneNote`. T-04-66: an extra block reads only the note kept under its marketplace's name, and the unit case pins two added marketplaces with different notes (`kit`, `tools`) plus a plugin-key note (`lib@plain`) that no block picks up. T-04-67: rebaseline audit above. T-04-SC: no package added.

## Orchestrator actions

No `gsd-tools windows append` is needed: no stub, skipped test, or unrun verify was left. This plan closes the `[system-git]` WINDOWS entries #130 (for the standalone install; apply's and import's rows are 04-24's), #131, and #132 in code. The orchestrator closes them in the ledger after the wave merges.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

04-22, 04-23, and 04-24 share no file with this plan. The wave gate runs `npm run check` on the merged tree.

## Self-Check: PASSED

- All 16 modified files exist; commits 80ba44a, e9a8634, 70dcea1 are ancestors of HEAD (`git rev-list --count 913c3b9..HEAD` = 3 before this SUMMARY commit).

---
*Phase: 04-ssh-sources-and-transport-selection*
*Completed: 2026-11-26*
