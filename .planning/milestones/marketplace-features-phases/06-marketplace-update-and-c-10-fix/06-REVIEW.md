---
phase: 06-marketplace-update-and-c-10-fix
reviewed: 2026-10-19T07:45:55Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/manifest.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - features/lib/mcp-configuration.ts
  - features/lib/path-marketplace.ts
  - features/lib/published-marketplace.ts
  - features/marketplace/file-source-update.feature
  - features/marketplace/info.feature
  - features/marketplace/update.feature
  - features/step_definitions/command.steps.ts
  - features/step_definitions/marketplace/publishing.steps.ts
  - features/step_definitions/marketplace/update.steps.ts
  - features/step_definitions/mcp-configuration.steps.ts
  - tests/domain/manifest.test.ts
  - tests/edge/register.test.ts
  - tests/integration/reserved-record-keys.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/marketplace/info.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/bootstrap.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/persistence/state-io.test.ts
findings:
  critical: 1
  warning: 14
  info: 4
  total: 19
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-10-19T07:45:55Z
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Scope: the phase diff `64235db7..HEAD` of the 24 listed files. Four test files
(`tests/edge/register.test.ts`, `tests/integration/reserved-record-keys.test.ts`,
`tests/orchestrators/plugin/bootstrap.test.ts`, `tests/orchestrators/reconcile/apply.test.ts`)
changed in commits `73196a83`, `fd6ad158`, and `c417495f`, outside the plan task commits. Findings
in those files are marked **(out-of-phase)**.

The production change does what it set out to do for new records. A path source rereads
`record.manifestPath` and no longer rebuilds it from the root, which fixes C-10. The persisted
`lastSuccessfulManifest` baseline gives path sources a real "changed" signal. `isDeepStrictEqual`
over the parsed text ignores object-key order, keeps array order, and keeps unknown fields
(D-04..D-06). The weak spots are at the edges of the new baseline:

- An unparseable baseline bricks a marketplace and reports a false reason.
- Legacy records keep the manifest paths that the old code stored or rewrote, so `info` and
  `update` can name different files.
- A legacy git record still cannot recover from a bad on-disk manifest.

On the test side, one new unit case does not pin the behavior its title names. Several Cucumber
comparison scenarios keep their point in a step's fixture table. Several kind-agnostic scenarios
run only the `dir` kind. Fourteen tables are misaligned.

## Structural Findings (fallow)

`fallow audit --changed-since 64235db7` returned verdict **pass**, with 0 dead-code issues and 0
duplication clone groups. Fallow listed 52 `complexity_findings`. They are CRAP estimates from
fallow's default `max-crap 30`. This project runs `maxCrap: 0` (CRAP off) and gates cognitive
complexity at 15 in both ESLint and fallow, and both pass. So they are not findings, and none are
reported here.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: "autoupdate ignores a newly declared plugin" does not pin what it claims

**File:** `tests/orchestrators/marketplace/update.test.ts:2060-2121`
**Issue:** The title promises that a manifest-only plugin (`new`) is ignored. The assertions are
these:

- `calls` equals `["existing"]`.
- The single `existing` record is unchanged (`readPluginRecord(..., "existing")`).
- Two `assert.match` regexes find the header line and the `existing` row in the notification.

Nothing compares the whole plugin map or the whole notification. Two plausible wrong
implementations pass:

- One emits an extra `new` row, such as `⊘ new (skipped) {not installed}`. The regexes still
  match because they are anchored per line.
- One writes a `new` record into state. Only `existing` is read back.

Per `.agents/skills/typescript-unit-tests/rules/review.md`, a case that a wrong implementation
passes is a BLOCKER.
**Fix:**
```ts
// assert
assert.deepStrictEqual(calls, ["existing"]);
assert.deepStrictEqual(
  (await loadState(locationsFor("project", cwd).extensionRoot)).marketplaces.offers?.plugins,
  { existing: installed },
);
assert.deepStrictEqual(notifications, [
  { message: "● offers [project] (updated)\n  ⊘ existing (skipped) {up-to-date}" },
]);
```

## Warnings

### WR-01: A corrupt `lastSuccessfulManifest` blocks updates and reports `{network unreachable}`

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:358-418, 664`; `extensions/pi-claude-marketplace/persistence/state-io.ts:316`
**Issue:** The schema accepts any string as `lastSuccessfulManifest`. `refreshRecord` runs
`JSON.parse(preKey)` (line 418) after the fetch and the manifest read. An empty or truncated
baseline (from a hand edit or a partial copy) throws `SyntaxError`, and two things go wrong:

1. The error is not `InvalidMarketplaceManifestError` and carries no errno, so
   `reasonsFromCascadeError` returns `undefined` and line 664 reports `{network unreachable}`. A
   path source never touches the network, so this is the ATTR-10 / NFR-5 false reason that the
   comments in `transportReason` describe. For git sources, `cloneAdvanced` is already true, so the
   user also sees "Retry the command.".
2. Only a successful refresh replaces the baseline, and a successful refresh needs the bad baseline
   to parse first. Every retry fails the same way. The only way out is `marketplace remove` plus
   `add`, or editing `state.json` by hand.

The project's fail-closed rule asks for an explicit `{unreadable}` refusal, not a false transport
reason.
**Fix:** Parse the baseline once, before any fetch, and turn a parse failure into a typed error
that maps to `unreadable`. Recovering from it (dropping the baseline and treating the refresh as
changed) is also acceptable if the user decides so. Fail-closed example:
```ts
function parseBaseline(name: string, text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new CorruptStateError(`marketplace "${name}" has an unreadable comparison baseline`, { cause });
  }
}
// in reasonsFromCascadeError: err.cause instanceof CorruptStateError -> ["unreadable"]
```
Add a unit case with `lastSuccessfulManifest: ""` for each source kind.

### WR-02: A path-source refresh reads `record.manifestPath` as stored, and legacy records are never repaired

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:409`; `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts:82-86`; `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:1210`
**Issue:** D-02 says every update rereads the exact file the user added. After this phase, two
places answer "which file" in different ways:

- `info.ts` derives it from `source.logical`: it expands `~` and resolves the path against
  `record.addedFromCwd`.
- `update.ts` (and every other reader) uses `record.manifestPath` exactly as stored.

New records agree, because `add.ts:1210` now stores an absolute path. Two kinds of existing record
do not:

1. **Relative records.** Before this phase, `addPathInGuard` stored `expandTildePath(source.logical)`
   as given, so `./mp` was stored as `mp/.claude-plugin/marketplace.json`. `update` resolves that
   against `process.cwd()`. `resolvesToRecord` (add.ts:393-406) already resolves recorded paths
   against `addedFromCwd`. A user-scope marketplace added from directory A and updated from a Pi
   started in directory B reads `B/mp/...`. The result is `{source missing}`, or a different
   marketplace's manifest, while `info` shows `A/mp`.
2. **Records the C-10 bug rewrote.** The old `validateManifestAtRoot(record, record.marketplaceRoot)`
   repointed `record.manifestPath` to `<root>/.claude-plugin/marketplace.json` whenever that file
   existed and was valid. That is the "conventional decoy" case. Such a record keeps reading the
   decoy forever, while `info` now shows the original external file.

**Fix:** For `source.kind === "path"`, derive the manifest path the same way `add` and `info` do,
in one shared helper. The helper resolves `source.logical` against `addedFromCwd` and uses the file
itself for a file source or `<dir>/.claude-plugin/marketplace.json` for a directory. Use the helper
in `refreshRecord` and write the result back to `record.manifestPath` and `record.marketplaceRoot`
on a successful refresh. Alternatively, repair these records once during state load or migration.
Add unit cases for a relative legacy record and for a record already repointed to a decoy.

### WR-03: A legacy git record with an invalid on-disk manifest still cannot recover

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:331-346, 358-360`
**Issue:** A git record without a baseline (one added before this phase) still reads the clone's
manifest before the fetch, and `manifestContentKey` rethrows any non-ENOENT error. Consider this
sequence:

1. A fetch advances the clone to an invalid manifest. The refresh fails, and no baseline is saved.
2. Upstream fixes the manifest.
3. Every later update fails at the pre-read, before the fetch that would bring in the fix.

D-07 says "a later update rereads the source and can succeed once it is fixed". The baseline design
already treats "no comparison available" as changed (the `preKey === undefined` path). So the
rethrow now only blocks recovery. It no longer prevents a silent wrong `(updated)`: the refresh
still validates the new manifest and fails if it is invalid. The bug existed before this phase. The
phase narrowed it to legacy git records and kept it on purpose (`legacy: true` in the WR-02 unit
case at `tests/orchestrators/marketplace/update.test.ts:1568`).
**Fix:** In `manifestContentKey`, map every pre-read failure to `undefined`, or skip the pre-read
and treat a git record that has no baseline the way a legacy path record is treated. Then update the
WR-02 case so it expects a recovered `(updated)` after a repaired fetch.

### WR-04: The comparison scenarios keep their point in step code, through two identical steps

**File:** `features/step_definitions/marketplace/update.steps.ts:25-87, 237-266`; `features/marketplace/update.feature:305-406`
**Issue:** `Given the marketplace "tools" has the "nested keys" comparison baseline` and
`... has the "nested keys" cosmetic rewrite` pick JSON from `COMPARISON_FIXTURES`. A reader cannot
see what changes between baseline and refresh without opening the step module. The cucumber skill
lists this as a review finding: "a scenario whose point lives only in a step's code". The feature
already has a docstring step, `update source contains this manifest:`, that could show both
documents inline. Two more problems:

- `... semantic rewrite` (line 238) and `... cosmetic rewrite` (line 258) have the same body.
  The two words are labels with no behavior behind them.
- "comparison baseline" names an implementation concept, not something the user owns.

**Fix:** State both manifests in the feature with docstrings, for example
`Given the marketplace "tools" publishes this manifest:` before the add and
`Given the marketplace "tools" update source contains this manifest:` after it. Then delete
`COMPARISON_FIXTURES` and the three fixture steps. If an Outline must stay, put the JSON in the
`Examples:` cells.

### WR-05: Kind-agnostic update behaviors run only the `dir` kind

**File:** `features/marketplace/update.feature:111, 342, 366, 390, 851`
**Issue:** These scenarios publish only a `dir` source:

- "A bare update continues after a marketplace fails"
- "An unknown manifest field changes the marketplace"
- "Reordering a manifest array changes the marketplace"
- "An isolated dependency entry retains its comparison fields"
- "A repaired marketplace can be updated again"

None of these behaviors depends on the source kind. `features.md` says that a behavior several
kinds share is one `Scenario Outline` with a `<source kind>` column, untagged `dir`/`file` rows, and
`@url`/`@github` blocks. As written, the file kind and both remote kinds have no coverage for
D-05, D-06, or D-07. The cosmetic Outline at line 305 does have the full kind matrix, so the file
is also inconsistent with itself.
**Fix:** Convert each one to an Outline over `<source kind>` with `dir`/`file` rows and tagged
`@url`/`@github` blocks.

### WR-06: The "has failed as invalid manifest" Given asserts with `assert.ok` and `includes`

**File:** `features/step_definitions/marketplace/update.steps.ts:126-200`
**Issue:** This 75-line `Given` checks a full failure payload, which is a `Then`'s job and hides a
second behavior inside setup. `steps.md` forbids two of its assertions:

- `assert.ok(plugin?.cause !== undefined)` (line 137)
- `causeChain.slice(1).some((message) => message.includes("marketplace.json"))` (line 151): "No
  `assert.ok(x.includes(...))`"

A cause chain that names some other `marketplace.json` error still passes.
**Fix:** Keep the `Given` minimal: run the command and assert only `payload.severity === "error"`
and the marketplace status `failed`. Move the full comparison to a separate scenario that uses the
existing `Then` table steps, which already compare `cause chain` whole.

### WR-07: Fourteen Gherkin tables are misaligned

**File:** `features/marketplace/update.feature:40, 43, 326, 329, 715, 790, 794, 795, 846-849, 885`; `features/marketplace/file-source-update.feature:30, 35, 50, 107, 110`; `features/marketplace/info.feature:34`
**Issue:** `features.md` says "Align the columns". No tool enforces this: Prettier does not cover
`.feature`, and `check:features` does not check alignment. A script comparing pipe positions within
each table flagged the lines above. The `info.feature:34` row is a phase edit. `info.feature:132`
and `:144` were already misaligned before this phase.
**Fix:** Re-pad each listed table so every row's pipes line up with its header.

### WR-08: The `ownedTarget` guard accepts the parent of the published root

**File:** `features/lib/published-marketplace.ts:181-192`
**Issue:** The guard rejects `relative.startsWith("../")` and absolute paths. It misses
`relative === ".."`, which is the path to the published root's parent, so the guard accepts it.
`removePublishedSource` passes the result to `rm(..., { recursive: true })`. No current caller
builds that path, but `publishedPluginFile` and `publishUnreadableSkillFile` join plugin names from
feature text, and a plugin name such as `x/../../..` would reach the parent.
**Fix:**
```ts
if (
  root === path.parse(root).root ||
  relative === ".." ||
  relative.startsWith(`..${path.sep}`) ||
  path.isAbsolute(relative)
) { throw ... }
```

### WR-09: The rows step now skips MCP notices silently

**File:** `features/step_definitions/command.steps.ts:169-176`
**Issue:** `the results list these marketplaces and plugins:` now drops `mcp-config-notices`
results without a check. A scenario that uses only this step after a `When` can no longer detect a
spurious notice payload. `features/marketplace/file-source-update.feature:59-68` is an example:
both updates are compared only through this step. The pinning now depends on each scenario also
using `the command reports these results:`, and nothing enforces that.
**Fix:** Keep the old strictness. Have the rows step accept a notice payload only when the scenario
also states the result list, or have it fail on any notice unless a dedicated
`Then the results include these MCP config notices:` step marks them compared, as
`markRowsCompared` does for rows.

### WR-10: The unreadable-skill Given never checks that the file is unreadable

**File:** `features/lib/published-marketplace.ts:256-276`; `features/step_definitions/marketplace/update.steps.ts:224-229`
**Issue:** `steps.md` says a `Given` that does setup asserts that the setup worked. A `0o000` file
is still readable to root and to some container users. In those runs, "Autoupdate continues in
installed order after a plugin fails" fails at the `Then` with a confusing diff, not at the
`Given`.
**Fix:** After writing the file, assert
`await assert.rejects(readFile(file), { code: "EACCES" })` in the `Given`.

### WR-11: Data rows are looped inside one test case

**File:** `tests/orchestrators/marketplace/update.test.ts:3668-3720`
**Issue:** "semantic comparison includes unknown fields and array order" runs its arrange, act, and
assert steps for three rows inside one `test()`. `cases.md` says "Do not loop rows inside one case;
it stops at the first failure." The other new cases in the same file correctly use one sibling
`test()` per row.
**Fix:** Move the `for` outside and give each row its own titled case, for example
``test(`semantic comparison reports ${title} as updated`, ...)``.

### WR-12: The D-01 info cases build the expected path with production-shaped conditional logic

**File:** `tests/orchestrators/marketplace/info.test.ts:592-606`
**Issue:** `expectedPath` is computed inside the loop body with a conditional (`rawSource === "~" ?
home : path.resolve(cwd, rawSource.startsWith("~/") ? ... : rawSource)`). That re-implements the
tilde expansion under test (`info.ts:85`), so a shared mistake passes both. `cases.md` forbids a
conditional in a data-row loop body and requires independently built expected values.
**Fix:** Put the expected path in each row as a literal built from `cwd`/`home`, for example
`{ title: "tilde manifest file", source: () => "~/sources/tilde/catalog/marketplace.json", expected: (cwd, home) => path.join(home, "sources", "tilde", "catalog", "marketplace.json") }`.

### WR-13: Partial notification checks and an assertion inside "act" in new update cases

**File:** `tests/orchestrators/marketplace/update.test.ts:1882, 1905, 1961, 3876`
**Issue:** These new cases assert notifications by severity plus an `assert.match` substring
(`/\{invalid manifest\}/`, `/\{source missing\}/`) or by `notifications.length`. `cases.md` says to
compare whole values. Line 1882 also runs `assert.deepStrictEqual(cascadeCalls, [])` in the middle
of the act phase. The title behaviors (state, config, and plugins retained) are asserted whole, so
this is a WARNING and not a BLOCKER. Still, a wrong header, a duplicated row, or a missing
cause-chain trailer would pass.
**Fix:** Compare the full `{ message, severity }` arrays. Capture `cascadeCalls` after the failed
run into a const (`const callsAfterFailure = [...cascadeCalls]`) and assert it in the assert block.

### WR-14: (out-of-phase) An integration test edits the baseline in `state.json` to keep its old expectation

**File:** `tests/integration/reserved-record-keys.test.ts:268-276` (commit `73196a83`)
**Issue:** The test loads `state.json`, sets `lastSuccessfulManifest` to the republished manifest
text, and saves it back. This keeps `marketplace update mp` at `(skipped) {up-to-date}`. Everything
else in the test drives the registered command surface. Writing internal state hides the real flow
(add at 1.0.0, publish 1.1.0, marketplace update), which now correctly reports `(updated)`. It also
ties the test to the baseline's storage format.
**Fix:** Either expect `● mp [project] (updated)` from the `refreshed` run, or reach the same state
through the public surface by adding `await run("marketplace update mp --scope project")` to the
arrange phase. Then drop the `saveState` import.

## Info

### IN-01: Comments still describe the old pre/post byte comparison

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:11-13, 68, 77, 719`; `extensions/pi-claude-marketplace/domain/manifest-cache.ts` (header D-03 and the `ManifestLoadOutcome` comment)
**Issue:** These comments are now wrong:

- `update.ts` still describes "pre/post validated marketplace.json content", "byte-identical
  pre/post", "read+validate `<marketplaceRoot>/.claude-plugin/marketplace.json`", and
  `refreshPathManifest(record)`. The code now compares the parsed text against the saved baseline,
  ignores key order, and reads `record.manifestPath` for path sources.
- `manifest-cache.ts` says the cache holds "the raw JSON.parse value". It now holds a
  `MarketplaceManifestDocument`.

**Fix:** Update the comments to describe the baseline-versus-refreshed semantic comparison and the
document the cache stores.

### IN-02: `info.ts` re-implements tilde expansion with a replacement string

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts:85`
**Issue:** `src.logical.replace(/^~(?=$|\/)/, os.homedir())` duplicates `add.ts::expandTildePath`.
The two can drift, and they jointly define D-01 identity. A string replacement also treats `$&`,
`$'`, and `` $` `` in the home path as patterns.
**Fix:** Move `expandTildePath` (or a `resolvePathSource(record)` helper, see WR-02) into one module
that both `add` and `info` import, and pass a function, not a string, if `replace` stays.

### IN-03: The fixture lookup error names only the cosmetic step

**File:** `features/step_definitions/marketplace/update.steps.ts:83`
**Issue:** `comparisonFixture` throws `unknown cosmetic rewrite` even when the baseline step or the
semantic step called it.
**Fix:** Use `unknown comparison fixture ${rewrite}`, or remove the fixtures per WR-04.

### IN-04: `loadMarketplaceManifest` drops the new `Readonly` view

**File:** `extensions/pi-claude-marketplace/domain/manifest.ts:163-165`
**Issue:** `MarketplaceManifestDocument.manifest` is `Readonly<MarketplaceManifest>`, but
`loadMarketplaceManifest` returns it as a mutable `MarketplaceManifest`. So the cached object that
D-03 says callers must not mutate still reaches roughly 20 callers as a mutable type. This is not a
regression, but the new type already expresses the right contract.
**Fix:** Return `Promise<Readonly<MarketplaceManifest>>` and fix any caller that the compiler
reports.

---

_Reviewed: 2026-10-19T07:45:55Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
