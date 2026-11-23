---
phase: 03-marketplace-layers-and-cross-scope-install
reviewed: 2026-11-21T23:21:13Z
depth: standard
iteration: 3
files_reviewed: 2
files_reviewed_list:
  - features/plugin/cross-scope-install.feature
  - features/step_definitions/marketplace/checkout.steps.ts
findings:
  critical: 0
  warning: 0
  info: 6
  total: 6
  necessity: 0
status: issues_found
---

# Phase 3: Code Review Report (iteration 3)

**Reviewed:** 2026-11-21T23:21:13Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found (Info only, no warning or blocker remains)

## Summary

Scope: commit 717dbda, the iteration-2 fix for WR-01. `git diff 78ac08a HEAD -- extensions features test` touches only the two listed files. I read both files whole, the fix report, and the cucumber skill rules (`SKILL.md`, `rules/steps.md`, `rules/features.md`). I did not run the suite, as asked. A full `npm run check` runs separately.

### Status of the iteration-2 findings

| ID | Status | Evidence |
|---|---|---|
| WR-01 | Resolved | `checkout.steps.ts:165-181` now projects each entry to `[path, text]` for a file and `[path/, ""]` for a directory, and compares the whole row set, header included, against `table.raw()`. `cross-scope-install.feature:138-140` states `\| notes.txt \| the user's notes \|`. A refused add that truncates, overwrites, or appends to `notes.txt` now fails the scenario, because the cell is compared exactly. The `Given` writes the text with no trailing newline (`checkout.steps.ts:112`), so the strict compare matches the planted bytes. The fixer's red proof targets a real function: `recognizeLeftover` exists at `orchestrators/marketplace/add.ts:1687` with a `finalDir` argument, and the MA-13 path reaches it through `recognize` at `add.ts:893-894`. |
| IN-01 to IN-06 | Still apply | Carried forward unchanged below. I checked each cited location against the current tree. |

### Checks on the fix

- **Step uniqueness and use:** the step text did not change, it has one definition, and `cross-scope-install.feature:138` is its only use. The sibling step `holds these files:` (`:152-160`) still uses `pathRows`, so no helper became dead. `checkoutEntries` gained `absolutePath`, and the file-list step simply ignores it.
- **Cucumber rules:** the `Then` compares strings with the header against `table.raw()` and `deepStrictEqual` (`steps.md`, data-table rule). It writes nothing to the world. The table is aligned, and the header cells are lower-case field names (`features.md`).
- **File and directory rows cannot collide:** an empty file reads `[x, ""]` and a directory reads `[x/, ""]`, so the trailing `/` keeps them apart.
- **Ordering:** rows sort by path with `localeCompare`, as `pathRows` does. One checkout cannot hold two entries with the same path, so the sort is total.
- **Edge cases I considered and did not report:**
  - A binary file under a new `.git/` would read as garbled UTF-8. That happens only on a path where the comparison already fails, so the verdict stays correct.
  - A symlink entry is neither a directory nor a regular file here, and `readFile` follows it. A refused add that swapped `notes.txt` for a symlink to a file with the same text would pass, but no plausible regression does that.
  - File text is not projected back through the run tokens. The only file this step reads holds plain text, so no current row needs it.

## Info

### IN-01: `deriveMarketplaceUrl`'s `git-subdir` arm is unreachable, and the WR-02 comparison now relies on that (carried forward)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:666-669`
**Issue:** This is unchanged. `parsePluginSource(origin)` receives a string from `readOriginRemoteUrl`, and a string never parses to `git-subdir`. Only `gitSubdirObjectSource` (`source.ts:263`) builds that kind, and it takes an object. The seeding comparison assumes the marketplace url is already in identity form. If this arm ever became reachable, it would return a verbatim git-subdir url, and that assumption would break without any test noticing.
**Fix:** Change the condition to `parsed.kind === "url" || parsed.kind === "github"`.

### IN-02: Seeding doc comments still describe the `.git`-only rule (carried forward)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:697-699`, `:779`; `extensions/pi-claude-marketplace/domain/clone-key.ts:75-77`
**Issue:** This is unchanged. `seedOnePluginMirror`'s doc still says "a `.git` the marketplace url drops". `canonicalCloneUrl`'s doc still says "compares them without the suffix". Neither mentions trailing slashes. The rewrap at `:779` still leaves one ragged, overlong line.
**Fix:** Say "a `.git` or trailing slashes", or refer to `urlPathIdentity`, and rewrap `:773-785`.

### IN-03: The cross-scope replacements no longer check the ownership marker in the project clone (carried forward)

**File:** `features/plugin/cross-scope-install.feature:71-97`, `:170-207`
**Issue:** This is unchanged. No scenario in this file checks `<projectClone>/.git/pi-claude-marketplace.json`, which the deleted LAYER-07 cases asserted.
**Fix:** Optionally add an `owned` column to `holds these git clones`, or add a dedicated step.

### IN-04: The url row of "keeps the marketplace updatable in the project scope" does not show that the update fetched into the project clone (carried forward)

**File:** `features/marketplace/remove.feature:775-805`
**Issue:** This is unchanged. The row checks only `skipped {up-to-date}`, and an update that never fetches gives the same result. The Outline is shared with the local kinds, so it cannot carry a request-log step.
**Fix:** If the fetch matters for LAYER-07, add a url-only scenario that states `the git host receives these requests:`.

### IN-05: The "changes nothing" checks compare bytes, not mtimes as the deleted autoupdate snapshot did (carried forward)

**File:** `features/step_definitions/scope-state.steps.ts:19-38`
**Issue:** This is unchanged. A rewrite with the same bytes passes.
**Fix:** No change is needed unless the project wants to pin "writes nothing" (MPA-01) as a contract.

### IN-06: Header comment of `installation.steps.ts` has a merged overlong line (carried forward)

**File:** `features/step_definitions/plugin/installation.steps.ts:22`
**Issue:** This is unchanged. The line "directory that a dependency install does not create. Others rewrite the whole installation record" is still 100 characters or longer.
**Fix:** Rewrap the paragraph.

---

_Reviewed: 2026-11-21T23:21:13Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
