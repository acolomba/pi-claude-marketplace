---
phase: 03-marketplace-layers-and-cross-scope-install
reviewed: 2026-11-21T23:05:07Z
depth: standard
iteration: 2
files_reviewed: 12
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/source.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - test/orchestrators/plugin/clone-cache.test.ts
  - test/domain/source.test.ts
  - features/support/world.ts
  - features/step_definitions/config.steps.ts
  - features/step_definitions/marketplace/checkout.steps.ts
  - features/step_definitions/marketplace/publishing.steps.ts
  - features/plugin/cross-scope-install.feature
  - features/marketplace/url-source.feature
  - features/marketplace/autoupdate.feature
  - features/marketplace/remove.feature
findings:
  critical: 0
  warning: 1
  info: 6
  total: 7
  necessity: 0
status: issues_found
---

# Phase 3: Code Review Report (iteration 2)

**Reviewed:** 2026-11-21T23:05:07Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Scope: the four iteration-1 fix commits in `15722a2..HEAD` (6a02d04 CR-01, e592d8b CR-02, 43c4b37 WR-01, a0bda9e WR-02). I read each changed file whole around the change and traced `urlPathIdentity` and `repositoryIdentity` through `parsePluginSource`, `canonicalCloneUrl`, `deriveMarketplaceUrl`, and `seedOnePluginMirror`.

### Status of the iteration-1 findings

| ID | Status | Evidence |
|---|---|---|
| CR-01 | Resolved | `cross-scope-install.feature:138-141` now states every entry of the checkout, directories and `.git/` included (`checkout.steps.ts:157-167`), and that `sources-staging/` is empty (`checkout.steps.ts:126-132`). Both regressions the earlier report named now fail the scenario. One assertion of the deleted case is still missing: see WR-01 below. |
| CR-02 | Resolved | `url-source.feature:183` and `:200` remember the `state.json` bytes and compare them. `recordBytes` (`config.steps.ts:56-58`) reads the same file `scopeBytes` reads, and `scopeBytes` now reuses it. |
| WR-01 | Resolved | All four scenarios (`autoupdate.feature:262`, `:281`; `remove.feature:542`, `:594`) remember the scope's files before the `When` and compare them before any new session starts. |
| WR-02 | Resolved | See the analysis below. |
| IN-01 | Resolved | The product has one identity helper, `urlPathIdentity` (`source.ts:576-578`), and `stripUrlDecorations` uses it. The copy in `publishing.steps.ts:162-169` is a deliberate independent oracle for a `Given` precondition, so it stays. |
| IN-02 | Resolved | The marketplace side is no longer stripped a second time (`clone-cache.ts:816`). The new unit case at `clone-cache.test.ts:2084-2102` fails on the pre-fix comparison. |
| IN-03 to IN-06 | Still apply | Carried forward below as IN-03 to IN-06. |

### WR-02 product change: correctness analysis

**`urlPathIdentity`:** it composes the same two steps in the same order (`stripTrailingSlashes`, then `stripGitSuffix`) that `stripUrlDecorations` composed inline. `stripUrlDecorations` has one caller, `parseUrlSource` (`source.ts:676`). Its output is unchanged for every input, so no parsed `url` identity moves, and no `pluginCloneKey` or `pluginMirrorKey` hash moves. `stripGitHubUrlDecorations` keeps its own order (strip slashes, split, strip `.git`) and is untouched.

**Marketplace side (`marketplaceUrl`):** `deriveMarketplaceUrl` always returns identity form. A `github` record gives `https://github.com/<o>/<r>`. A `url` record gives its parse-time url, with trailing slashes and one `.git` stripped. A `path` record's origin goes through `parsePluginSource(string)`, which yields only `url`, `github`, `path`, `hosted`, or `unknown`, never `git-subdir` (the only `git-subdir` constructor is `gitSubdirObjectSource`, `source.ts:263`, which takes an object). So the decision not to strip again is sound. It does rest on an unreachable arm staying unreachable, though (IN-01).

**Plugin side (`repositoryIdentity`):** `url` and `github` sources already have identity form after parsing, so `canonicalCloneUrl` is correct for them. A `git-subdir` url drops its trailing slashes and then one `.git`.

**What now compares as one repository:** a git-subdir entry whose url is `R`, `R/`, `R//`, `R.git`, or `R.git/` (any number of trailing slashes) matches a marketplace whose identity is `R`. A `url` or `github` entry matches only when its parsed identity equals `R`.

**False matches:** I found none.
- The `r.git.git` vs `r` false match (old IN-02) is closed in both directions, for a `url` entry and for a `git-subdir` entry.
- A git-subdir url with a `#<ref>` fragment never matches, because `urlPathIdentity` does not split the fragment. This keeps the earlier behavior.
- A non-https git-subdir url (`git@...`, `http://`) never equals an https identity.
- One contrived form, `R/.git`, reduces to `R/` on both sides. It matches only the same spelling, so it is a missed seed, not a false match.

**Stored keys:** unchanged. `seedOnePluginMirror` still hashes the plugin's verbatim `canonicalCloneUrl` (`clone-cache.ts:710-712`). The install materializer and the presence probe compute the same key. A seeded `R/` entry and a seeded `R` entry get two separate mirror directories, as they did before for `R.git`. No existing `plugin-clones/` directory is rehashed.

**Tests:** the `/` and `.git/` unit rows (`clone-cache.test.ts:2055-2082`) and the four trailing-slash scenario rows (`url-source.feature:220-221`, `:247-248`) each fail on the pre-fix comparison, per the fixer's red proofs. I checked that claim against the code paths. The `urlPathIdentity` rows in `source.test.ts:1869-1907` follow the skill's data-row form.

### New harness against the cucumber rules

- `rememberedRecordBytes` is an initialized world field (`world.ts:277`), as the world rule requires.
- The new `Given` writes only that field, and the two new `Then` steps write nothing to the world (`steps.md`, "No other `Then` writes to the world").
- The step texts are Cucumber expressions with one definition each, and they do not overlap with `the {word} scope holds no marketplace checkout`.
- The helpers stay private to their step modules (`layout.md`, "A small helper private to one step module may stay in it").
- The new Outlines that carry `the git host receives no request` live in `url-source.feature`, a git-source feature, and are not shared with the local kinds.

## Warnings

### WR-01: The MA-13 replacement still does not check the content of the user's file, which the deleted case asserted

**File:** `features/plugin/cross-scope-install.feature:121-144`, `features/step_definitions/marketplace/checkout.steps.ts:157-167`
**Issue:** The deleted case (`git show 792d2ef:test/integration/project-install-adds-user-marketplace.test.ts`, lines 409-412) asserted two things:

```ts
[await readFile(path.join(foreign, "notes.txt"), "utf8"), await projectFootprint(env)],
["the user's notes", [[], ["mp", path.join("mp", "notes.txt")], [], undefined]],
```

The CR-01 fix restored the footprint half: the entry list and the empty staging directory. It did not restore the content half. `holds exactly these entries:` compares names and entry types only.

So a refused add that overwrites or truncates `notes.txt` and then throws `StaleSourceCloneError` passes the scenario. The scenario's own title promises that the add "refuses a directory of the user's own ... and keeps it". The directory is user data that MA-13 exists to protect. No other scenario covers this, because this is still the only `stale clone` scenario.

The project-scope `the files of the ... are remembered/unchanged` pair, which compares bytes, cannot be used here. The fix report says why: the refused add leaves an empty `sources-staging/`.
**Fix:** Pin the bytes in the entry step itself, so one step states the whole directory. Add a `content` column: a directory row gets an empty cell, and a file row gets its text.

```gherkin
    Then the checkout of the marketplace "tools" in the project scope holds exactly these entries:
      | entry     | content          |
      | notes.txt | the user's notes |
```

In `checkoutEntries`, read each file's text with `readFile(..., "utf8")` and project `[entryPath, content]` rows against `table.raw()`. As a smaller alternative, add a dedicated `Then the file {string} of the checkout of the marketplace {string} in the {word} scope holds the text {string}`.

## Info

### IN-01: `deriveMarketplaceUrl`'s `git-subdir` arm is unreachable, and the WR-02 comparison now relies on that

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:666-669`
**Issue:** `parsePluginSource(origin)` receives a string from `readOriginRemoteUrl`. A string never parses to `git-subdir`: only `gitSubdirObjectSource` (`source.ts:263`) builds that kind, and it takes an object. So `parsed.kind === "git-subdir"` is dead.

The arm also matters for WR-02. The new comparison (`clone-cache.ts:816`) no longer normalizes `marketplaceUrl`, because the marketplace url is assumed to be in identity form already. If this arm were ever reachable, it would return a verbatim git-subdir url through `canonicalCloneUrl`, which may end in `/` or `.git`, and the assumption would break without a sound.
**Fix:** Drop the `git-subdir` disjunct, so the arm reads `parsed.kind === "url" || parsed.kind === "github"`. If coverage needs a reason, add a one-line comment that a remote url string parses only to those two git kinds.

### IN-02: Seeding doc comments still describe the `.git`-only rule

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:697-699`, `:779`; `extensions/pi-claude-marketplace/domain/clone-key.ts:75-77`
**Issue:**
- `seedOnePluginMirror`'s doc says the seed lands where install looks "even when the plugin's url keeps a `.git` the marketplace url drops". After WR-02, this also covers trailing slashes.
- `canonicalCloneUrl`'s doc in `clone-key.ts` still says "mirror seeding compares them without the suffix", which is now incomplete.
- The rewrap of `seedSameRepoPluginMirrors`'s doc left one ragged line at `:779`, noticeably longer than the lines around it.

**Fix:** In both docs, say "a `.git` or trailing slashes", or refer to `urlPathIdentity`. Rewrap the paragraph at `:773-785`.

### IN-03: The cross-scope replacements no longer check the ownership marker in the project clone (carried forward)

**File:** `features/plugin/cross-scope-install.feature:71-97`, `:169-206`
**Issue:** This is unchanged since iteration 1. The deleted LAYER-07 cases asserted `<projectClone>/.git/pi-claude-marketplace.json`, and no scenario in this file pins it.
**Fix:** Optionally add an `owned` column to `holds these git clones`, or add a dedicated step.

### IN-04: The url row of "keeps the marketplace updatable in the project scope" does not show that the update fetched into the project clone (carried forward)

**File:** `features/marketplace/remove.feature:775-805`
**Issue:** This is unchanged. The row checks only `skipped {up-to-date}`, and an update that never fetches produces the same result. The Outline is shared with the local kinds, so it cannot carry a request-log step.
**Fix:** If the fetch matters for LAYER-07, add a url-only scenario that states `the git host receives these requests:`.

### IN-05: The "changes nothing" checks compare bytes, not mtimes as the deleted autoupdate snapshot did (carried forward)

**File:** `features/step_definitions/scope-state.steps.ts:19-38`
**Issue:** This is unchanged, and it now also applies to the four scenarios that the iteration-1 WR-01 fix extended. A rewrite with the same bytes passes.
**Fix:** No change is needed unless "writes nothing" (MPA-01) is a contract the project wants to pin.

### IN-06: Header comment of `installation.steps.ts` has a merged overlong line (carried forward)

**File:** `features/step_definitions/plugin/installation.steps.ts:22`
**Issue:** This is unchanged. "directory that a dependency install does not create. Others rewrite the whole installation record" is still one line of more than 100 characters. The file is outside this iteration's scope, but the finding still applies.
**Fix:** Rewrap the paragraph.

---

_Reviewed: 2026-11-21T23:05:07Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
