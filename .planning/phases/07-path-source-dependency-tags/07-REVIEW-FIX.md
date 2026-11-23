---
phase: 07-path-source-dependency-tags
fixed_at: 2026-11-23T02:10:00Z
review_path: .planning/phases/07-path-source-dependency-tags/07-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 07: Code Review Fix Report

**Fixed at:** 2026-11-23T02:10:00Z
**Source review:** .planning/phases/07-path-source-dependency-tags/07-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, WR-01, WR-02, plus IN-01 and IN-03 by the orchestrator's scope; IN-02 stays open)
- Fixed: 5
- Skipped: 0

All work, the green runs, and the red proofs ran in the main checkout on `claude/stoic-shannon-la9q7o` (no worktree, by the orchestrator's instruction), so the results reproduce from that tree.

## Fixed Issues

### CR-01: The trimmed integration file no longer catches a tag checkout that overwrites the marketplace checkout

**Files modified:** `test/integration/path-source-tag-install.test.ts`, `features/plugin/install-dependencies.feature`
**Commit:** 9abf37b
**Applied fix:** `buildTwoTagMarketplace` now commits past both tags (formatter and linter at `2.0.0`). A new `marketplaceCheckoutSnapshot` helper reads `.git/HEAD`, `.git/index`, and every file tracked on `main`, and the D-07-04 case compares the whole snapshot before and after the install. In S1, the HEAD-moving publish offers `app` 1.1.0, so the `app` row, its record, and its whole staged `SKILL.md` (`Version 1.1.0.`) show that the marketplace clone still holds HEAD after the tag is materialized.

**Red proof (break C1):** a tag checkout in place that keeps HEAD. `orchestrators/plugin/clone-cache.ts` calls `gitOps.checkout({ dir: args.marketplaceRoot, ref: args.tagOid, noUpdateHead: true })` before `checkoutGitDirCopy`, and `platform/git.ts` `checkout` passes `noUpdateHead` through to isomorphic-git.
- Integration (`break-int.sh`, log `fix-07/C1-integration.log`): the D-07-04 case fails on its snapshot assertion. Both `plugin.json` files read `1.0.0` instead of `2.0.0`, and the index bytes differ. The CR-01 leak case passes. `exit=1`, `restored=clean`. I ran it on the CR-01 commit (`C1-integration.first.log`) and again on the final tree.
- S1 (`break.sh`, adapter, log `fix-07/C1-adapter.log`): fails on `Then the result lists these plugins:` (the `app` version is `1.0.0`, expected `1.1.0`). `exit=1`, `restored=clean`. I ran it on the CR-01 commit (`C1-adapter.first.log`) and again on the final S1.

### WR-01: Two tags on one commit get the same projection, so a result can never show the second tag's token

**Files modified:** `features/support/world.ts`, `.agents/skills/cucumber/rules/features.md`
**Commit:** e169e7f
**Applied fix:** `recordMarketplaceTag` now asserts two things, the way `recordErrorMessage` refuses a second message. A second tag on a commit that the scenario already tagged is refused (`{tools revision linter--v1.0.0} would stand for the commit of {tools revision formatter--v1.0.0}`). A token that another token already names is refused (`... already stands for another commit`), for example the tag `1` of the marketplace `tools` beside revision 1 of a git repository `tools`. The token rule in `features.md` now states that a result shows one token per value and that the step refuses both cases.
**Check:** a temporary probe feature (deleted after the run, log `fix-07/wr01-probe.log`) that tags `formatter--v1.0.0` and `linter--v1.0.0` on one commit failed in the second tag step with the message above. S1 and S2 stayed green.

### WR-02: S1 has one candidate tag, so it does not prove that the constraint "selects" the tag

**Files modified:** `features/plugin/install-dependencies.feature`
**Commit:** 9d15a4b
**Applied fix:** I chose the stronger scenario and kept the title. Before HEAD moves past them, S1 now publishes `formatter` 1.0.0 (tag `formatter--v1.0.0`), then `formatter` 1.1.0 (tag `formatter--v1.1.0`), then a commit that adds `linter` 1.2.0 (tag `linter--v1.2.0`, on its own commit, as WR-01 now requires). The final publish offers `app` 1.1.0 and `formatter` 2.0.0. The dependency must install as `1.1.0-{tools revision formatter--v1.1.0}`, with `Version 1.1.0.` and the `formatter--v1.1.0` clone key in its staged skill.

**Red proofs (all adapter, S1 at `install-dependencies.feature:672`, every one failed on `Then the result lists these plugins:`, `exit=1`, `restored=clean`):**
- W2L (`domain/release-tag.ts`: takes the lowest satisfying tag). Got `1.0.0-{tools revision formatter--v1.0.0}`.
- W2P (`domain/release-tag.ts`: ignores the plugin's own `<name>--v` prefix). Got `1.1.0-{tools revision linter--v1.2.0}`.
- W2F (`domain/release-tag.ts`: takes the first satisfying tag in the listing). Got `1.0.0-{tools revision formatter--v1.0.0}`.

`check-red.mjs` on the C1, W2L, W2P, and W2F logs against base `9d5767a` (tables in `fix-07/red-tables.md`) prints `RED-PROOFS OK`, with every failure in a `Then`.

### IN-01: The CR-01 fixture keeps a second commit that no remaining assertion reads

**Files modified:** `test/integration/path-source-tag-install.test.ts`
**Commit:** 4585519
**Applied fix:** I dropped the second commit of `buildTaggedMarketplace`, its comment, and the doc-comment sentence about a byte-distinguishable checkout. The doc comment now says the tag is at the fixture's one commit.

### IN-03: The `pushGitTag` doc comment does not say that the tag is lightweight and never forced

**Files modified:** `features/lib/git-marketplace.ts`
**Commit:** 1f707a0
**Applied fix:** I added one sentence: "The tag is lightweight and never forced: an existing tag, local or remote, makes it fail."

## Open Issues

- IN-02 (the tag step does not check that it tagged the commit the host serves on `main`) stays open, by the orchestrator's scope.

## Verification

All runs were in the main checkout. Cucumber and static runs held the shared heavy-run lock (`flock -w 3600`).
- `features/plugin/install-dependencies.feature`: adapter `61 scenarios (61 passed)`, builtin `1 scenario (1 passed)`.
- The 27 tag-only scenarios on the shared builder (`update-dependencies.feature`, `git-source-update.feature:154`, `git-source.feature:342`, `list.feature:356`, `pending.feature:130`, all under `features/plugin/`): adapter `27 scenarios (27 passed)`.
- `test/integration/path-source-tag-install.test.ts`: 2/2 pass.
- `npm run check:static`: all seven checks pass (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features).
- `git status --porcelain -- extensions/` is empty after every break.

---

_Fixed: 2026-11-23T02:10:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
