---
phase: 01-suite-foundation
plan: 02
subsystem: testing
tags: [cucumber, gherkin, eslint, gate, behavioral-tests]

requires:
  - phase: 01-suite-foundation (01-01)
    provides: "The widened payload driver and the 17-scenario suite the gate dry-runs"
provides:
  - "scripts/check-features.mjs: the usage gate (DRV-04) plus the layout and Gherkin gate, over a cucumber API dry run with the tag expression cleared (D-09)"
  - "check:features npm script, run by check:static (D-10)"
  - "cucumber.json default profile excludes @url and @github rows"
  - "ESLint blocks for features/step_definitions/**/*.steps.ts (no exports, literal Cucumber-expression step text) and features/lib/**/*.ts (no registration imports)"
affects: [01-03, 01-04, 01-05, marketplace verb phases, kind phases]

actuals:
  tokens: 4742
  tasks: 3
  commits: 3
plan_head_before: d5a4f51edd154cfb59e5702db1b88133bd32522a
plan_head_after: b3ca7647cdf2954062351a6a311d640a94b1c69b

tech-stack:
  added: []
  patterns:
    - "Gate verdicts come from the cucumber message stream (stepDefinition, pickle, testCase, gherkinDocument, parseError, undefinedParameterType), never from the run result's success flag"
    - "Findings print as `path:line: message (rule file)`; a finding with no line prints `path: message (rule file)`"

key-files:
  created:
    - scripts/check-features.mjs
  modified:
    - package.json
    - cucumber.json
    - eslint.config.js

key-decisions:
  - "Every gate message names the cucumber skill rule file that states the rule (steps.md, features.md, or layout.md)"
  - "An ambiguous-step finding names each matching definition by pattern and source location, since two ambiguous patterns are often textually identical"
  - "A finding with no source line (layout findings, run-level findings) prints `path: message` instead of `path:0: message`"
  - "The step-text selector requires a string literal first argument ([arguments.0.type!='Literal']), so a pattern held in a variable is rejected too; a separate selector names a regex literal"

patterns-established:
  - "scripts/check-features.mjs is the review check for unused steps; `npx cucumber-js --dry-run --format usage` now honors the @url/@github exclusion and is not a substitute"

requirements-completed: [DRV-04]

coverage:
  - id: D1
    description: "check:static fails on an unused, undefined, or ambiguous step in every row, excluded rows included, and on a parse error, an undefined parameter type, or a run that checked nothing"
    requirement: DRV-04
    verification:
      - kind: other
        ref: "CI=1 npm run check:features (Feature gate passed: 17 scenarios, 9 step definitions.)"
        status: pass
      - kind: other
        ref: "planted checks (a)-(d) and the parse error, recorded below (each failed as stated, reverted)"
        status: pass
      - kind: other
        ref: "commit hook check:commit (runs check:static, now including check:features) on 114a70b2, ba9e691d, b3ca7647"
        status: pass
    human_judgment: false
  - id: D2
    description: "The gate fails on each folded layout and Gherkin rule"
    verification:
      - kind: other
        ref: "npm run check:features on the tree (exit 0) and the fourteen planted checks recorded below (each failed, reverted)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ESLint rejects an export from a step module, non-literal or regex step text, and a registration import in features/lib"
    verification:
      - kind: other
        ref: "npm run lint (exit 0) and the four planted lint failures recorded below (reverted)"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-10-15
status: complete
---

# Phase 1 Plan 02: Feature Gate and Lint Blocks Summary

**`check:static` now runs `scripts/check-features.mjs`. The script dry-runs every scenario through the cucumber API with the tag exclusion cleared. It fails on an unused, undefined, or ambiguous step, and on any break of the cucumber skill's layout or Gherkin rules. Two ESLint blocks keep step modules export-free with literal Cucumber-expression step text, and keep `features/lib` from registering anything.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-10-15T19:44:32Z
- **Completed:** 2026-10-15T19:57:18Z
- **Tasks:** 3
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- `scripts/check-features.mjs` loads the default profile with `loadConfiguration`. It then clears `sources.tagExpression`, sets `order: "defined"`, `dryRun: true`, and `parallel: 0`, and runs `runCucumber` with stdout and stderr written to a discarding `Writable`. It collects the message stream and reports:
  - a definition that no test step uses, at its source line;
  - an undefined or ambiguous step, at the feature line of the Gherkin step, once per distinct path, line, and text;
  - every `parseError` and `undefinedParameterType`;
  - zero scenarios or zero step definitions as findings of their own.
- The same script walks `features/` and fails on these layout breaks:
  - an unexpected file;
  - a catch-all module or directory name (`common`, `shared`, `utils`, `helpers`, `support`, `misc`, `hooks`, `parameter-types`), with the top-level `features/support/` exempt;
  - a module beside a directory of its own name.
- It reads every `gherkinDocument`, recursing into `Rule:`, and fails on these Gherkin breaks:
  - a missing `Feature:`;
  - a title that does not kebab-case to `<function>-<capability>`;
  - an empty description;
  - a tag anywhere but an `Examples:` block, or any tag other than `@url` and `@github`;
  - a non-`Given` Background step;
  - `And`, `But`, or `*`;
  - upper-case step text outside quoted values;
  - `should`;
  - a `Given` after a `When` or `Then`;
  - a lower-case scenario title.
- `package.json` gains `check:features`, and `check:static` runs it. `cucumber.json` gains `"tags": "not @url and not @github"`.
- `eslint.config.js` has two new blocks directly after the global block:
  - `features/step_definitions/**/*.steps.ts` uses `no-restricted-syntax`: no exports, a string-literal first argument for `Given`/`When`/`Then`, and no regex literal;
  - `features/lib/**/*.ts` uses `no-restricted-imports`: none of the 13 registration names from `@cucumber/cucumber`.

## Task Commits

1. **Task 1: Fail check:static on an unused, undefined, or ambiguous step.** `114a70b2` (test). The hook's `check:commit` passed, and its `check:static` already ran `check:features`.
2. **Task 2: Check the layout and Gherkin rules mechanically.** `ba9e691d` (test). The hook's `check:commit` passed: lint, fallow health, and fallow dupes accept the script.
3. **Task 3: Lint step modules and feature libraries.** `b3ca7647` (test). The hook's `check:commit` passed.

## Files Created/Modified

- `scripts/check-features.mjs` (new, 468 lines): the usage, layout, and Gherkin gate.
- `package.json`: the `check:features` script; `check:static` runs it.
- `cucumber.json`: `"tags": "not @url and not @github"`.
- `eslint.config.js`: the step-module and feature-library blocks.

## Planted Checks (each run once by hand, then reverted; nothing planted was committed)

Task 1 (`npm run --silent check:features`, exit 1 unless stated):

- **(a) Undefined.** In install.feature line 14, `When the user runs` was changed to `When the user rnus`:
  ```
  features/plugin/install.feature:14: undefined step "the user rnus \"/claude:plugin install demo@fixtures --scope project\"" (.agents/skills/cucumber/rules/steps.md)
  Feature gate failed with 1 finding(s).
  ```
- **(b) Ambiguous.** A temporary `features/step_definitions/planted.steps.ts` registered a second `When("the user runs {string}", ...)`. That gave 14 findings, one per distinct `the user runs` line. The first:
  ```
  features/marketplace/help.feature:7: ambiguous step "the user runs \"/claude:plugin marketplace help\"", matched by "the user runs {string}" at features/step_definitions/command.steps.ts:102 and "the user runs {string}" at features/step_definitions/planted.steps.ts:3 (.agents/skills/cucumber/rules/steps.md)
  ...
  Feature gate failed with 14 finding(s).
  ```
- **(c) Unused.** A temporary `When("the user does nothing", ...)` was added:
  ```
  features/step_definitions/planted.steps.ts:3: unused step definition "the user does nothing" (.agents/skills/cucumber/rules/steps.md)
  Feature gate failed with 1 finding(s).
  ```
- **(d) Excluded row (D-09).** Two temporary files were added. `features/planted/excluded.feature` held a Scenario Outline whose only Examples block is tagged `@url`. `features/step_definitions/planted.steps.ts` defined its step `the planted source {string}`, and no other scenario used that step.
  - `npm run test:cucumber`: `17 scenarios (17 passed)`, `123 steps (123 passed)`.
  - `CI=1 npm run check:features`: exit 0, `Feature gate passed: 18 scenarios, 10 step definitions.`
  - After the temporary definition was deleted:
    ```
    features/planted/excluded.feature:7: undefined step "the planted source \"https://example.org\"" (.agents/skills/cucumber/rules/steps.md)
    Feature gate failed with 1 finding(s).
    ```
  - Both temporary files were then removed.
- **Extra: parse error.** The line `this is not gherkin` was inserted after install.feature line 14:
  ```
  features: the dry run found no scenarios
  features: the dry run found no step definitions
  features/plugin/install.feature:15: parse error: (15:5): expected: #EOF, #TableRow, #DocStringSeparator, #StepLine, #TagLine, #ExamplesLine, #ScenarioLine, #RuleLine, #Comment, #Empty, got 'this is not gherkin'
  Feature gate failed with 3 finding(s).
  ```
  (This run used the Task 1 output format, which printed `features:0:`. Task 2 changed line-less findings to print `features:`.)
- **No Pi started.** No `/tmp/pi-cm-features-*` directory existed before or after `npm run check:features`, so `BeforeAll` did not run.

Task 2 (`npm run --silent check:features`, exit 1 each):

1. An `And` step (install.feature Background line 11):
   ```
   features/plugin/install.feature:11: a Background holds Given steps only, not And (.agents/skills/cucumber/rules/features.md)
   features/plugin/install.feature:11: step keyword And: use Given, When, or Then (.agents/skills/cucumber/rules/features.md)
   ```
2. An upper-case word (`a new Pi session`, line 25). The undefined finding also appears because the text no longer matches:
   ```
   features/plugin/install.feature:25: undefined step "the user starts a new Pi session" (.agents/skills/cucumber/rules/steps.md)
   features/plugin/install.feature:25: step text is not lower case outside quoted values (.agents/skills/cucumber/rules/features.md)
   ```
3. `should` (`the session should offer these skills:`, line 26):
   ```
   features/plugin/install.feature:26: undefined step "the session should offer these skills:" (.agents/skills/cucumber/rules/steps.md)
   features/plugin/install.feature:26: step text says should (.agents/skills/cucumber/rules/features.md)
   ```
4. A `Given` after a `When` (inserted after line 14):
   ```
   features/plugin/install.feature:15: a Given step follows a When or Then step (.agents/skills/cucumber/rules/features.md)
   ```
5. A `When` in a Background (line 11):
   ```
   features/plugin/install.feature:11: a Background holds Given steps only, not When (.agents/skills/cucumber/rules/features.md)
   ```
6. A lower-case scenario title (line 13):
   ```
   features/plugin/install.feature:13: scenario title "installing a plugin reports it installed in the chosen scope" does not start with an upper-case letter (.agents/skills/cucumber/rules/features.md)
   ```
7. An empty feature description (lines 3-5 deleted):
   ```
   features/plugin/install.feature:1: the feature has no description (.agents/skills/cucumber/rules/features.md)
   ```
8. A title that does not match its file name (`Feature: Plugin installation`):
   ```
   features/plugin/install.feature:1: feature title "Plugin installation" is not "<function> <capability>" of its file name (.agents/skills/cucumber/rules/layout.md)
   ```
9. `@url` on a Scenario Outline (temporary `features/plugin/planted.feature`):
   ```
   features/plugin/planted.feature:6: tag @url is not on an Examples block (.agents/skills/cucumber/rules/features.md)
   ```
10. `@wip` on an Examples block (same temporary file):
    ```
    features/plugin/planted.feature:10: tag @wip on an Examples block is not @url or @github (.agents/skills/cucumber/rules/features.md)
    ```
11. `features/lib/helpers.ts`:
    ```
    features/lib/helpers.ts: catch-all module name "helpers" (.agents/skills/cucumber/rules/layout.md)
    ```
12. `features/support/hooks.ts`:
    ```
    features/support/hooks.ts: catch-all module name "hooks" (.agents/skills/cucumber/rules/layout.md)
    ```
13. `features/step_definitions/plugin.steps.ts` beside `features/step_definitions/plugin/install.steps.ts`:
    ```
    features/step_definitions/plugin.steps.ts: module beside its own directory features/step_definitions/plugin/ (.agents/skills/cucumber/rules/layout.md)
    ```
14. A `.feature` at the root of `features/` (`features/planted.feature`). This run used the first message wording. The final wording, checked with a planted `features/README.md`, is:
    ```
    features/planted.feature: unexpected file under features/ (.agents/skills/cucumber/rules/layout.md)
    features/README.md: unexpected file: features/ holds <function>/<capability>.feature files and step_definitions, support, and lib modules (.agents/skills/cucumber/rules/layout.md)
    ```

Task 3 (`npx eslint --no-cache <file>`, exit 1 each):

1. An exported constant in `features/step_definitions/session.steps.ts`:
   `29:1  error  A step module exports nothing  no-restricted-syntax`
2. A regex literal as step text (`Then(/^the planted regex$/, ...)`):
   `29:6  error  Step text uses Cucumber expressions, never regular expressions  no-restricted-syntax`
3. A `const` string variable as step text:
   `30:1  error  Step text is a string literal Cucumber expression  no-restricted-syntax`
4. `import { Given } from "@cucumber/cucumber"` in `features/lib/path-marketplace.ts`. The two `import-x/order` errors that also appeared came from where the import was placed:
   `11:10  error  'Given' import from '@cucumber/cucumber' is restricted. A library module registers nothing  no-restricted-imports`
- **Type-only import passes.** `features/lib/path-marketplace.ts` line 14 has `import type { DataTable } from "@cucumber/cucumber"`, and `npm run lint` exits 0 on it. A second planted copy reported only `import-x/order` errors and no `no-restricted-imports` error.

## Verification

- `npm run check:features`: exit 0. `CI=1 npm run check:features`: `Feature gate passed: 17 scenarios, 9 step definitions.`, exit 0.
- `npm run test:cucumber`: `17 scenarios (17 passed)`, `123 steps (123 passed)`.
- `npm run lint`: exit 0.
- All acceptance-criteria greps print the expected lines: `check:features` script, `check:static` list, `tags` in cucumber.json, `tagExpression`, `dryRun`, `parameter-types`, `keywordType`, both ESLint `files` globs, and the library message.
- The full `npm run check` phase gate belongs to the last plan of the phase. It was not run here.

## Decisions Made

- Each gate message ends with the rule file that states it.
- An ambiguous finding lists each matching definition as `"<pattern>" at <uri>:<line>`, because the colliding patterns are usually identical text.
- A finding with no line prints `path: message`.
- The literal-first-argument selector (`[arguments.0.type!='Literal']`) goes beyond the folded todo's regex-only rule, as the plan specified. A regex literal still gets its own message, because a regex literal is a `Literal` node.

## Deviations from Plan

None. The plan was executed as written. The message wording above is within the plan's latitude: each message names the rule and its skill file.

## Issues Encountered

- The first run of planted Task 2 checks 2 and 3 edited the wrong lines (24 and 25), and the gate passed because nothing had changed. They were re-run on the correct lines (25 and 26), with the results recorded above.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None. No external service needs configuration.

## Next Phase Readiness

- From this plan on, a commit that adds a step must also give it a first use (D-06). The hook fails otherwise, because `check:static` runs `check:features`.
- `npx cucumber-js --dry-run --format usage` now honors the `@url`/`@github` exclusion. The skill text that names it as the review check (SKILL.md, steps.md) should point at `npm run check:features`. 01-05 owns that doc change.
- The `@url`/`@github`-only-on-Examples rule is enforced, but it is not yet written in features.md. 01-05 documents it (SC4).

## Self-Check: PASSED

- FOUND: scripts/check-features.mjs
- FOUND commits: 114a70b2, ba9e691d, b3ca7647

---
*Phase: 01-suite-foundation*
*Completed: 2026-10-15*
