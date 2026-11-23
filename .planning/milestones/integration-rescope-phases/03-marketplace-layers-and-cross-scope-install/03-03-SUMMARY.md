---
phase: 03-marketplace-layers-and-cross-scope-install
plan: "03"
subsystem: testing
tags: [cucumber, marketplace, url-source, clone-cache, mirror-seeding, D-SEED-01, LAYER-01, D-09]

requires:
  - phase: 02-plugin-layers-names-and-list-fold
    provides: the break helper pattern and the red-proof SUMMARY record
provides:
  - six url-source scenarios (R01, R02, U01, U02, U01g, U02g) that replace the redeclare integration test and the user-visible half of seed-mirrors
  - the Given "the marketplace {string} offers these plugins from its own repository:" with its reader and builder in features/lib/git-plugin.ts
  - the D-SEED-01 fix that seeds a same-repo git-subdir plugin whose url ends in .git
affects: [phase-07-marketplace-publishing-harness, phase-08-internal-cases]

actuals:
  tokens: 7104
  tasks: 3
  commits: 4
plan_head_before: 792d2effb5602573522ac56ba22a60d430b0129a
plan_head_after: cd728de56af6690c50cd9f1cf0f467169fe473d1

tech-stack:
  added: []
  patterns:
    - "A Given that offers plugins from a url marketplace's own repository: republish the files, read HEAD, rewrite each entry as a git-subdir source"

key-files:
  created: []
  modified:
    - features/marketplace/url-source.feature
    - features/step_definitions/marketplace/publishing.steps.ts
    - features/lib/git-plugin.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
    - extensions/pi-claude-marketplace/domain/clone-key.ts
    - test/orchestrators/plugin/clone-cache.test.ts
  deleted:
    - test/integration/marketplace-layer-redeclare.test.ts
files_deleted:
  - test/integration/marketplace-layer-redeclare.test.ts

key-decisions:
  - "D-SEED-01 fix: seeding compares the plugin's and the marketplace's urls with one trailing .git set aside, and keys the seed by the plugin's own canonicalCloneUrl; no stored key changes, because only plugins that never seeded now seed"
  - "The own-repository Given checks the rewritten manifest's whole plugins list against the built entries, which is stronger than the by-name check of the plugin publishing step and avoids a clone group with it"

patterns-established:
  - "Own-repository offer: | name | version | url | pinned |, the url cell shows whether it ends in .git"

requirements-completed: [ITMIG-05]

coverage:
  - id: D1
    description: "Re-declaring a url marketplace (with --local while the base declares it, and after the scope records it with no layer declaring it) makes no second clone and no git request"
    requirement: ITMIG-05
    verification:
      - kind: e2e
        ref: "features/marketplace/url-source.feature#Adding with --local a url marketplace that the base layer declares makes no second clone and no git request (LAYER-01)"
        status: pass
      - kind: e2e
        ref: "features/marketplace/url-source.feature#Adding again a url marketplace that the scope records but no layer declares declares it with no git request (D-09)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A plugin a url marketplace offers from its own repository lists as available right after the add, and a pinned install of it makes no git request, with and without a .git url"
    requirement: ITMIG-05
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter --parallel 1 features/marketplace/url-source.feature (15 scenarios (15 passed))"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/clone-cache.test.ts#D-SEED-01 (2 cases)"
        status: pass
      - kind: integration
        ref: "test/integration/marketplace-add-seed-mirrors.test.ts (6 of 6 pass, unchanged)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The redeclare integration test is deleted after break D1 failed both replacing scenarios"
    requirement: ITMIG-05
    verification:
      - kind: other
        ref: "npm run check:static on 4e9cc91 (exit 0)"
        status: pass
    human_judgment: false

duration: 32min
completed: 2026-11-21
status: complete
---

# Phase 3 Plan 03: Url re-declarations, same-repo seeding, and the .git seeding fix Summary

**Six url-source scenarios replace the redeclare integration test and the user-visible half of seed-mirrors, and `seedSameRepoPluginMirrors` now seeds a same-repo git-subdir plugin whose url ends in `.git`, keyed by the plugin's own url.**

## Performance

- **Duration:** 32 min
- **Started:** 2026-11-21T21:41:16Z
- **Completed:** 2026-11-21T22:13:00Z
- **Tasks:** 3
- **Files modified:** 7 (one deleted)

## Accomplishments

- R01 and R02 show that adding again a url marketplace the project scope records makes no git request, keeps one marketplace clone, and declares it in the target layer (LAYER-01, D-09).
- U01 and U02 show that a plugin a url marketplace offers from its own repository lists as `available` right after the add, and a pinned install of it makes no git request (D-SEED-01).
- The D-SEED-01 defect is fixed under rule 4: a `git-subdir` url that ends in `.git` now seeds too (U01g, U02g, two unit cases).
- `test/integration/marketplace-layer-redeclare.test.ts` is deleted. `marketplace-add-seed-mirrors.test.ts` stays unchanged with its six internal cases.

## Task Commits

1. **Task 1: own-repository offer, tracer on U02** - `8ea8099` (test)
2. **Task 2: re-declaration and pinned-install scenarios** - `bac83c4` (test); **deletion of the redeclare test** - `4e9cc91` (test)
3. **Task 3: D-SEED-01 fix with its scenarios and unit cases** - `cd728de` (fix)

**Plan metadata:** the commit that adds this SUMMARY.

## Files Created/Modified

- `features/marketplace/url-source.feature` - six new scenarios after the last Outline: R01, R02, U01, U02, U01g, U02g. No existing line changed.
- `features/step_definitions/marketplace/publishing.steps.ts` - the own-repository Given and its local `withoutGitSuffix`.
- `features/lib/git-plugin.ts` - `OwnRepositoryOffer`, `readOwnRepositoryOffers`, `ownRepositoryEntry`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` - the D-SEED-01 comparison and key.
- `extensions/pi-claude-marketplace/domain/clone-key.ts` - comment lines of the `canonicalCloneUrl` docstring only.
- `test/orchestrators/plugin/clone-cache.test.ts` - two D-SEED-01 cases after the last SEED-04 case.
- `test/integration/marketplace-layer-redeclare.test.ts` - deleted.

## Red proofs

- Scratch folder: `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/phase03-plan03` (`$D`).
- Checkout root, the first line of every break log: `root=/home/user/pi-claude-marketplace/.claude/worktrees/agent-aec57dfff2750babc`.
- Plan base: `792d2effb5602573522ac56ba22a60d430b0129a`.
- Helper: `$D/break.sh`, copied from `phase02-plan02/break.sh` unchanged. It roots at `git rev-parse --show-toplevel`, refuses a dirty `extensions/`, sets the EXIT trap before the one-occurrence replacement, logs the diff, runs `npm run --silent test:cucumber:profile -- --profile <p> --parallel 1 <args>` with the nondac prefix, and appends `exit=` and `restored=`. `grep -c 'rev-parse --show-toplevel'` is 1, `grep -c '/home/user/pi-claude-marketplace'` is 0.
- Break texts: `$D/D1.old|new` and `$D/D2.old|new`, copied byte for byte from `research-03/brk/` and checked with `cat -A` against the plan.
- Green runs (adapter, `features/marketplace/url-source.feature`): `green-url-1.log` `10 scenarios (10 passed)` exit 0; `green-url-2.log` `13 scenarios (13 passed)` exit 0; `green-url-3.log` `15 scenarios (15 passed)` exit 0.
- Builtin run: `builtin.log` `0 scenarios`, exit 0 (DUAL-02).

Breaks (each run on a clean `extensions/`; `git status --porcelain -- extensions/` printed nothing after each, and each log ends `restored=clean`; no log holds `function timed out`):

- **D2, tracer** (`D2-tracer-adapter.log`): `orchestrators/marketplace/add.ts:1242`, inside the seeding call of `settleAddedMarketplace`, `-      marketplaceName: name,` / `+      marketplaceName: \`${name}-never\`,`. Command: `bash "$D/break.sh" D2-tracer adapter extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts "$D/D2.old" "$D/D2.new" features/marketplace/url-source.feature`. Result `10 scenarios (9 passed, 1 failed)`, `exit=1`. Failed: U02 "A plugin from the repository of a url marketplace lists as available right after the add (D-SEED-01)" `url-source.feature:152`, at `Then the result lists these plugins:`, first error `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal`, the row reads `remote` for `available`. No other scenario failed. Rerun once after the step's post-condition changed (see Deviations), with the same result; the first run is kept as `D2-tracer-adapter.first.log`.
- **D1** (`D1-adapter.log`): `orchestrators/marketplace/add.ts:1071` in `runAddInGuard`, `-    if (action?.kind === "reuse") {` / `+    if (action?.kind === "reuse" && process.env.NEVER_SET === "x") {`. Result `13 scenarios (11 passed, 2 failed)`, `exit=1`. Failed: R01 "Adding with --local a url marketplace that the base layer declares makes no second clone and no git request (LAYER-01)" `url-source.feature:152` and R02 "Adding again a url marketplace that the scope records but no layer declares declares it with no git request (D-09)" `url-source.feature:176`, each at `Then the result has these fields:`, first error `AssertionError`, the severity reads `error` for `info` and an extra `summary | A marketplace operation has failed.` row appears. Passed: the other 11, U01 and U02 included.
- **D2** (`D2-adapter.log`): the same change as the tracer. Result `13 scenarios (11 passed, 2 failed)`, `exit=1`. Failed: U01 "Installing a pinned plugin from the repository of a url marketplace makes no git request after the add (D-SEED-01)" `url-source.feature:200` at `Then the git host receives no request`, observed GET `/acme/tools/info/refs?service=git-upload-pack` 200 and POST `/acme/tools/git-upload-pack` 200; U02 `url-source.feature:216` at `Then the result lists these plugins:`, the row reads `remote`. Passed: the other 11, R01 and R02 included.
- **D2 on the fixed tree** (`D2-fixed-adapter.log`, run after `cd728de`): the same change. Result `15 scenarios (11 passed, 4 failed)`, `exit=1`. Failed: U01 `:200` (GET and POST on `/acme/tools`), U02 `:216` (`remote`), U01g "Installing a pinned plugin whose url ends in .git from the repository of a url marketplace makes no git request after the add (D-SEED-01)" `:235` at `Then the git host receives no request` (GET `/acme/tools.git/info/refs?service=git-upload-pack` and POST `/acme/tools.git/git-upload-pack`), and U02g "A plugin whose url ends in .git from the repository of a url marketplace lists as available right after the add (D-SEED-01)" `:251` at `Then the result lists these plugins:` (`remote`). Passed: the other 11, R01 and R02 included.

Natural red of the fix (on the tree without it, `extensions/` clean, both logs written before `cd728de`: log mtimes 1795298877 and 1795298907, commit time 1795299037):

- `fix-red-adapter.log`: `15 scenarios (13 passed, 2 failed)`, `exit=1`. U01g `:235` failed at `Then the git host receives no request` with GET `/acme/tools.git/info/refs?service=git-upload-pack` 200 and POST `/acme/tools.git/git-upload-pack` 200. U02g `:251` failed at `Then the result lists these plugins:` with `remote` for `available`.
- `seed-unit-red.log`: ` tests 2`, ` pass 0`, ` fail 2`, `exit=1`. The unpinned case failed on `pluginMirror: false` for `true`. The pinned case failed on `pluginClone: false` for `true` and `checkouts: []` for `[PIN_40]`.

## Case map

| Case | Replaced by | Break |
|------|-------------|-------|
| `marketplace-layer-redeclare.test.ts:96` "declares a url marketplace in the local layer with one clone in total" | R01 (`url-source.feature:152`); `add.feature:116`'s `@url` row also checks the declarations | D1 |
| `marketplace-layer-redeclare.test.ts:123` "declares again a url marketplace the scope records but no layer declares" | R02 (`url-source.feature:176`) | D1 |
| `marketplace-add-seed-mirrors.test.ts:155` "seeds a same-repository URL plugin mirror with one marketplace clone" | kept, internal (it asserts the mirror directory and the probe); U01 and U02 show its user-visible half, and U01g and U02g the `.git` spelling | D2 |
| `marketplace-add-seed-mirrors.test.ts:202`, `:253`, `:299`, `:357`, `:396` | kept, internal (no-call, unseeded different repository, unseeded pin, mirror remote, mirror GC) | - |

`test/integration/path-source-tag-install.test.ts:8` names `marketplace-add-seed-mirrors`, which stays, so it stays valid. `git grep -l 'marketplace-layer-redeclare' -- . ':(exclude).planning'` exits 1 and prints nothing.

## Product fix

- **Defect.** A url marketplace's identity drops a trailing `.git` at parse time (D-76-01), but a `git-subdir` source keeps the url its manifest wrote. `seedSameRepoPluginMirrors` compared the plugin's `canonicalCloneUrl` with the marketplace url exactly, so a `.git` git-subdir plugin of the marketplace's own repository was never seeded. It listed as `remote` right after the add, and a pinned install cloned the repository again.
- **`seedSameRepoPluginMirrors`.** The loop skips an entry only when `withoutGitSuffix(canonicalCloneUrl(src))` and `withoutGitSuffix(marketplaceUrl)` differ. `withoutGitSuffix` is a new module-private helper whose JSDoc cites D-SEED-01 and D-76-01. The SEED-03 comment stays and now says that one `.git` is ignored on both sides. The function's JSDoc says the seed lands under the plugin's own url.
- **`seedOnePluginMirror`.** It takes `canonicalCloneUrl(source)` once and builds the unpinned key with `pluginMirrorKey` and the pinned key with `pluginCloneKey` from it. The `marketplaceUrl` parameter is gone from its signature and its one call. Its JSDoc says both keys hash the url that install's materializer and the presence probe hash.
- **Key it now writes.** `pluginMirrorKey(<plugin url>)` or `pluginCloneKey(<plugin url>, sha)`, where the plugin url is the git-subdir url as written, `.git` included.
- **Why no stored key changes.** When the two urls compare equal, the plugin's own url is the marketplace url, so the key is the one it was before. Only entries that never seeded now seed. SEED-03 (a different repository stays unseeded) and SEED-04 (a pin seeds only when its commit checks out from the copied history) are unchanged. `canonicalCloneUrl`, `pluginMirrorKey`, `pluginCloneKey`, `networkCloneUrl`, and `domain/source.ts` are unchanged.
- **`domain/clone-key.ts`.** Comment lines only: a url source's `source.url` is the parse-time canonical form, a git-subdir source's keeps `.git`, so `repo` and `repo.git` name two keys, which seeding compares without the suffix (D-SEED-01).
- **Unit cases.** "D-SEED-01: a same-repository git-subdir source whose url ends in .git seeds the mirror under its own url" and "D-SEED-01: a pinned same-repository git-subdir source whose url ends in .git seeds the per-commit clone under its own url". Each pins the key in both directions in one `assert.deepStrictEqual`: the `.git` url's key holds the seed, the marketplace url's key stays empty, staging is empty, and the pinned case checks out `[PIN_40]`. `seed-unit-green.log`: ` tests 2`, ` pass 2`.
- **Coverage.** `coverage-clone-cache.log` and `coverage-clone-key.log`: both pairs exit 0, 100% direct coverage (quiet pass).
- **Seed-mirrors.** `seed-mirrors.log`: ` tests 6`, ` pass 6`, ` fail 0`, with the file unchanged.

## Checks

Node `v24.22.3`. Every heavy job ran under `flock -w 3600 $S/phase03-heavy.lock`.

| Check | Log | Exit | Tree |
|-------|-----|------|------|
| `npm run lint` (warm-up) | `lint-warm.log` | 0 | before `8ea8099` |
| `check:static` | `check-static-1.log` | 1, then 0 | first run: fallow found one clone group against `plugin/publishing.steps.ts:185-199`; rerun after the fix of the step, on the tree of `8ea8099` |
| `npx fallow dupes --fail-on-issues` | `dupes-2.log` | 0 | the tree of `8ea8099` |
| green url-source (10) | `green-url-1.log` | 0 | the tree of `8ea8099` |
| D2 tracer verify | `verify-t1-2.sh` | 0 | the tree of `8ea8099` |
| task 1 file-set verify | `verify-t1-4.sh` | 0 | `8ea8099` |
| green url-source (13) | `green-url-2.log` | 0 | the tree of `bac83c4` |
| D1 and D2 verify | `verify-t2-2.sh` | 0 | the tree of `bac83c4` |
| `check:static` | `check-static-2.log` | 0 | the tree of `bac83c4` |
| `check:static` (deletion) | `check-static-3.log` | 0 | the tree of `4e9cc91` |
| task 2 final verify | `verify-t2-5.sh` | 0 | `4e9cc91` |
| natural red, scenarios | `verify-t3-1.sh`, `fix-red-adapter.log` | 0 (log exit 1) | `4e9cc91` plus the `.git` scenarios |
| natural red, unit | `verify-t3-2.sh`, `seed-unit-red.log` | 0 (log exit 1) | the same plus the unit cases |
| unit green, seed-mirrors | `verify-t3-3.sh` | 0 | the tree of `cd728de` |
| direct coverage, clone-cache | `coverage-clone-cache.log` | 0 | the tree of `cd728de` |
| direct coverage, clone-key | `coverage-clone-key.log` | 0 | the tree of `cd728de` |
| green url-source (15) | `green-url-3.log` | 0 | the tree of `cd728de` |
| `check:static` | `check-static-4.log` | 0 | the tree of `cd728de` |
| D2 on the fixed tree | `verify-t3-4.sh` | 0 | `cd728de` |
| `fallow audit --base 792d2ef` | `verify-t3-5.sh`, `audit.json` | 0 | `cd728de` |
| builtin url-source | `builtin.log` | 0 (`0 scenarios`) | `cd728de` |
| final file-set verify | `verify-t3-6.sh` | 0 | `cd728de` |

The commit hook's `npm run check:commit` ran and passed on `8ea8099`, `bac83c4`, and `cd728de`. It skipped `4e9cc91`, which only deletes a file, so `check-static-3.log` is that commit's check. The wave's post-merge `npm run check` is the full verdict.

Every verify command of the plan that calls `git` inside `$(...)` ran unchanged from a script in `$D` (`verify-t1-2.sh`, `verify-t1-4.sh`, `verify-t2-2.sh`, `verify-t2-5.sh`, `verify-t3-1.sh` to `verify-t3-6.sh`), because the worktree's shell guard refused the one-line form. Commits ran through `$D/rec.sh` (the HEAD and cwd guards, the ledger, staging by path, and `git commit -F` under the lock), and pre-commit through `$D/pc.sh`.

## Harness changes for Phase 7

- `features/step_definitions/marketplace/publishing.steps.ts`: new Given `the marketplace {string} offers these plugins from its own repository:` with the table `| name | version | url | pinned |`, registered after `the marketplace {string} offers these plugins with dependencies:`. It works on a `url` marketplace only, republishes the plugin files with `republishMarketplace`, reads HEAD with `runGit`, rewrites each entry as `{ source: "git-subdir", url, path: "plugins/<name>", sha? }` through `offerGitPlugins` and `rewritePublishedManifest`, asserts that each expanded url names `published.source` once one trailing `.git` is set aside, and asserts that the manifest's whole `plugins` list equals the built entries. New imports: `offerGitPlugins`, `ownRepositoryEntry`, `readOwnRepositoryOffers` from `../../lib/git-plugin.ts`, and `runGit` from `../../lib/hermetic-git.ts`.
- `features/lib/git-plugin.ts`: new exports `OwnRepositoryOffer` (`name`, `version`, `url`, `pinned`), `readOwnRepositoryOffers(table: DataTable): OwnRepositoryOffer[]`, and `ownRepositoryEntry(offer, url, commit): GitPluginEntry & { readonly version: string }`. No existing export changed.
- No line of `features/lib/published-marketplace.ts` or `features/lib/git-marketplace.ts` changed.

## Issues for the milestone

- `fallow audit --base 792d2ef` on `cd728de`: verdict `pass`, `"dead_code_issues":0`, `"complexity_findings":0`, `"duplication_clone_groups":0`, and no diff-risk finding at all (`risks=` is empty; `attribution.diff_risk_introduced` is 0). Phases 1 and 2 measured one `weakened-tests` `warn` per deleted test file. Here the deleted file held 2 test cases and the same range adds 2 (the D-SEED-01 cases), which is a likely reason, not verified. No `.fallowrc.json` or CI change (user decision 2026-11-21).

## Decisions Made

- The fix follows CONTEXT [Seeding bug] and the plan exactly: a module-private `withoutGitSuffix` in `clone-cache.ts`. It duplicates the private `stripGitSuffix` of `domain/source.ts` in behavior, because the plan forbids a change to `domain/source.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The own-repository Given's post-condition made a clone group**
- **Found during:** Task 1, `check-static-1.log`.
- **Issue:** The by-name manifest check, copied in shape from `plugin/publishing.steps.ts:185-199`, formed a 15-line clone group there, and `fallow dupes` fails on every clone group. The plan forbids a change to the other step module, and no shared helper exists.
- **Fix:** The Given now compares the rewritten manifest's whole `plugins` list with the built entries. The republish offers exactly these plugins, so this check is stronger than the by-name one and has no clone.
- **Files modified:** `features/step_definitions/marketplace/publishing.steps.ts`.
- **Verification:** `dupes-2.log` exit 0, `check-static-1.log` exit 0 on the rerun, green 10 of 10, D2 tracer rerun with the same failure.
- **Committed in:** `8ea8099`.

### Expected values that differed

- **The `fallow audit` result.** Expected: only `weakened-tests` on the deleted redeclare file. Observed: verdict `pass` with no diff-risk finding. The verify command still exits 0, because it rejects only other findings. See "Issues for the milestone".
- **Commit count.** The plan's objective says "five commits"; its tasks name four (the own-repository step with U02, the re-declaration and pinned scenarios, the deletion, the fix). This plan made those four.
- **The task 2 commit title.** The first title, 73 characters, failed gitlint's 72-character limit. No commit happened, and the shorter title `test(marketplace): cover re-declared url marketplaces with no request` passed.

No scenario was strengthened for a break: every break failed its expected scenarios on the first valid run.

---

**Total deviations:** 1 auto-fixed (Rule 3), 3 expected values that differed.
**Impact on plan:** None on scope. The stronger post-condition is a test-only change.

## Issues Encountered

- The worktree's shell guard refused one-line commands that call `git` inside `$(...)`, `pre-commit` with a redirect, and a script named after a commit. Each ran unchanged from a script in `$D`.

## Parent lines

- **CHANGELOG** (for the milestone PR, the parent adds the PR number): "A plugin that a marketplace offers from its own repository, through a `git-subdir` URL that ends in `.git`, now shows as available right after `marketplace add`, and a pinned install of it makes no new clone."
- **BACKLOG:** None.
- **Key Decisions table:** None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 7 can build its marketplace tag step on the two harness files above.
- `marketplace-add-seed-mirrors.test.ts` keeps its six internal cases for Phase 8.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- All six modified files exist; `test/integration/marketplace-layer-redeclare.test.ts` is absent.
- Commits `8ea8099`, `bac83c4`, `4e9cc91`, and `cd728de` are ancestors of HEAD; `git rev-list --count 792d2ef..HEAD` is 4 before this SUMMARY's commit.
- Every acceptance criterion of the three tasks ran and passed (`verify-t1-4.sh`, `verify-t2-5.sh`, `verify-t3-6.sh`), and `git status --porcelain -- extensions/ features/ test/` prints nothing.

---
*Phase: 03-marketplace-layers-and-cross-scope-install*
*Completed: 2026-11-21*
