---
quick_id: 261123-gth
phase: quick-261123-gth
plan: 01
subsystem: cucumber harness
tags: [cucumber, tags, dependencies, git-folder]
status: complete
requirements: [TAGS-01, TAGS-03]
requires: []
provides:
  - "git-folder marketplace source kind (LocalGitPublication)"
  - "tagPublishedCommit library dispatch for the tag step"
  - "scenario: path-source dependency installed from a release tag of a local git folder marketplace"
affects: [features/plugin/install-dependencies.feature, .agents/skills/cucumber/rules/features.md]
tech-stack:
  added: []
  patterns: ["the library dispatches on the recorded source kind; the step only records the token"]
key-files:
  created: []
  modified:
    - features/lib/git-marketplace.ts
    - features/lib/published-marketplace.ts
    - features/support/source-kind.ts
    - features/step_definitions/marketplace/publishing.steps.ts
    - features/plugin/install-dependencies.feature
    - .agents/skills/cucumber/rules/features.md
decisions:
  - "The new marketplace source kind is git-folder: the dir fixture in a git work tree with no origin, added by its path as a dir source."
  - "The tag step dispatches through tagPublishedCommit in features/lib/published-marketplace.ts; url/github push the tag, git-folder keeps it local."
metrics:
  completed: 2026-11-23
  tasks: 3
plan_head_before: 542aebea44dd647f9501ff7cf582bd16ce664a45
plan_head_after: c09b30c
commits: 2
actuals:
  tasks: 3
  commits: 2
---

# Quick 261123-gth: git-folder marketplace kind and a local-folder tag install scenario

The harness now has a `git-folder` marketplace source kind. It is the dir fixture in a git work tree that has no `origin`, and the user adds it by its path. The tag step now goes through `tagPublishedCommit`. A new scenario installs `formatter@^1.0.0` from the folder's own `formatter--v1.0.0` tag. It checks the tag version, the `d1e3927ef215` clone key, the app staged from the folder at HEAD, and that no request reaches the git host. The scenario fails under both deliberate product breaks.

## Commits

| Hash | Title | Hook |
| --- | --- | --- |
| `87446bd` | test(plugin): install a dependency from a local git marketplace tag | passed (`npm run check:commit` Passed; the hook ran, it was not skipped) |
| `c09b30c` | docs(features): describe the git-folder marketplace source kind | passed (Markdown fixers and linters, gitlint; no build input) |

Task 2 commits nothing, as planned. Base `542aebe` (on `claude/stoic-shannon-la9q7o`). No file under `extensions/` changed: `git diff --stat 542aebe HEAD -- extensions/` is empty.

## Runs

- **Task 1 verify** (`--profile adapter features/plugin/install-dependencies.feature:672:716:748`): `3 scenarios (3 passed)`, `44 steps (44 passed)`, exit 0. Log: `/tmp/claude-0/-home-user-pi-claude-marketplace/ba73c1d1-11d2-59e0-b5d6-895ae262ca9f/scratchpad/dgt/t1.log`.
- **Task 3 adapter** (`--parallel 2`, install-dependencies, update-dependencies, plugin git-source, marketplace url-source, github-source, and git-source): `170 scenarios (170 passed)`, `2144 steps (2144 passed)`, exit 0. install-dependencies alone has 62 scenarios (the break runs below count 62 over that file). Log: `.../scratchpad/dgt/t3-adapter.log`.
- **Task 3 builtin** (`features/plugin/install-dependencies.feature`): `1 scenario (1 passed)`, `11 steps (11 passed)`, exit 0. Log: `.../scratchpad/dgt/t3-builtin.log`.
- **`npm run check:static`**, after `rm -rf node_modules/.cache/eslint`: exit 0. typecheck 22.5 s, lint 225.8 s, lint:workflows, fallow, format:check, test:corresponding, and check:features all passed. Log: `.../scratchpad/dgt/static.log`.

## Red proofs

Each run used `break.sh` (sha256 `8302926c...`) from this worktree over the whole `features/plugin/install-dependencies.feature`, adapter profile.

### B-D1: a dir-source marketplace's tag source points at a folder with no tags

- Log: `/tmp/claude-0/-home-user-pi-claude-marketplace/ba73c1d1-11d2-59e0-b5d6-895ae262ca9f/scratchpad/dgt/BD1-adapter.log`
- Diff (`orchestrators/plugin/install-cascade.ts`, line 844):
  ```diff
  -    return { kind: "path", marketplaceRoot: record.marketplaceRoot };
  +    return { kind: "path", marketplaceRoot: parsePluginSource(record.source).kind === "path" ? `${record.marketplaceRoot}/.no-tags` : record.marketplaceRoot };
  ```
- Count line: `62 scenarios (61 passed, 1 failed)`
- Failed: the new scenario (`install-dependencies.feature:748`), at `Then the result lists these plugins:`. Formatter showed `dependency current copy` and `2.0.0` where `""` and `1.0.0-{tools revision formatter--v1.0.0}` were expected.
- `exit=1`, `restored=clean`. No other scenario failed.

### B-D2: the no-origin tag clone key comes from the folder path, not the marketplace name

- Log: `/tmp/claude-0/-home-user-pi-claude-marketplace/ba73c1d1-11d2-59e0-b5d6-895ae262ca9f/scratchpad/dgt/BD2-adapter.log`
- Diff (`orchestrators/plugin/clone-cache.ts`, line 974):
  ```diff
  -    `marketplace-name:${args.marketplaceName}`;
  +    `marketplace-root:${args.marketplaceRoot}`;
  ```
- Count line: `62 scenarios (61 passed, 1 failed)`
- Failed: the new scenario (`install-dependencies.feature:748`), at `Then the staged skills directory of the project scope holds these files:`. Formatter's `pluginRoot` held `plugin-clones/600f40c1595b-...` where `plugin-clones/d1e3927ef215-...` was expected.
- `exit=1`, `restored=clean`. No other scenario failed.

BD1b was not needed, because BD1 failed the new scenario in a Then step.

### check-red.mjs output (`.../scratchpad/dgt/check-red.out`)

```
BD1-adapter: 62 scenarios (61 passed, 1 failed) exit=1
  failed features/plugin/install-dependencies.feature:748 [Then] Installing a plugin installs its path-source dependency from a release tag of a marketplace added from a local git folder (TAGS-01, TAGS-03)
BD2-adapter: 62 scenarios (61 passed, 1 failed) exit=1
  failed features/plugin/install-dependencies.feature:748 [Then] Installing a plugin installs its path-source dependency from a release tag of a marketplace added from a local git folder (TAGS-01, TAGS-03)
RED-PROOFS OK
```

After both runs, `git status --porcelain -- extensions/` was empty.

## Design items as built

1. The kind is `git-folder`, and the step reads `the marketplace "tools" is published as a git-folder source`. The parameter regexp is `/dir|file|url|github|hosted|git-folder/`, and the fileoverview says "six kinds".
2. `LocalGitPublication` (`kind: "git-folder"`, `root`, `source` (= root), `manifestPath`, `gitHome`) is a new interface in the `PublishedMarketplace` union. `PathPublication` stays `dir|file`.
3. `tagPublishedCommit(published, tag)` has one exhaustive switch. The url and github arm calls `pushGitTag` and confirms the tag in `bareRepository`. The git-folder arm calls `tagGitCommit` and confirms the tag in `root`. The dir, file, and hosted arm throws "has no commit to tag". The private `confirmTag` runs `rev-parse <tag>^{commit}` and `assert.strictEqual` for both arms. The step calls `tagPublishedCommit`, then `recordMarketplaceTag`. It no longer imports `../../lib/git-marketplace.ts`, and it keeps `runGit`.
4. `git-marketplace.ts` exports `initGitWorkTree`, `commitGitWorkTree`, and `tagGitCommit`. The four publishers reuse them, so the file has one `commit -q --allow-empty` line. The git arguments run in the same order as before. `pushGitTag` returns the commit from `tagGitCommit`, read before the push. That commit is still the tagged HEAD, which `pushTagOnlyRevision` relies on.
5. The scenario follows the plan's shape, with app 1.1.0 in the second publish. It sits after S2 at line 748, has no tag, and adds no step text.
6. Each source-kind switch has a `git-folder` case. `changePublication` writes, then calls `commitGitWorkTree` with no push. `requireFreeRoot` and `removePublishedSource` behave as for dir. `publishMarketplaceIn` writes, then calls `initGitWorkTree`. `unreadableSkillFile` and `readOnlySkillDirectory` throw with the git repository arm. `describeMarketplaceBranch` throws "has no branch". `makeManifestUnreadable` and `publishUnreadableCommandFile` refuse it through a small `isGitRepository` helper (url, github, or git-folder), with the existing message.
7. The scenario is not an Outline.
8. Each break run covered the whole feature file and failed only the new scenario.

## Deviations from Plan

1. **[Rule 3 - Blocking] Scratch layout.** This session's worktree guard refused (a) writing `dirgittag-scratch` into the worktree's git dir and (b) a scratch path that contains the substring `git`. So the scratch folder is `$X/dgt/`, not `$X/dirgittag/`, and the commands name `$X` directly. They do not read it back through `git rev-parse --git-path dirgittag-scratch`. `base.sha` holds `542aebe...`, this plan's real base (the plan text says 85c323b; this worktree started at 542aebe). The precondition held: `git diff --stat 85c323b HEAD -- extensions/` is empty.
2. **Heavy-run lock.** The orchestrator requires every heavy cucumber run to take `flock -w 3600 /tmp/claude-0/.../36571f01-.../scratchpad/phase07-heavy.lock`. `break.sh` takes `$X/phase07-heavy.lock`, so I made that path a symlink to the shared lock. This means break.sh waits on the same lock and nothing nests it. The other runs went through a wrapper `$X/dgt/run.sh` that takes the shared lock, and all ran in the background.
3. **No `PATH` on `git commit`.** The guard refused `PATH=...` on `git commit`. Commits ran with only `npm_config_script_shell` and `NODE_OPTIONS`. The hook's `check:commit` runs no cucumber, so it does not need `fd`, and it passed.
4. **Extra neighbor feature.** The Task 3 adapter run also included `features/marketplace/git-source.feature`, which uses the rewritten git helpers too. It passed.
5. **Small helper.** `isGitRepository` was added for the two if-guards. The plan asked for refusals there; the helper keeps one condition shared.

## Known Stubs

None.

## For the orchestrator

- BACKLOG: DIRGITTAG-01 closes now that the scenario has landed. Use the repo form: change the heading at `.planning/BACKLOG.md` line 5514 to `## ~~DIRGITTAG-01: no scenario installs a dependency from a tag of a local git marketplace~~ -- CLOSED`. Add one line that names the git-folder source kind, the scenario title "Installing a plugin installs its path-source dependency from a release tag of a marketplace added from a local git folder (TAGS-01, TAGS-03)", the Task 1 commit `87446bd`, and the two red proofs (B-D1 at `install-cascade.ts` and B-D2 at `clone-cache.ts`, each failing the scenario in a Then step, RED-PROOFS OK).
- STATE.md: remove DIRGITTAG-01 from the "Still open" line of the integration-rescope closeout, and add the quick task row (commits `87446bd`, `c09b30c`).
- Gate: Task 1 (`87446bd`) commits build inputs. So after this item's worktree merges, run `npm run check` in the main checkout (AGENTS.md, Build verification), with the nondac-sh prefix and a PATH that has `fd`.
- No CHANGELOG line and no version bump: the change is test-only, and no user-visible behavior changes.
- If 261123-gti also edits `.agents/skills/cucumber/rules/features.md` (this item changed the Source kinds section after the hosted paragraph, and the `{<marketplace> revision <tag>}` run-token bullet), merge the two edits. Never rebase.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- The six modified files exist in the worktree, and both commits `87446bd` and `c09b30c` are ancestors of HEAD.
- `extensions/` has no change against the base, and its working tree is clean.
