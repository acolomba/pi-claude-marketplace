---
phase: 07-path-source-dependency-tags
fixed_at: 2026-11-23T02:21:07Z
review_path: .planning/phases/07-path-source-dependency-tags/07-REVIEW.md
iteration: 2
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

The frontmatter counts iteration 2 (WR-01 and IN-01 of the iteration-2 review). Iteration 1 fixed 5 of 5 and is kept below as written.

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

_Fixed: 2026-11-23T02:10:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

---

# Iteration 2

**Fixed at:** 2026-11-23T02:21:07Z
**Source review:** .planning/phases/07-path-source-dependency-tags/07-REVIEW.md (iteration 2)
**Iteration:** 2

**Summary:**
- Findings in scope: 2 (WR-01, plus IN-01 by the orchestrator's scope; IN-02 stays open)
- Fixed: 2
- Skipped: 0

All work, the green runs, and the red proofs ran in the main checkout on `claude/stoic-shannon-la9q7o` (no worktree, by the orchestrator's instruction), so the results reproduce from that tree. Logs are in `<scratchpad>/fix-07b/`.

## Fixed Issues

### WR-01: S1's current copy never satisfies the constraint, so it does not prove TAGS-03's "the tag, not the current copy"

**Files modified:** `features/plugin/install-dependencies.feature`
**Commit:** 9e8c30d
**Applied fix:** The last `offers these plugins with dependencies` table of S1 now offers `formatter` at `1.9.0`: untagged, it satisfies `^1.0.0`, and it is higher than every tag. The expected rows stay `1.1.0-{tools revision formatter--v1.1.0}` in the result and the record, and `Version 1.1.0.` from `plugin-clones/` in the staged skill. S2 keeps `2.0.0` against `^9.0.0` for TAGS-02. The integration file keeps its HEAD at `2.0.0`; it was not in this finding's fix.

**Red proof (break WR1C, "a satisfying current copy wins"):** in `orchestrators/plugin/install-cascade.ts` `probeMemberPin`, before the `marketplaceTagProbe` call on the path branch, the break reads the current copy's `plugins/<name>/.claude-plugin/plugin.json` version and, when it satisfies the range, resolves the member with no pin and no probe.
- On S1 before the fix (log `WR1C-prefix-adapter.log`): `1 scenario (1 passed)`, `exit=0`, `restored=clean`. This is the gap the review names.
- On S1 after the fix (log `WR1C-adapter.log`, on the WR-01 commit and again on the final tree): fails on `Then the result lists these plugins:` with `1.9.0` in place of `1.1.0-{tools revision formatter--v1.1.0}`. `exit=1`, `restored=clean`.

**Iteration-1 breaks on the final tree (adapter, S1 at `install-dependencies.feature:672`, each `exit=1`, `restored=clean`, each failing on `Then the result lists these plugins:`):**
- C1 (tag checkout in place that keeps HEAD): the `app` version is `1.0.0`, expected `1.1.0`.
- W2L (lowest satisfying tag): got `1.0.0-{tools revision formatter--v1.0.0}`.
- W2P (ignores the `<name>--v` prefix): got `1.1.0-{tools revision linter--v1.2.0}`.
- W2F (first satisfying tag in the listing): got `1.0.0-{tools revision formatter--v1.0.0}`.
- C1 on the integration file (`break-int.sh`, log `C1-integration.log`): the D-07-04 case fails, the CR-01 leak case passes. `exit=1`, `restored=clean`.

`check-red.mjs` on the WR1C, C1, W2L, W2P, and W2F logs against base `9d5767a` (tables in `fix-07b/red-tables.md`) prints `RED-PROOFS OK`, with every failure in a `Then`. `git status --porcelain -- extensions/` is empty after every break.

### IN-01: The token-collision refusal checks only one order, and the rules text says more than it checks

**Files modified:** `features/support/world.ts`, `.agents/skills/cucumber/rules/features.md`
**Commit:** 95a261d
**Applied fix:** I chose the refusal. `recordGitRepository` now asserts that no recorded marketplace tag of the same name is `<n>` for any of the repository's revisions, with the message `{<name> revision <n>} already stands for another commit`, which is the message of the other order. Its doc comment says so. The token rule in `features.md` now says that publishing the revision after the tag is refused the same way.
**Check:** a temporary probe (a step file and a feature, deleted after the run, log `fix-07b/in01-probe.log`) recorded a tag token and then a repository directly through the world methods. A tag `2` beside a two-revision repository `tools` was refused with the message above. A different repository name, a tag `3` past two revisions, and a release tag `formatter--v1.0.0` were all recorded. A probe through the publishing steps could not reach the check: the git host already refuses a git repository whose name a git marketplace of the scenario holds (`the git host already serves ...`), so both refusals are a second line behind the host.

## Open Issues

- IN-02 (the tag step does not check that it tagged the commit the host serves on `main`) stays open, by the orchestrator's scope.

## Verification

All runs were in the main checkout, on the final tree. Cucumber and static runs held the shared heavy-run lock (`flock -w 3600`).
- `features/plugin/install-dependencies.feature`: adapter `61 scenarios (61 passed)`, builtin `1 scenario (1 passed)`.
- The 27 tag-only scenarios on the shared builder (`update-dependencies.feature`, `git-source-update.feature:154`, `git-source.feature:342`, `list.feature:356`, `pending.feature:130`, all under `features/plugin/`): adapter `27 scenarios (27 passed)`.
- `test/integration/path-source-tag-install.test.ts`: 2/2 pass.
- `npm run check:static`: all seven checks pass (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features).
- The commit hook ran on both commits and passed; on the IN-01 commit it ran `npm run check:commit`.

---

_Fixed: 2026-11-23T02:21:07Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
