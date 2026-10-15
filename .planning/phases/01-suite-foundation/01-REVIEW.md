---
phase: 01-suite-foundation
reviewed: 2026-10-15T20:52:55Z
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
  critical: 2
  warning: 7
  info: 6
  total: 15
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-10-15T20:52:55Z
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Structural Findings (fallow)

The structural pre-pass reported no findings: 0 unused exports, 0 unused files, 0 duplicate blocks, and 0 circular dependencies. The CRAP-only complexity items that the GSD pre-pass reported for `scripts/check-features.mjs` are left out on purpose. The project turns CRAP off (`maxCrap: 0` in `.fallowrc.json`).

## Narrative Findings (AI reviewer)

## Summary

The review covered the shared cucumber machinery, the seeded marketplace and plugin feature files, the new `check:features` gate, the ESLint blocks for `features/`, and the skill documents. I checked them against the cucumber skill, the typescript-style skill, and AGENTS.md.

The driver and the per-payload schema validation are sound. The exact-one-payload checks in `lastResult()` and `runCommand()` are correct. So are the `{scenario time}` round-trip check and the dry run that ignores the tag exclusion. I confirmed that dry run by hand: `CI=1 node scripts/check-features.mjs` reports 29 scenarios, which matches the 26 that run plus the 3 excluded url and github rows.

The two blockers are scenarios whose title claims more than the steps prove. A plausible wrong implementation passes each of them, and the cucumber skill names this as its highest-value finding. Most warnings are latent gaps in the shared steps and gates. No current scenario hits them yet, but every later verb phase inherits them, because the point of this phase is that later phases do not touch shared code.

## Critical Issues

### CR-01: The bare-update scenario cannot tell a refresh from a no-op

**File:** `features/marketplace/update.feature:7-24`
**Issue:** The title says "A bare update refreshes every marketplace of both scopes, project first". But no source changes between the add and the update, so every marketplace is expected as `skipped | up-to-date`. In `orchestrators/marketplace/update.ts:436-450`, the up-to-date verdict comes from comparing the manifest content key before and after the path-source refresh. Several plausible wrong implementations still pass this scenario:

- an update that never re-reads the source;
- an update that reads the pre-refresh key after the refresh;
- an update whose (mtime, size) manifest cache serves a stale entry (`domain/manifest-cache.ts:33-36` records this risk).

The scenario proves the visit order and the per-marketplace emission. It does not prove the refresh.
**Fix:** Change one source before the update, so the expected rows hold one refreshed marketplace beside the skipped ones. Two options:

```gherkin
    Given the marketplace "gamma" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    When the user runs "/claude:plugin marketplace update"
    Then the results list these marketplaces and plugins:
      | marketplace name | marketplace scope | marketplace status | ... |
      | alpha            | project           | skipped            | ... |
      | gamma            | project           | updated            | ... |
      | beta             | user              | skipped            | ... |
```

The other option is to retitle the scenario to what it proves ("A bare update visits every marketplace of both scopes, project first"). Then a separate scenario must cover the refresh before the update verb phase closes.

### CR-02: The "absolute path" info scenario types an absolute path, so echoing the input passes

**File:** `features/marketplace/info.feature:7-22`
**Issue:** The title says "Info on a directory marketplace shows its absolute path". The scenario adds the marketplace with `{home}/marketplaces/tools`, which is already absolute, and expects `source abs path | {home}/marketplaces/tools`. Two wrong implementations produce the same output:

- one that prints the source string the user typed;
- one that reads the source from `claude-plugins.json`, which keeps the typed form (ADD-14 in `add.feature:33-45`).

Neither resolves anything to an absolute path, and both pass. The resolving behavior that the title names (NFR-9) is never put to the test.
**Fix:** Add the marketplace in a form that is not absolute, and expect the resolved path:

```gherkin
    Given the user has run "/claude:plugin marketplace add ~/marketplaces/tools --scope project"
    When the user runs "/claude:plugin marketplace info tools --scope project"
    Then the result has these fields:
      ...
      | source abs path | {home}/marketplaces/tools |
```

D-04 keeps the `~/...` form for ADD-14's scenario. This scenario's point is the resolution of the path, so it needs the exception too. Record that in D-04, or retitle the scenario so it no longer claims the resolution.

## Warnings

### WR-01: "Adding a marketplace records it in the chosen scope" checks only the report

**File:** `features/marketplace/add.feature:7-31`
**Issue:** The Outline asserts the result payload and nothing else. An implementation that reports `tools | project | added` but writes the record to the user scope, or writes no record, passes this scenario. The second Outline (`add.feature:47-72`) catches the dir, file, and url rows through `marketplace list`. That Outline has no `@github` block, so when the github work removes the tag, the only github check of "records it in the chosen scope" is this report-only scenario.
**Fix:** Retitle it to "Adding a marketplace reports it added in the chosen scope", or add a step that observes the record, such as `Then the "claude-plugins.json" file of the project scope declares these marketplaces:`. Also add a `@github` block to the second Outline when the github stand-in arrives.

### WR-02: Rows that `the result has these fields:` hides are never required to be compared

**File:** `features/step_definitions/command.steps.ts:34-39, 83-90, 141-145`
**Issue:** `UNSTATED_FIELDS` hides `marketplaces` and `blocks` from `the result has these fields:` and from `the command reports these results:`, for every payload kind. The comment says these rows "have steps of their own". Nothing forces a scenario to call them. A scenario that states only the envelope of a cascade with rows passes whatever the rows are. Two kinds have no row step at all:

- `plugin-info-cascade` has `blocks`, and `marketplaceRecords` accepts only `cascade` and `marketplace-info-cascade`;
- `reconcile-applied-cascade` has `marketplaces`, and `pluginRecords` and the plugins step accept only `cascade`.

So the shared steps cannot compare those payloads whole. Every current scenario pairs the two steps correctly, so this gap is latent. It is still a shared-machinery hole that the later verb phases inherit.
**Fix:** Track on the world whether the hidden rows of the last result were compared, and fail in the `After()` hook of `world.ts` when they were not empty and no row step read them. Alternatively, make the envelope steps fail when a hidden array is non-empty and the scenario has not declared a row step. Add `plugin-info-cascade` and `reconcile-applied-cascade` to the row steps, or make the envelope step reject those kinds until they have a row step.

### WR-03: The field-name projection loses information, and collisions are silent

**File:** `features/lib/field-rows.ts:18-21, 43-54`; `features/step_definitions/command.steps.ts:50, 61, 77, 85`; `features/step_definitions/config.steps.ts:55`
**Issue:** `fieldWords` drops a leading word that repeats the parent, so `source.sourceKind` and `source.kind` both become `source kind` (checked with node). `cause.causeChain` and `cause.chain` also give the same column. A table therefore cannot pin the JSON field names it claims to describe: a rename on the wire that also changes the product's schema passes every scenario. Also, `new Map(flatten(...))` and the merge in `pluginRecords` (`new Map([...blockFields, ...flatten(row)])`) keep the last value for a name that occurs twice, so the first value is never compared. The current schema has no such collision. Nothing detects one when the schema grows, and the module comments promise that no field goes unseen.
**Fix:** Assert that every flattened name is unique before building a map:

```ts
function toRecord(pairs: Array<[string, string]>): Map<string, string> {
  const record = new Map<string, string>();
  for (const [name, value] of pairs) {
    assert.ok(!record.has(name), `two fields project to the column "${name}"`);
    record.set(name, value);
  }
  return record;
}
```

Use it in place of `new Map(...)` in both step modules. Decide whether to keep the de-duplication of the leading word. If you keep it, record it as a known limit in `features.md`.

### WR-04: A local row in an `@url` or `@github` block is excluded without any report

**File:** `scripts/check-features.mjs:321-327`; `cucumber.json:6`
**Issue:** The gate checks that only `@url` and `@github` tag an `Examples:` block. It does not check that the rows in a tagged block have the kind of their tag. A `| dir | ... |` row written by mistake into the `@url` block is dropped from every run until the url work removes the tag, and `check:features` still passes, because the dry run finds every step defined. The local behavior that row was meant to prove goes untested, and nothing reports it.
**Fix:** In `examplesTagFindings`, read the `source kind` column of each tagged block and require it to equal the tag without the `@`. Also require the untagged blocks to hold only `dir` and `file`:

```js
const kindColumn = examples.tableHeader?.cells.findIndex((c) => c.value === "source kind") ?? -1;
// for each row: tagged => cell === tag.slice(1); untagged => cell is "dir" or "file"
```

### WR-05: The ESLint step-text and registration rules have simple bypasses

**File:** `eslint.config.js:217-274`
**Issue:**

- The literal and no-regex selectors match only bare `Given`, `When`, and `Then` callees. `defineStep(/regex/, ...)`, an aliased import (`import { Given as given }`), and a member call (`cucumber.Given(...)`) are not covered.
- The block applies only to `features/step_definitions/**/*.steps.ts`. A `Given(/regex/)` in a support module goes unchecked, although `layout.md` says only step modules call `Given`, `When`, or `Then`.
- The `features/lib/**` import ban does not list `setDefinitionFunctionWrapper` or `setParallelCanAssign`, which are also registration calls.

`steps.md` says "Lint rejects a regular expression or a variable in its place", which overstates what lint does.
**Fix:** Ban `defineStep` and renamed imports of `Given`, `When`, and `Then` in step modules, using `no-restricted-imports` with `importNames: ["defineStep"]` and a selector on `ImportSpecifier[imported.name=/^(Given|When|Then)$/][local.name!=/^(Given|When|Then)$/]`. Add a `features/support/**` block that bans importing `Given`, `When`, `Then`, and `defineStep`. Add the two missing names to the lib ban.

### WR-06: The publishing steps depend on their order and hide the source kind

**File:** `features/step_definitions/marketplace/publishing.steps.ts:45-58`
**Issue:**

- `is published as a {source kind} source` always republishes with `[]` plugins. If it follows `offers these plugins:`, it removes the offered plugins without any report. The reverse order works.
- `offers these plugins:` silently uses `dir` when the marketplace was not published first (`?? "dir"`). A reader of `info.feature:7-11` or of the plugin Backgrounds cannot see the source kind without opening the step.
- Each call registers another `rm` release for the same root.

Multi-kind install and update Outlines in later phases will combine these two steps, and the wrong order gives a confusing failure far from its cause.
**Fix:** Make `is published as a ... source` fail when the marketplace was already published in the scenario, or make it keep the plugins that the scenario recorded. Make `offers these plugins:` require an earlier publish step, or name the kind in its text. Register the release only on the first publish of a name.

### WR-07: The feature gate catches its own errors and drops the stack trace

**File:** `scripts/check-features.mjs:463-468`
**Issue:** The most likely gate failure is that a support or step module fails to load: a syntax error, a bad import, or a parameter type defined twice. `runCucumber` then throws, and the `catch` prints only `error.message`, without the file, the line, or the cause. A top-level `await main()` with no `try` would let Node print the full stack and exit with code 1. `steps.md`'s rule "Let them bubble up: the stack trace is more useful than a log line" says the same about step code.
**Fix:** Remove the `try`/`catch` and let the rejection propagate, or print `error.stack ?? String(error)`.

## Info

### IN-01: The quote stripping treats apostrophes as quotes

**File:** `scripts/check-features.mjs:332`
**Issue:** `/"[^"]*"|'[^']*'/g` treats the span between two apostrophes as a quoted value. In `the user's Plugin list's rows`, the span `'s Plugin list'` is removed, and the upper-case `P` passes the lower-case check (checked with node). `features.md` defines quoted values with double quotes only.
**Fix:** Strip only double-quoted values: `step.text.replaceAll(/"[^"]*"/g, "")`.

### IN-02: The list of catch-all names misses common variants

**File:** `scripts/check-features.mjs:25-34`
**Issue:** Only exact names are rejected, so `util`, `helper`, `common-steps`, and `shared-steps` pass.
**Fix:** Match the names as words: `/(^|-)(common|shared|utils?|helpers?|support|misc|hooks|parameter-types)(-|$)/`.

### IN-03: A version-bump republish keeps the manifest size the same

**File:** `features/lib/path-marketplace.ts:56-75`; `features/plugin/update.feature:14-63`
**Issue:** `writeInvalidManifest` notes that the manifest cache is keyed on (mtimeMs, size) and changes the size on purpose. The `1.0.0` to `1.1.0` republish in the plugin-update scenarios writes a manifest and a `plugin.json` of the same size. On a filesystem with coarse timestamps, a cache hit would serve the old manifest, and the update scenarios would fail without a clear cause. The risk is low on tmpfs and ext4 with the delays this suite has between writes.
**Fix:** Add a field to the fixture manifest whose length changes on every write, such as a description that holds a write counter, or document the assumption next to `writeMarketplace`.

### IN-04: Some table cells lose information

**File:** `features/lib/field-rows.ts:34-40, 73-79`
**Issue:**

- In a table with more than one record, a missing field, `[]`, and `""` all show as an empty cell.
- An array of objects (`rollbackPartial`, `components.hooks`, `requires`) becomes a cell through `JSON.stringify` without token projection. A sandbox path inside it cannot be written as `{home}`.

No current scenario depends on either case.
**Fix:** Write a missing field in a multi-record table as a separate marker, or record the merging of these values in `field-rows.ts` and `features.md`. Apply `projectTokens` recursively before the stringify.

### IN-05: The sandbox root leaks when Pi fails to start

**File:** `features/support/pi-process.ts:47-65, 92-96`
**Issue:** `piRun` is set only after `PiProcess.start` resolves. If the start fails, nothing removes the `mkdtemp` root, and `AfterAll` throws "the run's Pi has not started", which hides the real failure. The ordering existed before this phase, but this phase changed the `BeforeAll` block.
**Fix:** Create the root, then use `try` around `PiProcess.start` and `rm` the root on failure. Or make `AfterAll` return early when `piRun` is undefined.

### IN-06: The layout gate reads untracked and ignored files

**File:** `scripts/check-features.mjs:212-219`
**Issue:** `readdirSync(..., { recursive: true })` lists editor swap files, `.DS_Store`, and `.gitkeep` under `features/` and reports them as unexpected files. The local gate then fails on files that CI never sees.
**Fix:** Skip dot-files, or build the file list from `git ls-files features`.

---

_Reviewed: 2026-10-15T20:52:55Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
