---
phase: 07-path-source-dependency-tags
reviewed: 2026-11-23T00:00:00Z
depth: standard
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
  critical: 1
  warning: 2
  info: 3
  total: 6
  necessity: 0
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-11-23
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Scope: the diff since `89d17f0`. That covers the shared `pushGitTag`, the marketplace tag step, the world's tag tokens, scenarios S1 and S2, the rules text, and the trimmed integration file. I checked every assertion of the two deleted integration cases (`89d17f0:test/integration/path-source-tag-install.test.ts:163` and `:524`) against S1, S2, and the kept cases.

The user-visible checks carry over:
- S1 checks the result row, the record version, and both staged `SKILL.md` files whole, including the `plugin-clones/` plugin root.
- S2 checks the `info` severity, the `dependency current copy` reason, the `2.0.0` row and record, and the `sources/tools/` root.
- The `the staged skills directory ... holds these files`, `the installation record ... holds these plugins`, and `the result lists these plugins` steps all compare the whole set (`installation.steps.ts:478-489`, `:557-566`).

One deleted guard has no replacement. The deleted cases took a snapshot of the marketplace checkout (`plugin.json`, `MARKER.txt`, `.git/HEAD`, `.git/index`) while HEAD had moved past the tag. The kept two-member case has HEAD *at* the tag. I ran an isomorphic-git experiment to test this: a stray in-place checkout of the tag that keeps HEAD now passes every test (CR-01).

The token work has one ambiguity that the rules text hides: two tags on one commit. It also has a gap in what S1 proves about selecting a tag. Known items (the `weakened-tests` audit, CR-01 staying internal, DIRGITTAG-01) are not reported.

## Critical Issues

### CR-01: The trimmed integration file no longer catches a tag checkout that overwrites the marketplace checkout

**File:** `test/integration/path-source-tag-install.test.ts:222-345` (with `features/plugin/install-dependencies.feature:672-702`)

**Issue:** The deleted TAGS-01/03 case (`89d17f0:...:163-241`) built the marketplace with a second commit after the tag. It then compared `marketplaceGitSnapshot` (HEAD bytes, index bytes, the work-tree `plugin.json` and `MARKER.txt`) before and after the install. The deleted TAGS-02 case (`:524-607`) did the same. The plan's case map says the kept case `:393` (now `:292`) takes over "its marketplace git snapshot". It cannot do that fully:
- `buildTwoTagMarketplace` (`:271-289`) makes one commit and puts both tags on it. So the tag's tree is HEAD's tree.
- The kept case checks only `.git/index` and `.git/HEAD`, not work-tree files.

So a checkout of the tag that leaves `.git/HEAD` alone changes nothing that the kept case reads. An example is isomorphic-git `checkout({ dir: marketplaceRoot, ref: tagOid, noUpdateHead: true })` before the copy. I checked this with the repo's isomorphic-git. With the kept fixture's shape (tag == HEAD), HEAD, index, and work tree stay byte-identical after such a checkout. With the deleted fixture's shape (HEAD past the tag), the index changes and `plugin.json` goes from `2.0.0` back to `1.0.0`.

S1 does not catch it either. `app` is `1.0.0` with the same files in both publishes (`:676`, `:681`). `formatter` comes from `plugin-clones/`. So nothing in S1 reads the marketplace clone's work tree after the tag is materialized.

This is a plausible wrong implementation, and the suite now passes it. For a dir-source git marketplace (the integration fixtures), it overwrites the user's own checkout. For a github marketplace, it leaves `sources/tools` serving the tag's files as if they were the current copy. The deleted assertions guarded exactly this. B5 only breaks the variant that detaches HEAD.

**Fix:** In the kept case, move HEAD past the tags and check the work tree too. For example, in `buildTwoTagMarketplace`, add a second commit after the two `git.tag` calls:

```ts
// Advance the checkout PAST both tags, so a stray checkout of a tag in the
// marketplace root changes bytes the assertions below read.
await writeFile(path.join(formatterDir, ".claude-plugin", "plugin.json"),
  JSON.stringify({ name: "formatter", version: "2.0.0" }));
await writeFile(path.join(linterDir, ".claude-plugin", "plugin.json"),
  JSON.stringify({ name: "linter", version: "2.0.0" }));
await git.add({ fs, dir: marketplaceRoot, filepath: "plugins/formatter/.claude-plugin/plugin.json" });
await git.add({ fs, dir: marketplaceRoot, filepath: "plugins/linter/.claude-plugin/plugin.json" });
await git.commit({ fs, dir: marketplaceRoot, message: "release 2.0.0", author: AUTHOR });
```

Also add both `plugin.json` files to the before/after comparison next to `.git/index` and `.git/HEAD`. For the user-visible side, make S1's second publish offer `app` at `1.1.0` (same dependency). `app` is staged from `sources/tools/plugins/app` after the dependency, so its row, its record, and its whole `SKILL.md` (`Version 1.1.0.`) then prove that the marketplace clone still holds HEAD after the tag is materialized.

## Warnings

### WR-01: Two tags on one commit get the same projection, so a result can never show the second tag's token

**File:** `features/support/world.ts:449-462`, `features/lib/run-tokens.ts:162-164`, `.agents/skills/cucumber/rules/features.md:136`

**Issue:** `revisionTokens` maps each `{<marketplace> revision <tag>}` key to the tagged commit's digits. When two tags name one commit, both tokens have the same value. An example is `formatter--v1.0.0` and `linter--v1.0.0` on one release commit, which is the exact shape of the kept D-07-04 case and the natural scenario once that case moves to a feature. `projectTokens` replaces values in map order, so every occurrence projects to whichever tag was recorded first. A `linter@tools` row would read `1.0.0-{tools revision formatter--v1.0.0}`, and a scenario that writes `{tools revision linter--v1.0.0}` fails. The rules text says "a result shows it wherever its value appears", which is false for the second token. Git plugin revisions never share a commit, so this ambiguity is new with tag tokens.

**Fix:** Either reject a second tag on a recorded commit in `recordMarketplaceTag` (an assert naming both tags), or key the token by commit and document that a shared commit projects to the first tag. Then state the chosen rule in `features.md:136`. Also assert in `recordMarketplaceTag` that the token key is not already in `revisionTokens`. A tag named `1` on a marketplace `tools` collides silently with `{tools revision 1}` of a git repository `tools`, and `new Map` keeps the later value. `recordErrorMessage` (`world.ts:432-439`) already refuses this kind of disagreement.

### WR-02: S1 has one candidate tag, so it does not prove that the constraint "selects" the tag

**File:** `features/plugin/install-dependencies.feature:672-702`

**Issue:** The title promises "the marketplace tag that its version constraint selects", and TAGS-01 resolves the constraint against the `{name}--v{version}` tags. The repository holds one tag, and it satisfies `^1.0.0`. Wrong implementations that still pass S1:
- one that ignores the `<name>--v` prefix;
- one that takes the lowest satisfying tag;
- one that takes the first listed tag.

S2 only rules out "ignore the range entirely" (B4). The highest-satisfying and prefix rules are unit-tested (`test/orchestrators/plugin/marketplace-tag-probe.test.ts:67`, `:93`), so this is not a release blocker. But the scenario title claims more than its steps prove.

**Fix:** Before the HEAD-moving publish, publish an intermediate `formatter` `1.1.0`, tag it `formatter--v1.1.0`, and add a `linter--v1.2.0` tag. Then expect `1.1.0-{tools revision formatter--v1.1.0}` and `Version 1.1.0.` Or narrow the title to the tag-versus-later-commit behavior that the steps prove.

## Info

### IN-01: The CR-01 fixture keeps a second commit that no remaining assertion reads

**File:** `test/integration/path-source-tag-install.test.ts:69-76`, `:124-137`

**Issue:** `buildTaggedMarketplace` still moves HEAD past the tag "so the CURRENT checkout is byte-distinguishable from the tag". The only remaining caller, CR-01, checks only that planted untracked files are absent. Nothing reads the `2.0.0`/`current-checkout-content` bytes now. The doc comment describes a distinction that nothing checks.

**Fix:** Either use it (see the CR-01 fix: snapshot the work tree here too), or drop the second commit and the sentence.

### IN-02: The tag step does not check that it tagged the commit the host serves on `main`

**File:** `features/step_definitions/marketplace/publishing.steps.ts:336-351`

**Issue:** "tags its current commit" means the marketplace's published commit. `pushGitTag` tags the work tree's `HEAD`, and the step checks only that the bare tag peels to that commit. If an earlier step left the work tree on another branch, or with a commit that was never pushed, the tag and `main` would differ, and the step would still pass.

**Fix:** Also assert `await runGit(published.bareRepository, published.gitHome, "rev-parse", "main")` equals `commit`.

### IN-03: The `pushGitTag` doc comment does not say that the tag is lightweight and never forced

**File:** `features/lib/git-marketplace.ts:74-83`

**Issue:** A second call with the same tag fails in `git tag`. A tag that already exists on the remote fails the push. Both are the right outcome for a fixture, but a caller cannot tell this from the comment, and `pushTagOnlyRevision` now depends on it too.

**Fix:** Add one sentence: "The tag is lightweight; an existing tag, local or remote, makes it fail."

---

_Reviewed: 2026-11-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
