---
phase: 01-suite-foundation
plan: 06
subsystem: testing
tags: [cucumber, git-host, failure-injection, bootstrap, official-marketplace, behavioral-tests]

requires:
  - phase: 01-suite-foundation
    provides: "01-01: git-host.steps.ts module; 01-03: `the user has run <command>, which failed` and failed-add.feature; 01-05: startSessionInAnotherProject (documented here)"
provides:
  - "HttpsGitHost serves and arms repositories under any owner (default `acme`), keyed `owner/directory`; `disarm(directory, owner?)` returns whether the repository was armed"
  - "GitRepositoryHost mirrors the optional owner and exposes `defaultOwner`; GitPublication records `owner`"
  - "Parameter type `{git repository}` (`marketplace \"<name>\"`) in features/support/git-repository.ts"
  - "The three arming steps over `{git repository}`, each registering a release that disarms; new step `the git host serves the {git repository} again`"
  - "publishOfficialMarketplace(sites, name): `anthropics/claude-plugins-official` on the git host as a github publication"
  - "Step `the marketplace {string} is published as the official marketplace`"
  - "`the user has run {string}` accepts any number of payloads, each info"
  - "Seeds: failed-add.feature retry after a lifted 404; plugin/bootstrap.feature second bootstrap"
affects: [phase-4, phase-12, phase-13-import, phase-14-bootstrap, phase-15-marketplace-add, 01-10]

actuals:
  tokens: 8395
  tasks: 3
  commits: 3

plan_head_before: 20d14fd454f306de4e522839431459a1464dad52
plan_head_after: 64d65b61bfaf1ffc8d0e91ba8a6b0207a0a95be1

tech-stack:
  added: []
  patterns:
    - "A step that arms the git host registers a release that disarms the same owner and directory; the release ignores whether the arm was already lifted"
    - "A step names a git host repository through `{git repository}`, never by a raw repository name"
    - "The two setup steps share one private `runSetup(world, command, severity)` helper in command.steps.ts"

key-files:
  created:
    - features/support/git-repository.ts
    - features/plugin/bootstrap.feature
  modified:
    - features/lib/https-git-host/server.ts
    - features/lib/published-marketplace.ts
    - features/step_definitions/git-host.steps.ts
    - features/step_definitions/marketplace/publishing.steps.ts
    - features/step_definitions/command.steps.ts
    - features/marketplace/failed-add.feature
    - .agents/skills/cucumber/rules/world-and-stand-ins.md
    - .agents/skills/cucumber/rules/steps.md

key-decisions:
  - "The host exposes `defaultOwner` (and GitRepositoryHost requires it), so publishMarketplaceIn records the owner from the host instead of hard-coding `acme` in the publishing library"
  - "publishOfficialMarketplace returns GitPublication, not the PublishedMarketplace union, so its step can assert the bare repository exists without narrowing"
  - "The official identity (owner `anthropics`, repository and name `claude-plugins-official`) is stated as fixture constants, not imported from the product's BOOTSTRAP_SOURCE"
  - "`the user has run` and `..., which failed` share a private runSetup helper; the fallow dupes gate rejected the two copies"

patterns-established:
  - "Lifted arm: `Given the git host answers 404 for the marketplace \"tools\"` ... `Given the git host serves the marketplace \"tools\" again`"
  - "Official marketplace: `Given the marketplace \"claude-plugins-official\" is published as the official marketplace`"

requirements-completed: [FND-01, FND-02]

coverage:
  - id: D1
    description: "An armed repository can stop failing: a marketplace add that failed on a 404 succeeds once the git host serves the repository again"
    requirement: FND-01
    verification:
      - kind: e2e
        ref: "features/marketplace/failed-add.feature#Adding a marketplace succeeds once the git host serves it again"
        status: pass
    human_judgment: false
  - id: D2
    description: "The re-registered arming steps keep every existing git marketplace scenario green"
    requirement: FND-02
    verification:
      - kind: e2e
        ref: "npx cucumber-js features/marketplace/{failed-add,git-source,github-source,url-source,url-source-update,unsupported-source}.feature (62 scenarios)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The official marketplace is served by the git host through the GitHub base override; a second bootstrap is skipped as already autoupdate and makes no request"
    requirement: FND-01
    verification:
      - kind: e2e
        ref: "features/plugin/bootstrap.feature#Bootstrapping a second time leaves the official marketplace as it is"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every new step is used, the feature gate passes, and the whole suite passes with the generalized setup step"
    requirement: FND-02
    verification:
      - kind: other
        ref: "npm run check:features"
        status: pass
      - kind: other
        ref: "npm run test:cucumber (445 scenarios)"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-10-23
status: complete
---

# Phase 1 Plan 06: Owner-aware git host, lifted arms, and the official marketplace Summary

**The loopback git host now serves and arms repositories under any owner and can lift an arm mid-scenario, every arm is released with its scenario, and `anthropics/claude-plugins-official` is published on it, proven by a marketplace add retried after a 404 and a second bootstrap.**

## Performance

- **Duration:** about 10 min (start 2026-10-23T03:29:51Z, end 2026-10-23T03:39:47Z)
- **Tasks:** 3
- **Files modified:** 10 (2 created, 8 modified)

## Accomplishments

- `features/lib/https-git-host/server.ts`: `DEFAULT_OWNER = "acme"` and a public `defaultOwner`. `repositoryPath`, `repositoryUrl`, `repositoryShorthand`, and `arm` take an optional trailing owner. Arms are keyed `owner/directory`, so `armFor` matches `/<owner>/<directory>/` and `/<owner>/<directory>.git/`. The two `arm` guards name the owner. The new `disarm(directory, owner?)` returns whether there was an arm. `snapshot().arms` lists `owner/directory` keys. The fileoverview and the `GitHostArm` doc say an arm lasts until it is disarmed or the host is reset (HOST-03).
- `features/lib/published-marketplace.ts`: `GitRepositoryHost` mirrors the optional owner and adds `defaultOwner`. `GitPublication.owner` is the host's default owner for every existing fixture. `publishOfficialMarketplace` publishes the official marketplace.
- `features/support/git-repository.ts` (new): the `git repository` parameter type.
- `features/step_definitions/git-host.steps.ts`: a private `servedRepository` resolver and an `armRepository` helper that arms and registers a disarming release. The three arming steps are re-registered over `{git repository}`, and the new disarm step is added.
- `features/step_definitions/command.steps.ts`: `the user has run {string}` accepts any number of payloads, each info. Both setup steps share `runSetup`.
- Two seeds pass, and the cucumber skill describes owners, lifted arms, the official marketplace, the other-project Pi, and where request-log steps belong.

## Task Commits

1. **Task 1: An armed repository can stop failing, seeded by a marketplace add retried after a 404** - `078d6fe2` (test), `test(features): let the git host stop failing a repository`. Hook: `npm run check:commit` Passed, gitlint Passed, on the first attempt. Tracer gate: after the commit, the Task 1 verify passed again (62 scenarios, 558 steps; `check:features` exit 0) before Task 2 started.
2. **Task 2: Serve the official marketplace and accept multi-payload setup, seeded by a second bootstrap** - `3449e0a8` (test), `test(features): serve the official marketplace from the git host`. Hook: the first attempt failed in `npm run check:commit` on fallow's duplication gate (`dup:e213abb5`, `command.steps.ts:38-41` and `:49-53`: the two setup step bodies). I extracted `runSetup`. `tsc`, `fallow dupes`, and the two seeds passed, and the second attempt passed (`npm run check:commit` Passed, gitlint Passed). The first `SKIP=npm-check pre-commit run` also reformatted one prettier line in `publishing.steps.ts`, which I restaged.
3. **Task 3: Document owners, lifted arms, the official marketplace, and where request-log steps belong** - `64d65b61` (docs), `docs(cucumber): describe git host owners and lifted arms`. Hook: mdformat, markdownlint-cli2, and gitlint Passed. `npm run check:commit` was skipped because no build input was staged.

## Final Text of New and Changed Steps

- `Given the git host answers {int} for the {git repository}` (re-registered)
- `Given the git host drops the connection for the {git repository}` (re-registered)
- `Given the git host requires the user {string} with the password {string} for the {git repository}` (re-registered)
- `Given the git host serves the {git repository} again` (new)
- `Given the marketplace {string} is published as the official marketplace` (new, in `features/step_definitions/marketplace/publishing.steps.ts`)
- `Given the user has run {string}` (changed: any number of payloads, each info)

Parameter type: `git repository`, regexp `marketplace "([^"]*)"`, transformed to `{ subject: "marketplace", name }`. Every existing feature line (`... for the marketplace "tools"`) matches it unchanged.

New exports: `HttpsGitHost.disarm`, `HttpsGitHost.defaultOwner`, `GitPublication.owner`, `publishOfficialMarketplace`, and `GitRepositoryReference` (support module type). Each has a user in this plan.

## Seed Results

- **failed-add.feature, "Adding a marketplace succeeds once the git host serves it again":** `tools` is published as a url source and armed 404. The first add fails (every payload error). The disarm step asserts the arm existed. The retried add reports `cascade` / `info` / needs reload `false`, one row `tools` / `project` / `added`, and the project config declares `tools` with `https://{git host}/acme/tools.git`.
- **plugin/bootstrap.feature, "Bootstrapping a second time leaves the official marketplace as it is":** the first bootstrap is setup. I measured it with a temporary scenario, later removed: two payloads, both `cascade` / `info` / `false`. The second bootstrap reports `cascade` / `info` / needs reload `false`, one marketplace row `claude-plugins-official` / `user` / `skipped` / reasons `already autoupdate`, and the git host receives no request and no connection.

## Planted Checks

Each check was made by hand, run, and reverted from a backup. `cmp` confirmed each restore.

1. **`disarm` keeps the arm (Task 1).** I changed `this.arms.delete(...)` to `this.arms.has(...)` and ran `npx cucumber-js features/marketplace/failed-add.feature` (exit 1). The retry still got the 404:

   ```
   1) Adding a marketplace succeeds once the git host serves it again # features/marketplace/failed-add.feature:25
        Then the result has these fields: # features/step_definitions/command.steps.ts:61
              'severity',
        +     'error'
        -     'info'
        +   [
        +     'summary',
        +     'A marketplace operation has failed.'
        +   ]
   2 scenarios (1 passed, 1 failed)
   20 steps (17 passed, 2 skipped, 1 failed)
   ```

2. **The official marketplace is published under owner `acme` (Task 2).** I set `OFFICIAL_OWNER = "acme"` and ran `npx cucumber-js features/plugin/bootstrap.feature` (exit 1). The setup step failed:

   ```
   1) Bootstrapping a second time leaves the official marketplace as it is # features/plugin/bootstrap.feature:8
        Given the user has run "/claude:plugin bootstrap" # features/step_definitions/command.steps.ts:38
          AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
          + [
          +   {
          +     kind: 'cascade',
          +     marketplaces: [
          +       { name: 'claude-plugins-official', plugins: [], scope: 'user', status: 'failed' }
          +     ],
          +     needsReload: false,
          +     severity: 'error',
          +     summary: 'A marketplace operation has failed.'
          +   }
          + ]
          - []
   ```

## Files Created/Modified

- `features/lib/https-git-host/server.ts` - owner-aware paths, URLs, shorthands, and arms; `disarm`; `defaultOwner`
- `features/lib/published-marketplace.ts` - optional owner on `GitRepositoryHost`; `GitPublication.owner`; `publishOfficialMarketplace`
- `features/support/git-repository.ts` - the `git repository` parameter type
- `features/step_definitions/git-host.steps.ts` - arming steps over `{git repository}`, disarming releases, the disarm step
- `features/step_definitions/marketplace/publishing.steps.ts` - the official marketplace step
- `features/step_definitions/command.steps.ts` - multi-payload setup; shared `runSetup`
- `features/marketplace/failed-add.feature` - retry-after-404 seed (Phase 15 owns the file)
- `features/plugin/bootstrap.feature` - `Feature: Plugin bootstrap` and its seed (Phase 14 owns it after this phase)
- `.agents/skills/cucumber/rules/world-and-stand-ins.md`, `.agents/skills/cucumber/rules/steps.md` - skill text

## Decisions Made

- The publishing library reads the owner from the host's `defaultOwner`, so `acme` lives only in the host.
- The official marketplace step registers its work-tree release before publishing, like the source-kind step. The release removes only `<marketplacesRoot>/claude-plugins-official`, under the sandbox HOME. The step has already confirmed that no marketplace of that name is published in the scenario. The host reset removes the bare repository.
- `the user has run {string}` no longer requires the payload to be a `cascade`. It requires only that every payload is info, as the plan asks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The duplication gate rejected the generalized setup step**
- **Found during:** Task 2 (the commit hook)
- **Issue:** After the change, `the user has run {string}` and `..., which failed` had the same body except for the severity. `fallow dupes` failed the hook (`dup:e213abb5`).
- **Fix:** One private helper, `runSetup(world, command, severity)`, serves both steps.
- **Files modified:** features/step_definitions/command.steps.ts
- **Verification:** `tsc --noEmit` exit 0, `fallow dupes` exit 0, both seeds pass, the commit hook passed, and the final `npm run test:cucumber` passed.
- **Committed in:** 3449e0a8

**2. [Rule 2 - Supporting] `defaultOwner` on the host and its interface**
- **Found during:** Task 1
- **Issue:** `publishMarketplaceIn` must record the owner of each git publication, but the interface did not expose the host's default owner.
- **Fix:** `HttpsGitHost.defaultOwner` and `GitRepositoryHost.defaultOwner`.
- **Files modified:** features/lib/https-git-host/server.ts, features/lib/published-marketplace.ts
- **Committed in:** 078d6fe2

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 supporting). **Impact:** both stay inside files the plan names. No scope creep.

## Bug Candidates

I recorded this as observed and did not fix it. It blocks no seed of this plan.

1. **A failed bootstrap row carries no reason and no cause.** Planted check 2 made the git host answer 404 for the official repository. The bootstrap row was only `{ name, plugins: [], scope: 'user', status: 'failed' }`, with no `reasons` and no cause chain. A failed git plugin install on a 404 reports the cause `HTTP Error: 404 Not Found` (RESEARCH Pattern 3). Owner: Phase 14 (bootstrap), with a Claude Code parity check.

## Issues Encountered

None beyond the duplication gate above.

## Plan-level Verification

- Task 1 verify: `npx cucumber-js` over failed-add, git-source, github-source, url-source, url-source-update, and unsupported-source passed 62 scenarios and 558 steps. `npm run check:features` exited 0. The host unit tests (`test/architecture/https-git-host-{server,cgi}.test.ts`) passed 18 of 18, so the existing `arm("tools", ...)` consumer is compatible.
- Task 2 verify: the bootstrap feature passed (1 scenario, 8 steps). `npm run check:features` exited 0.
- Task 3 verify: `SKIP=npm-check pre-commit run` on both files exited 0. `anthropics` count is 1 in world-and-stand-ins.md, and `official marketplace` count is 1 in steps.md.
- Acceptance greps: `disarm(` 1; `"git repository"` 1; `for the {git repository}` 3; `serves the {git repository} again` 1; `for the marketplace {string}` 0; `export async function publishOfficialMarketplace` 1; `is published as the official marketplace` 1.
- Final `npm run test:cucumber` on `64d65b61`: 445 scenarios and 4194 steps passed (exit 0, Node v26.12.1). `npm run check:features` exited 0. No `--mode rpc` Pi was left running.
- I did not run `npm run check`. It is the wave gate after wave 4.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

The plan's mitigations hold. T-01-12: the official marketplace is a github publication on the loopback host, reached through the GitHub base override, and the second bootstrap's `the git host receives no request` pins its traffic. T-01-13: every arming step registers a disarming release, and the `Before()` reset still clears every arm and asserts `arms: []`. T-01-14: the resolver fails for a marketplace that is not a git publication, `arm` keeps both guards, and the disarm step asserts that the repository was armed.

## Next Phase Readiness

- Phases 4, 12, and 15 can lift arms with `the git host serves the {git repository} again`. 01-10 adds the plugin form of `{git repository}`.
- Phases 13 and 14 can publish the official marketplace with its step and run bootstrap as setup.
- Ready for the wave-4 sibling (01-07) or the wave gate (`npm run check` on the combined tree).

## Self-Check: PASSED

- FOUND: features/support/git-repository.ts, features/plugin/bootstrap.feature
- FOUND: commits 078d6fe2, 3449e0a8, 64d65b61 (ancestors of HEAD)

---
*Phase: 01-suite-foundation*
*Completed: 2026-10-23*
