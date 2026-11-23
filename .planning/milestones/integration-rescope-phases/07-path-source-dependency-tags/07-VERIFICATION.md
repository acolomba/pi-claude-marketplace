---
phase: 07-path-source-dependency-tags
verified: 2026-11-23T03:10:00Z
status: passed
score: 9/9 must-haves verified
covered_files:
  - .agents/skills/cucumber/rules/features.md
  - .planning/phases/07-path-source-dependency-tags/07-01-PLAN.md
  - .planning/phases/07-path-source-dependency-tags/07-01-SUMMARY.md
  - features/lib/git-marketplace.ts
  - features/lib/git-plugin.ts
  - features/lib/run-tokens.ts
  - features/plugin/install-dependencies.feature
  - features/step_definitions/marketplace/publishing.steps.ts
  - features/support/world.ts
  - test/integration/path-source-tag-install.test.ts
covered_digest: "v4:sha256:7a1906a7a5e6c40b0bd5d67ac4bce486dc19d18aad145e6f6e134b7c7593c4df"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 7: Path-Source Dependency Tags Verification Report

**Phase Goal:** A cucumber step publishes a marketplace repository with a tag, and scenarios prove that a constrained path-source dependency installs from the tag its constraint selects, with the TAGS-02 fallback to the current checkout; the integration cases they replace are gone.
**Verified:** 2026-11-23T03:10:00Z
**Status:** passed
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SC1: a constrained path-source dependency installs from the marketplace tag that its constraint selects while HEAD has moved past it, and shows the tag's version and content (TAGS-01, TAGS-03). It passes under both profiles, fails under a break, and the case it replaces is gone (ITMIG-07) | VERIFIED | S1 `install-dependencies.feature:672`. The review loop made it stronger: three tags (`formatter--v1.0.0`, `formatter--v1.1.0`, `linter--v1.2.0`), and HEAD offers `formatter` 1.9.0, which satisfies `^1.0.0` but has no tag. S1 expects `1.1.0-{tools revision formatter--v1.1.0}` in the row and the record, and the whole staged `SKILL.md` (`Version 1.1.0.`) under `plugin-clones/1969ce50f054-{tools revision formatter--v1.1.0}/`. `app` at 1.1.0 from `sources/tools/` shows the marketplace clone stays at HEAD. I ran it here: `--profile adapter features/plugin/install-dependencies.feature:672:716` gave `2 scenarios (2 passed)`, exit 0. Breaks: B1 and B2 (`phase07-plan01/B1-adapter.log`, `B2-adapter.log`, each `restored=clean`, failing at `Then the result lists these plugins:`) ran on the earlier S1. On the final S1, WR1C, C1, W2L, W2P, and W2F all fail on a `Then`. I re-ran `check-red.mjs` on `fix-07b/` and it printed `RED-PROOFS OK`. The case at `:163` is gone from the integration file. |
| 2 | SC2: when no marketplace tag satisfies the constraint, both plugins install from the current checkout (TAGS-02). Passes, fails under a break, and the replaced case is gone (ITMIG-07) | VERIFIED | S2 `install-dependencies.feature:716` (`:704` in the SUMMARY, before S1 grew). It expects: `formatter@^9.0.0`, the tag `formatter--v1.0.0`, HEAD `formatter` 2.0.0, an `info` cascade, the `formatter@tools` row with `dependency current copy` and `2.0.0`, the record at `2.0.0`, and the HEAD `SKILL.md` under `sources/tools/plugins/formatter`. It passed here, in the run above. B4 (`B4-adapter.log`, the selection ignores the range) fails S2 alone at `Then the result lists these plugins:`. B3 fails S2 at `Then the result has these fields:`. S2's text has not changed since those runs. The case at `:524` is gone. The `info` severity diverges from upstream, and D-07-03 (`PROJECT.md:1988`) licenses it. The title names D-07-03. |
| 3 | A marketplace tag step exists on one shared tag builder: it refuses a non-git publication, pushes through `pushGitTag`, checks the bare repository, and records the tag. `pushTagOnlyRevision` reuses the builder | VERIFIED | `git-marketplace.ts:80` `export async function pushGitTag(workTree: string, home: string, tag: string): Promise<string>`. `git-plugin.ts:217` `const revision = await pushGitTag(workTree, gitHome, tag);`, and the old `runGit(... "tag", tag)` line is gone. `publishing.steps.ts:336-351`: the url/github guard, `pushGitTag(published.root, published.gitHome, tag)`, `rev-parse <tag>^{commit}` on `bareRepository`, then `this.recordMarketplaceTag(name, tag, commit)`. The step is used 4 times in the feature. The 27 shared-builder scenarios passed here: `27 scenarios (27 passed)`. |
| 4 | The world gives each tag the tokens `{<m> revision <tag>}` and `{<m> commit <tag>}`, and the docs say so | VERIFIED | `world.ts` keeps `marketplaceTags` apart from `gitRepositories`. `revisionTokens` maps `marketplaceTags.map(...)` into both nouns. `recordMarketplaceTag` and `recordGitRepository` refuse a token collision in either order (WR-01 and IN-01 fixes). The token bullet is at `features.md:136`, and `run-tokens.ts` names the tag form in its `@fileoverview` and in the `revisions` and `commits` docs. S1 and S2 project `{tools revision formatter--v1.1.0}` and `--v1.0.0` successfully, which proves the tokens work. |
| 5 | Both new scenarios are untagged. The builtin profile selects only the existing `@mcp` scenario | VERIFIED | `grep -cE '^ *@'` gives 1. I ran the builtin profile on the feature here: `1 scenario (1 passed)`. An untagged scenario passing under adapter and selected by no builtin leg meets DUAL-02 (the precedent of Phases 4 and 6). |
| 6 | Breaks B1 and B2 fail S1, and B3 and B4 fail S2, each on a `Then`. B5 fails no scenario but fails the kept two-member case. `check-red.mjs` prints `RED-PROOFS OK` | VERIFIED | `phase07-plan01/red.log`: B1, B2, and B4 each `61 scenarios (60 passed, 1 failed)`, B3 `(57 passed, 4 failed)`, B5 `(61 passed)`, then `RED-PROOFS OK` and `exit=0`. `red-tracer.log` is also OK. `B5-integration.log`: `tests 2`, `fail 1` (the two-member case fails, CR-01 passes), `restored=clean`. No break log holds a step timeout. Iteration 2's C1-integration log also fails the two-member case. |
| 7 | `path-source-tag-install.test.ts` keeps only CR-01 and the two-member case under an ITSCOPE-01 header, and both pass | VERIFIED | `grep '^test('` finds `:125` CR-01 and `:322` the two-member case. The header names ITSCOPE-01, CR-01, D-07-04, and `features/plugin/install-dependencies.feature`. `marketplaceGitSnapshot` and `buildNonSatisfyingTagMarketplace` have 0 matches. I ran it here: `tests 2`, `pass 2`, `fail 0`. |
| 8 | No product file changed. Commits touch only `files_modified`. The tree is clean | VERIFIED | `git diff --name-only 89d17f0 HEAD -- extensions/` is empty. Outside `.planning/`, the diff lists exactly the 8 files of `files_modified`. `git status --porcelain -- extensions/ features/ test/ .agents/skills/cucumber/` is empty. The key-link product sites are still in place: `install-cascade.ts:943`, `clone-cache.ts:990`, `marketplace-tag-probe.ts:147`. |
| 9 | The SUMMARY records the green runs, the breaks, the case map, the checks, the `fallow audit` `weakened-tests` finding, the parent lines, and `## Threat Flags` | VERIFIED | `07-01-SUMMARY.md` has all of these sections. The DIRGITTAG-01 parent line landed in `.planning/BACKLOG.md:5514` (`d59f8e0`). |

**Score:** 9/9 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `features/lib/git-marketplace.ts` | `pushGitTag` | VERIFIED | Exported. Imported by the step module and by `git-plugin.ts`. |
| `features/lib/git-plugin.ts` | the tag-only revision on the shared builder | VERIFIED | Calls `pushGitTag` at `:217`. |
| `features/step_definitions/marketplace/publishing.steps.ts` | the tag step | VERIFIED | Registered at `:336`. The feature uses it 4 times. |
| `features/support/world.ts` | `recordMarketplaceTag` and the tag tokens | VERIFIED | Wired into `revisionTokens`, which the `tokens` getter reads. |
| `features/plugin/install-dependencies.feature` | S1 and S2 | VERIFIED | `:672`, `:716`. Both pass. |
| `.agents/skills/cucumber/rules/features.md` | the token rule | VERIFIED | `:136`. |
| `test/integration/path-source-tag-install.test.ts` | the two internal cases | VERIFIED | 2 tests, ITSCOPE-01 header. |
| `07-01-SUMMARY.md` | `## Red proofs` and the other sections | VERIFIED | Present. |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| `publishing.steps.ts` | `git-marketplace.ts` | `const commit = await pushGitTag(published.root, published.gitHome, tag);` | WIRED |
| `git-plugin.ts` | `git-marketplace.ts` | `await pushGitTag(workTree, gitHome, tag)` | WIRED |
| `world.ts` | `run-tokens.ts` | `marketplaceTags.map(` inside `revisionTokens` | WIRED |
| feature | `install-cascade.ts` | the path arm `probed.kind === "no-matching-tag" \|\| ...` (B1 and B3 fail on it) | WIRED |
| feature | `clone-cache.ts` | `args.tagOid,` in `materializeMarketplaceTagClone` (B2 fails on it) | WIRED |
| feature | `marketplace-tag-probe.ts` | `options.range,` (B4 fails on it) | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| S1 and S2 pass (adapter) | `test:cucumber:profile -- --profile adapter --parallel 2 features/plugin/install-dependencies.feature:672:716` | `2 scenarios (2 passed)`, exit 0 | PASS |
| Builtin selects only `@mcp` | `... --profile builtin ... install-dependencies.feature` | `1 scenario (1 passed)`, exit 0 | PASS |
| The shared builder keeps the 27 tag-only scenarios green | `... --profile adapter update-dependencies.feature git-source-update.feature:154 git-source.feature:342 list.feature:356 pending.feature:130` | `27 scenarios (27 passed)`, exit 0 | PASS |
| The kept integration cases pass | `node --import scripts/isolated-pi-home.mjs --test test/integration/path-source-tag-install.test.ts` | `tests 2`, `pass 2`, `fail 0` | PASS |
| The iteration-2 red proofs | `node fix-07b/check-red.mjs fix-07b/red-tables.md fix-07b <root> 9d5767a` | 5 must-fail rows, each `[Then]`, `RED-PROOFS OK` | PASS |

### Probe Execution

None declared. The phase's red-proof checker `check-red.mjs` ran as a spot-check (above).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| ITMIG-07 | 07-01 | A tag step for a marketplace repository, the tag install while HEAD has moved past the tag, and the TAGS-02 fallback | SATISFIED | Truths 1 to 7. Rule 1: adapter green, builtin selects 0 of the new scenarios (DUAL-02). Rule 2: breaks recorded and reverted. Rule 3: the 2 user-visible cases are deleted, and the 2 internal ones stay under ITSCOPE-01, as the ROADMAP notes require. Rule 4: no product bug found. |

No orphaned requirements: REQUIREMENTS.md maps only ITMIG-07 to Phase 7. Its checkbox and its traceability row still read Pending. Updating them is the orchestrator's step after verification.

### Prohibitions (judgment tier, verdicts backed by evidence)

| Statement | Verdict | Evidence |
| --- | --- | --- |
| No deliberate break staged, committed, or left in the tree | held | `git diff 89d17f0 HEAD -- extensions/` is empty. Every break log ends `restored=clean`. `git status` is clean. |
| No break or scenario in another checkout, and no file of the research or planner folders run or written | held (non-authoritative) | Every plan-01 log starts `root=` at the plan's own worktree. The fix logs start `root=/home/user/pi-claude-marketplace`, the main checkout the orchestrator chose. Whether a research file was run cannot be checked, so this rests on the executor's word. |
| No break counted on timeouts alone. No trim before `RED-PROOFS OK`. CR-01 and the two-member case not deleted | held | No break log matches `timed out\|timeout`. `red.log` mtime 01:24:15 comes before the trim commit `45e96c6` at 01:28:22. Both kept cases are present and pass. |
| No change outside the permitted files (the support, lib, step, skill, config, BACKLOG, CHANGELOG, and CI limits) | held for the plan's commits | The non-`.planning` diff is exactly the 8 `files_modified`. The `.planning/BACKLOG.md` change is `d59f8e0`, the orchestrator's parent-line step after the merge. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (8 modified files) | - | no TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER | - | none |

### Info

- **S1 diverges from the must-have text, and the divergence makes it stronger.** Plan truth 3 describes S1 with one tag (`formatter--v1.0.0`) and HEAD at 2.0.0. Review fixes `9abf37b`, `9d15a4b`, and `9e8c30d` added two more tags and an untagged HEAD copy that satisfies the range, so S1 now selects `formatter--v1.1.0`. The SUMMARY still describes the first form and the old S2 line (`:704`). `07-REVIEW-FIX.md` records the change and its red proofs. Like Phase 1's review-driven table change, I judge this an accepted deviation. It covers more than the must-have does.
- **B1 and B2 were not re-run on the final S1.** They ran on the first S1. On the final S1, B1 (every probe falls back) would produce `dependency current copy` and `1.9.0`. B2 (checkout of HEAD) would produce HEAD's `1.9.0` files under the tag pin. Both fail the same result-rows `Then`. WR1C (the current copy wins) and the reviewer's "tag commit, current-copy version" mutant exercise the same paths on the final S1, and both fail it.
- **IN-02 stays open.** The tag step does not assert that the tag equals the bare repository's `main`. The decision is recorded in `07-REVIEW.md`. No current scenario can tell them apart.
- **`fallow audit` reports `weakened-tests`** on the trimmed integration file (4 -> 2 cases). By user decision it is accepted at PR review. It is not a gap.
- The full `npm run check` gate on `7009d86` was still running when I wrote this report. The orchestrator reports that the gates on `d59f8e0` and `23159ee` passed. The commits after `23159ee` change only `install-dependencies.feature` and `world.ts`. For those two files I re-ran the focused scenarios and the 27 shared-builder scenarios here, and all passed.

### Human Verification Required

None.

### Gaps Summary

None. The step, the tokens, both scenarios, the red proofs, and the trim are all in the tree and work. No product file changed.

---

_Verified: 2026-11-23T03:10:00Z_
_Verifier: Claude (gsd-verifier)_
