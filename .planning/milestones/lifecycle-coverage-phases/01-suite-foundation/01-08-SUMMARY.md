---
phase: 01-suite-foundation
plan: 08
subsystem: testing
tags: [cucumber, git-source, github, url, git-subdir, run-tokens, https-git-host, behavioral-tests]

requires:
  - phase: 01-suite-foundation
    provides: "01-06: owner-aware `GitRepositoryHost` (repositoryPath/Url/Shorthand, defaultOwner, gitHome) and the request-log steps; 01-07: `{project dir}`/`{agent dir}` in `RunTokens`; 01-05: `plugin/publishing.steps.ts` topic module"
provides:
  - "features/lib/git-plugin.ts: `readRepositoryPlugins`, `publishPluginRepository`, `pushPluginRepository`, `readGitPluginOffers`, `gitPluginEntry`, `offerGitPlugins`, and the types `RepositoryPlugin`, `GitPluginRepository`, `GitPluginOffer`, `GitPluginEntry`, `GitPluginSource`, `GitPluginSourceKind`"
  - "Step `Given the git repository {string} holds these plugins:` (`| name | version | path |`): first statement publishes `acme/<name>.git`, later ones push a new revision"
  - "Step `Given the marketplace {string} offers these plugins from git repositories:` (`| name | source kind | repository | pinned |`)"
  - "Run token `{<repository> revision <n>}`, e.g. `{ghp revision 1}` = `sha-<first 12 hex>` of that revision; `RunTokens.revisions`"
  - "World: `recordGitRepository`, `gitRepository`, `requireGitRepository`"
  - "`runGit` resolves with trimmed stdout; `writePluginFiles` and `requireColumns` exported from path-marketplace.ts"
  - "Seeds in features/plugin/git-source.feature: the Outline over github/url/git-subdir and the pinned reuse with no request"
affects: [phase-4-git-source, phase-9, phase-10, phase-12, phase-15, 01-09, 01-10]

actuals:
  tokens: 7290
  tasks: 2
  commits: 2

plan_head_before: e53528fc33e5d18261c85e47e1b6589f65ff3b01
plan_head_after: 245c0fccc0872ef1ed00f7b141bbdafa06ba55bf

tech-stack:
  added: []
  patterns:
    - "A git plugin repository is a work tree under `<home>/plugin-repositories/<name>`, apart from the marketplaces, published through the same `publishGitRepository`/`pushGitRepository` as git marketplaces"
    - "A git plugin is offered by merging its entry into the published manifest text by name, so one marketplace of any kind can offer path and git plugins together"
    - "A per-run value with no fixed spelling (a commit sha) is stated as a run token the world derives from what the scenario published"

key-files:
  created:
    - features/lib/git-plugin.ts
    - features/plugin/git-source.feature
  modified:
    - features/lib/hermetic-git.ts
    - features/lib/path-marketplace.ts
    - features/lib/run-tokens.ts
    - features/support/world.ts
    - features/step_definitions/plugin/publishing.steps.ts
    - .agents/skills/cucumber/rules/features.md

key-decisions:
  - "The plugin work trees live under `<home>/plugin-repositories/`, a directory of its own beside `<home>/marketplaces/`, so a plugin repository and a marketplace never share a work tree"
  - "One Outline covers all three plugin source kinds: each unpinned kind made the same request log (the upload-pack pair twice), so no kind needed a scenario of its own"
  - "`GitPluginSourceKind` and `GitPluginSource` are exported because fallow reports a private type referenced by an exported signature as a private-type leak"
  - "`requireColumns` is exported from path-marketplace.ts and reused by git-plugin.ts instead of a copy"

patterns-established:
  - "Revision tokens: `{<repository> revision <n>}`, counted from 1, expanded in commands and projected back in results"
  - "Plugin source kinds go in a `plugin source kind` Examples column with untagged Examples; `source kind` and `@url`/`@github` stay the marketplace's"

requirements-completed: [FND-01, FND-02]

coverage:
  - id: D1
    description: "A scenario publishes a git repository of plugins on the loopback git host (root or subpath, several per repository, new revisions) and a marketplace offers them as github, url, or git-subdir sources, unpinned or pinned"
    requirement: FND-01
    verification:
      - kind: e2e
        ref: "npx cucumber-js features/plugin/git-source.feature features/plugin/install.feature"
        status: pass
    human_judgment: false
  - id: D2
    description: "Git plugin versions are stated with revision tokens such as `{ghp revision 1}`"
    requirement: FND-01
    verification:
      - kind: e2e
        ref: "features/plugin/git-source.feature#Installing a plugin from a <plugin source kind> source clones its repository from the git host"
        status: pass
    human_judgment: false
  - id: D3
    description: "Seeds: an install from each plugin source kind with its request log and a new session offering its skill; a pinned second install with no request"
    requirement: FND-01
    verification:
      - kind: e2e
        ref: "npm run test:cucumber (452 scenarios passed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every new step and export has a user; fallow finds no clone, no dead export, and no private-type leak"
    requirement: FND-02
    verification:
      - kind: other
        ref: "commit hook npm run check:commit (fallow, check:features) on 509dd6ce and 245c0fcc"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-10-23
status: complete
---

# Phase 1 Plan 08: Git-source plugins and revision tokens Summary

**Plugins published in git repositories on the loopback git host can now be offered by any marketplace as `github`, `url`, or `git-subdir` sources, pinned or not, with their `sha-` versions stated as `{<repository> revision <n>}` tokens. Four seeds prove the install of each kind with its request log and a pinned install that reuses another plugin's clone with no request.**

## Performance

- **Duration:** about 10 min
- **Started:** 2026-10-23T03:57:03Z
- **Completed:** 2026-10-23T04:07:11Z
- **Tasks:** 2
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments

- `features/lib/git-plugin.ts` (new): a git repository of plugins on the git host. `readRepositoryPlugins` reads `| name | version | path |` and refuses a missing or unknown column, an absolute path, a path with `..`, and two plugins at one path. `publishPluginRepository` asserts that the host does not serve the repository yet, writes each plugin with `writePluginFiles`, publishes with `publishGitRepository`, and records `HEAD`. `pushPluginRepository` empties the work tree except `.git`, writes the plugins, pushes with `pushGitRepository`, and appends the new `HEAD`. `readGitPluginOffers` reads `| name | source kind | repository | pinned |`. `gitPluginEntry` builds `{ source: "github", repo }`, `{ source: "url", url }`, or `{ source: "git-subdir", url, path }`, adding `sha` (the latest revision, 40 hex) for a pinned offer. It fails when the repository does not hold the plugin, and when a github or url offer names a plugin below the root or a git-subdir offer names one at the root. `offerGitPlugins` merges entries into a manifest's text by name.
- `features/lib/hermetic-git.ts`: `runGit` resolves with the trimmed stdout. Every existing caller ignores it.
- `features/lib/path-marketplace.ts`: `writePluginFiles(pluginRoot, plugin)` is the exported plugin writer. The private `writePlugin` calls it, so a path fixture writes the same files. `requireColumns` is exported.
- `features/support/world.ts`: `recordGitRepository`, `gitRepository`, and `requireGitRepository`. The `tokens` getter builds `revisions` from every recorded repository.
- `features/lib/run-tokens.ts`: `RunTokens.revisions`. `expandTokens` replaces each revision token with its version, and `projectTokens` replaces each version with its token.
- `features/step_definitions/plugin/publishing.steps.ts`: the two new steps and a private `publishRepositoryRevision` helper. The fileoverview now covers git repositories.
- `.agents/skills/cucumber/rules/features.md`: the plugin source kinds and the `plugin source kind` column under "Source kinds", and the revision token under "Run tokens".

## Task Commits

1. **Task 1: A plugin from a github repository on the git host, end to end, offered by a marketplace and installed** - `509dd6ce` (test), `test(features): publish plugins from git repositories`. Hook: the first attempt failed `npm run check:commit` in fallow: `Private type leaks (2)`, `GitPluginOffer references private type GitPluginSourceKind` and `GitPluginEntry references private type GitPluginSource`. No commit was made. I exported both types, `npm run fallow` passed (exit 0), and the retry passed: `npm run check:commit` Passed, gitlint Passed. `SKIP=npm-check pre-commit run --files ...` passed before the commit with no fixer writes. Tracer gate: after the commit, I re-ran `npx cucumber-js features/plugin/git-source.feature features/plugin/install.feature` (13 scenarios passed) and `npm run check:features` (exit 0) before Task 2 started.
2. **Task 2: Revision tokens and every source kind, seeded by an Outline over the kinds and a pinned reuse** - `245c0fcc` (test), `test(features): state git plugin versions with revision tokens`. Hook: every hook passed on the first attempt: mdformat, markdownlint-cli2, `npm run check:commit`, and gitlint.

## Final Text of New Steps and Tokens

Both steps are in `features/step_definitions/plugin/publishing.steps.ts`:

- `Given the git repository {string} holds these plugins:` (columns `name`, `version`, `path`; an empty path is the repository root). The first statement in a scenario publishes `acme/<name>.git` from a work tree at `{home}/plugin-repositories/<name>`, whose release removes it. Each later statement pushes a new revision. The step then asserts that `main` of the bare repository is the recorded latest revision.
- `Given the marketplace {string} offers these plugins from git repositories:` (columns `name`, `source kind`, `repository`, `pinned`; kinds `github`, `url`, `git-subdir`; pinned `true` or `false`). It merges the entries into the published manifest through `rewritePublishedManifest`, so a git marketplace pushes them, then reads the manifest back and compares each entry.

Token: `{<repository> revision <n>}`, for example `{ghp revision 1}` = `sha-` plus the first 12 hex digits of the first revision the scenario published to `ghp`.

Final `git-plugin.ts` exports: `readRepositoryPlugins`, `publishPluginRepository`, `pushPluginRepository`, `readGitPluginOffers`, `gitPluginEntry`, `offerGitPlugins`, and the types `RepositoryPlugin`, `GitPluginRepository`, `GitPluginOffer`, `GitPluginEntry`, `GitPluginSource`, and `GitPluginSourceKind`.

## Seed Results (measured)

`features/plugin/git-source.feature`, `Feature: Plugin git source` (Phase 4 owns the file after this phase):

- **Outline "Installing a plugin from a <plugin source kind> source clones its repository from the git host"** (rows `github`/`ghp`/`ghp`/root, `url`/`urlp`/`urlp`/root, `git-subdir`/`subp`/`mono`/`plugins/subp`). Each row reports `cascade` / `info` / needs reload `true` and one plugin row: `gits` / `project` / `<plugin>@gits` / `<plugin>` / `installed` / no reasons / `project` / `{<repository> revision 1}`. A new session offers `/skill:<plugin>-skill` (`A skill of <plugin> 1.0.0.`). The request log was the same for every kind, so one Outline holds all three:

  | method | path | status |
  | ------ | ---- | ------ |
  | GET | `/acme/<repository>.git/info/refs?service=git-upload-pack` | 200 |
  | POST | `/acme/<repository>.git/git-upload-pack` | 200 |
  | GET | `/acme/<repository>.git/info/refs?service=git-upload-pack` | 200 |
  | POST | `/acme/<repository>.git/git-upload-pack` | 200 |

  The pair is made twice for the unpinned url kind too. RESEARCH measured only the pinned url install, which made the pair once.

- **"A plugin pinned to the commit another installed plugin was cloned at installs with no request":** `mono` holds `subp` and `subq` under `plugins/`. `gits` offers both as git-subdir sources pinned to `mono`'s revision, and `subp` is installed as setup. Installing `subq` reports `cascade` / `info` / needs reload `true` and the row `gits` / `project` / `subq@gits` / `subq` / `installed` / no reasons / `project` / `{mono revision 1}`. The git host receives no request and no connection.

## Planted Checks

Each check was made by hand, run, and reverted from a backup. `cmp` confirmed each restore.

1. **The github entry names another repository (Task 1).** I set `repo: "acme/other"` in `gitPluginEntry` and ran `npx cucumber-js features/plugin/git-source.feature` (exit 1). The install setup failed:

   ```
   1) A plugin installed from a github source is offered by a new session # features/plugin/git-source.feature:7
        Given the user has run "/claude:plugin install ghp@gits --scope project" # features/step_definitions/command.steps.ts:55
            AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
            +             cause: {
            +               causeChain: [
            +                 'HTTP Error: 404 Not Found',
            +                 'fetched https://127.0.0.1:40437/acme/other.git'
            +               ],
            ...
            +             reasons: [],
            +             status: 'failed'
   ```

2. **`projectTokens` drops the revisions (Task 2).** I replaced the revision replacement in `projectTokens` with a no-op and ran `npx cucumber-js features/plugin/git-source.feature` (exit 1). All 4 scenarios failed on the raw version, for example:

   ```
   3) Installing a plugin from a github source clones its repository from the git host # features/plugin/git-source.feature:37
        Then the result lists these plugins: # features/step_definitions/command.steps.ts:82
            +     'sha-a458592eb288'
            -     '{ghp revision 1}'
   4 scenarios (4 failed)
   ```

3. **A pinned entry has no `sha` (Task 2).** I made `gitPluginEntry` leave out the `sha` of a pinned offer and ran `npx cucumber-js features/plugin/git-source.feature --name "pinned"` (exit 1). The second install refreshed the mirror:

   ```
   1) A plugin pinned to the commit another installed plugin was cloned at installs with no request # features/plugin/git-source.feature:41
        Then the git host receives no request # features/step_definitions/git-host.steps.ts:132
            +   requests: [
            +     { method: 'GET', path: '/acme/mono.git/info/refs?service=git-upload-pack', status: 200 },
            +     { method: 'POST', path: '/acme/mono.git/git-upload-pack', status: 200 }
            +   ]
            -   requests: []
   ```

## Suspicious Values and Bug Candidates

- No product bug blocked a seed, and no product file changed.
- **For Phase 4 (INS-05/INS-06):** an unpinned second install from a repository that is already cloned (planted check 3) makes the upload-pack pair once, which is the mirror refresh. A first unpinned install makes it twice: clone, then refresh. Whether the refresh right after a fresh clone matches Claude Code's behavior is Phase 4's to check against upstream. I record it here, and I did not change it.
- The install 404 row with empty `reasons` (planted check 1, `HTTP Error: 404 Not Found`) is Phase 4's, as the plan states.

## Files Created/Modified

- `features/lib/git-plugin.ts` - plugin repositories on the git host, their revisions, and the manifest entries that offer their plugins
- `features/lib/hermetic-git.ts` - `runGit` returns trimmed stdout
- `features/lib/path-marketplace.ts` - exported `writePluginFiles` and `requireColumns`
- `features/lib/run-tokens.ts` - revision tokens
- `features/support/world.ts` - git repository records; `tokens.revisions`
- `features/step_definitions/plugin/publishing.steps.ts` - the repository and git-offer steps
- `features/plugin/git-source.feature` - `Feature: Plugin git source`, the Outline and the pinned seed
- `.agents/skills/cucumber/rules/features.md` - plugin source kinds and the revision token

## Decisions Made

See `key-decisions` in the frontmatter. In short: work trees live under `{home}/plugin-repositories/`, one Outline covers all three kinds because they share one request log, the two source types are exported to satisfy fallow, and `requireColumns` is reused rather than copied.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Exported two types that fallow reported as private type leaks**
- **Found during:** Task 1 commit
- **Issue:** `npm run check:commit` failed in fallow: the exported `GitPluginOffer` and `GitPluginEntry` referenced the module-private `GitPluginSourceKind` and `GitPluginSource`.
- **Fix:** exported both. Each already had a doc comment.
- **Files modified:** features/lib/git-plugin.ts
- **Verification:** `npm run fallow` exit 0, then the commit hook passed
- **Committed in:** 509dd6ce

**2. [Rule 3 - Reuse] Exported `requireColumns` from path-marketplace.ts**
- **Found during:** Task 1
- **Issue:** both table readers in `git-plugin.ts` need the column check that path-marketplace.ts kept private. A copy would risk a fallow clone group.
- **Fix:** exported it and imported it in `git-plugin.ts`.
- **Files modified:** features/lib/path-marketplace.ts
- **Committed in:** 509dd6ce

---

**Total deviations:** 2 auto-fixed (both blocking or reuse, in files the plan lists)
**Impact on plan:** None on behavior. `features/lib/git-plugin.ts` needed no change in Task 2.

## Issues Encountered

None besides the fallow finding above.

## Verification

- `npx cucumber-js features/plugin/git-source.feature features/plugin/install.feature`: 13 scenarios passed (after Task 1); `npx cucumber-js features/plugin/git-source.feature`: 4 scenarios, 47 steps passed (after Task 2).
- `npm run check:features`: exit 0 after each task.
- `npm run test:cucumber` (full suite, Node v26.12.1, at `245c0fcc`): 452 scenarios, 4276 steps passed.
- The wave gate runs `npm run check` on the combined tree after wave 5.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. Every url and git-subdir entry is built from `host.repositoryUrl` (127.0.0.1 and the run's port), every github entry is an `acme/<name>` shorthand that goes through the GitHub base override, the work trees live under the sandbox HOME, and the plugin path refuses absolute paths and `..` (T-01-19, T-01-20, T-01-21).

## Next Phase Readiness

- Phases 4, 9, 10, 12, and 15 can publish git plugins with the two steps and state their versions with revision tokens. `git-source.feature` passes to Phase 4.
- Ready for 01-09 and 01-10.

## Self-Check: PASSED

- FOUND: features/lib/git-plugin.ts, features/plugin/git-source.feature
- FOUND: 509dd6ce, 245c0fcc (ancestors of HEAD)
- Acceptance greps: `export` in git-plugin.ts 12, `writePluginFiles` export 1, both step texts 1 each, `requireGitRepository` 1, `revisions` in run-tokens.ts 3, `| plugin source kind |` 1 with three Examples rows, `revision 1}` 2, `plugin source kind` in the skill 1.

---
*Phase: 01-suite-foundation*
*Completed: 2026-10-23*
