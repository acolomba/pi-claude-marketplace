---
phase: 07-path-source-dependency-tags
reviewed: 2026-11-23T00:00:00Z
depth: standard
iteration: 3
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
  warning: 0
  info: 1
  total: 1
  necessity: 0
status: issues_found
---

# Phase 07: Code Review Report (iteration 3)

**Reviewed:** 2026-11-23
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found (one open info finding, kept open by decision)

## Summary

Scope: the diff since `89d17f0`, re-read after the iteration-2 fix commits `9e8c30d` and `95a261d`. I ran S1 and S2 (`features/plugin/install-dependencies.feature:672:716`) under the adapter profile: `2 scenarios (2 passed)`. I did not re-run the full suite, and I did not repeat the red proofs, because they need a source change.

Iteration-2 findings:

- **WR-01, fixed.** The last `offers these plugins with dependencies` table of S1 (`install-dependencies.feature:690-694`) now offers `formatter` `1.9.0`. That version has no tag, satisfies `^1.0.0`, and is higher than every tag. The expected rows did not change: `1.1.0-{tools revision formatter--v1.1.0}` in the result (`:704`) and in the record (`:708`), and `Version 1.1.0.` from `plugin-clones/…-{tools revision formatter--v1.1.0}` in the staged skill (`:714`). Under WR1C ("a satisfying current copy wins"), the path branch of `probeMemberPin` (`orchestrators/plugin/install-cascade.ts:925-948`) would resolve `formatter` at `1.9.0` with a `sources/tools/plugins/formatter` root. That fails the `Then the result lists these plugins:` row before any later check. This matches the recorded red proof (`WR1C-adapter.log`, exit 1). The iteration-1 mutants still fail on the same `Then`. W2L and W2F give `1.0.0-…formatter--v1.0.0`, and W2P gives `1.1.0-…linter--v1.2.0`. C1 still shows `app` at `1.0.0` because `app` is `1.1.0` only at HEAD. A "highest of tags and current copy" mutant gives `1.9.0`, and a "tag commit, current-copy version" mutant gives `1.9.0-…`. Both fail. The title "not from a later marketplace commit" now matches the case where that later commit satisfies the constraint.
- **IN-01, fixed.** `recordGitRepository` (`features/support/world.ts:659-675`) refuses a repository when a recorded marketplace tag of the same name equals `String(index + 1)` for one of its revisions. That is the exact key `revisionTokens` builds (`:462-477`), and the commit token uses the same key. The refusal message matches the message of the other order (`:455`). The rule text (`.agents/skills/cucumber/rules/features.md:136`) now says that both orders are refused, which matches the code. The check can fire through the steps. The git host refuses a repository path that is already served (`features/lib/git-plugin.ts:162-167`). But a `github` marketplace published under the `anthropics` owner (`features/lib/published-marketplace.ts:341-347`) can be tagged, and a git repository of the same name under the default owner is not refused by the host. So the world check is not already defended by the host, and it is not a necessity finding.

Regression checks:

- **S2 still proves TAGS-02.** S2 (`:716-746`) is a separate scenario, and the S1 publishes do not reach it. Its tag `formatter--v1.0.0` (1.0.0) and its current copy `2.0.0` both fail `^9.0.0`. The expected `2.0.0` with the `dependency current copy` reason and the `sources/tools/plugins/formatter` root tell D-07-03's fallback apart from a constraint-blind "highest tag" mutant, which would give `1.0.0-{tools revision formatter--v1.0.0}`. The WR1C mutant cannot change S2, because S2's current copy does not satisfy the range.
- **The new refusal fires in no current scenario.** The refusal reads `marketplaceTags`, which only `recordMarketplaceTag` fills (`world.ts:457`). Only S1 and S2 call that step (`install-dependencies.feature:678, 683, 689, 722`), and neither publishes a git plugin repository. The other `recordGitRepository` callers are `features/step_definitions/plugin/publishing.steps.ts:87, 103, 140`, `plugin/git-source.steps.ts:44, 63`, and `mcp-server/verdict-fetch.steps.ts:21`. In every scenario they serve, `marketplaceTags` is empty, so the `find` returns `undefined`. The 27 tag-only scenarios tag plugin repositories through `pushTagOnlyRevision` (`git-plugin.ts:206-223`), which never records a marketplace tag. The world is created for each scenario, so no tag carries over to the next scenario.
- **The integration file's two-member case.** The case (`test/integration/path-source-tag-install.test.ts:322-374`) is the D-07-04 proof. Two cascade members read one marketplace clone's tags, with HEAD at `2.0.0` past both tags. The case checks both pins (`1.0.0-<tag>`, `resolvedSha`) and a byte-identical checkout snapshot. It does not claim TAGS-03: its title cites TAGS-01, and its header (`:13-16`) sends TAGS-03 to the feature. HEAD at `2.0.0` still makes an in-place tag checkout change the index and both `plugin.json` files, which is what the C1 proof needs. The WR1C mutant passes this case, but S1 now carries that contract, so this is not a gap. The CR-01 leak case did not change.

Not reported, as decided: the `fallow audit` `weakened-tests` verdict, CR-01 staying internal, and DIRGITTAG-01. IN-02 stays open by decision and is carried below.

## Info

### IN-02: The tag step does not check that it tagged the commit the host serves on `main` (carried, open by decision)

**File:** `features/step_definitions/marketplace/publishing.steps.ts:336-351`

**Issue:** "tags its current commit" means the marketplace's published commit. `pushGitTag` tags the work tree's `HEAD`, and the step checks only that the bare tag peels to that commit. Suppose an earlier step left the work tree on another branch, or with a commit that was never pushed. The tag and `main` would then differ, and the step would still pass. No current scenario does this: each `offers these plugins` publish goes through `pushGitRepository`, which pushes `main`.

**Fix:** Also assert that `await runGit(published.bareRepository, published.gitHome, "rev-parse", "main")` equals `commit`.

---

_Reviewed: 2026-11-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
