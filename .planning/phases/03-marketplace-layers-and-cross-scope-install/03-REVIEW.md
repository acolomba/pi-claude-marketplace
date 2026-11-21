---
phase: 03-marketplace-layers-and-cross-scope-install
reviewed: 2026-11-21T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/domain/clone-key.ts
  - test/orchestrators/plugin/clone-cache.test.ts
  - features/lib/git-plugin.ts
  - features/step_definitions/marketplace/checkout.steps.ts
  - features/step_definitions/marketplace/publishing.steps.ts
  - features/step_definitions/plugin/installation.steps.ts
  - features/marketplace/autoupdate.feature
  - features/marketplace/remove.feature
  - features/marketplace/url-source.feature
  - features/plugin/cross-scope-install.feature
  - test/integration/marketplace-layer-remove.test.ts
findings:
  critical: 2
  warning: 2
  info: 6
  total: 10
  necessity: 0
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-11-21
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Scope: the changes since `792d2ef`. That is the D-SEED-01 seeding fix (`cd728de`) in `clone-cache.ts`, a comment change in `clone-key.ts`, two new unit cases, the new scenarios and steps, and the deletion of three integration tests (plus the trimming of a fourth). I compared each deleted case (`git show 792d2ef:<path>`) with the scenario that the plan summaries name as its replacement.

**The fix is correct for the case it targets.** A url marketplace's identity drops one `.git` when the source is parsed. A git-subdir source keeps the url its manifest wrote. So before the fix, a same-repo `repo.git` entry never seeded. The fix ignores the suffix when it compares the two urls, and it keys the seed under the plugin's own `canonicalCloneUrl`. The install materializer (`materializeUnpinnedSource`, line 395) and the presence probe (`git-source-probe.ts:189/221`) compute that same key, so the seed lands where they look.

- **Stored keys:** no stored key changes. When the old exact comparison matched, `canonicalCloneUrl(src) === marketplaceUrl`, so the key is identical. Only entries that never seeded before now seed.
- **Other callers:** `seedOnePluginMirror` has one caller, and `withoutGitSuffix` is private.
- **Red tests:** without the fix, both unit cases fail on `pluginMirror`/`pluginClone: false`. Both `.git` scenarios also fail: the list one reads `remote`, and the pinned install one sends git requests.

**The weak spot is test migration.** Two replacing scenarios check less than the integration cases they replaced. A plausible regression passes each of them, and no other scenario catches it. These are CR-01 and CR-02. Several "changes nothing" scenarios that were mapped onto existing scenarios also lost the state-file part of the old footprint check (WR-01). The fix also leaves one spelling of the same defect class unhandled (WR-02).

## Critical Issues

### CR-01: The MA-13 replacement drops the staging-leak and full-tree checks, and no other scenario has them

**File:** `features/plugin/cross-scope-install.feature:121-143`, `features/step_definitions/marketplace/checkout.steps.ts:115-131`
**Issue:** The deleted case `project-install-adds-user-marketplace.test.ts` "MA-13: a project install refuses a foreign tree..." asserted `projectFootprint`. That check covered four things: no marketplace records, `sources/` exactly `["mp", "mp/notes.txt"]`, an empty `sources-staging/`, and no base config.

The order matters here. `addStagedInGuard` (`orchestrators/marketplace/add.ts`) clones into `sources-staging/<uuid>` first. Only after that does `recognizeLeftover` throw `StaleSourceCloneError`. So the MA-9 cleanup of that staging directory is exactly what this case protected.

The new scenario checks less:
- It never checks `sources-staging/`. It calls neither `holds no marketplace checkout` nor any `git clones` step, and `readGitClones` is what asserts empty staging.
- Its checkout step drops every directory and every path under `.git/` (line 126).

Two plausible regressions pass the scenario: a refusal that leaks the staged clone, and an add that writes a `.git/` (marker or config) into the user's directory before refusing. This is the only `stale clone` scenario in the suite (`grep -rn "stale clone" features/`), so nothing else catches either one.
**Fix:** Add a staging assertion and a full-tree assertion to the scenario. Example: a step that states the checkout path holds exactly these entries, directories and `.git` included, plus a staging-empty step.
```gherkin
    Then the checkout of the marketplace "tools" in the project scope holds exactly these entries:
      | entry     |
      | notes.txt |
    Then the project scope holds no staged marketplace checkout
```
The first step should list `readdir(checkout, { recursive: true })` without the `.git` filter. The second should assert that `sources-staging/` is empty, as `holds no marketplace checkout` does at `checkout.steps.ts:95`.

### CR-02: The D-09 "add again" replacement does not check the installation record, though the deleted case and the source contract both require that it stays unchanged

**File:** `features/marketplace/url-source.feature:176-197`
**Issue:** The deleted `marketplace-layer-redeclare.test.ts` "declares again a url marketplace the scope records but no layer declares" asserted `readFile(stateJsonPath) === stateBefore`. The source contract says the same thing. `recordedSourceAction`'s doc (`add.ts:572-575`) says the add "reuses the record and its clone: no clone, no git call, no state write".

The new scenario checks four things: the result, no git request, the clone list, and the two config files. It never checks `state.json`. A regression that rewrites the reused record without cloning passes. An example is a re-stamped `lastUpdated`, which `marketplace list` shows as `last updated at`, or a rebuilt `plugins` map. The sibling LAYER-01 scenario (line 152) catches this with `the config and installation record bytes ... are unchanged`. That step cannot be used here, because the base config changes.
**Fix:** Add a remembered/unchanged pair for the installation record alone. The `scopeBytes` helper in `config.steps.ts:55` already reads `state.json`, so the change is small:
```gherkin
    Given the installation record bytes of the project scope are remembered
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools.git --scope project"
    ...
    Then the installation record bytes of the project scope are unchanged
```

## Warnings

### WR-01: Replacements of "changes nothing" cases that were mapped onto existing scenarios check no installation record or clone

**File:** `features/marketplace/autoupdate.feature:262-277`, `:279-294`; `features/marketplace/remove.feature:542-590`, `:592-628`
**Issue:** The plan summaries map these deleted cases onto existing scenarios:

| Deleted case | Existing scenario it maps onto | What the deleted case snapshotted |
|---|---|---|
| `marketplace-layer-autoupdate.test.ts` LAYER-02 refusal pair | autoupdate `:262`, `:279` | `state.json` + base + local, bytes and mtime |
| `marketplace-layer-remove.test.ts:321` "...preserves all installed state and skill bytes" | remove `:542` | `removeFootprint`: state bytes, both configs, clone entries, clone manifest, skills dir, and every `SKILL.md` byte |
| `marketplace-layer-remove.test.ts:748` D-05-07 "...changes nothing" | remove `:592` | the same `removeFootprint` |

The existing scenarios compare the config declarations and, for remove, the skills of a new session. None of them checks the installation record.

`:592` is titled "fails and changes nothing", but no step checks the record or the files. A refused remove that drops a record and keeps its staged files passes `:542`. The new scenarios in this same phase use `the files of the project scope are remembered/unchanged` for exactly this purpose: `remove.feature:970`, `:989` and `autoupdate.feature:695`, `:739`. These four did not get it.
**Fix:** In each of the four scenarios, add `Given the files of the project scope are remembered` just before the `When`, and `Then the files of the project scope are unchanged` after it. `:542` and `:592` start a new session afterwards, so put the unchanged check before `When the user starts a new pi session`.

### WR-02: Seeding still misses a same-repo git-subdir url that differs from the marketplace identity by a trailing slash

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:681-683`, `:816`
**Issue:** This is the same class of defect that D-SEED-01 fixes. The marketplace identity of a url source comes from `stripUrlDecorations` (`domain/source.ts:625`), which strips trailing slashes and then one `.git`. A git-subdir source keeps the url verbatim (`gitSubdirObjectSource`, `source.ts:263`). `withoutGitSuffix` reconciles only the `.git` difference.

So `https://host/acme/tools/` and `https://host/acme/tools.git/` still compare unequal to the identity `https://host/acme/tools`. Such an entry is never seeded: it lists as `remote` right after the add, and a pinned install clones again. The fix's own doc says "`repo` and `repo.git` name one repo", but the asymmetry it set out to remove is wider than the suffix.
**Fix:** Compare both sides in the identity form the marketplace url already has. Keep the seed key on the plugin's verbatim `canonicalCloneUrl`, so the key does not move. For example, export a pure `urlIdentity(url)` from `domain/source.ts` that composes `stripTrailingSlashes` and `stripGitSuffix`, and use it in place of `withoutGitSuffix` at line 816. Add a unit case for `${GITHUB_REPO_URL}/`.

## Info

### IN-01: `withoutGitSuffix` is a third copy of `domain/source.ts::stripGitSuffix`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:681-683`, `features/step_definitions/marketplace/publishing.steps.ts:158-161`
**Issue:** `stripGitSuffix` (`domain/source.ts:565-567`) has the same body. The identity rule now lives in three places, so the next change to it (see WR-02) can move one copy and leave the others behind.
**Fix:** Export one identity helper from `domain/source.ts` (domain is an allowed import for orchestrators). Use it in `clone-cache.ts`, and consider using it from the step as well.

### IN-02: Stripping `.git` from the marketplace side creates a false same-repo match for a `.git.git` url

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:816`
**Issue:** `marketplaceUrl` already went through one `.git` strip when it was parsed. Stripping again turns `https://host/o/r.git.git` (identity `https://host/o/r.git`) into `https://host/o/r`. That matches a git-subdir entry for `https://host/o/r`, which then seeds from a different repository's checkout. The case is contrived, but the second strip has no other effect, because every other identity no longer ends in `.git`.
**Fix:** Normalize only the plugin side, or use one identity function on both sides that is idempotent for the marketplace identity (see WR-02).

### IN-03: The cross-scope replacements no longer check the ownership marker in the project clone

**File:** `features/plugin/cross-scope-install.feature:71-97`, `:169-206`
**Issue:** The deleted LAYER-07 cases asserted `pathExists(<projectClone>/.git/pi-claude-marketplace.json)`. Without that Q-01 marker, a later interrupted add is refused as a foreign tree (MA-12/MA-13). The marker is written by the shared staging step, so a regression would probably show up elsewhere. Still, no scenario here pins it.
**Fix:** Optionally extend `holds these git clones` with an `owned` column, or add a dedicated step.

### IN-04: The url row of "keeps the marketplace updatable in the project scope" does not show that the update fetched into the project clone

**File:** `features/marketplace/remove.feature:771-801`
**Issue:** Deleted case `project-install-adds-user-marketplace.test.ts:214` asserted that the project update fetched only `projectClone`. The replacing Outline row checks only `skipped {up-to-date}`, which an update that never fetches also produces. A request-log step cannot go into an Outline that is shared with the local kinds (cucumber steps rule).
**Fix:** If the fetch matters for LAYER-07, add a url-only scenario that states `the git host receives these requests:` for the project update.

### IN-05: The "changes nothing" checks compare bytes, not mtimes as the deleted autoupdate snapshot did

**File:** `features/step_definitions/scope-state.steps.ts:19-38` (used by `autoupdate.feature:695`, `:739`)
**Issue:** `fileSnapshot` in the deleted autoupdate test recorded `mtimeNs`, so a byte-identical rewrite failed it. `scopeFiles` compares content only. A user would not see a byte-identical rewrite, so this is noted only to record that the replacement is not a strict superset.
**Fix:** No change needed, unless the project treats "writes nothing" (MPA-01) as a contract worth pinning.

### IN-06: Header comment of `installation.steps.ts` has a merged overlong line

**File:** `features/step_definitions/plugin/installation.steps.ts:21-22`
**Issue:** The insertion left "directory that a dependency install does not create. Others rewrite the whole installation record" on one 100+ character line, and the paragraph's reading order now skips between topics.
**Fix:** Rewrap the paragraph.

---

_Reviewed: 2026-11-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
