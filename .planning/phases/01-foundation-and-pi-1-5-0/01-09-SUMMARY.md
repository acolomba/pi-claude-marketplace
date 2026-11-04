---
phase: 01-foundation-and-pi-1-5-0
plan: "09"
subsystem: testing
tags: [cucumber, harness, mcp, pi-mcp-adapter, pi-builtin-mcp, profiles, tags]

requires:
  - phase: 01-07
    provides: cucumber profiles, writeAdapterOnboardingSeed, classifyMcpImplementation, stubPidsIn, waitUntilProcessesExit
  - phase: 01-02
    provides: the dual-profile cucumber contract (tags, setup variants, reserved file names)
provides:
  - profile-following shared Pi (pi-mcp-adapter plus onboarding seed under adapter, Pi's built-in MCP under builtin)
  - shared-Pi implementation probe at start and after every reset; stub-exit check under builtin
  - "@adapter-only on listing, configuration, sources, lifecycle, invocation, project-scope, invalid-configs, agent-grants, and the hook MCP-tool scenario; @builtin-only on companion-missing"
  - features/mcp-server/agent-grants.feature and features/step_definitions/mcp-server/agent-grants.steps.ts (Phase 4 owns them)
  - features/mcp-server/verdict-markers.feature with 9 @builtin-only/@adapter-only pairs (Phase 3 owns it)
  - the setup step "the user has run {string}, which did not fail"
affects: [01-10, 01-13, 01-14, phase-2, phase-3, phase-4, phase-5]

actuals:
  tokens: 37700
  tasks: 3
  commits: 3
plan_head_before: 9a32dc213f8b31dc2db7d92afe507f3559562aa5
plan_head_after: fae516ed9ebcf76117259eb0ce56fa5d91985a4a

tech-stack:
  added: []
  patterns:
    - "The shared Pi's BeforeAll reads the profile through cucumber's context proxy and keeps the launch profile on PiRun, so a replaced Pi starts the same way"
    - "A replaced shared Pi starts only after the sandbox is emptied and seeded"
    - "An implementation-dependent row lives in one Phase 3 file as an @builtin-only twin and an @adapter-only twin"

key-files:
  created:
    - features/mcp-server/agent-grants.feature
    - features/mcp-server/verdict-markers.feature
  modified:
    - features/support/pi-process.ts
    - features/step_definitions/mcp-server/agent-grants.steps.ts (renamed from invocation.steps.ts)
    - features/step_definitions/command.steps.ts
    - features/mcp-server/listing.feature
    - features/mcp-server/configuration.feature
    - features/mcp-server/sources.feature
    - features/mcp-server/lifecycle.feature
    - features/mcp-server/invocation.feature
    - features/mcp-server/project-scope.feature
    - features/mcp-server/invalid-configs.feature
    - features/mcp-server/companion-missing.feature
    - features/hook/tool-use.feature
    - features/marketplace/update.feature
    - features/plugin/apply.feature
    - features/plugin/staging-warnings.feature
    - features/plugin/update.feature

key-decisions:
  - "The onboarding seed is also written in BeforeAll before the shared Pi starts, because Pi starts its first session before any reset"
  - "Installs that emit an info cascade plus an MCP config notice under the adapter use the contract setup step 'which did not fail', added to command.steps.ts here"
  - "An adapter twin whose cascade turns info drops the summary column, since an info cascade carries no summary"

patterns-established:
  - "Tag reason: a description sentence 'They run under pi-mcp-adapter only, until <the work> (<ID>) lift the tag.'"

requirements-completed: [DUAL-01, DUAL-02]

coverage:
  - id: D1
    description: "The shared Pi runs pi-mcp-adapter with a seeded onboarding file under the adapter profile and Pi's built-in MCP under the builtin profile, probed at start and after every reset"
    requirement: DUAL-02
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter features/mcp-server/listing.feature features/plugin/list.feature (19 passed)"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile builtin features/mcp-server (BeforeAll probe passes; 4 companion-missing scenarios pass)"
        status: pass
      - kind: other
        ref: "fail-first: shared Pi started without the adapter under the adapter profile fails the first reset with mcpImplementation 'builtin' !== 'adapter'"
        status: pass
    human_judgment: false
  - id: D2
    description: "Adapter-specific MCP features tagged @adapter-only with a requirement ID, companion-missing @builtin-only, agent scenarios split into agent-grants"
    requirement: DUAL-01
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter features/mcp-server features/hook/tool-use.feature (76 passed)"
        status: pass
      - kind: other
        ref: "npm run check:features"
        status: pass
    human_judgment: false
  - id: D3
    description: "The 9 implementation-dependent marker scenarios live in verdict-markers.feature as @builtin-only/@adapter-only pairs; no plugin or marketplace feature names the adapter marker"
    requirement: DUAL-01
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter (whole suite, 1557 passed, 6m32s)"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile builtin (whole suite, 13 passed, 1m03s)"
        status: pass
      - kind: other
        ref: "npm run check:static"
        status: pass
    human_judgment: false

duration: 49min
completed: 2026-11-04
status: complete
---

# Phase 1 Plan 09: Profile-following shared Pi and the MCP feature tags Summary

**The run's shared Pi now loads pi-mcp-adapter with a seeded `mcp-onboarding.json` under the adapter profile and keeps Pi's built-in MCP under the builtin profile, and it is probed with `get_commands` at start and after every reset. The adapter-specific MCP features carry `@adapter-only` with a requirement ID, `companion-missing.feature` runs `@builtin-only`, the D-CF6-10 agent scenarios moved to `agent-grants.feature`, and the 9 marker scenarios moved to `verdict-markers.feature` as tag pairs. Both profiles pass the whole suite.**

## Performance

- **Duration:** about 49 min
- **Started:** 2026-11-04T06:02:11Z
- **Completed:** 2026-11-04T06:51:25Z
- **Tasks:** 3
- **Files modified:** 18 (2 created, 1 renamed)

## Accomplishments

- `features/support/pi-process.ts`: `BeforeAll` (an arrow, timeout 90 s) reads `mcpImplementation` through cucumber's `context` proxy and fails on any value other than `adapter` or `builtin`. Under adapter it starts the shared Pi with `resolveCompanion("pi-mcp-adapter").entry` and `TMPDIR=<run root>/shared-pi-tmp`, and seeds the onboarding file before the start. `PiRun` keeps `mcpImplementation`, `piProfile`, and `adapterVersion`. `Before` collects the stub pids under builtin, empties the sandbox, seeds the onboarding file under adapter, starts a replaced Pi if one is needed, starts the session, waits up to 10 s for the stub pids to exit, and adds the probed implementation to the reset's deep-equality baseline.
- `listing`, `configuration`, `sources`, `lifecycle`, `invocation`, `project-scope`, and `invalid-configs` are tagged `@adapter-only` at feature level. Each description names the ID that lifts the tag: BLT-01, BLT-02, BLT-02, BLT-06, BLT-01, BLT-03, and MREC-04. An install whose only warning was the adapter marker is now `the user has run`.
- `companion-missing.feature` is `@builtin-only`, its text unchanged except one description sentence naming MREC-05.
- `features/mcp-server/agent-grants.feature` (`@adapter-only`, D-CF6-10 and MGRT-01) holds the three agent scenarios. The install row of the third drops `requires pi-mcp-adapter` and keeps `requires pi-subagents` and its warning. `git mv` renamed `invocation.steps.ts` to `agent-grants.steps.ts`, with a new `@fileoverview`.
- `hook/tool-use.feature`: the MCP-tool scenario is `@adapter-only` and its install is info. The feature description names MHK-01 and MHK-02.
- `features/mcp-server/verdict-markers.feature` (D-MB-07, MREC-03, MREC-05, MREC-07) holds 9 pairs: `marketplace/update.feature` 7 and 52, `plugin/apply.feature` 556, `plugin/staging-warnings.feature` 251, 269, 295, 315, and 358, and `plugin/update.feature` 28. Each pair has a `@builtin-only` twin with today's rows and an `@adapter-only` twin without the marker. The source files' Background steps are inlined, and the originals are deleted.

## Measured cucumber runs (4 CPUs, parallel 8, local)

| Run | Scenarios | Result | Duration |
|-----|-----------|--------|----------|
| adapter profile, whole suite | 1557 | 1557 passed | 6m 32.2s |
| builtin profile, whole suite | 13 | 13 passed | 1m 02.7s |
| adapter, `features/mcp-server` + `hook/tool-use.feature` | 76 | 76 passed | 3m 03.8s |
| adapter, verdict-markers + the four source files | 195 | 195 passed | 2m 16.3s |
| adapter, `listing.feature` + `plugin/list.feature` | 19 | 19 passed | 1m 12.5s |

1557 is the 1561 of plan 01-07 minus the 4 `companion-missing` scenarios, which now run only under builtin. The 9 originals became 9 adapter twins. The builtin 13 are the 9 builtin twins and the 4 `companion-missing` scenarios.

## Fail-first proof (Task 1 acceptance)

A temporary edit started the shared Pi without its profile (no adapter) under the adapter profile, and skipped `BeforeAll`'s own probe. The first reset then failed with `mcpImplementation: 'builtin'` against the expected `'adapter'`. The edit was reverted before the commit. Without the skip, `BeforeAll`'s own probe fails first.

## Task Commits

1. **Task 1: Make the shared Pi follow the profile and prove it with the listing feature.** `a280c4a` (test)
2. **Task 2: Tag and rewrite the MCP server features, and split the agent scenarios into agent-grants.** `18595ec` (test)
3. **Task 3: Move the implementation-dependent marker rows into verdict-markers as tag pairs and run both profiles.** `fae516e` (test)

## Files Created/Modified

- `features/support/pi-process.ts`: the profile-following shared Pi, the onboarding seed, the shared-Pi probe, and the stub-exit check.
- `features/mcp-server/agent-grants.feature`: the D-CF6-10 agent scenarios (created).
- `features/step_definitions/mcp-server/agent-grants.steps.ts`: renamed from `invocation.steps.ts`, with a new file overview.
- `features/mcp-server/verdict-markers.feature`: the 9 marker pairs (created).
- `features/step_definitions/command.steps.ts`: the `which did not fail` setup step.
- The MCP features, `hook/tool-use.feature`, `marketplace/update.feature`, `plugin/apply.feature`, `plugin/staging-warnings.feature`, and `plugin/update.feature`: tags, info setups, and the removed originals.

## Decisions Made

- The onboarding seed is also written before the shared Pi starts. Pi starts its first session at once, and the adapter's settings write would otherwise race the first reset's emptying.
- A replaced shared Pi now starts after the emptying and the seed, not before them. So its start-up session sees a clean, seeded sandbox.
- Three `configuration.feature` installs emit an info cascade and an MCP config notice (a warning) under the adapter. No existing setup step accepts mixed severities. These installs now use the contract step `the user has run {string}, which did not fail` from `steps.md`, which this plan adds to `command.steps.ts` (see Deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The `which did not fail` setup step added to `command.steps.ts`**
- **Found during:** Task 2
- **Issue:** Under the adapter profile, the installs of `configuration.feature` lines 10, 87, and 161 emit an info cascade and a warning MCP config notice (`variables-missing`). `which warned` needs every payload to be a warning, and `the user has run` needs every payload to be info, so neither step fits.
- **Fix:** The step `the user has run {string}, which did not fail` fails on any error result. The cucumber contract (`steps.md`) defines it, and plan 01-10 also adds it. This plan added it after `which warned`, and the three installs use it.
- **Files modified:** features/step_definitions/command.steps.ts, features/mcp-server/configuration.feature
- **Verification:** the adapter run of `configuration.feature` passes 10 of 10, and `check:features` passes.
- **Committed in:** 18595ec

**2. [Rule 3 - Blocking] Two adapter twins drop the `summary` column**
- **Found during:** Task 3
- **Issue:** With the marker gone, the cascade of two adapter twins (`staging-warnings` 251 and 295) is info, and an info cascade carries no `summary` field.
- **Fix:** Those two `the command reports these results:` tables state `kind`, `severity`, `needs reload`, and `notices`, with the cascade `info`.
- **Files modified:** features/mcp-server/verdict-markers.feature
- **Committed in:** fae516e

**Total deviations:** 2 auto-fixed, both Rule 3. **Impact on plan:** one file outside `files_modified` (`command.steps.ts`) was changed, and it overlaps plan 01-10.

## Issues Encountered

- The worktree guard refused compound shell commands such as `$(git rev-parse --git-dir)` and `${SKIP:+,$SKIP}`. So the per-plan commit ledger file was not written, and the commits are measured from the known base `9a32dc2`. Pre-commit ran with `SKIP=npm-check,trufflehog` spelled out.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

- **P1-09-DC-01: The `which did not fail` step is added to `command.steps.ts`, a file that plan 01-10 owns in this wave.** Alternatives: keep `which warned` and let the three scenarios fail until 01-10 merges; add a configuration-specific variant in `mcp-server/configuration.steps.ts`, which Phase 2 owns; or change the scenarios so no notice appears. Why: it is the contract step for this case, and the suite must stay green in this worktree. Merge risk: if both plans keep a definition, cucumber reports an ambiguous step, and `check:features` fails loudly at the post-merge gate. Keep exactly one definition. Severity: Medium.
- **P1-09-DC-02: The three `configuration.feature` installs now accept any non-error result.** The old `which warned` proved a notice appeared at install. Alternatives: a step that states the notice. Why: no such setup step exists, and the scenarios pin the header and env values, not the notice. Severity: Low.
- **P1-09-DC-03: The `.fallowrc.json` `ignoreExports` entry for `writeAdapterOnboardingSeed`, `stubPidsIn`, and `waitUntilProcessesExit` stays, although `pi-process.ts` now uses all three.** Alternatives: remove the entry now. Why: sibling plans in this wave may append to the same array, and removing an element there invites a merge conflict. Phase 6 removes the entries. Severity: Low.
- **P1-09-DC-04: The onboarding seed is also written in `BeforeAll` before the start (the plan names only `Before`), and a replaced Pi now starts after the emptying.** Why: Pi's first session would otherwise run the adapter's real first-run write, which races the reset. Severity: Low.
- **P1-09-DC-05: The shared Pi's `TMPDIR` is `<run root>/shared-pi-tmp`, with its own jiti cache.** Alternatives: link `jiti` to the profile Pis' `<run root>/jiti-cache`. Why: separate caches avoid two Pis writing one cache at once. The cost is one extra cold compile per worker. Severity: Low.
- **P1-09-DC-06: `BeforeAll` has its own 90-second timeout, `RUN_START_TIMEOUT_MS`.** `world.ts`'s `PROFILE_PI_START_TIMEOUT_MS` cannot be imported, because `world.ts` imports `pi-process.ts`. Severity: Low.
- **P1-09-DC-07: The stub-exit check runs only under the builtin profile, as the plan says.** Under the adapter profile, a stub that the shared Pi's adapter starts is not checked at the reset. Severity: Low.
- **P1-09-DC-08: The tag-reason sentences make some feature descriptions four or five lines, where the rule asks for two or three.** Alternatives: rewrite each description. Why: the tags are temporary, and the phases that lift them remove the sentences. Severity: Low.
- **P1-09-DC-09: The reason IDs follow the plan's list. `configuration` and `sources` both cite BLT-02, and `listing` and `invocation` both cite BLT-01.** Sources could also cite BLT-01 (registration). Severity: Low.
- **P1-09-DC-10: The hook scenario's reason (MHK-01, MHK-02) is in the feature description, not its title.** Why: a title change would rename the scenario. Severity: Low.
- **P1-09-DC-11: The moved `apply` pair inlines the `fixtures` Background (four plugins) that it never uses.** Why: the plan says to inline every Background step, so the setup stays identical. Severity: Low.
- **P1-09-DC-12: The builtin twins copy today's rows verbatim, including two rows with an extra space in a `reasons` cell. The adapter twins' marker tables are realigned.** Severity: Low.
- **P1-09-DC-13: The twin titles end in ", under Pi's built-in MCP" and ", under pi-mcp-adapter".** Alternatives: put the implementation first. Severity: Low.
- **P1-09-DC-14: The Task 1 commit title reads "run the shared pi under the profile's mcp server".** "mcp implementation" made the title too long for the 72-character limit, and a commit may not be amended. Severity: Low.
- **P1-09-DC-15: The fail-first proof skipped `BeforeAll`'s own probe, so that the reset probe is the one that fails.** Without the skip, `BeforeAll` fails first with its own message. Severity: Low.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Plan 01-10's merge must keep one definition of `the user has run {string}, which did not fail` (P1-09-DC-01).
- Phase 2 removes the `@adapter-only` tags of `listing`, `configuration`, `sources`, `lifecycle`, `invocation`, and `project-scope`. Phase 3 owns `verdict-markers.feature`, `companion-missing.feature`, and `invalid-configs.feature`. Phase 4 owns `agent-grants.feature` and `agent-grants.steps.ts`. Phase 5 owns the hook scenario's tag.
- Plan 01-13's CI legs: adapter whole suite about 6.5 min locally and builtin whole suite about 1 min.

## Self-Check: PASSED

- FOUND: features/mcp-server/agent-grants.feature, features/mcp-server/verdict-markers.feature, features/step_definitions/mcp-server/agent-grants.steps.ts; features/step_definitions/mcp-server/invocation.steps.ts is gone
- FOUND: a280c4a, 18595ec, fae516e (ancestors of HEAD)
- Acceptance: `writeAdapterOnboardingSeed` in pi-process.ts = 3 and `context` > 0; `^@adapter-only` in listing = 1; `granted the mcp tool` = 0 in invocation and 2 in agent-grants; `^@builtin-only` in companion-missing = 1; verdict-markers has 9 `@adapter-only` and 9 `@builtin-only`; `requires pi-mcp-adapter` is 0 in apply, staging-warnings, plugin update, and marketplace update; check:static passes; both profiles pass the whole suite.

---
*Phase: 01-foundation-and-pi-1-5-0*
*Completed: 2026-11-04*
