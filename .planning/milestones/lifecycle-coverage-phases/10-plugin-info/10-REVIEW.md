---
phase: 10-plugin-info
reviewed: 2026-10-23T08:45:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - test/orchestrators/plugin/info.test.ts
  - features/plugin/info.feature
findings:
  critical: 1
  warning: 3
  info: 4
  total: 8
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-10-23T08:45:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

I reviewed the D-03 fix in `buildGitNotInstalledRow`, the new unit test, and the nine
scenarios in `features/plugin/info.feature`. I compared the fix with
`deriveInstallVersion` in `orchestrators/plugin/install-outcome.ts:453-470` and checked the
scenarios against the cucumber rules.

A note on scope: during the review, an in-progress `git commit` in this worktree (only
`info.ts` and the test were staged) had its pre-commit hook stash the unstaged
`features/plugin/info.feature`. The working copy showed only the Phase 1 seed scenario.
I rebuilt the nine-scenario file from the hook's patch
(`~/.cache/pre-commit/patch1792743930-66485`) in the scratchpad and reviewed that copy.
Feature line numbers below refer to it. `npx cucumber-js` on the rebuilt file: 9
scenarios, 79 steps, all pass. I could not run `npm run check:features`, because it
reads only `features/`, which held the seed. If the hook does not restore the file, the
scenarios survive only in that patch file.

The fix works for the case it targets (entry with no version, warm unpinned mirror), and
the `--fetch` scenario would fail without it. Main concerns:

- INF-01 cannot tell the installed version apart from the offered version.
- `info --fetch` runs the materializing probe twice. The new version comes from the
  first probe, but the components come from the tree after the second refresh. The
  scenario's request table locks in the doubled fetch.
- When the entry declares a version, the info row still differs from what install
  records.

## Critical Issues

### CR-01: The INF-01 scenario passes when info shows the offered version instead of the installed one

**File:** `features/plugin/info.feature:26-48` (also the seed scenario at `:7-24`)
**Issue:** The marketplace offers `demo` at `1.0.0`, the install records `1.0.0`, and the
row shows `plugin version | 1.0.0`. The installed row takes `installed.version`
(`info.ts:1368`), and the not-installed row takes `entry.version` (`info.ts:1301`). An
implementation that showed `entry.version` on the installed row would still pass. That
swap is plausible: `invalidManifestBlock` (`info.ts:1432`) already picks between the two.
D-04 says info describes the installation, not what the marketplace offers now, but no
scenario pins that. Under the cucumber skill this is a BLOCKER: a plausible wrong
implementation still passes.
**Fix:** After the install, make the offered version differ from the installed one, then
expect the installed version:

```gherkin
  Scenario: Info on an installed plugin shows its installed version, scope, marketplace, and skills
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 2.0.0   |
    When the user runs "/claude:plugin info demo@fixtures"
    Then the result has these fields:
      ...
      | plugin version                 | 1.0.0         |
```

If a dir-source marketplace must be refreshed before info sees the new manifest, run
`marketplace update` in a `Given` step.

## Warnings

### WR-01: `info --fetch` fetches twice, so the new version can come from a different commit than the components

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:2515,2540,2545`; `features/plugin/info.feature:175-180`
**Issue:** `buildGitNotInstalledRow` calls `probe(gitSource)` at line 2515. It then passes
the same `probe` to `resolveStrict` as `resolveGitPluginRoot` at line 2545. In fetch mode,
`probe` is `makeFetchProbe`, so `materializeOrRefreshPluginMirror` runs twice and refreshes
the same mirror directory in place each time. I confirmed this with a scratch scenario. A
cold `info --fetch` sends 6 requests (clone, refresh, refresh). A cold install sends 4
(`features/plugin/git-source.feature:24-29`), because install probes once inside
`resolveStrict` and captures the sha there (`install-outcome.ts:697-724`).

The new line 2540 takes the version from the FIRST probe's `presence.resolvedSha`. The
components come from `pluginRoot` after the SECOND refresh. If the repository moves
between the two fetches, the row shows revision N's version with revision N+1's
components. Before this change the row showed no sha, so this mismatch is new.

The `--fetch` scenario's request table (lines 175-180) states two GET/POST pairs for a warm
refresh, so it locks in the doubled fetch. A single-fetch fix would fail the scenario. The
installed-row path has the same double probe (`info.ts:2181,2187`), but that code was
already there.
**Fix:** Resolve against the result the first probe already returned:

```ts
const ctx: ResolveContext = {
  marketplaceRoot: mpRecord.marketplaceRoot,
  marketplaceName: mpRecord.name,
  readFileText: (filePath) => reader.readTextFile(filePath),
  resolveGitPluginRoot: () => Promise.resolve(presence),
};
```

Then cut the scenario's request table to the single refresh (one GET and one POST). Apply
the same change at line 2187.

### WR-02: When the entry declares a version, the warm git row still differs from what install records

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:2538-2540`
**Issue:** `deriveInstallVersion` (`install-outcome.ts:463-467`) records `sha-<12hex>` for
every git source that has a resolved sha. It ignores both the entry version and the
`plugin.json` version. The info row uses `version ?? shaVersion(...)`, so an entry that
declares `1.2.3` shows `v1.2.3 (available)`, and the install then records `sha-…`. So the
D-03 bug ("`info --fetch` could not report a new revision") remains for every git entry
that declares a version, because the row never changes after a fetch. The code comment
and D-03 both justify the fallback as "the version an install of that tree records". For
these entries, that statement is false. The precedence also does not match upstream, where
the manifest (`plugin.json`) version beats the entry's (see the 10-CONTEXT upstream notes).
D-03 records "the entry still wins" as a decision. I flag it because it contradicts the
D-77-01 rule it cites.
**Fix:** Ask the user. Then either use the sha unconditionally on the warm git arm, as
install does, and update the warm-git unit tests that expect the entry version
(`info.test.ts:5215` and similar):

```ts
const warmVersion = shaVersion(presence.resolvedSha);
```

or keep the entry version and rewrite the comment and D-03 to say the info row differs
from the recorded version when the entry declares one. For the first option, consider a
small shared domain helper, so that info and install cannot drift apart again.

### WR-03: The title of the partial-availability scenario claims more than the result shows

**File:** `features/plugin/info.feature:72`
**Issue:** The title is "...names the unsupported component an install would leave out".
The full field comparison shows that the result carries only the generic reason
`unsupported component`. Nothing in the result names the output style. A reader would
expect the component to be named.
**Fix:** Rename the scenario to "Info on a partially available plugin reports an
unsupported component and the skills an install would keep".

## Info

### IN-01: The catch arm for an unreadable warm tree drops the sha version

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:2577-2578`
**Issue:** After `presence` is `materialized`, the catch arm uses `version`, not
`warmVersion`. The clone is present and its commit is known, but if the tree is
unreadable, the row loses the version that the success arms show.
**Fix:** Use `...(warmVersion !== undefined && { version: warmVersion })`, or just
`version: warmVersion`, since it is always defined.

### IN-02: `list` and `info` now show different versions for the same fetched git plugin

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-row.ts:49`
**Issue:** `list` still shows only `manifestEntry.version`. So a fetched git plugin whose
entry has no version shows `sha-…` in info and no version in list. This is deferred in
10-CONTEXT, but this phase makes the difference visible to users.
**Fix:** Track it as the deferred follow-up. Apply the same warm-sha fallback, or the
WR-02 decision, in list.

### IN-03: No scenario covers `info --fetch` on an installed plugin (D-04)

**File:** `features/plugin/info.feature`
**Issue:** D-04 says that on an installed plugin, `info --fetch` keeps showing the
installed revision. No scenario proves it, and CR-01 shows that the installed and offered
versions are never told apart.
**Fix:** Add a git-source scenario: install, publish revision 2, run
`info ghp@gits --fetch`, then expect `{ghp revision 1}` and the refresh requests.

### IN-04: The unit test covers only the unpinned-mirror arm

**File:** `test/orchestrators/plugin/info.test.ts:9408-9443`
**Issue:** The new test seeds a warm URL-keyed mirror. It does not cover a pinned
per-sha clone (`probeShaClone`, where `resolvedSha` is the manifest pin), or the warm
non-installable arm that also gets `warmVersion`. Line coverage is unaffected, because
both call sites share one expression.
**Fix:** Optional. Add a pinned warm-clone case that expects `v#<pin 7hex>`.

---

_Reviewed: 2026-10-23T08:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
