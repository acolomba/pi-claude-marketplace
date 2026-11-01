---
phase: 01-harness-and-version-raise
plan: 09
subsystem: testing
tags: [ci, cucumber, github-actions, harness-rules, decisions, changelog]

requires:
  - phase: 01-harness-and-version-raise
    provides: "every other Phase 1 plan: the raised floors (01-01), the rule drafts and D-CF1 rows (01-02), the harness and the six seeds (01-03..01-08), the invocation cores (01-10, 01-12, 01-13), the replace rule (01-11), connect-time defaults (01-14), and the floor fixture and version docs (01-15)"
provides:
  - "A sharded behavioral CI job: a fail-fast-off matrix of a lifecycle and a components shard, each at the 15-minute floor (CI-01, D-CF1-16)"
  - "Cucumber skill rules reconciled with the harness as built (HAR-08)"
  - "D-CF1-01, -02, -13, and -16 rows that carry the measured residuals and results (DEC-01, DEC-02)"
  - "The D-CF1-06 and D-CF1-13 CHANGELOG sub-bullets (DEC-01)"
  - "The phase gate result on the combined Phase 1 tree, and the parent lines"
affects: [skills, slash-commands, agents, hooks, mcp-servers, workflows, milestone PR]

actuals:
  tokens: 11233    # chars/4 over the added diff lines (44,932 chars); the padded PROJECT.md rows make up most of it
  tasks: 3
  commits: 2       # MEASURED: git rev-list --count 732a0d8..HEAD before this SUMMARY commit
plan_head_before: 732a0d80394d4e7f664898ff008e1714b2ef78a6
plan_head_after: 80f1764fe0f37f40dbbf298b732b23a4d1d268bb

tech-stack:
  added: []
  patterns:
    - "Matrix values reach a run step only through env, and the unquoted expansion splits a shard's paths into arguments"

key-files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - CHANGELOG.md
    - .agents/skills/cucumber/rules/layout.md
    - .agents/skills/cucumber/rules/world-and-stand-ins.md
    - .agents/skills/cucumber/rules/features.md
    - .planning/PROJECT.md

key-decisions:
  - "CI timeouts come from local runs doubled for a 4-vCPU runner and are marked estimated, because the branch is not on origin and the plan forbids pushing to measure (CI-01 flagged assumption)"
  - "Both shards take the 15-minute floor: estimated 3.4 minutes for lifecycle and 1.2 for components, so 1.5 times each is far below 15"
  - "zizmor's online audit cannot run here (the GH_TOKEN in the session is invalid, 401). Commits ran with GH_TOKEN unset, so the hook ran zizmor in its default offline mode and did not skip it"
  - "CONVENTIONS.md and STACK.md were left alone and handed to the parent: the marker count is stale since before this milestone (46 on main, 48 now, against the documented 41), and a correct fix rewrites the marker inventory"

patterns-established:
  - "A new function directory joins the components shard's paths in ci.yml"

requirements-completed: [CI-01, HAR-08, DEC-01, DEC-02]

coverage:
  - id: D1
    description: "The behavioral job is a fail-fast-off matrix with a lifecycle and a components shard, paths passed through env, each timeout at least 15 minutes, and the measurement recorded in a comment"
    requirement: CI-01
    verification:
      - kind: other
        ref: "SKIP=npm-check pre-commit run --files .github/workflows/ci.yml (zizmor offline) && npm run lint:workflows && node -e '<shard key check>'"
        status: pass
      - kind: other
        ref: "SHARD_PATHS='features/workflow features/hook' sh -c 'npm run test:cucumber -- $SHARD_PATHS' (2/2 scenarios)"
        status: pass
    human_judgment: true
    rationale: "The timeouts rest on an estimate. Only a real CI run on a hosted runner proves the shards finish inside them; the parent re-measures on the first CI run"
  - id: D2
    description: "The cucumber rules name the world methods, step texts, stand-in files and logs, run tokens, and ownership as built"
    requirement: HAR-08
    verification:
      - kind: other
        ref: "grep of each world method, step text, and stand-in name the rules mention, in features/ (20/20 found)"
        status: pass
      - kind: other
        ref: "npm run check:features"
        status: pass
    human_judgment: true
    rationale: "Whether the rules are complete and clear for six parallel sessions is a reading judgment"
  - id: D3
    description: "PROJECT.md D-CF1-01, -02, -13, and -16 carry the measured residuals, the precondition result and kept exceptions, and the CI minutes; CHANGELOG carries the two sub-bullets"
    requirement: DEC-01
    verification:
      - kind: other
        ref: "grep -c 'folder is ignored\\|conventional folder' CHANGELOG.md (1); grep of the new row text in .planning/PROJECT.md"
        status: pass
    human_judgment: true
    rationale: "DEC-01 and DEC-02 rest on the flagged meaning of 'recorded with IDs' from plan 01-02"
  - id: D4
    description: "The phase gate passes on the combined tree: npm run check, the pinned e2e suite on the Pi 1.4.0 floor fixture, and the whole cucumber suite twice in random order"
    verification:
      - kind: other
        ref: "npm run check (exit 0, 80f1764, Node v22.23.4)"
        status: pass
      - kind: e2e
        ref: "npm run test:e2e (exit 0 on the recorded run; see Gate evidence for one flaky failure on the first run)"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber twice (1169/1169, seeds 641302 and 717293)"
        status: pass
    human_judgment: false

duration: 28min
completed: 2026-11-01
status: complete
---

# Phase 1 Plan 09: CI Shards, Reconciled Rules, and the Phase Gate Summary

**The behavioral CI job now runs a lifecycle shard and a components shard in parallel at the 15-minute floor, the cucumber rules describe the harness that Phase 1 built, the D-CF1 rows and the CHANGELOG carry the measured results, and `npm run check` passes on the combined Phase 1 tree.**

## Performance

- **Duration:** about 28 min
- **Started:** 2026-11-01T05:44Z
- **Completed:** 2026-11-01T06:12Z
- **Tasks:** 3 (Task 3 changed no file)
- **Files modified:** 6

## Accomplishments

- `ci.yml`: the `behavioral` job is a matrix with `fail-fast: false`, `shard: lifecycle` (`features/marketplace features/plugin`) and `shard: components` (the six function directories), a job name that shows the shard, and a final step that runs `npm run test:cucumber -- $SHARD_PATHS` with the paths in `env:`. Both legs have `timeout-minutes: 15`. A comment above the job records the measurement. The `package` job still needs `behavioral`, so it waits for both legs.
- The cucumber rules now match the harness: the profile Pi's load order, `extraExtensions`, the jiti cache link, the two start timeouts, the launch-environment extension, how agent trust is observed, the scripted model's file names, literal key, and step texts, the stand-in log and pid names, the MCP listing wait, the nested tool-call id, the workflow run `When`, and the sharded CI job. `features.md` adds `{uuid}`, `{tool call <n>}`, and the hook session ordinals. `layout.md` freezes `pi-launch-environment.ts` and `mcp-configuration.ts`, names the shared `When`s and `Given`s, and places `features/agent/project-trust.feature` (Phase 4) and `features/plugin/component-directories.feature` (lifecycle, no component phase).
- `PROJECT.md`: D-CF1-01 records the measured tokenizer residuals, D-CF1-02 the prompt-shell residuals, D-CF1-13 the precondition result and the three install-time exceptions (the base-URL exception joins the Decision text), and D-CF1-16 the shard step shape and the estimated minutes. Each cell keeps its padded width.
- `CHANGELOG.md`: two sub-bullets under the milestone line, for D-CF1-06 and D-CF1-13.

## Task Commits

1. **Task 1: Shard the CI behavioral job with timeouts from a measured run**: `9189a2b` (ci). Tracer gate: the verify command re-ran and passed, so expansion continued.
2. **Task 2: Apply the handed-over lines and reconcile the cucumber rules**: `80f1764` (docs)
3. **Task 3: Pass the phase gate and hand the parent its lines**: no commit. The gate changed no measured number, so `PROJECT.md` stays as Task 2 left it.

## Timing evidence (CI-01, D-CF1-16)

The branch `worktree-agent-a19eda7bc2ffd6bfb` is not on origin (`git ls-remote origin <branch>` printed nothing), and the plan forbids pushing to measure, so no CI run was dispatched. The numbers are local and the CI minutes are ESTIMATED as the local wall time doubled for a 4-vCPU hosted runner.

Machine: 4 cores, `cucumber.json` `parallel: 8`, Node v22.23.4, no other agent running. Each run used `npx cucumber-js <paths>` under the non-DAC script shell, in random order, through a Python wrapper that reads the wall time and the largest child RSS (`/usr/bin/time` is not installed).

| Run | Shard | Scenarios | Wall | Max RSS (one process) | Result |
| --- | --- | --- | --- | --- | --- |
| 1 | lifecycle | 1158 | 94.3 s | 1,364,584 kB | all pass (seed 438807) |
| 2 | components | 11 | 34.9 s | 1,183,876 kB | all pass (seed 600894) |
| 3 | components | 11 | 35.3 s | 1,189,280 kB | all pass |
| 4 | lifecycle | 1158 | 102.1 s | 1,454,984 kB | all pass |

Estimated CI: lifecycle 2 x 102 s = about 3.4 min, components 2 x 35 s = about 1.2 min. `max(15, ceil(1.5 x 3.4))` = 15 and `max(15, ceil(1.5 x 1.2))` = 15, so one constant of 15 minutes. No interference showed between companion scenarios, so none is serialized. For reference, the full suite in the gate runs took 1m 38s to 1m 42s wall for 1169 scenarios.

## Gate evidence (local-verification evidence rules)

All runs on commit `80f1764fe0f37f40dbbf298b732b23a4d1d268bb` (clean tree), Node v22.23.4, worktree `agent-a19eda7bc2ffd6bfb`, with `npm_config_script_shell=<scratchpad>/nondac-sh` (drops CAP_DAC_OVERRIDE so the chmod-based cases behave as for a non-root user; it skips no check) and `NODE_OPTIONS=--max-old-space-size=6144` for the check.

- `npm run check`: **exit 0**, 06:00:43Z to 06:06:04Z. It ran `check:static`, `test:unpaired`, `test:integration`, `test:cucumber` (1169/1169 scenarios, 12063 steps, seed 955754), and `test:coverage:direct:all` (`Merged LCOV: coverage/direct.lcov (316 records)`).
- `npm --prefix test/e2e/pi-peer-floor ci --ignore-scripts`: exit 0. The fixture's `@earendil-works/pi-coding-agent` is 1.4.0.
- `npm run test:e2e`: the first run, right after the check, reported `tests 33, pass 32, fail 1`. The failing case was `ADET-01: with only Pi's built-in MCP active, ...` in `test/e2e/adapter-detection-rpc.test.ts:452`, on `{ stubGone: true, sentinelGone: false }`: its group sentinel was still alive after the case's 2-second `processGone` window. The case then passed 3 of 3 times alone, and two more full runs passed. The recorded run: **exit 0**, no failure. The peer-floor lines read `peer floor: Pi 1.4.0; rpc; exit 0; ...`. No test was changed. See Issues Encountered.
- `npm run test:cucumber` twice: **exit 0** both times, 1169/1169 scenarios and 12063 steps each (seeds 641302 and 717293, 1m 42.4s and 1m 38.2s).
- Commit hooks: `9189a2b` ran every hook, including zizmor (offline, see Decisions) and `npm run check:commit` (Passed). `80f1764` staged no build input, so `check:commit` was skipped by its `files` pattern.

## Parent lines

Lines the parent session applies or carries forward at merge:

1. **DC-13 item 6:** remove the six `dynamicallyLoaded` and `ignoreExports` entries from `.fallowrc.json` after Phases 2 and 3 merge, then run `npm run fallow`.
2. **D-CF1-16:** the CI timeouts are estimated. Re-measure both behavioral shards on the first CI run of the milestone branch (`gh api -X POST repos/acolomba/pi-claude-marketplace/actions/workflows/ci.yml/dispatches -f ref=<branch>`, then read each job's `started_at` and `completed_at`), and again after each component merge. Raise a shard's `timeout-minutes` when it no longer holds 1.5 times the shard's run. Update the `ci.yml` comment and the D-CF1-16 row with the measured numbers.
3. **CHANGELOG:** when the milestone pull request opens, append ` (#NNN)` after the final period of `The extension now needs Pi 1.4.0 or newer, and each companion extension now needs its latest release.`
4. **Roadmap ownership:** Phase 3 owns `edge/command-invocation.ts`. The six invocation cores (`domain/argument-substitution.ts`, `domain/shell-words.ts`, `domain/context-injection.ts`, `domain/description-fallback.ts`, `domain/invocation-frontmatter.ts`, `platform/prompt-shell.ts`) are frozen, and only the parent changes them. `features/agent/project-trust.feature` goes to Phase 4. `features/plugin/component-directories.feature` stays a lifecycle file.
5. **For Phase 4:** `bridges/agents/convert.ts` `THINKING_VALUES` lacks `max` (research Q3). pi-subagents 0.84.0's `subagent {action:"list"}` lists the agents of an untrusted project while its runs refuse them. Research Claude Code's behavior before an agents scenario pins either side.
6. **For Phase 5 (from plan 01-05):** `transcript_path` is empty during the first turn (`translation-context.ts` falls back to `""`), where upstream always gives a path. The bridge runs the matching hooks of one event one at a time in declaration order, where upstream runs them in parallel. The bridge does not dedupe identical hook commands, where upstream does.
7. **For Phase 6:** FG-29 (an unapproved project MCP server) is not decided. The MCP seed's expected log includes the adapter's startup listing, two connections per call scenario.
8. **For Phase 7:** the workflow run `When` fails when the scripted model is called at all. A workflow that calls agents needs that check relaxed to the overflow check.
9. **CONVENTIONS.md:** it says exactly 41 `fallow-ignore` markers. `rg -n "fallow-ignore" extensions test scripts` counts 48 now: 46 on `origin/main` before this milestone, plus the two `unused-type` markers on `ThinkingLevel` and `InputSource` in `platform/pi-api.ts` (plan 01-15). `features/` holds three more `unused-export` markers on the Pi extensions under `features/lib/`. The count and the inventory paragraph need a rewrite, which the next codebase map refresh can do.
10. **STACK.md:** its "CI Workflows" paragraph lists the `ci.yml` jobs without `behavioral`. It now has a lifecycle and a components leg, each at 15 minutes.
11. **DUBIOUS-CHOICES (from plan 01-02):** D-CF1-03, D-CF1-08, and D-CF1-14..17 cite DC-01, the nearest entry. The parent may add an entry for them.
12. **WINDOWS ledger (from plan 01-10):** the pass-through `edge/command-invocation.ts` is not on the ledger. Add a `[component-features]` stub entry if the parent wants it tracked until Phases 2 and 3 replace it.
13. **Commit message (from plan 01-15):** `8b191cb` carries plan 01-01's message because of a scratchpad collision. The milestone squash replaces it.
14. **CI-01 flagged assumption:** see below.

## Flagged assumptions (spec-less probe)

- **CI-01 (unclassified, unresolved):** "the measured combined run" was taken as the local run doubled, marked estimated, because the branch was not on origin to dispatch CI (research Q9 fallback). Parent line 2 asks for the first CI run to re-measure. Flagged for the verifier.

## Files Created/Modified

- `.github/workflows/ci.yml`: the sharded `behavioral` job and its measurement comment. The integration job's comment now names all three companions.
- `CHANGELOG.md`: the D-CF1-06 and D-CF1-13 sub-bullets.
- `.agents/skills/cucumber/rules/layout.md`: frozen libraries, shared steps, the placement of the two new feature files, and the reserved launch-environment library.
- `.agents/skills/cucumber/rules/world-and-stand-ins.md`: the profile Pi, scripted model, model turn, stand-ins, and CI as built.
- `.agents/skills/cucumber/rules/features.md`: `{uuid}`, `{tool call <n>}`, and the hook session ordinals.
- `.planning/PROJECT.md`: the D-CF1-01, -02, -13, and -16 rows.

## Decisions Made

- One timeout constant of 15 minutes for both legs, from the estimate above.
- The shard paths sit in a matrix `paths` value and reach the shell through `SHARD_PATHS` in `env:`. The unquoted `$SHARD_PATHS` splits them into arguments. A local run of that exact step form passed with two directories.
- zizmor: the session's `GH_TOKEN` is invalid, so zizmor's online `ref-confusion` audit failed with a 401 before any finding. With `GH_TOKEN` unset, zizmor runs in its offline mode and reports no finding. Both commits ran that way, so the hook ran zizmor instead of skipping it. The change adds no new `uses:`, which the online audits check.
- The CHANGELOG lines were rewritten to 25 words or fewer each, with no semicolon, per the changelog skill. The D-CF1-06 line drops the handed-over second sentence about `skills`, because an entry gets a second sentence only when the reader must act.
- The seed table in `layout.md` already matched the built names, so it did not change.

## Deviations from Plan

None to the plan's files or scope. The judgment calls are listed under Decisions Made and Dubious Choices.

**Total deviations:** 0. **Impact on plan:** none.

## Issues Encountered

- **Flaky e2e case:** `ADET-01: with only Pi's built-in MCP active, ...` failed once, on the sentinel liveness check, right after `npm run check` had loaded the machine. It passed 3 of 3 alone and in the next two full runs. The case waits 2 seconds (`processGone`, 20 x 100 ms) for the session's group kill to reach its sentinel. The failure is timing under load, not a Phase 1 change: no Phase 1 plan touched that test or the session teardown. If it repeats in CI, the parent may widen the window in that test (owned by no component phase).
- The worktree guard refused compound commands that named git or computed a command name. Each check ran as a plain separate command.
- `/usr/bin/time` is not installed, so a Python wrapper (`resource.getrusage(RUSAGE_CHILDREN)`) measured the wall time and the largest child RSS.

## Known Stubs

None.

## Dubious Choices

1. **Estimated CI timeouts.** The numbers are local runs doubled, not a CI measurement (CI-01 flagged assumption, parent line 2).
2. **zizmor run with `GH_TOKEN` unset.** The hook's zizmor ran offline, so its online audits (`ref-confusion`, known-vulnerable actions, impostor commits) did not run on these commits. The Lint workflow in CI runs them.
3. **CONVENTIONS.md and STACK.md not edited.** The handoff allowed it if the files could reasonably join the scope. The marker inventory was stale before this milestone, so a correct fix is a rewrite outside this plan's files. Parent lines 9 and 10 carry the facts.
4. **The D-CF1-06 CHANGELOG line omits the `skills` sentence** from the handed-over text.
5. **Frozen list widened** to `pi-launch-environment.ts`, `mcp-configuration.ts`, and "every other file under `features/lib/` except the six fixture writers". The "Parallel work" section already gives the foundation every `features/lib/**` file, so this states that rule for the milestone.
6. **`staging-warnings.feature` named as a lifecycle file** beside `component-directories.feature`, because plan 01-11 added its D-CF1-06 scenarios. The plan named only the first.
7. **PROJECT.md row text uses semicolons as list separators,** as the existing rows do, against the simple-english rule. A rewrite of the existing rows was out of scope.
8. **The e2e verdict** counts the third full run. The first run failed one flaky case, which is reported above, not hidden.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-01-40: the shard paths reach the shell only through `env:`, and zizmor's offline audits report no finding. T-01-41: both timeouts are at the 15-minute floor, above 1.5 times the estimated run, and parent line 2 re-measures. T-01-42: each shard runs `npm run test:cucumber`, which installs the peers through `install-test-peers.mjs`, and `npm ci --ignore-scripts` stays (`lint:workflows` passes).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 1 is complete. The component phases fan out from this tree, and the parent applies the lines above at merge.

## Self-Check: PASSED

- FOUND: all six modified files.
- FOUND on HEAD: `9189a2b`, `80f1764` (`git rev-list --count 732a0d8..HEAD` = 2 before this SUMMARY).
- Acceptance re-run: `shard: lifecycle` 1, `shard: components` 1, `run:.*${{` in the behavioral job 0, behavioral `timeout-minutes: 15`; CHANGELOG grep 1; `project-trust.feature` in layout.md 2; every named world method, step text, and stand-in file exists in `features/`; `npm run check:features` exit 0.

---
*Phase: 01-harness-and-version-raise*
*Completed: 2026-11-01*
