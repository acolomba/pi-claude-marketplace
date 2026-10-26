---
phase: 08-marketplace-help-and-usage-errors
plan: "05"
subsystem: edge
tags: [cucumber, plugin, usage-errors, update, fetch, reinstall, changelog]
status: complete

requires:
  - phase: 08-marketplace-help-and-usage-errors
    provides: "08-04: parsePluginRef in edge/handlers/plugin/shared.ts and the partly malformed reference Outline that pins `foo@` on update, fetch, and reinstall"
provides:
  - "parsePluginTarget(ref, ctx, run, usage) and PluginCommandTarget in edge/handlers/plugin/shared.ts: the one target parser of update, fetch, and reinstall"
  - "update '', fetch '', and reinstall '' report `Plugin name must not be empty.`"
  - "update @, fetch @, reinstall @, and reinstall '@   ' report `Marketplace name must not be empty.`"
  - "The completed empty-argument CHANGELOG bullet"
  - "A cucumber review of the phase's three feature files and a green phase gate"
affects: [phase verification, code review of phase 8]

actuals:
  tokens: 7540
  tasks: 3
  commits: 3
plan_head_before: ebbf6df3cfce787d557c93f82ac1f9997fe7e2a5
plan_head_after: 427f4fdf0036edbc174e6ce7b13306b2a98124f1

tech-stack:
  added: []
  patterns:
    - "One exported target parser per verb family: the optional `[<plugin>@<marketplace> | @<marketplace>]` target of three verbs maps through parsePluginTarget, which sends the plugin form through parsePluginRef"

key-files:
  created:
    - .planning/phases/08-marketplace-help-and-usage-errors/08-05-RED.json
  modified:
    - extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/fetch.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts
    - tests/edge/handlers/plugin/shared.test.ts
    - tests/edge/handlers/plugin/update.test.ts
    - tests/edge/handlers/plugin/fetch.test.ts
    - tests/edge/handlers/plugin/reinstall.test.ts
    - features/plugin/usage-errors.feature
    - CHANGELOG.md

key-decisions:
  - "An `@` followed only by blanks is the marketplace form with an empty name, so `reinstall '@   '` reports `Marketplace name must not be empty.` instead of reaching the workflow with a blank marketplace name"
  - "`foo@` keeps the invalid-reference message on update, fetch, and reinstall; the partly malformed Outline from 08-04 stays green"
  - "parsePluginTarget returns its own PluginCommandTarget union, structurally equal to UpdatePluginsTarget, FetchTarget, and ReinstallPluginsTarget, so the edge helper imports no orchestrator type"

patterns-established:
  - "Marketplace form before reference split: a leading `@` is always the marketplace form, and its name is checked for `trim() === \"\"` before any orchestrator call"

requirements-completed: [USE-07]

coverage:
  - id: D1
    description: "update '', fetch '', and reinstall '' report `Plugin name must not be empty.` as one usage-error payload with the verb's own usage line"
    requirement: USE-07
    verification:
      - kind: integration
        ref: "features/plugin/usage-errors.feature#An empty plugin reference is rejected as an empty plugin name (rows #1.8 to #1.10)"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/{update,fetch,reinstall}.test.ts#the empty-reference rows"
        status: pass
    human_judgment: false
  - id: D2
    description: "update @, fetch @, reinstall @, and reinstall '@   ' report `Marketplace name must not be empty.` and never reach a workflow"
    requirement: USE-07
    verification:
      - kind: integration
        ref: "features/plugin/usage-errors.feature#An @ with no marketplace name is rejected as an empty marketplace name (4 rows)"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/{update,fetch,reinstall}.test.ts#the lone-separator rows and reinstall's blank-marketplace row"
        status: pass
    human_judgment: false
  - id: D3
    description: "parsePluginTarget maps no reference, `@<marketplace>`, and `<plugin>@<marketplace>`, and rejects `@`, `@   `, an empty reference, and `alpha@`"
    requirement: USE-07
    verification:
      - kind: unit
        ref: "tests/edge/handlers/plugin/shared.test.ts#parsePluginTarget (7 cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The CHANGELOG empty-argument bullet covers every plugin command"
    verification:
      - kind: other
        ref: "SKIP=npm-check pre-commit run --files CHANGELOG.md"
        status: pass
    human_judgment: true
    rationale: "Reader-facing wording; no test asserts that the prose is clear"
  - id: D5
    description: "The combined tree passes npm run check and the fallow audit against 779eeced passes"
    verification:
      - kind: other
        ref: "npm run check (exit 0 at 427f4fdf)"
        status: pass
      - kind: other
        ref: "npx fallow audit --base 779eeced (verdict pass)"
        status: pass
    human_judgment: false

duration: 12 min
completed: 2026-10-20
---

# Phase 8 Plan 05: Name an empty update, fetch, or reinstall target Summary

**`update`, `fetch`, and `reinstall` now report `Plugin name must not be empty.` for an empty target and `Marketplace name must not be empty.` for an `@` with no name or only blanks after it. One exported `parsePluginTarget` replaces the three copies of the target logic. The CHANGELOG bullet covers every plugin command, a cucumber review of the phase's feature files found one wording issue, and the phase gate passed.**

## Performance

- **Duration:** about 12 min
- **Started:** 2026-10-20T13:13:22Z
- **Completed:** 2026-10-20T13:25:05Z
- **Tasks:** 3
- **Files modified:** 10, plus the new `08-05-RED.json`

## Accomplishments

- `parsePluginTarget(ref, ctx, run, usage)` and `PluginCommandTarget` in `edge/handlers/plugin/shared.ts`. No reference gives `{ kind: "all" }`. A reference that starts with `@` is the marketplace form: an empty or blank name gets `Marketplace name must not be empty.`. Any other reference goes through `parsePluginRef`, so an empty one gets `Plugin name must not be empty.` and an unsplittable one gets the invalid-reference message.
- `update.ts`, `fetch.ts`, and `reinstall.ts` each call `parsePluginTarget` once. `toFetchTarget`, `parseTarget`, and the inline block in `update.ts` are gone, with the imports only they used. `splitPluginMarketplaceRef` is now private to `shared.ts`.
- Real-Pi scenarios: three new rows (`update ''`, `fetch ''`, `reinstall ''`) in the empty-reference Outline, and the new four-row Outline `An @ with no marketplace name is rejected as an empty marketplace name`.
- Unit owners: a `parsePluginTarget` block in `shared.test.ts` (three accepted forms, four rejections). The two accepted `splitPluginMarketplaceRef` cases moved into `parsePluginRef` as rows of one loop, and the `splitPluginMarketplaceRef` block was deleted. Its rejection rows (`alpha`, `@official`, `alpha@`, `@`, `""`) are all rows of the `parsePluginRef` rejection loop. In `update.test.ts` and `fetch.test.ts`, the lone-separator row expects the marketplace-name sentence, a new `'""'` row expects the plugin-name sentence, and each loop has a title that fits every row. In `reinstall.test.ts`, the malformed loop carries one sentence per row and has a new `'@   '` row, and the empty-target loop expects the plugin-name sentence.
- CHANGELOG: the empty-argument bullet now has two sub-bullets covering every plugin command and plugin `list ""`.

## Task Commits

1. **Task 1: Name an empty update, fetch, or reinstall target through one shared target parser** - `101d89aa` (fix)
2. **Task 2: Complete the empty-argument CHANGELOG bullet** - `7965bc7b` (docs)
3. **Task 3: Review the phase's feature files and run the phase gate** - `427f4fdf` (test)

The tracer gate after Task 1 ran its cucumber `<verify>` again on the committed tree (`21 scenarios (21 passed)`) before Task 2 started.

## RED Evidence (before the fix)

- **Precondition:** `git diff --quiet 124f2311 -- update.ts fetch.ts reinstall.ts` exited 0.
- **Cucumber:** `npm run --silent test:cucumber -- features/plugin/usage-errors.feature --parallel 1 --name '^(An empty plugin reference is rejected as an empty plugin name|An @ with no marketplace name is rejected as an empty marketplace name)$' --format summary --format junit:<scratch>/08-05-red.xml` exited 1 with `14 scenarios (7 passed, 7 failed)`, `56 steps (49 passed, 7 failed)`.
  - Rows `#1.1` to `#1.7` of the empty-reference Outline passed.
  - Rows `#1.8` (`update ''`), `#1.9` (`fetch ''`), and `#1.10` (`reinstall ''`) failed only at `Then the result has these fields:`, on the `message` row alone: `Invalid <plugin>@<marketplace> ref: "".`.
  - Rows `#1.1` (`update @`), `#1.2` (`fetch @`), and `#1.3` (`reinstall @`) of the new Outline failed only on `message`: `Invalid <plugin>@<marketplace> ref: "@".`.
  - Row `#1.4` (`reinstall '@   '`) failed at the same step because the command reached the reinstall workflow: the payload was `kind marketplace-not-added` for a marketplace named `"   "`, with no message or usage.
- **Classifier:** `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`) for all seven targets, each in its own temporary copy inside the phase directory. No copy remains. Recorded in `08-05-RED.json` (base commit `ebbf6df3`, whose `fetch.ts` still holds `toFetchTarget`).
- **Unit:** `node --test` on the `shared`, `update`, `fetch`, and `reinstall` owners exited 1 with 100 tests, 89 passed, 11 failed:
  - Load failure: `tests/edge/handlers/plugin/shared.test.ts` (`does not provide an export named 'parsePluginTarget'`), so none of its cases ran.
  - Assertion failures: the lone-separator and empty-reference rows of `update.test.ts` (2) and `fetch.test.ts` (2), the lone-separator and blank-marketplace rows of the `reinstall.test.ts` malformed loop (2), and the four rows of its empty-target loop (4).
- **Semantic assessment:** every target failed on the planned assertion for the intended reason. There was no setup, load, or unrelated failure in the scenarios.

The tests landed with the fix in one commit (`101d89aa`). No red tree was committed.

## Cucumber Review

The review covered `features/marketplace/help.feature`, `features/marketplace/usage-errors.feature`, and `features/plugin/usage-errors.feature` against the cucumber skill's `features.md`, `layout.md`, and `steps.md`.

- **Would a plausible wrong implementation pass?** No. Every scenario compares the whole result with `the result has these fields:`: kind, severity, needs reload, message, and usage. Any extra or different field fails the step, as the RED run of `reinstall '@   '` showed. Every Outline has three or more rows. Each row checks one verb's own usage line, so a verb that printed another verb's usage fails.
- **Can a reader understand each scenario without a step definition?** Yes. Each title names the behavior. Each step is a command the user types or a result field the user sees.
- **Rules checked:** sentence-case titles, lower-case steps, only `When`/`Then`, untagged `Examples:`, placeholder columns `arguments`, `message`, `usage`, and `value` (none named `name`, `source`, `plugin`, or `marketplace`), aligned tables, and a two-line description under each title.

| # | Class | Finding | Fix |
| --- | --- | --- | --- |
| 1 | WARNING | The `features/plugin/usage-errors.feature` description said each plugin command rejects "an empty or malformed reference". It also holds the plugin `list ''` scenario and the empty marketplace-name Outline, so the description no longer named everything the file proves. | It now says "an empty or malformed plugin reference or marketplace name" (`427f4fdf`). |

No BLOCKER was found, and no finding is open. The review changed no row, so the counts are as planned: 5 (help), 51 (marketplace usage errors), and 21 (plugin usage errors), 77 in all. `npm run test:cucumber -- <the three files> --parallel 1` exited 0 with `77 scenarios (77 passed)`, `308 steps (308 passed)`, and `npm run check:features` exited 0.

## Phase Gate

| Field | Value |
| --- | --- |
| Command | `npm run check` (foreground, output to a log file, `$?` read directly) |
| Exit status | 0, on the first run (no rerun) |
| Duration | 105 s |
| Commit | `427f4fdf0036edbc174e6ce7b13306b2a98124f1` |
| Node | `v26.11.1` |
| Scope | Combined tree of all five phase-8 plans on `features/cucumber-behavioral-tests`; static checks (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features), unpaired tests, integration, the whole cucumber suite (`311 scenarios (311 passed)`, `2827 steps (2827 passed)`), and direct coverage of every pair (`Merged LCOV: coverage/direct.lcov (280 records)`) |

**Fallow audit:** `npx fallow audit --base 779eeced --format json --quiet | node -e '...'` printed `fallow audit verdict: pass` and exited 0.

The SUMMARY commit changes only planning Markdown and the RED JSON, so the gate result above holds for it (`.agents/skills/local-verification/rules/gates.md`).

## Verification Evidence

Node `v26.11.1`, run on this worktree. The cucumber harness sandboxes HOME, the agent directory, and the project. The unit owners use `createHermeticEnvironment`.

| Command | Tree | Exit | Result |
| --- | --- | --- | --- |
| `npm run test:cucumber -- features/plugin/usage-errors.feature --parallel 1` | before `101d89aa` (same content) and after it | 0 | `21 scenarios (21 passed)`, `84 steps (84 passed)` |
| `node --test` on plugin `shared`, `update`, `fetch`, `reinstall`, `install`, `info`, `list`, `uninstall`, `enable-disable`, and `register` | before `101d89aa` (same content) | 0 | 591 tests, 591 pass, 0 fail |
| `npm run test:coverage:direct --` the four changed sources | same | 0 | no coverage shortfall reported |
| `npx tsc --noEmit -p .` | same | 0 | clean |
| `npx eslint --max-warnings 0` on the eight changed `.ts` files | same | 0 | clean |
| `npx fallow dupes --format json` | same | 0 | 23 clone groups, none naming a changed file |
| `SKIP=npm-check pre-commit run --files <task files>` | all three tasks | 0 | all hooks passed |
| commit hook `npm run check:commit` | `101d89aa`, `427f4fdf` | 0 | Passed (skipped for `7965bc7b`, which stages no build input) |
| `npm run test:cucumber --` the three phase feature files `--parallel 1` | `427f4fdf` | 0 | `77 scenarios (77 passed)` |
| `npm run check` | `427f4fdf` | 0 | see Phase Gate |

Acceptance checks, all passing:

- Task 1: `export function parsePluginTarget` and `export type PluginCommandTarget` each grep 1 in `shared.ts`. `parsePluginTarget(nonFlagPositionals[0], ctx, run, USAGE)` greps 1 in each of `update.ts` and `fetch.ts`, and `parsePluginTarget(refs[0], ctx, run, USAGE)` greps 1 in `reinstall.ts`. `function toFetchTarget` and `function parseTarget` each grep 0. `Invalid <plugin>@<marketplace> ref` appears only in `shared.ts`. `^export function splitPluginMarketplaceRef` greps 0. `^// Target parsing is private.` greps 0 and `parsePluginTarget` greps 1 in `fetch.test.ts`.
- Task 2: 13 top-level `[Unreleased]` bullets. `Plugin name must not be empty.` greps 1 and `Marketplace name must not be empty.` greps 3. The empty-argument bullet has two sub-bullets, of 31 and 16 words.
- Task 3: `grep -rln 'Argument must not be empty' extensions tests features docs` prints nothing. The `TOP_LEVEL_USAGE` block of `router.ts` and the `EXPECTED_TOP_LEVEL_USAGE` block of `tests/edge/router.test.ts` (18 lines each) are the same as at `779eeced`. `Unknown option: ` greps 1 in plugin `list.ts`. `git diff --quiet 779eeced -- docs/output-catalog.md docs/json-output.md tests/architecture/catalog-uat/ cucumber.json` exits 0. `git status --short -- extensions tests features docs CHANGELOG.md` prints nothing.

## Known Edge Behaviors (not pinned)

08-RESEARCH.md records these outside the requirements. This phase does not pin or change them:

- A repeated `--local` is accepted (`autoupdate --local --local`).
- A repeated `--scope` keeps the last value (`list --scope user --scope project`).
- A short option such as `-x` reads as a positional: `add -x` tries the source `-x`, `info -x` reports not added, and `list -x` reports `Too many arguments.`.

## Files Created/Modified

- `extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts` - `PluginCommandTarget`, `parsePluginTarget` with its JSDoc, and a private `splitPluginMarketplaceRef`
- `extensions/pi-claude-marketplace/edge/handlers/plugin/{update,fetch,reinstall}.ts` - each calls `parsePluginTarget`; the private target mappers and their imports are gone
- `tests/edge/handlers/plugin/shared.test.ts` - the `parsePluginTarget` block, `FETCH_USAGE`, the moved accepted rows, and no `splitPluginMarketplaceRef` block
- `tests/edge/handlers/plugin/{update,fetch,reinstall}.test.ts` - the changed and new rows, retitled loops, and corrected comments
- `features/plugin/usage-errors.feature` - three Outline rows, the empty marketplace-name Outline, and the review's description fix
- `CHANGELOG.md` - the completed empty-argument bullet
- `.planning/phases/08-marketplace-help-and-usage-errors/08-05-RED.json` - the RED run before the fix

## Decisions Made

- The decisions the plan states, as planned: `'@   '` is the marketplace form with an empty name, `foo@` keeps the invalid-reference message, and the shared parser is one exported helper.
- `parsePluginTarget` declares its own `PluginCommandTarget` union. TypeScript accepts it where each orchestrator expects its target type, so the plugin helper module needs no orchestrator import.
- The data-row title of the accepted `parsePluginTarget` loop uses a `supplied` field (`no target`, `the target "@mp"`), so the no-reference row does not print `undefined` in its title.

## Deviations from Plan

**1. [Rule 2 - Test quality] The reinstall owner's opening sentence named only a named marketplace form**
- **Found during:** Task 1
- **Issue:** The header said "a leading separator followed by a name is the marketplace form, and anything else is split into a plugin reference". After the fix, a lone `@` is not split; it is the marketplace form with an empty name.
- **Fix:** It now says "a leading separator is the marketplace form, and anything else is split into a plugin reference". The bullet the plan named now says that an empty or blank name is rejected.
- **Files modified:** `tests/edge/handlers/plugin/reinstall.test.ts`
- **Committed in:** `101d89aa`

**2. [Rule 2 - Test quality] The fetch owner's header kept a long line after the planned sentence change**
- **Found during:** Task 1
- **Issue:** Replacing the first sentence left the rest of the paragraph on one line longer than the file's wrap width.
- **Fix:** The paragraph is rewrapped. Its wording is unchanged.
- **Committed in:** `101d89aa`

**Total deviations:** 2 (both comment corrections inside planned files). **Impact:** none on the production change or the scenarios.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

All five plans of phase 8 are done. The phase is ready for its code review and verification. USE-07 is complete now that 08-03, 08-04, and 08-05 have summaries.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
- FOUND: features/plugin/usage-errors.feature
- FOUND: .planning/phases/08-marketplace-help-and-usage-errors/08-05-RED.json
- FOUND: 101d89aa
- FOUND: 7965bc7b
- FOUND: 427f4fdf
