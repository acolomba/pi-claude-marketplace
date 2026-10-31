---
phase: 01-suite-foundation
fixed_at: 2026-10-15T23:30:00Z
review_path: .planning/phases/01-suite-foundation/01-REVIEW.md
iteration: 2
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-10-15T23:30:00Z
**Source review:** .planning/phases/01-suite-foundation/01-REVIEW.md
**Iteration:** 2

**Summary:**

- Findings in scope: 4 (1 critical, 3 warning; fix scope `critical_warning`, so IN-01..IN-10 are out of scope)
- Fixed: 4
- Skipped: 0

**Where verification ran:** in the main checkout (`/home/acolomba/src/pi-claude-marketplace-cucumber-behavioral-tests`, branch `features/cucumber-behavioral-tests`). No worktree was used, because the orchestrator asked for sequential work on the main tree. Each code commit passed the pre-commit hook (`npm run check:commit`, which includes `check:features`). The WR-03 commit changed only a skill file, so the hook skipped `npm-check` for it. After the last commit, these passed: `npm run test:cucumber` (26 scenarios, 206 steps), `CI=1 npm run check:features` (30 scenarios, 17 step definitions), and `npm run lint`. The full `npm run check` was not run.

Commit messages follow `.agents/skills/committing/SKILL.md`: Conventional Commits with no phase scope, not the `fix(01): ...` template.

## Fixed Issues

### CR-01: The INFO-01 title claims the autoupdate state, but the scenario checks only the default

**Files modified:** `features/marketplace/info.feature`
**Commit:** 9e81b6a3
**Applied fix:** The scenario is now titled "Info on a directory marketplace shows its absolute path and the default autoupdate state". No `autoupdate` command was added, because showing a changed setting in list and info is AU-05, which the autoupdate verb phase owns. The `~/marketplaces/tools` input and the `{home}/marketplaces/tools` expectation are unchanged (the D-04 exception). Three historical planning records still quote the old title: `01-01-PLAN.md`, `01-01-SUMMARY.md`, and `01-VALIDATION.md`. They were left unchanged, as in iteration 1.

### WR-01: The uncompared-rows check makes `Then` steps write to the world, which `steps.md` forbids

**Files modified:** `features/support/world.ts`, `features/step_definitions/command.steps.ts`, `.agents/skills/cucumber/rules/steps.md`, `.agents/skills/cucumber/rules/world-and-stand-ins.md`
**Commit:** 0c035116
**Applied fix:** `ScenarioWorld.markRowsCompared()` is now the one place a `Then` writes to the world. The three row steps call it in place of `this.uncomparedRows = []`. `steps.md` keeps "A `Then` has no side effects", and adds one exception: a step that compares the row arrays calls `this.markRowsCompared()` after its comparison. It also says no `Then` writes to the world in any other way. `world-and-stand-ins.md` names the method. The uncompared-rows check works as before. Planted once: with the body of `markRowsCompared()` emptied, 17 of 26 scenarios failed with "no step compared these rows of the last results". Restored from a copy.

### WR-02: A local alias of `Given` still registers a regular-expression step, and no gate catches it

**Files modified:** `scripts/check-features.mjs`, `eslint.config.js`, `.agents/skills/cucumber/rules/steps.md`
**Commit:** b0ae9c12
**Applied fix:** The new `patternFindings()` in the feature gate reports every step definition whose `pattern.type` is not `CUCUMBER_EXPRESSION`. It reads the registered pattern, so it does not depend on the name of the function that registered the step. Step modules now also ban imports of `Before`, `After`, `BeforeAll`, `AfterAll`, `BeforeStep`, `AfterStep`, `defineParameterType`, `setWorldConstructor`, `setDefaultTimeout`, `setDefinitionFunctionWrapper`, and `setParallelCanAssign`. This is a second `paths` entry with its own message, and ESLint reports both entries. `steps.md` and the ESLint block comment now say that the gate catches what the name-based lint misses. Planted once: a temporary `features/step_definitions/planted.steps.ts` with `const step = Given; step(/^the (.*) thing$/, ...)`, a `defineStep` call, and an `After` import. ESLint reported the `After` and `defineStep` imports. The gate reported "step text is not a Cucumber expression" for the alias line, plus the unused findings, and failed. The file was deleted.

### WR-03: The skill's Outline example still teaches the report-only scenario that WR-01 called out

**Files modified:** `.agents/skills/cucumber/rules/features.md`
**Commit:** 9a056f3d
**Applied fix:** The "Source kinds" example now includes the same `Then the "claude-plugins.json" file of the project scope declares these marketplaces:` check as `add.feature`, with `| tools | <source> |`. Its title "records it in the chosen scope" now matches what the example checks.

## Iteration 1 history

Iteration 1 fixed all 9 in-scope findings, in commits `01aa3696..2eb257aa`:

- CR-01 (`01aa3696`): the bare-update scenario was retitled to what it proves, one result per marketplace of both scopes, project first.
- CR-02 (`6afb83a5`): INFO-01 types `~/marketplaces/tools` and expects `{home}/marketplaces/tools`, so an info that echoes the typed source fails.
- WR-01 (`b4141776`): the add Outline also checks `claude-plugins.json`, and the new-session Outline gained its `@github` block.
- WR-02 (`78edbf69`): row arrays that no step compared fail the scenario, in `After()` or at the next `When the user runs`.
- WR-03 (`a489abee`): `fieldRecord()` builds every record and throws on a repeated column.
- WR-04 (`00cfd2eb`): the gate checks each Examples row's source kind against its block's tag.
- WR-05 (`a2e4e22a`): step modules ban `defineStep`, renamed imports, and namespace imports. Support modules ban the step functions.
- WR-06 (`53a31a43`): a marketplace is published once, with its kind stated, before it offers plugins.
- WR-07 (`2eb257aa`): the feature gate awaits `main()` at the top level, so a crash prints its stack.

---

_Fixed: 2026-10-15T23:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
