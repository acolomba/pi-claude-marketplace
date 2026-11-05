---
phase: 01-foundation-and-pi-1-5-0
plan: "07"
subsystem: testing
tags: [cucumber, harness, mcp, pi-mcp-adapter, pi-builtin-mcp, profiles]

requires:
  - phase: 01-01
    provides: Pi 1.5.0 pins (builtin:mcp, --no-mcp)
  - phase: 01-02
    provides: the dual-profile cucumber contract in .agents/skills/cucumber/
provides:
  - cucumber.json profiles default, adapter, builtin with world parameter mcpImplementation
  - npm scripts test:cucumber (both profiles) and test:cucumber:profile (one profile, paths)
  - start probe on every profile Pi (classifyMcpImplementation vs expectedMcpImplementation)
  - world.restartPi with without-adapter, with-adapter, builtin-on, no-mcp
  - world.mcpProfile getter, world.ownImplementation, world.turnOffBuiltinMcpBeforeStart
  - RpcProfile.noMcp, piArguments options (--no-mcp), ListedCommand.source
  - features/lib/mcp-implementation.ts helpers incl. writeAdapterOnboardingSeed, stubPidsIn, waitUntilProcessesExit for plan 01-09
  - five frozen step texts and four @own-implementation seed scenarios
  - check-features allows @mcp, @adapter-only, @builtin-only, @own-implementation anywhere
affects: [01-09, 01-10, 01-13, 01-14, phase-2, phase-3, phase-4, phase-5]

actuals:
  tokens: 11900
  tasks: 2
  commits: 2
plan_head_before: 57363954459d2a3d6dff1642f0eb5fa4aca10175
plan_head_after: f616049

tech-stack:
  added: []
  patterns:
    - "Each profile Pi is probed with RPC get_commands after startup and compared with the implementation its launch implies"
    - "A restart stops the profile Pi, asserts its stand-ins stopped, and starts another through the same private start"
    - "Sandbox-file helpers refuse any location outside the run root (<tmp>/pi-cm-features-*)"

key-files:
  created:
    - features/lib/mcp-implementation.ts
    - features/support/mcp-implementation.ts
    - features/step_definitions/mcp-implementation.steps.ts
    - features/mcp-server/implementation-profiles.feature
  modified:
    - cucumber.json
    - package.json
    - features/support/world.ts
    - scripts/check-features.mjs
    - test/e2e/_rpc.ts
    - test/e2e/adapter-detection-rpc.test.ts
    - features/lib/turn-records.ts
    - .fallowrc.json
    - .agents/skills/local-verification/rules/commands.md

key-decisions:
  - "Profiles repeat import/format/order/parallel and name no paths; default equals adapter"
  - "A restart waits for the adapter's onboarding file whenever the stopped Pi loaded the adapter, not only for without-adapter"
  - "Frozen lib exports that plan 01-09 consumes are exempted through .fallowrc.json ignoreExports"

patterns-established:
  - "Restart step: When the user restarts pi <change>, PROFILE_PI_START_TIMEOUT_MS, keeps the new session as the last session results"
  - "@own-implementation is recorded by a tagged Before hook in features/support/mcp-implementation.ts"

requirements-completed: [DUAL-01, DUAL-02]

coverage:
  - id: D1
    description: "cucumber.json adapter and builtin profiles, test:cucumber runs both, test:cucumber:profile runs one; builtin with no matching scenario exits 0"
    requirement: DUAL-01
    verification:
      - kind: other
        ref: "npm run test:cucumber:profile -- --profile adapter (1561 scenarios passed, 4m26s)"
        status: pass
      - kind: other
        ref: "npx cucumber-js --profile builtin (0 scenarios, exit 0, 5.5s)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Start probe on every profile Pi fails the start step naming both implementations on a mismatch"
    requirement: DUAL-02
    verification:
      - kind: e2e
        ref: "features/mcp-server/implementation-profiles.feature (4 scenarios, adapter profile)"
        status: pass
      - kind: other
        ref: "fail-first: forcing pi-mcp-adapter into every start failed the restart step with 'runs the MCP implementation adapter, but its launch implies none'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Four restart steps and the settings-off step, each proven by an @own-implementation seed"
    requirement: DUAL-01
    verification:
      - kind: e2e
        ref: "npx cucumber-js --profile adapter features/mcp-server/implementation-profiles.feature"
        status: pass
    human_judgment: false
  - id: D4
    description: "--no-mcp launch option in test/e2e/_rpc.ts; e2e drivers that share _rpc.ts still pass"
    requirement: DUAL-02
    verification:
      - kind: e2e
        ref: "node --test test/e2e/pi-json-output.test.ts test/e2e/adapter-detection-rpc.test.ts (15/15)"
        status: pass
    human_judgment: false
  - id: D5
    description: "check-features accepts the four implementation tags on Feature, Rule, Scenario, Examples; @url/@github stay Examples-only"
    requirement: DUAL-01
    verification:
      - kind: other
        ref: "npm run check:features"
        status: pass
    human_judgment: false

duration: 36min
completed: 2026-11-04
status: complete
---

# Phase 1 Plan 07: Dual-profile cucumber runtime Summary

**Adapter and builtin cucumber profiles, a get_commands start probe that checks every profile Pi against its launch, four Pi restart steps plus a settings-off step, and `--no-mcp` in the RPC driver, each proven by an `@own-implementation` seed scenario.**

## Performance

- **Duration:** about 36 min
- **Started:** 2026-11-04T05:07:10Z
- **Completed:** 2026-11-04T05:43:00Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- `cucumber.json` has `default` and `adapter` (`not @builtin-only`, `mcpImplementation: adapter`) and `builtin` (`(@mcp or @builtin-only) and not @adapter-only`, `mcpImplementation: builtin`). Each profile repeats `import`, `format`, `order: random`, and `parallel: 8`, and none names paths. `npm run test:cucumber` runs the installer, then the adapter profile, then the builtin profile. `npm run test:cucumber:profile -- --profile <p> <paths>` runs one profile.
- `features/support/world.ts`: `usePiWithProfile` and `restartPi` share one private `startProfilePi`. It removes the harness onboarding seed before an adapter start in an `@own-implementation` scenario. It computes the launch expectation and starts Pi. After `set_model` and `set_auto_retry`, it probes with `get_commands` and fails with both implementation names on a mismatch. `restartPi` handles `without-adapter`, `with-adapter`, `builtin-on`, and `no-mcp`. The `mcpProfile` getter validates the world parameter.
- `features/lib/mcp-implementation.ts` holds the classification (MSEL-01 precedence), the launch rule (P1-DC-14), the settings read and the on/off edits, the onboarding seed write, remove, and wait, and the stub pid helpers that the shared-Pi reset of plan 01-09 needs. Every path is checked against the run root.
- Steps: `Given the user's pi settings turn off pi's built-in mcp`, plus `When the user restarts pi without pi-mcp-adapter`, `... with pi-mcp-adapter`, `... with pi's built-in mcp turned on`, and `... with no mcp`. These texts are verbatim from the 01-02 contract.
- `test/e2e/_rpc.ts`: adds `RpcProfile.noMcp`, `piArguments(mode, extensions, { noMcp })` (it never passes `--no-extensions`), and `ListedCommand.source`.
- `scripts/check-features.mjs`: the `implementationTags` set is allowed on a Feature, a Rule, a Scenario, or an Examples block.

## Measured cucumber durations (4 CPUs, parallel 8, local)

| Run | Scenarios | Result | Duration |
|-----|-----------|--------|----------|
| adapter profile, whole suite (`npm run test:cucumber:profile -- --profile adapter`) | 1561 | 1561 passed | 4m26.5s cucumber, 269 s wall incl. installer |
| builtin profile, whole suite (`npx cucumber-js --profile builtin`) | 0 | exit 0 | 5.5 s cucumber, 8 s wall |
| adapter profile, `implementation-profiles.feature` | 4 | 4 passed | 19.7 s |
| builtin profile, `implementation-profiles.feature` (no match) | 0 | exit 0 | 5.8 s |

The builtin profile runs no scenario yet, because no feature carries `@mcp` or `@builtin-only` until plan 01-09.

## Task Commits

1. **Task 1: Profiles, the start probe, and one restart, proven by a seed scenario.** `6da6ac2` (test)
2. **Task 2: The remaining restarts, the settings-off step, --no-mcp, and their seeds.** `f616049` (test)

## Files Created/Modified

- `cucumber.json`: the three profiles.
- `package.json`: `test:cucumber` runs both profiles; adds `test:cucumber:profile`.
- `features/lib/mcp-implementation.ts`: classification, launch rule, settings and onboarding helpers, and stub pid helpers.
- `features/support/mcp-implementation.ts`: a tagged `Before` that sets `world.ownImplementation`.
- `features/support/world.ts`: the profile getter, the shared private start with the probe, `restartPi`, and `turnOffBuiltinMcpBeforeStart`.
- `features/step_definitions/mcp-implementation.steps.ts`: the settings-off Given and the four restart Whens.
- `features/mcp-server/implementation-profiles.feature`: four `@own-implementation` restart seeds.
- `scripts/check-features.mjs`: allows the implementation tags.
- `test/e2e/_rpc.ts`: `noMcp`, `piArguments` options, and `ListedCommand.source`.
- `test/e2e/adapter-detection-rpc.test.ts`: projects listed commands to name and path, so the new `source` field changes none of its expectations.
- `features/lib/turn-records.ts`: exports `isRunning` for reuse.
- `.fallowrc.json`: an `ignoreExports` entry for the lib exports that plan 01-09 consumes.
- `.agents/skills/local-verification/rules/commands.md`: the two profile scripts and the one-scenario command.

## Decisions Made

- A restart waits for the adapter's onboarding file whenever the stopped Pi loaded the adapter, so the adapter's asynchronous `-builtin:mcp` write is on disk before any change. A `builtin-on` switch from an adapter Pi needs this too.
- `restartPi` changes only what the step names. `extraExtensions`, the trust entry, and `noMcp` carry over (with-adapter adds the adapter whatever came before, and `no-mcp` sets `noMcp`).
- The probe runs after `set_model` and `set_auto_retry`, through its own `get_commands`. Pi answers only after its startup, so a late-registered command is seen.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `ListedCommand.source` moved into Task 1**
- **Found during:** Task 1
- **Issue:** The Task 1 probe must apply the extension-command rule, which needs `source`, but the plan added `source` in Task 2.
- **Fix:** Added `source` to `ListedCommand` in Task 1. `test/e2e/adapter-detection-rpc.test.ts` deep-equals listed commands, so it now projects them to `{ name, sourcePath }`.
- **Files modified:** test/e2e/_rpc.ts, test/e2e/adapter-detection-rpc.test.ts
- **Verification:** both e2e driver suites pass, 15/15.
- **Committed in:** 6da6ac2

**2. [Rule 3 - Blocking] fallow unused exports**
- **Found during:** Task 1 and Task 2 (`npm run fallow`)
- **Issue:** `writeAdapterOnboardingSeed`, `stubPidsIn`, and `waitUntilProcessesExit` have no consumer until plan 01-09. `adapterOnboardingSeedText` is used only inside the module.
- **Fix:** Added an `ignoreExports` entry for `features/lib/mcp-implementation.ts` (the frozen-export mechanism of CONTEXT's amendments). `adapterOnboardingSeedText` is no longer exported.
- **Files modified:** .fallowrc.json, features/lib/mcp-implementation.ts
- **Committed in:** 6da6ac2, f616049

**3. [Rule 3 - Blocking] fallow duplication**
- **Found during:** Task 2
- **Issue:** A copy of `isRunning` in the lib formed a clone group with `features/lib/turn-records.ts`.
- **Fix:** `turn-records.ts` now exports `isRunning`, and the lib imports it.
- **Files modified:** features/lib/turn-records.ts, features/lib/mcp-implementation.ts
- **Committed in:** f616049

**Total deviations:** 3 auto-fixed, all Rule 3. **Impact on plan:** gate-driven only. The behavior is as planned, and three files outside `files_modified` were touched.

## Issues Encountered

- `test/e2e/pi-json-output.test.ts` needs `npm --prefix test/e2e/pi-peer-floor ci --ignore-scripts` in a fresh worktree. After that install it passes. This is an environment step only.

## Fail-first proof (Task 1 acceptance)

A temporary edit made every profile Pi load pi-mcp-adapter whatever its launch said. The first start stayed adapter = adapter. The restart without the adapter then failed its step with: `AssertionError: the profile Pi runs the MCP implementation adapter, but its launch implies none ('adapter' !== 'none')`. The edit was reverted before the commit, and the scenario passes again.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

- **P1-07-DC-01: `ListedCommand.source` landed in Task 1, and the adapter-detection e2e test now projects.** Alternatives: keep the Task 2 placement and classify without `source` in Task 1, or add `source: "extension"` to that test's expectations. Why: the probe needs the extension-command rule from its first commit, and a projection keeps the e2e expectations as they were. Severity: Low.
- **P1-07-DC-02: `adapterOnboardingSeedText` is not exported, although the plan lists it as an artifact.** Alternatives: export it and exempt it in `.fallowrc.json`. Why: only the module uses it, and an exempted dead export in a frozen file would never be reported. `writeAdapterOnboardingSeed` and `removeAdapterOnboardingSeed` cover every caller. Severity: Low.
- **P1-07-DC-03: `.fallowrc.json` `ignoreExports` for `writeAdapterOnboardingSeed`, `stubPidsIn`, and `waitUntilProcessesExit`.** The file is outside `files_modified`, and sibling plans may append to the same array, so a merge conflict is possible. Alternatives: source markers (forbidden in frozen files), or leaving the exports out until 01-09 (01-09 does not own the lib). Severity: Low.
- **P1-07-DC-04: `features/lib/turn-records.ts` exports `isRunning`.** Alternatives: an inline `fallow-ignore` dupes marker. Why: reuse beats a reviewed clone. Severity: Low.
- **P1-07-DC-05: Every restart waits for the adapter's onboarding when the stopped Pi loaded the adapter.** The contract names the wait only for `without-adapter`. Why: `builtin-on` after an adapter Pi otherwise races the adapter's asynchronous settings write, and the wait returns at once when a seed already records the version. Severity: Low.
- **P1-07-DC-06: `readBuiltinTurnedOff` reads `{project}/.pi/settings.json` whatever the launch's trust.** Pi 1.5.0 ignores untrusted project settings (`SettingsManager.loadFromStorage`). Alternatives: pass the trust and skip project settings when untrusted, which needs a third parameter the plan does not list. Why: no scenario writes `-builtin:mcp` into project settings, and a future mismatch fails loudly at the probe. Severity: Low.
- **P1-07-DC-07: The run-root check repeats `support/pi-process.ts`'s `pi-cm-features-` mkdtemp prefix.** A location counts as inside the run root when its realpath lies under `<realpath(tmpdir())>/pi-cm-features-*/`. Alternatives: pass the run root to every helper, which changes the listed signatures, or check only "under tmp and outside the repository". Why: it is strict, and a renamed prefix fails loudly. Severity: Low.
- **P1-07-DC-08: The seeds repeat their marketplace and install Givens instead of using a Background.** Each seed installs `demo` at project scope. Why: plan 01-10 adds scenarios to this frozen file that may not need the install. Severity: Low.
- **P1-07-DC-09: `@own-implementation` is recorded by a tagged hook, `Before({ tags: "@own-implementation" })`, rather than by reading `pickle.tags`.** The effect is the same, and cucumber evaluates the tag expression. Severity: Low.
- **P1-07-DC-10: The settings-off step's release removes `{agent dir}/settings.json`, even when another step created the file.** Why: the sandbox is emptied at the next reset anyway, and the step follows the project-settings step's release pattern. Severity: Low.
- **P1-07-DC-11: CI keeps `npm run test:cucumber -- $SHARD_PATHS`.** With the two-profile chain, the paths reach only the builtin run, so each CI shard now runs the whole adapter suite. Plan 01-13 owns `.github/workflows/ci.yml` and switches it to `test:cucumber:profile`. Until then CI shards are slower but still green. Severity: Medium (orchestrator should keep 01-13 ahead of any CI dispatch).
- **P1-07-DC-12: The full-suite verify ran as two foreground calls (installer plus adapter profile, then builtin profile), not one chained `npm run test:cucumber`.** Why: the tool's 10-minute cap. The commands are the chain's parts. Severity: Low.
- **P1-07-DC-13: The fail-first proof forced the adapter into every start instead of "changing the restart to keep the adapter".** Why: a restart that keeps the adapter in its launch also expects the adapter, so it cannot fail the probe. Severity: Low.
- **P1-07-DC-14: The seed text is compact JSON with no trailing newline, exactly as the plan wrote it.** The adapter writes two-space JSON, so `removeAdapterOnboardingSeed` never removes a file the adapter wrote. Severity: Low.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Plan 01-09 can call `writeAdapterOnboardingSeed`, `classifyMcpImplementation`, `parseMcpProfile`, `stubPidsIn`, and `waitUntilProcessesExit`. Plan 01-10 can build `mcpImplementationLaunch` on `world.mcpProfile` and `usePiWithProfile`. Plan 01-13 can replace the classifier body with `softDepStatus` and keep its signature.
- Plan 01-13 must switch CI to `test:cucumber:profile` (P1-07-DC-11).

## Self-Check: PASSED

- FOUND: features/lib/mcp-implementation.ts, features/support/mcp-implementation.ts, features/step_definitions/mcp-implementation.steps.ts, features/mcp-server/implementation-profiles.feature
- FOUND: 6da6ac2 and f616049 (ancestors of HEAD)
- Acceptance: builtin=1, adapter=2 in cucumber.json; test:cucumber:profile=1; --no-mcp in _rpc.ts=5; "the user restarts pi"=4; @own-implementation=4; check:features passes; check:static passes.

---
*Phase: 01-foundation-and-pi-1-5-0*
*Completed: 2026-11-04*
