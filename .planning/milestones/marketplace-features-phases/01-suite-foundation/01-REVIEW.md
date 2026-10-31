---
phase: 01-suite-foundation
reviewed: 2026-10-15T21:44:18Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - .agents/skills/cucumber/SKILL.md
  - .agents/skills/cucumber/rules/features.md
  - .agents/skills/cucumber/rules/layout.md
  - .agents/skills/cucumber/rules/steps.md
  - .agents/skills/cucumber/rules/world-and-stand-ins.md
  - .agents/skills/local-verification/rules/commands.md
  - cucumber.json
  - eslint.config.js
  - features/lib/field-rows.ts
  - features/lib/path-marketplace.ts
  - features/lib/pi-commands.ts
  - features/lib/published-marketplace.ts
  - features/lib/run-tokens.ts
  - features/marketplace/add.feature
  - features/marketplace/help.feature
  - features/marketplace/info.feature
  - features/marketplace/list.feature
  - features/marketplace/update.feature
  - features/plugin/install.feature
  - features/plugin/uninstall.feature
  - features/plugin/update.feature
  - features/step_definitions/command.steps.ts
  - features/step_definitions/config.steps.ts
  - features/step_definitions/marketplace/publishing.steps.ts
  - features/step_definitions/session.steps.ts
  - features/support/pi-process.ts
  - features/support/source-kind.ts
  - features/support/world.ts
  - package.json
  - scripts/check-features.mjs
findings:
  critical: 0
  warning: 0
  info: 12
  total: 12
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-10-15T21:44:18Z
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

This is the re-review after fix iteration 2 (commits `9e81b6a3..9a056f3d`). I checked the 30 files against the cucumber skill, the typescript-style skill, AGENTS.md, and the locked decisions in `01-CONTEXT.md`. The user's rulings on the bare-update scenario (UPD-02) and on INFO-01 (AU-05 belongs to the autoupdate verb phase) are not raised again. CRAP scores are off by project policy, so this report leaves them out.

All four fixes from iteration 2 hold, and I found no regression from them:

- CR-01 (`9e81b6a3`): the INFO-01 title now says "the default autoupdate state". This matches what the scenario checks (`details autoupdate | false`) and the user's ruling.
- WR-01 (`0c035116`): the three row steps call `markRowsCompared()` (`command.steps.ts:131, 138, 180`). `steps.md:58` states the one exception, and `world-and-stand-ins.md:22` names the method. The uncompared-rows check still works: the `After()` check in `world.ts:162-168` and the `When` check in `command.steps.ts:107-111` are unchanged.
- WR-02 (`b0ae9c12`): `patternFindings()` reads `definition.pattern.type`. Cucumber sets that type from the registered argument (a string is always `CUCUMBER_EXPRESSION`), so the check holds whatever name the step function was called through. Step modules now ban the hook and registration imports. I also checked whether a support or lib module could register a step through a default import (`import cucumber from "@cucumber/cucumber"`). ESLint exits 0 on that form. But the package's ESM wrapper (`lib/wrapper.mjs`) has no default export, so the module fails to load and both the run and the gate fail. That is not a usable bypass.
- WR-03 (`9a056f3d`): the skill's Outline example now checks `claude-plugins.json` the same way `add.feature` does.

Both gates pass on the current tree. `CI=1 npm run check:features` reports 30 scenarios and 17 step definitions. `npm run test:cucumber` passes 26 scenarios and 206 steps. The sandbox is hermetic: `tests/e2e/_rpc.ts` gives the child its own `HOME` and `PI_CODING_AGENT_DIR`.

I found no new blocker or warning. I traced every seeded scenario for a plausible wrong implementation that would still pass, and checked the whole-value comparisons, the token projection, the gate's dry run and tag clearing, the Examples-kind check, and the lint selectors. The ten Info items from round 2 were outside the fix scope (`critical_warning`). I checked each one again, and each is still present. They appear below as IN-01..IN-10 with updated line numbers. IN-11 and IN-12 are new and small. IN-11 is a doc drift that the WR-02 fix left behind. IN-12 notes that WR-01's "one write" guarantee is a convention that nothing enforces.

## Info

### IN-01: The quote stripping treats apostrophes as quotes (still open)

**File:** `scripts/check-features.mjs:391`
**Issue:** `/"[^"]*"|'[^']*'/g` removes the text between two apostrophes, as in `the user's Plugin list's rows`. An upper-case letter in that span then passes the lower-case check. `features.md` uses only double quotes for quoted values.
**Fix:** `step.text.replaceAll(/"[^"]*"/g, "")`.

### IN-02: The list of catch-all names misses common variants (still open)

**File:** `scripts/check-features.mjs:25-34`
**Issue:** The gate rejects only exact names, so `util`, `helper`, `common-steps`, and `shared-steps` pass.
**Fix:** Match the names as words: `/(^|-)(common|shared|utils?|helpers?|support|misc|hooks|parameter-types)(-|$)/`.

### IN-03: A version-bump republish keeps the manifest size the same (still open)

**File:** `features/lib/path-marketplace.ts:55-75`; `features/plugin/update.feature:16-18, 29-31, 39-41`
**Issue:** The manifest cache keys on (mtimeMs, size) (`domain/manifest-cache.ts:92`). `writeInvalidManifest` changes the size on purpose. The `1.0.0` to `1.1.0` republish does not. On a filesystem with coarse timestamps, the cache could serve the old manifest, and the update scenarios would flake.
**Fix:** Add a field to the manifest whose length changes on every write, or note this assumption at `writeMarketplace`.

### IN-04: Some table cells lose information (still open)

**File:** `features/lib/field-rows.ts:34-40, 90-96`
**Issue:** In a table with more than one record, a missing field, `[]`, and `""` all show as an empty cell. An empty object (`{}`) disappears from the record entirely. An array of objects (`rollbackPartial`, `components.hooks`, `requires`) becomes a cell through `JSON.stringify` without token projection, so a path inside it cannot be written as `{home}`.
**Fix:** Write a missing field as a separate marker, and apply `projectTokens` recursively before the stringify.

### IN-05: The sandbox root leaks when Pi fails to start (still open)

**File:** `features/support/pi-process.ts:164-182, 209-213`
**Issue:** `piRun` is set only after `PiProcess.start` resolves. If the start fails, nothing removes the `mkdtemp` root. Then `AfterAll` throws "the run's Pi has not started", and that error hides the real failure.
**Fix:** Put `PiProcess.start` in a `try` block and remove the root on failure, or return early from `AfterAll` when `piRun` is undefined.

### IN-06: The layout gate reads untracked and ignored files (still open)

**File:** `scripts/check-features.mjs:225-232`
**Issue:** `readdirSync(..., { recursive: true })` lists editor swap files, `.DS_Store`, and `.gitkeep`, and reports each one as an unexpected file. So the gate can fail locally on files that CI never sees.
**Fix:** Skip dot-files, or build the file list from `git ls-files features`.

### IN-07: The session `When` neither checks uncompared rows nor clears the last results (still open, widened)

**File:** `.agents/skills/cucumber/rules/world-and-stand-ins.md:22`; `features/step_definitions/session.steps.ts:24-26`
**Issue:** The rule says "a second `When` fails when the first one's rows went uncompared". Only `When the user runs` checks (`command.steps.ts:107-111`). `When the user starts a new pi session` does not. The `After()` hook still catches the gap, so no scenario can pass with rows left uncompared. The failure just shows up later than the rule says. The session `When` also leaves `this.results` in place. A later `Then the result has these fields:` would then read the earlier command's result, while a reader takes it to mean the session.
**Fix:** In the session `When`, run the same uncompared-rows check, then set `this.results = undefined`. The other option is to change the sentence to "the next `When the user runs` fails".

### IN-08: An Examples block with both tags passes the kind check with mixed rows (still open)

**File:** `scripts/check-features.mjs:357-386`
**Issue:** On a block tagged `@url @github`, the allowed kinds are `{url, github}`, so a block that mixes url and github rows passes. When the url work removes `@url`, the url rows in that block stay excluded, because the block still has `@github`. That contradicts "Removing a tag turns on every row of that kind" in `features.md:125`.
**Fix:** Require exactly one source tag on a tagged block, and report a block that has two.

### IN-09: "source kind" names two different sets of values (still open)

**File:** `features/marketplace/info.feature:20`; `features/marketplace/add.feature:22`; `scripts/check-features.mjs:344-353`
**Issue:** The `source kind` Examples column holds the fixture kinds `dir`, `file`, `url`, and `github`. The result field `source.sourceKind` also reads as `source kind`, but it holds the wire kinds `path`, `url`, and `github`. So a dir marketplace shows `| source kind | path |`. The info phase's INFO-01 Outline will hold both: a `<source kind>` column of `dir` and `file`, and a result row `source kind | path`. A reader has to open the steps to see why they differ. The gate also treats `source kind` as a reserved column name, so it would flag a later Outline whose Examples column holds wire kinds.
**Fix:** Rename the fixture column, for example to `published as` (`<published as>`, which matches the step "is published as a ... source"). Update the gate's column name and `features.md` to match.

### IN-10: Two info scenarios set up plugins that their results never show (still open)

**File:** `features/marketplace/info.feature:9-11, 37-39`
**Issue:** INFO-01 and the two-scope scenario both offer a `demo` plugin, but `marketplace-info` and `marketplace-info-cascade` show no plugins. The invalid-manifest scenario at lines 52-55 shows that info works without them. A reader may think the plugin is part of what the scenario proves.
**Fix:** Remove the two `offers these plugins:` steps, or keep them only if a later info scenario shows plugins.

### IN-11: The WR-02 fix left the gate's descriptions behind and one comment unwrapped

**File:** `scripts/check-features.mjs:11`; `.agents/skills/cucumber/SKILL.md:26`; `.agents/skills/local-verification/rules/commands.md:5`; `.agents/skills/cucumber/rules/layout.md:17`
**Issue:** The edited line of the gate's header comment runs to about 160 characters. The rest of the block wraps at 100, and Prettier does not reflow comments. `SKILL.md:26` and `commands.md:5` list what `check:features` fails on, and neither names the new check on step text that is not a Cucumber expression. `commands.md:5` also leaves out the layout rules. `layout.md:17` says `world.ts` holds "its release hook". That `After()` hook now also fails a passing scenario whose rows went uncompared.
**Fix:** Rewrap line 11. Add "a step definition whose text is not a Cucumber expression" (and, in `commands.md`, "the layout rules") to both lists. Change the `layout.md` cell to "its release hook, which also checks that every row array was compared".

### IN-12: The "one write a `Then` makes" is a convention, and the field stays public

**File:** `features/support/world.ts:42, 111-117`; `features/step_definitions/command.steps.ts:113`
**Issue:** `markRowsCompared()` says it "is the one write a `Then` step makes to the world", and `steps.md:58` says "No `Then` writes to the world in any other way". But `uncomparedRows` is still a public, writable field, and `When the user runs` assigns it directly at `command.steps.ts:113`. A future `Then` can write `this.uncomparedRows = []`, and neither TypeScript nor lint stops it, so the WR-01 fix's single named write point holds only by convention.
**Fix:** Make the field `private` and move every read and write of it into world methods. TypeScript's `private` is scoped to the class, not the module, so the `After()` hook needs a method too:

```ts
private uncomparedRows: readonly string[] = [];

/** Fails when a row array of the last results went uncompared. */
assertRowsCompared(message: string): void { ... }

/** Keeps `results` as the last command's results, after `assertRowsCompared()`. */
recordResults(results: readonly NotificationPayload[]): void { ... }
```

---

_Reviewed: 2026-10-15T21:44:18Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
