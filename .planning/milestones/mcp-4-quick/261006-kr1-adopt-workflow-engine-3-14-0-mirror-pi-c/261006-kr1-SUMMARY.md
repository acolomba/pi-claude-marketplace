---
phase: 261006-kr1
plan: 01
subsystem: workflows bridge (platform/workflow-home), live UAT, docs
tags: [workflows, pi-dynamic-workflows, PI_CODING_AGENT_DIR, WPTH-04, live-uat]
status: complete
requires: []
provides:
  - workflowHomeDir() follows engine 3.14.0's PI_CODING_AGENT_DIR storage rule
  - storage canary --home-default mode and 3.14.0 transcript
  - launcher pin and compatibility guide at engine 3.14.0
affects:
  - extensions/pi-claude-marketplace/persistence/locations.ts (workflowsHomeDir, workflowsSavedDir, workflowsStagingDir)
tech-stack:
  added: []
  patterns:
    - platform seam copies a host rule and resolves the variable through pi-api.ts getAgentDir
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/platform/workflow-home.ts
    - extensions/pi-claude-marketplace/persistence/locations.ts
    - tests/platform/workflow-home.test.ts
    - tests/persistence/locations.test.ts
    - tests/bridges/workflows/stage.test.ts
    - tests/bridges/workflows/unstage.test.ts
    - tests/orchestrators/plugin/workflows-staging-gc.test.ts
    - tests/orchestrators/marketplace/shared.test.ts
    - tests/orchestrators/marketplace/remove.test.ts
    - tests/integration/workflow-kind-inversion.test.ts
    - tests/live-uat/workflow-storage-canary.mjs
    - tests/live-uat/README.md
    - docs/workflows-compatibility.md
    - CHANGELOG.md
    - scripts/pi.sh
decisions:
  - workflowHomeDir mirrors the engine 3.14.0 rule exactly (truthy PI_CODING_AGENT_DIR -> join(getAgentDir(), "workflows"), else ~/.pi/workflows), importing getAgentDir from ./pi-api.ts only
  - Test helpers that relocate HOME also clear PI_CODING_AGENT_DIR, keeping every home-derived expectation true
  - WPTH-05 keeps its five booleans with the variable cleared; no new locations case for the set variable
  - Pi 0.86.1 changelog line moved under the #205 entry as a sub-bullet
metrics:
  duration: 15 min
  completed: 2026-10-06
  tasks: 3
  files: 15
actuals:
  tokens: 14300
  tasks: 3
  commits: 3
plan_head_before: be4379c5177021e79d7f039a1ce4a3e8337bb01a
plan_head_after: 6129e7bd47b64e6ae9cdbb4eb3bf78c2b9079bfe
---

# Quick 261006-kr1: Adopt workflow engine 3.14.0 Summary

The workflows bridge now roots storage at `$PI_CODING_AGENT_DIR/workflows` when that variable is non-empty, and at `~/.pi/workflows` otherwise. This is the same rule engine 3.14.0 uses (engine PR #238), resolved through Pi's `getAgentDir`. The live storage canary proves it against the real engine in both root modes. The launcher, the live-UAT record, the compatibility guide, and the changelog now target 3.14.0.

## Commits

| Task | Hash       | Title                                                                    | Shortstat                                    |
| ---- | ---------- | ------------------------------------------------------------------------ | -------------------------------------------- |
| 1    | `5b26a3f3` | fix(workflows): store workflows under PI_CODING_AGENT_DIR when set       | 10 files changed, 208 insertions(+), 103 deletions(-) |
| 2    | `111beac6` | test(live-uat): add a home-default mode to the workflow storage canary   | 2 files changed, 72 insertions(+), 24 deletions(-)    |
| 3    | `6129e7bd` | docs(workflows): adopt engine 3.14.0 and describe the storage rule       | 3 files changed, 19 insertions(+), 16 deletions(-)    |

The `actuals.tokens` value is the chars/4 count of the full diff `be4379c5..6129e7bd` (57,185 bytes). It is not a count of the touched files' full size.

## Pre-commit and commit hooks

Node v26.10.0, npm 11.19.1.

| Task | `SKIP=npm-check pre-commit run --files ...`                                                               | Commit hook                                                       |
| ---- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1    | exit 0 on the first pass, no fixer rewrites                                                               | `npm run check:commit` Passed (seven staged source-test pairs)    |
| 2    | pass 1 exit 1 (mdformat re-padded the prerequisites table in `tests/live-uat/README.md`), pass 2 exit 0   | `npm run check:commit` Passed (all pairs, non-test build input)   |
| 3    | exit 0 on the first pass, no fixer rewrites                                                               | `npm run check:commit` Skipped (no build input staged)            |

POST-1, POST-2, and POST-3 each exited 0.

## RED evidence

- **End to end, before SRC-1** (`canary-red.log`, engine 3.14.0, unchanged canary and source): `CANARY_EXIT=1` with `[wf-storage-canary] FAIL: W0: the bridge's user saved directory is not the engine's at engine 3.14.0.` The bridge's directory was `<run>/home/.pi/workflows/saved` and the engine's was `<run>/agent/workflows/saved`.
- **Owner test, before SRC-1** (`env -u PI_CODING_AGENT_DIR node --test tests/platform/workflow-home.test.ts`): pass 4, fail 2. The two failures were `WPTH-04 roots storage under PI_CODING_AGENT_DIR when the variable is set` and `WPTH-04 expands a leading ~ in PI_CODING_AGENT_DIR as Pi's getAgentDir does`. The empty-value case passed, as planning predicted (finding 6).
- **GREEN after SRC-1:** pass 6, fail 0.

## Canary runs (Task 2 matrix)

Every run used `PI_CODING_AGENT_DIR=$PWD/tmp/pi-uat/wf-store`. The sandbox was empty after every run.

| Engine | Flag             | Exit | First line                                                                 | Last or failure line                                                                                                  |
| ------ | ---------------- | ---- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 3.14.0 | none             | 0    | `[wf-storage-canary] engine 3.14.0, storage root from PI_CODING_AGENT_DIR` | `[wf-storage-canary] all assertions proven; exit 0`                                                                   |
| 3.14.0 | `--home-default` | 0    | `[wf-storage-canary] engine 3.14.0, storage root from HOME`                | `[wf-storage-canary] all assertions proven; exit 0`                                                                   |
| 3.14.0 | `--invert`       | 1    | `[wf-storage-canary] engine 3.14.0, storage root from PI_CODING_AGENT_DIR` | `FAIL: [user] W2: the script bytes the engine loads for acme:audit are not the plugin's source bytes at engine 3.14.0.` |
| 3.13.0 | none             | 1    | `[wf-storage-canary] engine 3.13.0, storage root from PI_CODING_AGENT_DIR` | `FAIL: W0: the bridge's user saved directory is not the engine's at engine 3.13.0.` (bridge `agent/workflows/saved`, engine `home/.pi/workflows/saved`) |
| 3.13.0 | `--home-default` | 0    | `[wf-storage-canary] engine 3.13.0, storage root from HOME`                | `[wf-storage-canary] all assertions proven; exit 0`                                                                   |

The matrix matched the plan exactly. The 3.14.0 no-flag transcript (13 lines) was byte-identical to LUAT-6, both before the README edit and in the Task 2 `<verify>` re-run (`diff` against the README block, exit 0).

## Verification

- Task 1 `<verify>`: exit 0. The canary ran GREEN, the eight affected files passed with the variable unset and set to a sentinel, the sentinel stayed empty, and direct coverage passed for `workflow-home.ts` and `locations.ts`.
- Task 2 `<verify>`: exit 0. All five canary runs repeated, and the transcript diff was clean.
- Task 3 `<verify>`: exit 0. This includes the two `npm view` checks and numstat `2:3 10:6 7:7`.
- `npx --no-install fallow audit --base be4379c5... --format json --quiet`: verdict `pass`. 0 issues introduced or inherited.
- `npm run check` (run once after the last commit, output to a log, no pipe): **exit 0** at `6129e7bd47b64e6ae9cdbb4eb3bf78c2b9079bfe`, Node v26.10.0.

## npm view facts read

- `@quintinshaw/pi-dynamic-workflows@3.14.0`: `dist.attestations.provenance.predicateType` = `https://slsa.dev/provenance/v1`. `_npmUser` = `GitHub Actions <npm-oidc-no-reply@github.com>`. `version` = `3.14.0`.
- `@quintinshaw/pi-dynamic-workflows@3.13.0`: `dist.attestations.provenance.predicateType` = `https://slsa.dev/provenance/v1`.
- Both scratch installs printed npm 11.19's "3 packages have install scripts not yet covered by allowScripts" (esbuild, @google/genai, protobufjs). Nothing was approved or denied, and the canary worked (finding 13).

## Choices made (from the plan)

- **Mirror exactly.** Same variable name, same truthiness check, and the same Pi function (`getAgentDir`, through `pi-api.ts`, the only Pi peer import site).
- **Helpers clear the variable.** The five helpers that relocate HOME also clear `PI_CODING_AGENT_DIR`.
- **WPTH-05 keeps its five booleans** with the variable cleared. Its title now names that configuration.
- **No locations case for the set variable.** The owner test pins the rule. The composition below the root is the same code in both configurations.
- **The canary gets `--home-default`**, and the older-engine control runs at 3.13.0.
- **Live-UAT pins.** The storage canary moves to 3.14.0. The agent-failure canary pins stay at 3.13.0 (README lines 69 and 79).
- **Changelog.** The Pi 0.86.1 line is a sub-bullet under #205.
- **READMEs unchanged.** They name no engine version.
- **No sentence about engine PR #248.**
- **Grades.** New storage claims are `runtime-measured at 3.14.0`, and the older-engine mismatch is `runtime-measured at 3.13.0`. The source-read grades stay as they were.
- **Version count:** 62 versions in eighteen weeks through 3.14.0.

## Deviations from Plan

None in substance. One anchor note: the LUAT-6 anchor `### Observed result (2026-09-21, engine 3.13.0)` appears twice in `tests/live-uat/README.md`, at line 117 (the agent-failure canary) and at line 182 (the storage canary). The plan scopes it to the one "that sits in the storage canary section". I inserted the block before the second occurrence, found by searching after the `## Engine storage canary` heading. Task 2 `<verify>` confirmed the placement.

## Out-of-scope observations (recorded, not acted on)

1. **Pre-existing hermeticity leak.** With `PI_CODING_AGENT_DIR` set, the hooks tests create `<agent dir>/pi-claude-marketplace/data/_shared` (the `_shared` mkdir in `bridges/hooks/event-router.ts`). It also happens at `be4379c5`, so this change did not cause it.
2. **The agent-failure canary needs no provider.** It needs provider credentials to be unreachable. The task scope said not to run it, so its grades stay at 3.10.1 and 3.13.0, and its README pins stay at 3.13.0.
3. **Source-read grades.** The guide still grades its engine source reads `unchanged at 3.13.0`. The task scope reports the admission checks, the blocklist, `src/workflow-saved.ts`, the project-key derivation, and the tool names as unchanged at 3.14.0. No file in this repository records that re-read. `WPIN-01` tracks a machine-checkable re-read.
4. **Engine pull request #248** (deferred tool exposure on Pi 0.99 and later): the soft-dependency probe uses `pi.getAllTools()`, which the task scope reports lists deferred tools in Pi 1.0.4. The probe does not change, and the guide does not mention it.
5. **Profiles and project scope.** Project-scope envelopes live under the engine root, which follows the Pi profile. A project's `state.json` stays with the project. After a user switches `PI_CODING_AGENT_DIR`, the project-scope records point at envelopes under the other profile's root until the user reinstalls or copies them. This is the engine's model: "custom Pi profiles own their workflow state".
6. **Archived requirement text.** The archived WPTH-04 requirement (`.planning/milestones/ws-workflows-2026-09-27/`) still says the root has no environment override. It is history and stays unchanged.
7. **Codebase map.** `.planning/codebase/ARCHITECTURE.md` lists `pi-api.ts`, `git.ts`, and `git-credential.ts` under `platform/` and omits `workflow-home.ts` and `os.ts` (pre-existing).
8. **npm allowScripts.** npm 11.19 flags the engine peers' install scripts as "not yet covered by allowScripts". The live-UAT README advice "Do not add `--ignore-scripts`" predates that npm feature.

## Follow-ups

- The orchestrator commits this SUMMARY, STATE.md, and the PLAN.
- No PR exists yet. Before one opens, offer the version bump (AGENTS.md "Versioning").

## Cleanup

`tmp/kr1`, `tmp/pi-uat/wf-store`, `/var/tmp/wf-engine-3140`, and `/var/tmp/wf-engine-3130` were removed. The logs were first copied to the session scratchpad. No `node_modules` symlink was created, because this run used the main checkout. After cleanup, `git status --porcelain` showed only the untracked `.planning/quick/261006-kr1-.../` directory that the orchestrator owns. To re-run the Task 1 or Task 2 `<verify>`, first reinstall the scratch engines (Task 1 step 2, Task 2 step 2) and recreate `tmp/kr1/canary-red.log` (Task 1 step 3, which needs the pre-change source).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- All 15 modified files exist, and each commit holds exactly its listed files (POST-1/2/3 exit 0).
- Commits `5b26a3f3`, `111beac6`, and `6129e7bd` are ancestors of HEAD.
