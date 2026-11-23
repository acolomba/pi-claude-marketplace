---
phase: 07-path-source-dependency-tags
plan: "01"
subsystem: testing
tags: [cucumber, git-host, release-tag, dependencies, integration-rescope]
status: complete

requires: []
provides:
  - "features/lib/git-marketplace.ts: pushGitTag, the one release-tag builder that the marketplace tag step and the plugin tag-only revision share"
  - "the step `the marketplace {string} tags its current commit {string}` in features/step_definitions/marketplace/publishing.steps.ts"
  - "the run tokens {<marketplace> revision <tag>} and {<marketplace> commit <tag>} in features/support/world.ts, documented in the cucumber skill and features/lib/run-tokens.ts"
  - "two untagged scenarios in features/plugin/install-dependencies.feature: S1 (TAGS-01, TAGS-03) and S2 (TAGS-02, D-07-03)"
  - "test/integration/path-source-tag-install.test.ts trimmed to CR-01 and the two-member git-state case (ITSCOPE-01)"
affects: [integration-rescope Phase 8 (the two kept internal cases)]

actuals:
  tokens: 8650
  tasks: 3
  commits: 3
plan_head_before: 89d17f041388da63b6ac31d6315a5a7fad420747
plan_head_after: 45e96c6e693fad056cb675ecd8ea039ca8d0cade

tech-stack:
  added: []
  patterns:
    - "A marketplace release tag is a world record kept apart from the git plugin repositories, so requireGitRepository never resolves a marketplace"

key-files:
  created: []
  modified:
    - features/lib/git-marketplace.ts
    - features/lib/git-plugin.ts
    - features/step_definitions/marketplace/publishing.steps.ts
    - features/support/world.ts
    - features/plugin/install-dependencies.feature
    - features/lib/run-tokens.ts
    - .agents/skills/cucumber/rules/features.md
    - test/integration/path-source-tag-install.test.ts

key-decisions:
  - "The tag scenarios publish `tools` as a github source, whose clone key 1969ce50f054 is stable across runs (a url source's key hashes the git host's random port)"
  - "CR-01 and the two-member git-state case stay internal (ITSCOPE-01): no command shows plugin-clones/ or the marketplace clone's .git state"

patterns-established:
  - "Release tags of plugins and marketplaces go through one builder, pushGitTag, so fallow dupes sees one copy"

requirements-completed: [ITMIG-07]

duration: 25min
completed: 2026-11-23
---

# Phase 7 Plan 01: Path-Source Dependency Tags Summary

A marketplace release-tag step on a shared `pushGitTag` builder, two github-marketplace scenarios
that install a constrained path-source dependency from its tag (TAGS-01, TAGS-03) or from the
current copy when no tag fits (TAGS-02, D-07-03), and `path-source-tag-install` trimmed to its two
internal cases.

## Performance

- Duration: about 25 minutes (2026-11-23T01:09Z to 01:34Z)
- Tasks: 3 of 3
- Files modified: 8 (no file under `extensions/`)

## Task Commits

1. Task 1 (tracer): the shared builder, the plugin tag builder on it, the tag step, the tag
   tokens, and S1: `71ce5ba` `test(plugin): install a dependency from a marketplace release tag`
2. Task 2: S2, the feature description, and the token docs: `04081b8`
   `test(plugin): install the current copy when no marketplace tag fits`
3. Task 3: the breaks, the red proofs, and the trim: `45e96c6`
   `test(plugin): keep only the internal path-source tag cases`

## Red proofs

- Scratch folder: `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/phase07-plan01` (`$D`). Every log and command script named below is kept there. The shell guard refused one-line commands that name `git` (also as part of a path such as `git-marketplace.ts`) or call it inside `$(...)`, so those verify commands ran verbatim from scripts: `diff-t1.sh`, `copy-in.sh`, `verify-t1-builder.sh`, `verify-t1-red.sh`, `verify-files.sh`, `feature-removed-lines.sh`, `commit.sh`, `run-breaks.sh`, `verify-t3-red.sh`, `verify-t3-b5int.sh`, `verify-t3-audit.sh`, `excerpt.sh`.
- Checkout root, the first line of every break log: `root=/home/user/pi-claude-marketplace/.claude/worktrees/agent-a49325a0548296363`.
- Plan base (`$D/plan-base`): `89d17f041388da63b6ac31d6315a5a7fad420747`. The precondition's `git diff --quiet 8826ad0 HEAD -- <the copied files, the named feature files, the integration file, the three break sites, cucumber.json>` exited 0, so every copy, scenario line, and break site applies to this tree.
- Inputs: `sha256sum -c --quiet SHA256SUMS` in `$I` exited 0, and `sha256sum "$I/SHA256SUMS"` printed `379aa6cad09fe1374bb3f37ffb3f14c10c78f6e0685b80282b0f41cb840455ee`. Every copied file was checked with `cmp`. I wrote nothing to `$I` and ran no file of `research-07/`, `plan-07/stage/`, `plan-07/wt/`, `plan-07-v1/`, or `research-06.1/`.
- Helpers: `$D/break.sh` is Phase 6's helper with two changes: the lock is `<scratchpad>/phase07-heavy.lock` (`flock -E 75 -w 3600`), and every cucumber run passes `--parallel 2`. `$D/break-int.sh` is its node:test sibling: it reads the same edits file, refuses a dirty `extensions/`, runs the named test files with `node --import <root>/scripts/isolated-pi-home.mjs --test --test-reporter=spec`, restores `extensions/` in an EXIT trap, and writes `<id>-integration.log` (`root=`, the diff, the run, `exit=`, `restored=`); it takes no lock. `bash -n` passed on both, and `node --check "$D/check-red.mjs"` passed.
- Green runs (each exited 0): Task 1 `green-1-adapter.log` `60 scenarios (60 passed)`, `green-1-builtin.log` `1 scenario (1 passed)`, `builder-1-adapter.log` `27 scenarios (27 passed)`. Task 2 `green-2-adapter.log` `61 scenarios (61 passed)`, `green-2-builtin.log` `1 scenario (1 passed)`. Task 3 `int-3.log` on the trimmed integration file: `tests 2`, `pass 2`, `fail 0`.
- Scenario lines (final file): S1 `:672` "Installing a plugin installs its path-source dependency from the marketplace tag that its version constraint selects, not from a later marketplace commit (TAGS-01, TAGS-03)"; S2 `:704` "Installing a plugin whose path-source dependency's version constraint no marketplace tag satisfies installs the dependency's current copy as a note (TAGS-02, D-07-03)".
- Every cucumber break command was `bash "$D/break.sh" <id> adapter "$D/brk/<id>.json" features/plugin/install-dependencies.feature`. Every log ends with `restored=clean` and holds no step timeout, and `git status --porcelain -- extensions/` printed nothing after each run. No run needed a rerun. Task 3's cucumber breaks ran on the committed Task 2 tree `04081b8`. Every failure's first error line is `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:`.
- `check-red.mjs` printed `RED-PROOFS OK` with `exit=0` for the tracer tables (`red-tracer.log`) and for the main tables (`red.log`).

- **B1-tracer** (`B1-tracer-adapter.log`, the Task 1 tree): `orchestrators/plugin/install-cascade.ts:943`, `-    if (probed.kind === "no-matching-tag" || probed.kind === "tag-listing-failed") {` / `+    if (probed.kind !== undefined) {`. `60 scenarios (59 passed, 1 failed)`, `exit=1`. S1 `:672` failed at `Then the result lists these plugins:`: the `formatter@tools` row had the reason `dependency current copy` and the version `2.0.0` in place of no reason and `1.0.0-{tools revision formatter--v1.0.0}`. No other scenario failed.
- **B1** (`B1-adapter.log`, the same edit): `61 scenarios (60 passed, 1 failed)`, `exit=1`. S1 `:672` failed at `Then the result lists these plugins:`, with the same values as B1-tracer.
- **B2** (`B2-adapter.log`): `orchestrators/plugin/clone-cache.ts:990` (in `materializeMarketplaceTagClone`), `-        args.tagOid,` / `+        "HEAD",`. `61 scenarios (60 passed, 1 failed)`, `exit=1`. S1 `:672` failed at `Then the result lists these plugins:`: the version was `2.0.0-{tools revision formatter--v1.0.0}` in place of `1.0.0-{tools revision formatter--v1.0.0}` (the HEAD's files under the tag's commit).
- **B3** (`B3-adapter.log`): `orchestrators/plugin/install-cascade.ts:943`, `-    if (probed.kind === "no-matching-tag" || probed.kind === "tag-listing-failed") {` / `+    if (probed.kind === "tag-listing-failed") {`. `61 scenarios (57 passed, 4 failed)`, `exit=1`. S2 `:704` and `:7` "Installing a plugin whose dependency carries a version constraint installs the dependency too" failed at `Then the result has these fields:` (severity `error` in place of `info`, needs reload `false`, and a summary `Some plugin operations have failed.`). `:491` "Installing a plugin whose installed dependency another plugin holds outside its version constraint fails as a version conflict and changes nothing" and `:24` "A new session offers the skills of a plugin and its dependency that carries a version constraint" failed in a `Given` (`Given the user has run "/claude:plugin install ... --scope project"`). These are the dir-source scenarios of RESEARCH Pitfall 2: a dir marketplace has no `.git`, so its tag list is empty and goes through the same `no-matching-tag` arm. The tables expect all four; only S2 is a must-fail row.
- **B4** (`B4-adapter.log`): `orchestrators/plugin/marketplace-tag-probe.ts:147` (in `probeMarketplaceTags`), `-    options.range,` / `+    "*",`. `61 scenarios (60 passed, 1 failed)`, `exit=1`. S2 `:704` failed at `Then the result lists these plugins:`: the `formatter@tools` row had no reason and the version `1.0.0-{tools revision formatter--v1.0.0}` in place of `dependency current copy` and `2.0.0`.
- **B5** (`B5-adapter.log`, the survivor): `orchestrators/plugin/clone-cache.ts:985`, `+      await gitOps.checkout({ dir: args.marketplaceRoot, ref: args.tagOid });` before `checkoutGitDirCopy(`. `61 scenarios (61 passed)`, `exit=0`, as the survivor row expects: an in-place checkout of the marketplace clone changes only its own git state, which no command shows (D-07-04).
- **B5 on the integration file** (`B5-integration.log`, the trimmed file, uncommitted at the time of the run, equal to its frozen copy): `bash "$D/break-int.sh" B5 "$D/brk/B5.json" test/integration/path-source-tag-install.test.ts`, the same edit. `tests 2`, `pass 1`, `fail 1`, `exit=1`, `restored=clean`. `✖ TAGS-01: two cascade members resolving against the SAME marketplace clone leave its git state untouched` failed at `test/integration/path-source-tag-install.test.ts:344` with `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:` (`.git/HEAD` became a 41-byte detached oid in place of the 21-byte `ref: refs/heads/...`). `✔ CR-01: an untracked file in the marketplace root does not leak into the materialized tag clone` passed. `git status --porcelain -- extensions/` printed nothing after it.

## Case map

| Case at 8826ad0 | Replaced by | Breaks | Commit |
| --- | --- | --- | --- |
| `:163` "TAGS-01/TAGS-03: a constrained path-source dependency installs from the marketplace tag that satisfies it" | S1 `:672`: the row and record version and the tag's `SKILL.md` text under `plugin-clones/`. Its stored `resolvedVersion` and `resolvedSha` stay guarded by `test/orchestrators/plugin/install-outcome.test.ts:3750` and, for `resolvedSha`, by the kept case; its marketplace git snapshot by the kept two-member case | B1, B2; B5 on the integration file | deleted in `45e96c6` |
| `:243` "CR-01: an untracked file in the marketplace root does not leak into the materialized tag clone" | kept, internal (ITSCOPE-01): the planted files never reach a component, and no command lists `plugin-clones/`; now `:142` | - | kept in `45e96c6` |
| `:393` "TAGS-01: two cascade members resolving against the SAME marketplace clone leave its git state untouched" | kept, internal (ITSCOPE-01, D-07-04): no command shows the marketplace clone's `.git/index` or `.git/HEAD`; now `:292` | B5 on the integration file | kept in `45e96c6` |
| `:524` "TAGS-02: a constraint no marketplace tag satisfies still installs both plugins, from the CURRENT checkout" | S2 `:704`: the `info` severity, the row with `dependency current copy` and version `2.0.0`, the record, and HEAD's `SKILL.md` text under `sources/tools/`; its marketplace git snapshot by the kept two-member case | B4, B3 | deleted in `45e96c6` |

## Checks

`node --version`: `v24.22.3`. Every npm script ran with `npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`, and every cucumber run, `check:static`, the ESLint warm-up, the audit, and every commit ran under `flock -w 3600 "$S/phase07-heavy.lock"`.

| Check | Tree | Exit |
| --- | --- | --- |
| Precondition: `nondac-sh` executable, `flock` on PATH, `SHA256SUMS` and its hash, `node_modules/.package-lock.json`, `git diff --quiet 8826ad0 HEAD -- ...` | `89d17f0` | 0 |
| Task 1 `cmp` of the five tracer copies | working tree on `89d17f0` | 0 |
| Task 1 green adapter (60/60), builtin (1/1), shared builder (27/27) | working tree on `89d17f0` | 0, 0, 0 |
| Task 1 B1-tracer and `check-red.mjs ... tracer-` (`RED-PROOFS OK`) | working tree on `89d17f0` | 0 |
| `npm run lint` warm-up | working tree on `89d17f0` | 0 |
| Task 1 `check:static` (`check-static-1.log`) | working tree on `89d17f0` | 0 |
| Commit hook (`check:commit` passed) | `71ce5ba` | 0 |
| Task 1 file set and clean tree (`verify-files.sh`) | `71ce5ba` | 0 |
| Task 2 `cmp` of the seven final copies | working tree on `71ce5ba` | 0 |
| Task 2 green adapter (61/61), builtin (1/1) | working tree on `71ce5ba` | 0, 0 |
| Task 2 `check:static` (`check-static-2.log`) | working tree on `71ce5ba` | 0 |
| Commit hook (`check:commit` passed) | `04081b8` | 0 |
| Task 2 file set and clean tree | `04081b8` | 0 |
| Task 3 breaks B1 to B5 (`run-breaks.sh`) | `04081b8` | each `restored=clean` |
| Task 3 `check-red.mjs` main tables (`RED-PROOFS OK`) and survivor check | `04081b8` | 0, 0 |
| Task 3 `cmp` of the trimmed file and `int-3.log` (2/2) | working tree on `04081b8` | 0, 0 |
| Task 3 B5 on the integration file (`verify-t3-b5int.sh`) | working tree on `04081b8` | 0 |
| Task 3 `check:static` (`check-static-3.log`) | working tree on `04081b8` | 0 |
| Commit hook (`check:commit` passed) | `45e96c6` | 0 |
| Task 3 `fallow audit` (`verify-t3-audit.sh`) | `45e96c6` | 0 |
| Final file set, no `extensions/` change, clean tree | `45e96c6` | 0 |

The wave's post-merge `npm run check` on the combined tree is the full verdict of this plan.

## Issues for the milestone

- `fallow audit --base 89d17f0` on `45e96c6`: `verdict=warn`, `dead_code_issues: 0`, `complexity_findings: 0`, `duplication_clone_groups: 0`, and one diff-risk finding: `weakened-tests` (`removed-tests`, `warn`) on `test/integration/path-source-tag-install.test.ts`, "The change removes test cases (test cases: 4 -> 2)". Left to the milestone, as the user decided on 2026-11-21: no `.fallowrc.json` or CI change.

## Deviations from Plan

None - plan executed exactly as written. No scenario needed strengthening, and no break run needed a rerun.

## Known Stubs

None.

## Parent lines

- `CHANGELOG.md`: None (the change is test-only).
- Key Decisions table: None.
- `.planning/BACKLOG.md`: append this entry at the end of the file:

  ## DIRGITTAG-01: no scenario installs a dependency from a tag of a local git marketplace

  Noted 2026-11-23 (integration-rescope, Phase 7, ITMIG-07). Claude Code also resolves a
  relative-path dependency against the `<plugin>--v<version>` tags of a marketplace added from a
  local folder that is a git repository, and the integration case that Phase 7 deleted used that
  form. The cucumber harness publishes a marketplace as `dir`, `file`, `url`, `github`, or `hosted`,
  but not as a dir source whose folder is a git work tree, so the tag scenarios of
  `features/plugin/install-dependencies.feature` use a github marketplace. The product path is the
  same: the tag probe and `materializeMarketplaceTagClone` read the record's `marketplaceRoot`. Only
  the tag clone's key differs, because a folder with no `origin` keys it by `marketplace-name:<name>`
  (`orchestrators/plugin/clone-cache.ts`). The work: a publication kind for a dir marketplace in a
  git work tree in `features/lib/published-marketplace.ts`, and a scenario that installs a
  constrained dependency from its tag.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: every file of `files_modified` (equal to its `$I/07-01/ref/` copy by `cmp`)
- FOUND: `71ce5ba`, `04081b8`, `45e96c6` are ancestors of HEAD
