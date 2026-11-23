---
phase: 07-path-source-dependency-tags
reviewed: 2026-11-23T00:00:00Z
depth: standard
iteration: 2
files_reviewed: 8
files_reviewed_list:
  - features/lib/git-marketplace.ts
  - features/lib/git-plugin.ts
  - features/lib/run-tokens.ts
  - features/step_definitions/marketplace/publishing.steps.ts
  - features/support/world.ts
  - features/plugin/install-dependencies.feature
  - .agents/skills/cucumber/rules/features.md
  - test/integration/path-source-tag-install.test.ts
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
  necessity: 0
status: issues_found
---

# Phase 07: Code Review Report (iteration 2)

**Reviewed:** 2026-11-23
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Scope: the diff since `89d17f0`, re-read after the iteration-1 fix commits `9abf37b`, `e169e7f`, `9d15a4b`, `4585519`, and `1f707a0`. I ran `test/integration/path-source-tag-install.test.ts` (2/2 pass). I did not re-run cucumber or the full suite.

Iteration-1 findings:
- **CR-01, fixed.** `buildTwoTagMarketplace` (`test/integration/path-source-tag-install.test.ts:273-293`) now commits `2.0.0` past both tags. `marketplaceCheckoutSnapshot` (`:303-320`) compares `.git/HEAD`, `.git/index`, and every file tracked on `main`, so an in-place `noUpdateHead` checkout of the tag now changes the index and both `plugin.json` files. In S1, the last publish offers `app` 1.1.0. `app` is staged from `sources/tools/plugins/app` after the dependency, so an in-place tag checkout of the marketplace clone makes `app` read `1.0.0` in the row, the record, and the staged skill. That matches the C1 red proof.
- **WR-01, fixed.** `recordMarketplaceTag` (`features/support/world.ts:446-458`) refuses a second tag on a commit that is already tagged, and a token key that already exists. Each `offers these plugins` publish goes through `pushGitRepository`, which commits with `--allow-empty` (`features/lib/git-marketplace.ts:51-55`), so the three S1 tags and the one S2 tag are on four different commits and the refusal does not fire. Only S1 and S2 use the tag step. The 27 tag-only scenarios go through `pushTagOnlyRevision`, which never calls `recordMarketplaceTag`. Its tag, push, and `rev-parse HEAD` now run in a new order (`features/lib/git-plugin.ts:217`), but HEAD is the same commit, so nothing changes for those scenarios.
- **WR-02, fixed.** S1 now has tags `formatter--v1.0.0`, `formatter--v1.1.0`, and `linter--v1.2.0`. The lowest-tag, first-listed-tag, and ignore-the-prefix mutants each give a different version (`1.0.0-…formatter--v1.0.0`, or `1.1.0-…linter--v1.2.0`), which matches W2L, W2F, and W2P.
- **IN-01, fixed.** `buildTaggedMarketplace` has one commit, and its doc comment says so. The CR-01 leak case still catches a copy of the live work tree, because a checkout does not remove untracked files.
- **IN-03, fixed.** `pushGitTag`'s doc comment says that the tag is lightweight and never forced.
- **IN-02, open by decision.** Carried below as IN-02.

Iteration 1 missed one gap in S1 (WR-01 below): the current copy at HEAD never satisfies the constraint, so S1 cannot tell "the tag wins" from "a satisfying current copy wins". The new collision refusal also works in one direction only (IN-01). Not reported, as decided: the `fallow audit` `weakened-tests` verdict, CR-01 staying internal, and DIRGITTAG-01.

## Warnings

### WR-01: S1's current copy never satisfies the constraint, so it does not prove TAGS-03's "the tag, not the current copy"

**File:** `features/plugin/install-dependencies.feature:690-694` (the HEAD publish), title at `:672`

**Issue:** TAGS-03 says that a constrained path-source dependency with a satisfying tag installs "as it stands at that tag, not the marketplace's current copy". The scenario title says the same: "not from a later marketplace commit". But the final publish, which is the current copy, offers `formatter` `2.0.0`, and `2.0.0` does not satisfy `^1.0.0`. The kept integration case has the same shape: HEAD is at `2.0.0` against `^1.0.0` (`test/integration/path-source-tag-install.test.ts:275-293`, `:249`).

So this wrong implementation passes every check: use the current copy when it satisfies the range, and probe the tags only when it does not. It could sit, for example, in front of the `marketplaceTagProbe` call in `probeMemberPin` (`extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:924-947`). For S1 that mutant falls through to the tag probe, because `2.0.0` fails `^1.0.0`, and it records `1.1.0-{tools revision formatter--v1.1.0}`. That is the expected value.

The mutant is a natural shortcut, because the current copy needs no clone, and TAGS-03 exists to rule it out. The iteration-1 review (WR-02) checked only which tag gets chosen. It never checked whether a tag is chosen over a satisfying current copy.

**Fix:** Make the current copy satisfy the range but stay distinct from every tag. For example, in the last `offers these plugins` table of S1, offer `formatter` at `1.9.0` (untagged, satisfies `^1.0.0`, higher than every tag):

```gherkin
    Given the marketplace "tools" offers these plugins with dependencies:
      | name      | version | dependencies     |
      | app       | 1.1.0   | formatter@^1.0.0 |
      | formatter | 1.9.0   |                  |
      | linter    | 1.2.0   |                  |
```

The expected rows stay as they are: `1.1.0-{tools revision formatter--v1.1.0}`, and `Version 1.1.0.` from `plugin-clones/`. The "prefer a satisfying current copy" mutant would instead give `1.9.0` with a `sources/tools/plugins/formatter` root. Record a red proof for that mutant, as for C1 and W2*. S2 keeps `2.0.0` against `^9.0.0` for TAGS-02.

## Info

### IN-01: The token-collision refusal checks only one order, and the rules text says more than it checks

**File:** `features/support/world.ts:452-455`, `:659-662`, `:465-476`; `.agents/skills/cucumber/rules/features.md:136`

**Issue:** `recordMarketplaceTag` refuses a tag whose token already exists. `recordGitRepository` (`:660-662`) checks nothing. So if a scenario tags the marketplace `tools` with `1` first and publishes a git repository `tools` later, no step fails. `revisionTokens` then puts the repository's `{tools revision 1}` entry first and the tag's entry second, and `new Map` keeps the later value. The tag's commit then silently stands for `{tools revision 1}`. A command expands the token to the wrong commit, and the repository's own revision no longer projects to its token.

`features.md:136` says the step "refuses a token that another token already names", which is true only when the tag step runs second. Under the `<plugin>--v<version>` convention a tag is never a bare number, so no current scenario can hit this.

**Fix:** Check in both places: in `recordGitRepository`, assert that no marketplace tag token has the key `{<name> revision <n>}` for any of its revisions. Or narrow the rules text to "refuses a tag whose token another token already names".

### IN-02: The tag step does not check that it tagged the commit the host serves on `main` (carried, open by decision)

**File:** `features/step_definitions/marketplace/publishing.steps.ts:336-351`

**Issue:** "tags its current commit" means the marketplace's published commit. `pushGitTag` tags the work tree's `HEAD`, and the step checks only that the bare tag peels to that commit. If an earlier step left the work tree on another branch, or with a commit that was never pushed, the tag and `main` would differ, and the step would still pass.

**Fix:** Also assert that `await runGit(published.bareRepository, published.gitHome, "rev-parse", "main")` equals `commit`.

---

_Reviewed: 2026-11-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
