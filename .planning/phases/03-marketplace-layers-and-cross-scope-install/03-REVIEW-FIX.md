---
phase: 03-marketplace-layers-and-cross-scope-install
fixed_at: 2026-11-21T00:00:00Z
review_path: .planning/phases/03-marketplace-layers-and-cross-scope-install/03-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-11-21
**Source review:** .planning/phases/03-marketplace-layers-and-cross-scope-install/03-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 4 (CR-01, CR-02, WR-01, WR-02; scope `critical_warning`)
- Fixed: 4
- Skipped: 0

All work ran in the main checkout on `claude/stoic-shannon-la9q7o`, not in a worktree, as the orchestrator required. Every verification number below can be reproduced from that tree.

## Fixed Issues

### CR-01: The MA-13 replacement drops the staging-leak and full-tree checks

**Files modified:** `features/plugin/cross-scope-install.feature`, `features/step_definitions/marketplace/checkout.steps.ts`
**Commit:** 6a02d04
**Applied fix:** The whole-scope steps could not be used here. With the correct code, the refused add still leaves an empty `pi-claude-marketplace/sources-staging/` directory. Other scenarios accept that directory (`holds no marketplace checkout` checks only that it is empty), so `the files of the project scope are unchanged` failed on correct code. I added two steps instead:

- `the checkout of the marketplace {string} in the {word} scope holds exactly these entries:` lists every entry under the checkout. Directories show with a trailing `/`, and `.git/` is included.
- `the {word} scope holds no staged marketplace checkout` checks that `sources-staging/` is empty.

The MA-13 scenario (`cross-scope-install.feature:121`) now uses both. The old file-only step stays for MA-12, which compares a real clone. The two read steps share a `checkoutEntries` helper, because fallow dupes flagged the first version.

**Red proofs (each break reverted, none committed):**

- I removed the MA-9 staging cleanup in `addStagedInGuard` (`orchestrators/marketplace/add.ts`). `1) Installing a plugin into the project scope refuses a directory of the user's own where the marketplace checkout goes and keeps it (MA-13) # features/plugin/cross-scope-install.feature:121` failed at `Then the project scope holds no staged marketplace checkout`, which found the leaked `<uuid>` directory.
- In the add's catch block, I created `<finalDir>/.git/` before the refusal. The same scenario failed at `Then the checkout of the marketplace "tools" in the project scope holds exactly these entries:`, which found the extra `.git/` row. I repeated this proof after the helper refactor.

### CR-02: The D-09 "add again" replacement does not check the installation record

**Files modified:** `features/marketplace/url-source.feature`, `features/step_definitions/config.steps.ts`, `features/support/world.ts`
**Commit:** e592d8b
**Applied fix:** I added the record-only snapshot steps `the installation record bytes of the {word} scope are remembered` and `... are unchanged`. They read `state.json` through a new `recordBytes` helper, which `scopeBytes` now reuses, and they store the bytes in a new world map, `rememberedRecordBytes`. The D-09 scenario (`url-source.feature:176`) remembers the record bytes just before the `When` and compares them at the end.
**Red proof:** In `runAddInGuard`'s reuse arm, I re-stamped `lastUpdatedAt` on every record and called `tx.save()`. `1) Adding again a url marketplace that the scope records but no layer declares declares it with no git request (D-09) # features/marketplace/url-source.feature:176` failed only at `Then the installation record bytes of the project scope are unchanged`. The other 14 steps passed. Reverted.

### WR-01: Replacements of "changes nothing" cases check no installation record or clone

**Files modified:** `features/marketplace/autoupdate.feature`, `features/marketplace/remove.feature`
**Commit:** 43c4b37
**Applied fix:** Four scenarios got `Given the files of the project scope are remembered` just before the `When` and `Then the files of the project scope are unchanged` after their checks:

- `autoupdate.feature:262`
- `autoupdate.feature:281`
- `remove.feature:542`
- `remove.feature:594`

In both remove scenarios, the unchanged check comes before `When the user starts a new pi session`.

**Red proofs (both breaks applied together, then reverted):**

- In `flipOneScope` (`autoupdate.ts`), I re-stamped `lastUpdatedAt` and called `tx.save()` before the plan.
- In the `marketplace remove` lock body (`remove.ts`), on `HeldRemovalStop` or `DeclarationIndexStop`, I dropped a plugin record and called `tx.save()` before rethrowing.

All four scenarios failed, each only at `Then the files of the project scope are unchanged # features/step_definitions/scope-state.steps.ts:70`:

- `1) Disabling autoupdate with --local on a marketplace only the base layer declares fails as marketplace in base layer only # features/marketplace/autoupdate.feature:281`
- `2) Removing a marketplace whose dependency declarations cannot be read fails and changes nothing # features/marketplace/remove.feature:594`
- `3) Enabling autoupdate without --local on a marketplace added with --local fails as marketplace in local layer only # features/marketplace/autoupdate.feature:262`
- `4) A refused remove reports every blocking plugin without removing any # features/marketplace/remove.feature:542`

### WR-02: Seeding still misses a same-repo git-subdir url that differs by a trailing slash

**Status:** fixed: requires human verification (this changes the same-repository comparison logic)
**Files modified:** `extensions/pi-claude-marketplace/domain/source.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts`, `test/domain/source.test.ts`, `test/orchestrators/plugin/clone-cache.test.ts`, `features/marketplace/url-source.feature`, `features/step_definitions/marketplace/publishing.steps.ts`, `features/lib/git-plugin.ts`
**Commit:** a0bda9e
**Applied fix:**

- **New domain helper (IN-01):** `domain/source.ts` exports `urlPathIdentity(url)`, which strips trailing slashes and then one `.git`. `stripUrlDecorations` now uses it, so the url identity rule lives in one place. It does not split off a `#<ref>` fragment, so a git-subdir url with a fragment still never seeds, as before.
- **Comparison (`clone-cache.ts`):** `withoutGitSuffix` is gone. A new `repositoryIdentity(source)` applies `urlPathIdentity` to a git-subdir url only. For url and github sources, it returns `canonicalCloneUrl`, because those urls already have identity form when they are parsed. The comparison is now `repositoryIdentity(src) !== marketplaceUrl`, and the marketplace url is no longer stripped a second time. This also closes IN-02, an origin ending in `r.git.git` that falsely matched `r`.
- **Seed key:** unchanged. It still hashes the plugin's verbatim `canonicalCloneUrl`.

**Tests:**

- `clone-cache.test.ts` has two new cases, for urls ending in `/` and in `.git/`, plus an IN-02 case: a path marketplace whose origin ends in `r.git.git` must not seed a plugin from `r`. A stored url marketplace whose url ends in `.git.git` does not survive a state reload, so that case uses a path origin.
- `source.test.ts` has five direct `urlPathIdentity` rows.
- **Scenarios:** the four D-SEED-01 scenarios in `url-source.feature` are now two Outlines, `:202` (pinned install, no git request) and `:225` (lists as available). Each has four `plugin url` rows: `tools`, `tools.git`, `tools/`, `tools.git/`.
- **Setup step:** the precondition check in the "offers these plugins from its own repository" step now also strips trailing slashes. I wrote it as a loop, not a regex. It stays independent of the product helper, so setup does not reuse the code under test.

**Red proofs:**

- **Unit:** I ran the tests before the product fix. The three new clone-cache cases failed (`/`, `.git/`, `r.git.git`).
- **Scenario:** I put the pre-fix `clone-cache.ts` and `source.ts` back, then restored the fix. The four trailing-slash rows failed:
  - `1) A plugin from the repository of a url marketplace lists as available right after the add (D-SEED-01) # features/marketplace/url-source.feature:248` and `3) ... # features/marketplace/url-source.feature:249`, at `Then the result lists these plugins:`
  - `2) Installing a pinned plugin from the repository of a url marketplace makes no git request after the add (D-SEED-01) # features/marketplace/url-source.feature:223` and `4) ... # features/marketplace/url-source.feature:222`, at `Then the git host receives no request`

  The other 15 scenarios passed.

**Direct coverage:** `npm run test:coverage:direct -- clone-cache.ts source.ts`, run with `env -i HOME=$HOME PATH=$PATH LANG=C.UTF-8 TMPDIR=/tmp` plus the npm prefix, exited 0 (100% for both pairs). The commit hook ran direct coverage for the staged pairs again.

## Verification

All checks ran in the main checkout.

- `npm run check:static`: passed. typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, and check:features all passed.
- Adapter profile, all four touched feature files (`cross-scope-install`, `url-source`, `autoupdate`, `remove`): 135 scenarios passed (1577 steps).
- Builtin profile on the same files: 0 scenarios selected, because no touched scenario carries an MCP tag.
- No integration test file was touched.
- `git status --porcelain -- extensions/` is empty. The only product change is the committed WR-02 fix.

## Notes for the orchestrator

- `.planning/STATE.md` records a planned CHANGELOG line for D-SEED-01 that says the url "ends in `.git`". After WR-02, the line could say "ends in `.git` or `/`". I did not edit `STATE.md` or `CHANGELOG.md`.
- IN-01 is partly done: the product has one helper now. The step in `publishing.steps.ts` keeps its own copy on purpose, so the test oracle does not depend on the code under test.

---

_Fixed: 2026-11-21_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
