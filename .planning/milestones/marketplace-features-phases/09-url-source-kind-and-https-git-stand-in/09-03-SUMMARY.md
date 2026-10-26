---
phase: 09-url-source-kind-and-https-git-stand-in
plan: "03"
subsystem: testing
tags: [cucumber, git-http-backend, hermetic-git, url-source]

requires:
  - phase: 09-url-source-kind-and-https-git-stand-in
    provides: plan 09-01's git host, PublishedMarketplace path|git union, publishGitRepository, runGit, and the url arms of requireFreeRoot / publishMarketplaceIn
provides:
  - url arms for every publication operation in features/lib/published-marketplace.ts, through one private dispatch (changePublication) that writes the work tree and then commits and pushes
  - pushGitRepository(workTree, home) in features/lib/git-marketplace.ts
  - writePublishedPluginFile(published, plugin, file, text) in place of publishedPluginFile
  - the corrected info @url row (#main) and the four-row local-only unreadable-skill Outline
  - the SRC-01 scenario "A url source is cloned at exactly the url typed"
affects: [09-04, 09-07, 09-08, phase-10-github-source]

actuals:
  tokens: 2500
  tasks: 3
  commits: 3

plan_head_before: 81b9db8ffd1e611cb3b0f1a1d9157b29984de6b6
plan_head_after: 8330990b4e61e12877c3704d6ef85a1d748f399b

tech-stack:
  added: []
  patterns:
    - "One private dispatch (changePublication) carries the url push, so each publication operation is a single call with its dir writer and no repeated kind switch"
    - "A url publication change is write-then-commit-then-push with --allow-empty, so even a byte-identical republish reaches the git host as a new commit"

key-files:
  created: []
  modified:
    - features/lib/published-marketplace.ts
    - features/lib/git-marketplace.ts
    - features/lib/mcp-configuration.ts
    - features/marketplace/info.feature
    - features/marketplace/update.feature
    - features/marketplace/url-source.feature

key-decisions:
  - "removePublishedSource's url arm deletes only published.bareRepository (recursive), so a later clone or fetch gets the git host's natural 404"
  - "publishUnreadableSkillFile's url arm throws 'a git repository cannot hold a file nobody may read'; the github arm keeps noStandIn"
  - "The @url triage runs with a cwd-relative path to the scratch config: cucumber-js 13.3.0 joins an absolute -c path to the cwd and fails to load it"

patterns-established:
  - "A new url fixture operation goes through changePublication with the dir writer, never a new switch"

requirements-completed: [HOST-01, SRC-01]

coverage:
  - id: D1
    description: "Every publication operation has a url arm: republish, manifest rewrite, invalid manifest, description, dependency allowance, and a plugin file write run the dir writer on the work tree and push a new commit; removing the source deletes only the bare repository; only github arms throw noStandIn"
    requirement: HOST-01
    verification:
      - kind: e2e
        ref: "npm run test:cucumber (317 scenarios, 317 passed)"
        status: pass
      - kind: e2e
        ref: "npx cucumber-js -c <scratch @url config> (31 scenarios, 31 passed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The info @url row types https://{git host}/acme/tools.git#main and expects source ref main; the unreadable-skill autoupdate Outline runs dir and file in both scopes with no @url or @github block"
    requirement: HOST-01
    verification:
      - kind: e2e
        ref: "npm run test:cucumber -- features/marketplace/update.feature features/marketplace/info.feature --parallel 1 (71 scenarios, 71 passed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A url source added without .git is recorded verbatim in the project base config, and the git host log is exactly GET /acme/tools/info/refs?service=git-upload-pack 200 then POST /acme/tools/git-upload-pack 200"
    requirement: SRC-01
    verification:
      - kind: e2e
        ref: "features/marketplace/url-source.feature#A url source is cloned at exactly the url typed"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-10-21
status: complete
---

# Phase 9 Plan 03: Url arms, @url triage, and the verbatim-url scenario Summary

**Every publication operation now writes the url work tree and pushes a new commit to the git host through one private dispatch, the scratch `@url` run passes 31 of 31 after the two predicted wrong rows were corrected, and a new scenario pins that Pi clones a url source at exactly the path typed.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-10-21T03:30:08Z
- **Completed:** 2026-10-21T03:40:59Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- `features/lib/git-marketplace.ts`: `pushGitRepository(workTree, home)` runs `add -A`, `commit -q --allow-empty -m publish`, and `push -q origin main` through `runGit`.
- `features/lib/published-marketplace.ts`: the private `changePublication(published, write)` awaits the write for dir and file, writes and then pushes for url, and throws `noStandIn` for github. `republishMarketplace`, `rewritePublishedManifest`, `invalidateManifest`, `allowDependenciesOn`, and `describeMarketplace` each call it with today's dir writer. `removePublishedSource` gets a url arm that removes only `published.bareRepository`. `writePublishedPluginFile` replaces `publishedPluginFile` and writes with `flag: "wx"` through `ownedTarget` and `changePublication`. `publishUnreadableSkillFile` gets a url arm that throws. `throw noStandIn` count fell from 10 to 5, all github arms.
- `features/lib/mcp-configuration.ts`: `declarePublishedMcpServer` writes the `.mcp.json` through `writePublishedPluginFile`, so a url publication commits it.
- `features/marketplace/info.feature` (D-17): the `@url` row types `https://{git host}/acme/tools.git#main` and expects `source ref` `main`.
- `features/marketplace/update.feature` (D-18): `Autoupdate continues in installed order after a plugin fails` takes `<scope>` everywhere it named `project` and has one untagged Examples block over `source kind` and `scope` (`dir project`, `file project`, `dir user`, `file user`). The `@url` and `@github` blocks are gone. The file now holds 61 scenarios (was 59).
- `features/marketplace/url-source.feature` (SRC-01): `A url source is cloned at exactly the url typed`.

## Task Commits

1. **Task 1: Give every publication operation a url arm and triage the verb-phase @url rows** - `0769ec13` (test)
2. **Task 2: Correct the info ref row and make the unreadable-skill Outline local-only** - `3e433143` (test)
3. **Task 3: Pin that a url source is cloned at exactly the url typed** - `8330990b` (test)

**Plan metadata:** the `docs(planning)` commit that adds this SUMMARY.

## Files Created/Modified

- `features/lib/published-marketplace.ts` - url arms through `changePublication`, `writePublishedPluginFile`
- `features/lib/git-marketplace.ts` - `pushGitRepository`
- `features/lib/mcp-configuration.ts` - uses `writePublishedPluginFile`
- `features/marketplace/info.feature` - `@url` row at `#main`
- `features/marketplace/update.feature` - local-only unreadable-skill Outline over two scopes
- `features/marketplace/url-source.feature` - the SRC-01 scenario

## Triage run (Task 1, D-13 / D-14)

Command: the plan's scratch config `{"default":{"import":["features/support/**/*.ts","features/step_definitions/**/*.steps.ts"],"format":["progress"],"order":"random","tags":"@url","parallel":4}}`, written to the session scratchpad and run as `npx cucumber-js -c <cwd-relative path to it>` (see deviation 1). Seed 311971.

Summary line: `32 scenarios (30 passed, 2 failed)`, `345 steps (333 passed, 10 skipped, 2 failed)`, exit 1.

Failing scenarios, exactly the two `<interfaces>` predicted:

1. `Info shows the source identity and description` (`features/marketplace/info.feature:39`). Failing step: `Given the user has run "/claude:plugin marketplace add https://{git host}/acme/tools.git#stable --scope project"`. The command emitted `{"kind":"internal-error","summary":"Command failed unexpectedly.","cause":{"causeChain":["Could not find stable."]}}` instead of one cascade. Classification: wrong row (the bare repository has no `stable` ref), corrected in Task 2 per D-17. The missing-ref classification is D-16, which plan 09-06 owns.
2. `Autoupdate continues in installed order after a plugin fails` (`features/marketplace/update.feature:885`). Failing step: `Given the published plugin "zeta" of the marketplace "tools" has an unreadable skill file`, which threw `Error: a git repository cannot hold a file nobody may read`. Classification: wrong row for a git kind, corrected in Task 2 per D-18.

No other row failed, so no further D-13 classification was needed. After Task 2 the same config ran `31 scenarios (31 passed)` (seed varies per run; exit 0), and again after Task 3 (seed 61007, `31 scenarios (31 passed)`, `326 steps (326 passed)`, exit 0). The new SRC-01 scenario is untagged, so it does not count in the `@url` run.

## Verification evidence

Environment: Node v26.11.1, git version 2.55.0, cucumber-js 13.3.0. `cucumber.json` still reads `"tags": "not @url and not @github"` (D-14).

| Stage | Command | Exit | Result |
| --- | --- | --- | --- |
| Task 1 | `npm run typecheck` | 0 | clean |
| Task 1 | `npm run test:cucumber` | 0 | `314 scenarios (314 passed)` |
| Task 1 | `npm run check:features` | 0 | no "Feature gate failed" |
| Task 1 | scratch `@url` config | 1 | `32 scenarios (30 passed, 2 failed)`, the two predicted rows |
| Task 1 | `SKIP=npm-check pre-commit run --files` (3 files), then commit hook | 0, 0 | `0769ec13` |
| Task 2 | `npm run test:cucumber -- features/marketplace/update.feature features/marketplace/info.feature --parallel 1` | 0 | `71 scenarios (71 passed)` |
| Task 2 | scratch `@url` config | 0 | `31 scenarios (31 passed)` |
| Task 2 | `npm run check:features` | 0 | no "Feature gate failed" |
| Task 2 | `npx cucumber-js --dry-run features/marketplace/update.feature` | 0 | `61 scenarios` |
| Task 2 | commit hook | 0 on the fourth try | `3e433143` (see Issues) |
| Task 3 | `npm run test:cucumber -- features/marketplace/url-source.feature --parallel 1` | 0 | `2 scenarios (2 passed)` |
| Task 3 | `npm run check:features` | 0 | no "Feature gate failed" |
| Task 3 | commit hook | 0 | `8330990b` |
| Final | `npm run test:cucumber` | 0 | `317 scenarios (317 passed)`, `2889 steps (2889 passed)` |
| Final | scratch `@url` config | 0 | `31 scenarios (31 passed)` |
| Final | `npm run check:features` | 0 | clean |

Acceptance greps: `rg -c 'throw noStandIn' features/lib/published-marketplace.ts` = 5 (requireFreeRoot, publishMarketplaceIn, changePublication, removePublishedSource, publishUnreadableSkillFile, all github). `rg -n 'publishedPluginFile' features` prints nothing. `writePublishedPluginFile` appears on two lines of `mcp-configuration.ts`. `export async function pushGitRepository` appears once. `acme/tools.git#stable` in `info.feature` = 0, `acme/tools.git#main` = 1, `acme/tools#stable` = 1 (the Phase 10 row). `@url|@github` tags inside the unreadable-skill Outline = 0. `/acme/tools/info/refs?service=git-upload-pack` in `url-source.feature` = 1. `git status --short` on each task's paths printed nothing after each commit.

The combined-tree `npm run check` is the orchestrator's post-wave gate; this executor ran the hook's `check:commit` on the Task 1 commit (a build input) and the cucumber runs above, not the full gate.

## Decisions Made

- One private `changePublication` carries the url push, so no publication function repeats the kind switch (fallow complexity and duplication stay clean).
- `writePublishedPluginFile` resolves the target through `ownedTarget` before dispatching, so the containment check runs for every kind (T-09-08).
- The url arm of `removePublishedSource` does not go through `ownedTarget`, because the bare repository lives under the host root, not the work tree; it removes only the path the host returned when the marketplace was published (T-09-08).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The plan's triage command fails to load its config**
- **Found during:** Task 1, step 5
- **Issue:** The plan's command writes the config under `$(mktemp -d)` and passes that absolute path to `-c`. cucumber-js 13.3.0 joins the `-c` path to the cwd, so it looks for `<repo>/tmp/...` and exits 1 with `Configuration file ... failed to load/parse` before running any scenario. Reproduced with both a scratchpad path and a `mktemp -d` path.
- **Fix:** Kept the config byte-for-byte and passed it as a cwd-relative path (`realpath --relative-to=. <scratch config>`). The config stays outside the repository.
- **Files modified:** none (command only)
- **Verification:** the run loaded and printed `32 scenarios (30 passed, 2 failed)`, then `31 scenarios (31 passed)` after Task 2.
- **Committed in:** n/a

---

**Total deviations:** 1 auto-fixed (1 blocking, in the plan's verification command)
**Impact on plan:** None on the code. Plan 09-07 uses the same `mktemp -d` command and will meet the same load failure; pass the config by a cwd-relative path there too.

## Issues Encountered

- The Task 2 commit hook failed three times on gitlint T1 (title over 72 characters). Each failure made no commit. The fourth title, 72 characters, passed.
- `gsd-tools check evaluation-scope --plan 09-03 --commits-only` cannot match these commits, because the repository's commit policy keeps plan IDs out of commit subjects. The commits are `0769ec13`, `3e433143`, and `8330990b` on `features/cucumber-behavioral-tests`.

## Flagged assumptions (carried from the plan)

- `SRC-01 / unclassified / unresolved`: the SRC-01 scenario is the manual-review target. It proves the verbatim URL through the logged path. `git http-backend` serves `/acme/tools` from `acme/tools.git`, so the suffix-less request succeeds (200) rather than 404s.
- **Phase 10 hand-off:** the `@github` row of `Info shows the source identity and description` still types `acme/tools#stable` (left untouched here). Phase 10 will meet the same missing ref; after plan 09-06 it classifies as `source missing`. Correct it to `#main` as D-17 did for url, or publish a `stable` ref.
- 09-RESEARCH.md A5 and A6 are settled by D-17 and D-18.

## Known Stubs

None. The github arms still throw `noStandIn` by design until Phase 10, and no default-profile or `@url` scenario reaches them.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Every verb-phase `@url` row passes under the scratch config (31 of 31), so plan 09-08 can remove `@url` from the exclusion once the url-only plans land.
- Plan 09-07: use a cwd-relative `-c` path for the scratch config (deviation 1).
- The orchestrator's post-wave `npm run check` on the combined tree is still owed (AGENTS.md, Build verification).

## Self-Check: PASSED

- FOUND: features/lib/published-marketplace.ts, features/lib/git-marketplace.ts, features/lib/mcp-configuration.ts, features/marketplace/url-source.feature
- FOUND: 0769ec13, 3e433143, and 8330990b are ancestors of HEAD
- All `<acceptance_criteria>` and the `<verify>` commands re-ran green on the committed tree

---
*Phase: 09-url-source-kind-and-https-git-stand-in*
*Completed: 2026-10-21*
