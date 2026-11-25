---
phase: quick-261123-gth
verified: 2026-11-23T14:10:00Z
status: passed
score: 7/7 must-haves verified
covered_files:
  - .agents/skills/cucumber/rules/features.md
  - .planning/quick/261123-gth-dirgittag-01-planning-backlog-md-add-a-publication-kind-for/261123-gth-PLAN.md
  - .planning/quick/261123-gth-dirgittag-01-planning-backlog-md-add-a-publication-kind-for/261123-gth-SUMMARY.md
  - features/lib/git-marketplace.ts
  - features/lib/published-marketplace.ts
  - features/plugin/install-dependencies.feature
  - features/step_definitions/marketplace/publishing.steps.ts
  - features/support/source-kind.ts
covered_digest: "v4:sha256:8ff39875ebb48a54b025342dd44e86dd52739044fffb55906ac429a5b74f89c4"
behavior_unverified: 0
overrides_applied: 0
---

# Quick 261123-gth: Verification Report

**Goal (DIRGITTAG-01):** A `git-folder` marketplace kind (dir fixture in a git work tree with no origin) and a scenario that installs a constrained relative-path dependency from the folder's own release tag (TAGS-01, TAGS-03, NFR-5).
**Verified:** 2026-11-23 at HEAD 1cd35e7. Commits 87446bd and c09b30c.
**Re-verification:** No

Cucumber runs were not repeated here (the orchestrator runs the full gate on 1cd35e7). Behavioral evidence is the saved logs under `/tmp/claude-0/-home-user-pi-claude-marketplace/ba73c1d1-11d2-59e0-b5d6-895ae262ca9f/scratchpad/dgt/`, which I read, plus code reads.

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `the marketplace <name> is published as a git-folder source` makes the dir fixture a git work tree with no origin, added by its path; later changes are local commits, nothing pushed | VERIFIED | `publishMarketplaceIn` `git-folder` arm: `writeMarketplace`, then `initGitWorkTree(root, gitHome)` (`git init`, `add -A`, `commit`; no remote), returns `source: root`. `changePublication` `git-folder` arm: `write()` then `commitGitWorkTree`, no push. `source-kind.ts` regexp is `dir\|file\|url\|github\|hosted\|git-folder`. |
| 2 | The tag step goes through `tagPublishedCommit`: pushes and confirms for url/github, tags locally for git-folder | VERIFIED | `publishing.steps.ts` now calls `tagPublishedCommit(this.requirePublished(name), tag)`. In `published-marketplace.ts`, url/github use `pushGitTag` and `confirmTag` on the bare repo, `git-folder` uses `tagGitCommit` and `confirmTag` on the folder; dir/file/hosted throw. S1 and S2 were in the 62-scenario run and the 170-scenario adapter run, all passed (`t3-adapter.log`: 170 passed, exit 0). |
| 3 | Every switch over the source kind lists git-folder with work-tree behavior | VERIFIED | The diff adds `git-folder` to `changePublication`, `requireFreeRoot`, `publishMarketplaceIn`, `removePublishedSource` (removes the folder), `unreadableSkillFile`, `readOnlySkillDirectory`, `describeMarketplaceBranch` (no branch), `isGitRepository` (unreadable manifest and command file refusals), and `tagPublishedCommit`. `typecheck` passed in `static.log`, so the exhaustive switches compile. Other `published.kind` users outside this file (`git-host.steps.ts`, `add.steps.ts` and others) keep their guards and throw or fail for git-folder, as intended. |
| 4 | The new scenario (`install-dependencies.feature:748`) installs app 1.1.0 from the folder and formatter at `1.0.0-{tools revision formatter--v1.0.0}` from the tag, staged from the d1e3927ef215 clone, with no git host request | VERIFIED | Scenario exists at line 748 with the plan's steps, including `Then the git host receives no request` and the version token. `t1.log`: `3 scenarios (3 passed)`, `44 steps (44 passed)`, exit 0. The B-D2 break log shows the scenario asserts the `plugin-clones/d1e3927ef215-...` root. |
| 5 | With B-D1 or B-D2 applied the scenario fails in a Then step, runs end `restored=clean`, and check-red prints RED-PROOFS OK | VERIFIED | `BD1-adapter.log` and `BD2-adapter.log`: each `62 scenarios (61 passed, 1 failed)`, `exit=1`, `restored=clean`. `check-red.out`: both failed at `install-dependencies.feature:748 [Then]`, then `RED-PROOFS OK`. |
| 6 | The unbroken tree passes install-dependencies (62 scenarios adapter, 1 builtin), the git neighbors, and `check:static` from an empty ESLint cache | VERIFIED (logs) | `t3-adapter.log` 170/170 passed; `t3-builtin.log` `1 scenario (1 passed)`; `static.log`: typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features all `passed`. |
| 7 | No file under `extensions/` changes, and `features.md` documents the kind and widens the tag token rule | VERIFIED | `git show --stat` of 87446bd and c09b30c lists only `features/` and `.agents/skills/cucumber/rules/features.md`. c09b30c adds the git-folder paragraph and changes the token rule to "`url`, `github`, or `git-folder` marketplace". The paragraph's claim that `check:features` rejects `git-folder` in a `source kind` column holds: `scripts/check-features.mjs` `localKinds` is `dir` and `file`, so an untagged Examples block with `git-folder` is rejected. |

## Key Links

| From | To | Status |
|------|----|--------|
| `publishing.steps.ts` tag step | `tagPublishedCommit` | WIRED |
| `published-marketplace.ts` git-folder arms | `initGitWorkTree`, `commitGitWorkTree`, `tagGitCommit` (never push) | WIRED |
| `source-kind.ts` | `parseSourceKind` / `SOURCE_KINDS` (six kinds) | WIRED |

## Anti-Patterns

None found in the changed files (no TODO/FIXME/XXX/TBD, no stubs).

## Notes

- The scenario's behavioral evidence is the recorded cucumber logs, taken before the gti merge. The two items touch disjoint files (`features/hook`, hooks bridge versus `features/lib`, `install-dependencies.feature`), so I see no interaction. The orchestrator's gate on 1cd35e7 confirms it.

## Gaps

None.

---

_Verified: 2026-11-23_
_Verifier: Claude (gsd-verifier)_
