---
phase: 10-github-source-kind-and-suite-close
plan: "01"
subsystem: testing
tags: [cucumber, github-source, git-host, rpc-environment, SRC-02, GHB-01]
status: complete

requires:
  - phase: 09-url-source-kind-and-https-git-stand-in
    provides: "The loopback https git host, GitPublication shared by both git kinds, and the request-log steps"
provides:
  - "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL in RpcGitEnvironment, set for every Pi of the cucumber run to the git host's https origin"
  - "HttpsGitHost.repositoryShorthand and GitRepositoryHost.repositoryShorthand (the owner/repo shorthand)"
  - "github arms in every publication operation of features/lib/published-marketplace.ts, shared with the url arms"
  - "features/marketplace/github-source.feature: the shorthand tracer scenario and the SRC-02 spelling Outline"
  - "IN-05 wording in unsupported-source.feature and the request-log rule of steps.md"
  - "The @github triage record: 39 scenarios, 38 passed, 1 known failure (info.feature:44, P-1)"
affects: [10-03, 10-04, 10-05, 10-07]

actuals:
  tokens: 5000
  tasks: 2
  commits: 3
plan_head_before: 82802ed10257104f35db08c5153640362c40d750
plan_head_after: 7a452c2076ebfbb940212844c5eaee61978578d5

tech-stack:
  added: []
  patterns:
    - "The github publication kind falls through to the url arm; only `source` differs (shorthand vs URL)"

key-files:
  created:
    - features/marketplace/github-source.feature
  modified:
    - tests/e2e/_rpc.ts
    - tests/architecture/hermetic-git-environment.test.ts
    - features/support/pi-process.ts
    - features/lib/https-git-host/server.ts
    - features/lib/published-marketplace.ts
    - features/lib/git-marketplace.ts
    - features/marketplace/unsupported-source.feature
    - .agents/skills/cucumber/rules/steps.md

key-decisions:
  - "The owner `acme` stays a literal of server.ts only; the fixture library reaches it through GitRepositoryHost.repositoryShorthand"
  - "The acme/tools shorthand is the tracer scenario; the SRC-02 Outline holds the five github.com URL spellings, with the plain URL as D-01's plain form"
  - "The @github triage matched the research measurement exactly; no row was edited and no product defect was found beyond P-1"

patterns-established:
  - "A github-only feature file has untagged scenarios with the literal step `is published as a github source` and no `source kind` column"

requirements-completed: [SRC-02]

duration: 8min
completed: 2026-10-21
---

# Phase 10 Plan 01: GitHub source kind end to end Summary

**Every Pi of the cucumber run now clones GitHub sources from the loopback https git host through `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`. The github publication arms reuse the url arms, a new feature pins the shorthand and five github.com URL spellings to one request log and one info identity, and the 39 `@github` rows were triaged with only the known P-1 failure.**

## Performance

- **Duration:** about 8 min
- **Started:** 2026-10-21T13:47:26Z
- **Completed:** 2026-10-21T13:55Z
- **Tasks:** 2 (one tracer, one auto)
- **Files modified:** 9 (1 created, 8 modified)

## Accomplishments

- GHB-01 / D-MF-01: `RpcGitEnvironment` carries `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`, and `rpcChildEnvironment` copies it by name. `features/support/pi-process.ts` sets it to `https://${gitHost.address}`. The `Before()` restart reuses `run.piEnvironment`, so a restarted Pi gets it too.
- DRV-03: the architecture case plants an operator value (`https://operator.example/git`) of the override. With a git environment, the whole-object comparison expects the run's value. Without one, the four-key allowlist proves that the operator's value is not inherited.
- The github kind publishes through the url arms of `changePublication`, `requireFreeRoot`, `publishMarketplaceIn`, `removePublishedSource`, and `publishUnreadableSkillFile`. Its source is `gitHost.repositoryShorthand(directory)`. `noStandIn` is deleted.
- The tracer scenario `Adding a github marketplace clones it from the git host` adds `acme/tools`. The SRC-02 Outline `Each spelling of a GitHub URL clones and shows the same repository` runs five spellings. Each row gives the same two request paths, the typed source stored verbatim, and the info identity `github / acme / tools`.
- D-04 / IN-05: the refused-source description now says that the no-request check can fail only for the forms that would reach the host. The steps.md rule allows log steps in that feature.

## Task Commits

1. **Task 1: Add one github marketplace through the base override (tracer)**: `68fd3694` (test)
2. **Task 2a: Pin the GitHub URL spellings (SRC-02, D-01)**: `eff93cab` (test)
3. **Task 2b: IN-05 wording (D-04)**: `7a452c20` (docs). Plan 10-07 cites this commit in the Phase 9 ledger.

**Plan metadata:** the `docs(planning)` commit that follows this SUMMARY.

## Verification Evidence

Tools: Node `v26.11.1`, git `2.55.0`, OpenSSL `4.0.3 29 Sep 2026`.

| Command | Exit | Result |
|---------|------|--------|
| `npm run test:cucumber -- features/marketplace/github-source.feature --parallel 1` (after Task 1) | 0 | `1 scenario (1 passed)` |
| `node --test tests/architecture/hermetic-git-environment.test.ts` | 0 | 3 tests, `ℹ fail 0` |
| `npm run typecheck` | 0 | no `error TS` line |
| `npm run check:features` (after each task) | 0 | no "Feature gate failed" |
| `npm run test:cucumber` (after Task 1) | 0 | `374 scenarios (374 passed)` |
| `npm run test:cucumber -- features/marketplace/github-source.feature features/marketplace/unsupported-source.feature --parallel 1` | 0 | `10 scenarios (10 passed)` |
| `npm run test:cucumber` (after Task 2) | 0 | `379 scenarios (379 passed)` |
| `SKIP=npm-check pre-commit run --files <Task 2 files>` | 0 | every hook Passed (mdformat, markdownlint-cli2, smartquotes, dashes) |
| Commit hook `npm run check:commit` on all three commits | 0 | Passed, no `--no-verify` |

Acceptance greps: `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` appears in `_rpc.ts` (2), `pi-process.ts` (1), and the architecture test (3). There is no `...git`/`...process` spread in `_rpc.ts`. `noStandIn` count is 0. `repositoryShorthand` appears in `published-marketplace.ts` (2) and `server.ts` (1). There is no `acme/${` in `published-marketplace.ts`. The Feature title count is 1. The five spelling rows count is 5. `source owner` count is 1. The request-log step count is 2. `every form that can name a host` count is 0. `unsupported-source.feature` appears in steps.md once.

## @github Triage (Phase 9 D-13)

Command, run from the repository root with a scratch config passed by a relative path:

```bash
cfg="<scratchpad>/10-01-cucumber-github.json" && printf '%s' '{"default":{"import":["features/support/**/*.ts","features/step_definitions/**/*.steps.ts"],"format":["summary"],"order":"random","tags":"@github","parallel":4}}' > "$cfg" && npx cucumber-js -c "$(realpath --relative-to=. "$cfg")"
```

- Exit status: 1 (expected)
- Summary line: `39 scenarios (38 passed, 1 failed)`, `382 steps (379 passed, 2 skipped, 1 failed)`
- Failing scenario: `Info shows the source identity and description # features/marketplace/info.feature:44` (the `@github` row)
- Failing step: `Given the user has run "/claude:plugin marketplace add acme/tools#main --scope project"`, with `'error' !== 'info'`. The payload shows `reasons: ["source missing"]` and the cause `fetched https://127.0.0.1:<port>/acme/tools#main.git` / `HTTP Error: 404 Not Found`. The shorthand parser reads `tools#main` as the repository name (P-1, fixed by plan 10-03). The request went to the loopback host, not to github.com, which confirms the override.
- Classification: this is the known P-1 failure. No other row failed, so no row was edited, skipped, or loosened, and no other classification was needed.

`cucumber.json` keeps `"tags": "not @github"`. The default run gains only the six untagged github-source scenarios (373 + 1 + 5 = 379).

## Flagged Assumptions (carried from the plan)

- `SRC-02 / unclassified / unresolved` (spec-less probe): the spelling Outline is the manual-review target. D-01's "plain form" is read as `https://github.com/acme/tools`. The `acme/tools` shorthand is the tracer scenario, not a sixth row.
- The `www.` and case rows prove that the parse folds the host before the override rewrites it (`domain/source.ts` `gitHubUrlPath`). A spelling the parser refused would fail its add, not its log.
- Assumption-delta decision: no change. The github kind reuses `GitPublication` and the same `HttpsGitHost`. The shorthand is a second spelling of the same repository.

## Files Created/Modified

- `tests/e2e/_rpc.ts`: the override member in `RpcGitEnvironment`, copied by name in `rpcChildEnvironment`
- `tests/architecture/hermetic-git-environment.test.ts`: plants an operator override, `INHERITED_VARIABLES` / `inheritVariables`, and expects the run's value
- `features/support/pi-process.ts`: `piEnvironment` sets the override to the git host's https origin
- `features/lib/https-git-host/server.ts`: `repositoryShorthand(directory)`
- `features/lib/published-marketplace.ts`: github arms share the url arms, the interface member, and the header and JSDoc rewritten
- `features/lib/git-marketplace.ts`: the header no longer says that the github kind "will share" the git publication
- `features/marketplace/github-source.feature`: new (tracer scenario plus the SRC-02 Outline)
- `features/marketplace/unsupported-source.feature`: IN-05 description
- `.agents/skills/cucumber/rules/steps.md`: the request-log bullet allows the refused-source feature

## Decisions Made

- The owner literal stays in `server.ts`. `published-marketplace.ts` reaches it through `GitRepositoryHost.repositoryShorthand`.
- The IN-05 description stays at three lines. It names the http and ssh forms on the host's port and the GitHub forms through the override as the rows that the host check covers. The scp-style and home-relative rows pin only the refusal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Stale comment] Updated the header of `features/lib/git-marketplace.ts`**
- **Found during:** Task 1
- **Issue:** The header said "the github kind will share it". This was false once the github arms landed. 10-RESEARCH.md Pattern 2 names this header, but the plan's file list leaves it out.
- **Fix:** Changed it to "The url and github kinds both publish this way."
- **Files modified:** `features/lib/git-marketplace.ts`
- **Commit:** `68fd3694`

Other than this, the plan was executed as written.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

- Plans 10-03 (P-1 shorthand `#ref` and the ref rows), 10-04 (401 rows), and 10-05 (switch-on) can build on GitHub sources that reach the stand-in.
- The only `@github` row still failing is `features/marketplace/info.feature:44`.

## Self-Check: PASSED

- FOUND: features/marketplace/github-source.feature, tests/e2e/_rpc.ts, features/lib/published-marketplace.ts, features/lib/https-git-host/server.ts
- FOUND: 68fd3694, eff93cab, 7a452c20
