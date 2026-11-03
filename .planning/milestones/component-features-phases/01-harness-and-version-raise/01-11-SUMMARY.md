---
phase: 01-harness-and-version-raise
plan: 11
subsystem: resolver
tags: [component-paths, resolver, install, update, info, cucumber, D-CF1-06]

requires:
  - phase: 01-harness-and-version-raise
    provides: "01-15 version lines in docs/workflows-compatibility.md (edited after them)"
provides:
  - "Per-kind conventional-folder rule in domain/component-paths.ts (conventionalFolderApplies): a declared commands/agents/workflows path replaces its folder; skills unions"
  - "ComponentPathResolution.shadowedFolders and MaterializableFields.shadowedFolders (optional), copied by materializableFields"
  - "shadowedFolderWarning(kind) and the discovery warning on the install ledger (install, enable, import, apply) and the update swap (update, reinstall)"
  - "info's lenient component map follows the same rule"
  - "Generic Given: the published plugin {string} of the marketplace {string} has the file {string} with this text:"
  - "features/plugin/component-directories.feature (2 scenarios) and 2 new staging-warnings scenarios"
affects: [03-slash-commands, 04-agents, 07-workflows]

actuals:
  tokens: 13200   # chars/4 over the realized diff (52742 chars)
  tasks: 3
  commits: 3
plan_head_before: 9a815c57e5be80e7c6c7ca4df70dbebe7f7bb60c
plan_head_after: de826cd29be0914643d66e3a9fa93e4956644aa0

tech-stack:
  added: []
  patterns:
    - "A resolver fact that a staging verb must report travels as an optional field on the materializable arms, created only when non-empty, and each staging path turns it into a discovery warning"

key-files:
  created:
    - features/plugin/component-directories.feature
  modified:
    - extensions/pi-claude-marketplace/domain/component-paths.ts
    - extensions/pi-claude-marketplace/domain/resolver-types.ts
    - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - features/step_definitions/plugin/publishing.steps.ts
    - features/plugin/staging-warnings.feature
    - docs/workflows-compatibility.md
    - test/domain/component-paths.test.ts
    - test/domain/plugin-resolver.test.ts
    - test/domain/resolver-types.test.ts
    - test/orchestrators/plugin/install-outcome.test.ts
    - test/orchestrators/plugin/update-swap.test.ts
    - test/orchestrators/plugin/info.test.ts
    - test/orchestrators/plugin/install-flow-ledger.test.ts
    - test/orchestrators/plugin/reinstall-flow.test.ts
    - test/orchestrators/plugin/update-flow.test.ts
    - test/architecture/declared-component-path-overlap.test.ts

key-decisions:
  - "The shadowed-folder test is upstream lKn exactly: a declared path suppresses the warning only when it equals the conventional folder or lies inside it. A declared `.` (plugin root) still records the folder, against the plan's behavior bullet."
  - "An empty-string component declaration declares nothing (like null) in both the strict resolver and info's lenient map, matching Claude Code's truthiness check; before, `\"\"` resolved to the plugin root."
  - "Union-pinning fixtures outside files_modified (three orchestrator tests and one architecture test) were rewritten to the replace rule, as the plan's must-have requires."
  - "The second lenient seed in info.ts (non-path warm tree) was left unchanged: it reads no entry declarations at all, so it does not seed the way deriveLenientComponentPaths does."

patterns-established:
  - "Generic plugin-file Given for any later scenario that needs a custom plugin.json or component file"

requirements-completed: [DEC-01]

coverage:
  - id: D1
    description: "A declared commands, agents, or workflows path replaces the conventional folder; a declared skills path adds to skills/; [] leaves the folder unread; \"\" and null read it."
    requirement: DEC-01
    verification:
      - kind: unit
        ref: "test/domain/component-paths.test.ts#D-CF1-06 rows; test/domain/plugin-resolver.test.ts#D-CF1-06 a manifest-declared <kind> path replaces the existing <kind>/ folder"
        status: pass
      - kind: e2e
        ref: "npx cucumber-js features/plugin/component-directories.feature"
        status: pass
    human_judgment: false
  - id: D2
    description: "Install and update show `Default commands/ folder is ignored because the manifest sets \"commands\"` in the plugin's staging diagnostic when a declaration leaves the folder unread."
    requirement: DEC-01
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/install-outcome.test.ts#D-CF1-06; test/orchestrators/plugin/update-swap.test.ts#D-CF1-06"
        status: pass
      - kind: e2e
        ref: "npx cucumber-js features/plugin/staging-warnings.feature --name commands"
        status: pass
    human_judgment: false
  - id: D3
    description: "info's lenient map for an unavailable plugin lists only a declared workflows directory."
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/info.test.ts#WFLW-04 / D-CF1-06"
        status: pass
    human_judgment: false
  - id: D4
    description: "docs/workflows-compatibility.md rows and paragraph state the replace rule and the warning."
    verification:
      - kind: other
        ref: "SKIP=npm-check pre-commit run --files docs/workflows-compatibility.md; grep -c 'Pi UNIONs the declared paths' -> 0"
        status: pass
    human_judgment: false

duration: 75min
completed: 2026-11-01
status: complete
---

# Phase 1 Plan 11: Declared component paths replace their folder Summary

**A declared `commands`, `agents`, or `workflows` path now replaces the conventional folder as in Claude Code 2.1.316, `skills` still unions, and install, enable, import, apply, update, and reinstall warn `Default <kind>/ folder is ignored because the manifest sets "<kind>"` when a declaration leaves an existing folder unread.**

## Performance

- **Duration:** about 75 min
- **Started:** 2026-11-01T02:30Z (approximate)
- **Completed:** 2026-11-01T03:47:28Z
- **Tasks:** 3
- **Files modified:** 20 (1 created)

## Accomplishments

- `conventionalFolderApplies(kind, entryRaw, manifestRaw)` in `domain/component-paths.ts`: `skills/` is always read; `commands/`, `agents/`, `workflows/` only when both raw declarations are falsy (D-CF1-06).
- `shadowedFolders` recorded on the resolution, carried on both materializable arms, and turned into one discovery warning per kind by the install ledger (`install-outcome.ts`, so a failed install keeps it) and the update swap (`update-swap.ts`, before the bridges' warnings).
- `deriveLenientComponentPaths` in `info.ts` follows the same rule.
- Cucumber: `component-directories.feature` (commands replace, skills add) and two `staging-warnings.feature` scenarios (install, update), plus the generic plugin-file `Given`.

## Task Commits

1. **Task 1: A declared commands path replaces the commands folder, end to end through info** - `e5bc40d` (feat)
2. **Task 2: Warn on every staging verb when a declaration leaves a folder unread** - `0b88cc8` (feat)
3. **Task 3: Apply the rule to info's lenient map and correct the workflows rows** - `de826cd` (feat)

Each task is one commit holding its tests and implementation: the commit hook runs direct coverage for staged pairs, so a red-only test commit cannot pass it. The red runs are recorded below.

## TDD evidence (RED, then GREEN)

- **Task 1, cucumber:** `features/plugin/component-directories.feature` against the union code: scenario "A declared commands path replaces the commands folder" failed on `plugin components commands`: actual `hello, old`, expected `hello`. 2 scenarios, 1 failed, 1 passed. The skills scenario passes on both trees, as it should: skills keep the union. Semantic assessment: the target failed on the planned assertion (the conventional command was listed).
- **Task 1, unit:** `node --test test/domain/component-paths.test.ts`: 12 failures, all of them the new D-CF1-06 replace rows (entry, manifest, `[]`, and `""` for each of commands, agents, and workflows) failing on the whole-resolution `deepStrictEqual`; `plugin-resolver.test.ts`: the 3 new replace cases failed the same way. TAP saved at `/tmp/claude-0/-home-user-pi-claude-marketplace/100a262e-8092-4329-93e1-ed0a34bcc396/scratchpad/agent-01-11/red-task1-unit.tap`.
- **Task 2, unit:** 12 failures in `component-paths.test.ts` (the shadowing rows, `.` on agents, kind order, `shadowedFolderWarning` missing); the install-outcome and update-swap D-CF1-06 cases failed on the missing warning (deepStrictEqual diff).
- **Task 2, cucumber:** both new staging-warnings scenarios run with the resolver change but with the HEAD `install-outcome.ts` and `update-swap.ts`: 2 scenarios, 2 failed. The results had the cascade row and no diagnostic row.
- **Task 3, unit:** the rewritten WFLW-04 case failed: actual `workflows: alpha:extra, alpha:zeta`, expected `workflows: alpha:extra`.
- **GREEN:** all of the above pass. Direct coverage is 100% for `component-paths.ts`, `plugin-resolver.ts`, `install-outcome.ts`, `update-swap.ts`, and `info.ts`. `npm run test:modules` and `npm run test:integration` pass (run with the non-DAC shell). `npm run test:cucumber -- features/plugin` passes (662 scenarios). `npm run check:features` passes. Every commit hook (`check:commit`, which includes `check:static`) passed.

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/component-paths.ts`: the per-kind rule, `shadowedFolders`, `shadowedFolderWarning`, and `""` as no declaration.
- `extensions/pi-claude-marketplace/domain/resolver-types.ts`, `domain/plugin-resolver.ts`: optional `shadowedFolders` on the materializable arms.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts`, `update-swap.ts`: the shadowed-folder discovery warnings, and nothing else.
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`: the per-kind lenient map, and `""` as no declaration.
- `features/plugin/component-directories.feature`, `features/plugin/staging-warnings.feature`, `features/step_definitions/plugin/publishing.steps.ts`.
- `docs/workflows-compatibility.md`: rows 38-39 are ✓ on both sides, and the paragraph states the rule.
- Tests: listed in key-files.

## Decisions Made

See key-decisions in the frontmatter. Each is also listed under Dubious Choices below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Rewrote union-pinning tests outside files_modified**
- **Found during:** Task 1 (the full `test:modules` run and the commit hook)
- **Issue:** Ten PDEF-01 / D-PL1-13 cases in `install-flow-ledger.test.ts`, `reinstall-flow.test.ts`, and `update-flow.test.ts` declared `agents: ["declared-agents"]` and relied on the union to also stage `agents/`. The architecture case `declared-component-path-overlap.test.ts` pinned the union for a declared `./commands/git` beside `commands/top.md`.
- **Fix:** The PDEF-01 fixtures now declare both directories (`["declared-agents", "agents"]`), so they still test multi-directory staging under the replace rule. The overlap case now expects only the declared root's command, and its title and comment state D-CF1-06. The plan's must-have ("Every existing test that pinned the union for commands, agents, or workflows states the replace rule") requires this.
- **Files modified:** test/orchestrators/plugin/install-flow-ledger.test.ts, test/orchestrators/plugin/reinstall-flow.test.ts, test/orchestrators/plugin/update-flow.test.ts, test/architecture/declared-component-path-overlap.test.ts
- **Committed in:** e5bc40d

**2. [Rule 1 - Bug] An empty-string declaration resolved to the plugin root**
- **Found during:** Task 1
- **Issue:** `readPathOrArray("")` returned `[""]`, which validated to `.`. Under the new rule, `commands: ""` would have read both the plugin root and `commands/`, which the recursive commands walk would read twice. Claude Code loads a declared path only when the field is truthy.
- **Fix:** `""` now declares nothing, in `component-paths.ts` and in `info.ts`'s `asDeclaredList`.
- **Committed in:** e5bc40d, de826cd

**3. [Rule 1 - Lint] `sonarjs/no-nested-assignment` on `(x ??= []).push(kind)`**
- **Fix:** rewritten as a plain assignment; caught by the commit hook before the Task 2 commit landed.

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs/lint). **Impact:** the test rewrites are the plan's own must-have; the `""` change follows upstream. No scope creep into product files outside the plan.

## Issues Encountered

- The sandbox runs as root, so the chmod-based tests need the non-DAC shell (`npm_config_script_shell=.../nondac-sh`, or `nondac-sh -c "node --test ..."` for direct runs).

## CHANGELOG line for plan 01-09

- A plugin that declares a `commands`, `agents`, or `workflows` path no longer also loads the conventional folder, as in Claude Code, and install and update warn when the folder is left unread (`Default <kind>/ folder is ignored because the manifest sets "<kind>"`). A declared `skills` path still adds to `skills/`.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-01-16: every declared path still passes `resolveContainedComponentPath`, and the containment cases stay green. T-01-17: the discovery warning is proven for install and update by scenarios.

## Dubious Choices

1. **`.` declared path records the folder (upstream lKn), against the plan bullet.** The plan's Task 2 behavior says a declared `.` records nothing. Its own action text says to suppress only when a declared path "equals the folder or lies inside it (upstream `lKn`)", and the 2.1.316 binary does exactly that: `lKn` resolves each path with `yF` and tests `(S+sep).startsWith(folder+sep)`, so the plugin root does not suppress. I followed upstream. This also keeps the DEC-01 prohibition for agents and workflows: their walks do not recurse, so `agents: "."` really does leave `agents/` unread. Caveat: Pi's commands walk is recursive, so `commands: "."` does read `commands/` in Pi, and the warning is then stricter than what Pi loads. It matches what upstream prints.
2. **`""` declares nothing.** The old code read `""` as the plugin root. Changed for upstream truthiness parity (see deviation 2).
3. **Warning field text is always the bare kind** (`"commands"`), not upstream's `experimental.<kind>` / `"<kind>" and "experimental.<kind>"` variants. This project has no `experimental.*` component fields. Upstream's fix hint ("Remove ... from .claude-plugin/plugin.json ...") is not ported. The plan fixes the one-line text.
4. **The update swap adds the warning to the `updated` outcome only**, as planned. A failed update (phase-3 failure path and `onStagingWarnings`) does not carry it, unlike a failed install. The plan said to change nothing else in `update-swap.ts`.
5. **The second lenient seed in `info.ts`** (non-path source, warm tree) was left alone. It reads no declarations at all, so it still enumerates every conventional folder of an unavailable non-path plugin.
6. **No separate RED commits.** The hook's direct coverage run fails a commit that holds only failing tests, so each task is one commit; the red runs are recorded above.

## Next Phase Readiness

- Phases 3, 4, and 7 inherit the rule and can pin their own kind with the generic plugin-file step.
- Verifier note: the `.` case (Dubious Choice 1) is the one place this implementation departs from the plan's text.

## Self-Check: PASSED

- FOUND: features/plugin/component-directories.feature (2 `Scenario:` lines)
- FOUND: e5bc40d, 0b88cc8, de826cd on HEAD
- Acceptance greps: `D-CF1-06` in component-paths.ts = 6; `shadowedFolderWarning(` in install-outcome.ts = 1 and update-swap.ts = 1; `folder is ignored because the manifest sets` in staging-warnings.feature = 2; `Pi UNIONs the declared paths` in the doc = 0; the old WFLW-04 title = 0.

---
*Phase: 01-harness-and-version-raise*
*Completed: 2026-11-01*
