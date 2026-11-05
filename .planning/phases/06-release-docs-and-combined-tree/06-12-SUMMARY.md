---
phase: 06-release-docs-and-combined-tree
plan: "12"
subsystem: testing
tags: [gate, cucumber, ci, fallow, mcp-builtin]

requires:
  - phase: 06-release-docs-and-combined-tree
    provides: "06-01..06-11 merged (waves 1-3): the DUAL-04 row, the MDOC-02 docs (06-06, 06-10), the code and harness changes, and the codebase maps"
provides:
  - "The combined-tree gate on one commit (a7f73bf): every npm run check part in CI order, test:modules, and both e2e parts exit 0"
  - "The D-P6-06 per-feature, per-profile re-verification table"
  - "06-CI-HANDOFF.md: the parent's push, dispatch, timing, and D-CF1-16 amendment checklist"
affects: [06-13 records, parent CI dispatch, PROJECT.md D-CF1-16, milestone audit]

actuals:
  tokens: 2030
  tasks: 3
  commits: 1
plan_head_before: a7f73bf828f3fef77c55eaf4743e1ae220d0e291
plan_head_after: 9e9c116

tech-stack:
  added: []
  patterns:
    - "The gate runs as one script that logs each part's command, start, end, and exit status, so the record is the log"

key-files:
  created:
    - .planning/phases/06-release-docs-and-combined-tree/06-CI-HANDOFF.md
  modified: []

key-decisions:
  - "The gate commit is the wave 4 base a7f73bf: no part failed, so no product commit was needed"
  - "The builtin profile runs one implementation-switch scenario (MREC-02, @mcp), so it got a row, though the plan expected none"

patterns-established:
  - "A gate record names each CI leg's scenarios, steps, wall time, and seed beside the sha and Node version"

requirements-completed: [DUAL-04, MDOC-02, DUAL-03]

coverage:
  - id: D1
    description: "DUAL-04: the switch scenario passes on the gate tree"
    requirement: DUAL-04
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter --name \"moves from pi-mcp-adapter to pi's built-in mcp\" features/mcp-server/implementation-switch.feature (1 scenario (1 passed), seed 111322)"
        status: pass
    human_judgment: false
  - id: D2
    description: "MDOC-02: the built-in support statements are in the CHANGELOG, both READMEs, and the hooks doc"
    requirement: MDOC-02
    verification:
      - kind: other
        ref: "06-12-PLAN.md Task 1 third <automated> node check (exit 0, no missing line)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ROADMAP Phase 6 criterion 3, local part: npm run check (both profiles) and test:modules on one commit; no clone group"
    requirement: DUAL-03
    verification:
      - kind: other
        ref: "gate.sh on a7f73bf: 7 check parts and unit exit 0; npx fallow dupes --fail-on-issues exit 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Criterion 3's CI part and the DUAL-03 re-measure on the combined tree"
    requirement: DUAL-03
    verification: []
    human_judgment: true
    rationale: "Executors have no GitHub tools; the parent dispatches ci.yml and records the timings per 06-CI-HANDOFF.md"

duration: 31min
completed: 2026-11-05
status: complete
---

# Phase 6 Plan 12: Combined-tree gate and CI handoff Summary

**On a7f73bf, the whole gate passes: every `npm run check` part in CI order (adapter 1168 + 435 = 1603 scenarios, builtin 133), `npm run test:modules`, and both e2e parts. The D-P6-06 files pass per profile, `fallow dupes` reports no clone group, DUAL-04 and MDOC-02 hold, and 06-CI-HANDOFF.md gives the parent the CI checklist. The CI part of criterion 3 stays unverified until the parent's run.**

## Performance

- **Duration:** 31 min
- **Started:** 2026-11-05T02:38:00Z
- **Completed:** 2026-11-05T03:09:30Z
- **Tasks:** 3
- **Files modified:** 1 (plus this SUMMARY)

## Accomplishments

- The merge procedure's re-verifications (D-P6-06) pass per feature file and per profile on a7f73bf.
- DUAL-04's switch scenario passes, and the MDOC-02 check finds every statement.
- `npx fallow dupes` reports no clone group.
- The gate passes on one commit: 7 `check` parts, `unit`, `e2e-install`, and `e2e` all exit 0, with a fresh ESLint cache.
- 06-CI-HANDOFF.md hands the CI measurement and the D-CF1-16 sentence to the parent.

## Task Commits

1. **Task 1: re-verifications, DUAL-04, MDOC-02** - no commit (read-only runs; nothing failed, so no fix)
2. **Task 2: the whole gate on one commit** - no commit (read-only runs on a7f73bf; nothing failed)
3. **Task 3: the CI handoff** - `9e9c116` (docs)

## Gate record

- **Commit:** `a7f73bf828f3fef77c55eaf4743e1ae220d0e291` (`git rev-parse HEAD` at gate start). `git status --porcelain` was empty before and after.
- **Node:** v24.22.1.
- **Install:** `npm ci --ignore-scripts --no-audit --no-fund` in the worktree before every run (exit 0, 395 packages), replacing the SubagentStart hook's `npm install`, so the gate matches CI's install. `/tmp/jiti` existed.
- **ESLint cache:** gate.sh deleted `node_modules/.cache/eslint/` first; the verify check (cache absent or newer than `package.json`) exits 0.
- **Script:** `scratchpad/exec-06-12/gate.sh` (run with `run_in_background`), log `scratchpad/exec-06-12/gate.log`, 2026-11-05T02:49:29Z to 03:07:30Z (18 min).

| # | Label | Command | Exit | Duration | Counts and seed |
| --- | --- | --- | --- | --- | --- |
| 1 | check | `npm run check:static` | 0 | 190 s | typecheck 43.5 s, lint 189.6 s (empty cache), lint:workflows 0.4 s, fallow 9.2 s, format:check 60.7 s, test:corresponding 5.2 s, check:features 8.5 s |
| 2 | check | `npm run test:unpaired` | 0 | 19 s | quiet reporter, no failure |
| 3 | check | `npm run test:integration` | 0 | 32 s | quiet reporter, no failure |
| 4 | check | `npm run test:cucumber:profile -- --profile adapter features/marketplace features/plugin` | 0 | 146 s | 1168 scenarios (1168 passed), 12026 steps, cucumber 2m 23.674s, seed 639458 |
| 5 | check | `npm run test:cucumber:profile -- --profile adapter features/skill features/slash-command features/agent features/hook features/mcp-server features/workflow` | 0 | 256 s | 435 scenarios (435 passed), 5371 steps, cucumber 4m 13.750s, seed 958366 |
| 6 | check | `npm run test:cucumber:profile -- --profile builtin features` | 0 | 69 s | 133 scenarios (133 passed), 1681 steps, cucumber 1m 5.926s, seed 68105 |
| 7 | check | `npm run test:coverage:direct:all` | 0 | 175 s | `Merged LCOV: coverage/direct.lcov (350 records)` |
| 8 | unit | `npm run test:modules` | 0 | 173 s | quiet reporter, no failure |
| 9 | e2e-install (recorded) | `npm --prefix test/e2e/pi-peer-floor ci --ignore-scripts` | 0 | 6 s | 123 packages added |
| 10 | e2e (recorded) | `npm run test:e2e` | 0 | 15 s | installed runtime and peer floor both Pi 1.5.0: text, json, and rpc outcomes validated, zero session files |

The log has 7 `check exit status 0` lines and 1 `unit exit status 0` line. No flake rerun was needed: neither `lifecycle.feature` "A new session offers the plugin's tool again" nor the cold-`/tmp/jiti` TUI timeout occurred. No e2e part is deferred: both reached the network they needed and passed, so the gate record has no `network-unavailable` line.

The adapter profile ran 1603 scenarios and the builtin profile 133, the same totals as the parent's post-merge `npm run check` on 715e869 (12m50s, adapter 1603/1603, builtin 133/133). 715e869 has the same product tree as a7f73bf, which adds only a ROADMAP tracking commit. The parent's runs and this gate agree.

**Build-input check after the gate:** `git diff a7f73bf HEAD -- . ':(exclude,glob).planning/**/*.md'` prints nothing at 9e9c116, so the gate stands for this plan's head.

**CI:** ROADMAP Phase 6 criterion 3's CI part ("CI within its timeouts") and DUAL-03's re-measure on the combined tree are unverified until the parent dispatches `ci.yml` and records the run in 06-CI-HANDOFF.md `## CI timings`.

## D-P6-06 re-verification

All rows ran on a7f73bf, Node v24.22.1, one feature file per command (`npm run test:cucumber:profile -- --profile <profile> <file>`), from `scratchpad/exec-06-12/reverify.sh` and `task1-extra.sh`.

| Feature file | Profile | Scenarios run | Passed | Seed | Note |
| --- | --- | --- | --- | --- | --- |
| features/mcp-server/implementation-switch.feature | adapter | 3 | 3 | 73663 | the switch scenario, the MSEL-04 restart scenario, and MREC-02 |
| features/mcp-server/implementation-switch.feature | builtin | 1 | 1 | 603017 | MREC-02 (`@mcp`); the two `@own-implementation` restart scenarios do not run here, by tag design |
| features/mcp-server/builtin-status.feature | adapter | 0 | 0 | 627528 | by tag design: the file is `@builtin-only` (exit 0) |
| features/mcp-server/builtin-status.feature | builtin | 8 | 8 | 908062 | Phase 2's `info` status scenarios, with their `plugin requires` and `plugin status` rows |
| features/hook/mcp-tool-names.feature | adapter | 2 | 2 | 545495 | |
| features/hook/mcp-tool-names.feature | builtin | 3 | 3 | 718717 | |
| features/hook/tool-use.feature | adapter | 21 | 21 | 727179 | |
| features/hook/tool-use.feature | builtin | 2 | 2 | 772389 | |
| features/mcp-server/agent-grants.feature | adapter | 13 | 13 | 948744 | 04-06 item 11 named 12 before Phase 6 |
| features/mcp-server/agent-grants.feature | builtin | 6 | 6 | 370980 | 04-06 item 11 named 5 before Phase 6 |

**DUAL-04:** `npm run test:cucumber:profile -- --profile adapter --name "moves from pi-mcp-adapter to pi's built-in mcp" features/mcp-server/implementation-switch.feature` exits 0 with `1 scenario (1 passed)`, 34 steps, seed 111322.

**fallow dupes:** `npx fallow dupes --fail-on-issues --format human --quiet` exits 0 with empty output: no clone group.

**MDOC-02:** the plan's third `<automated>` command exits 0 with no missing line. The `grep -n` line per file and per statement:

| File | Statement | Line |
| --- | --- | --- |
| CHANGELOG.md `[Unreleased]` (lines 3-26) | `requires mcp`, `requires pi-mcp-adapter`, `requires builtin mcp` | 11 |
| CHANGELOG.md | plugin MCP servers | 5 |
| CHANGELOG.md | turn on Pi's built-in MCP or install pi-mcp-adapter | 9 |
| CHANGELOG.md | the fold (`` `_` ``) | 23 |
| README.md | `{requires mcp}` / `{requires pi-mcp-adapter}` / `{requires builtin mcp}` | 183 / 184 / 185 |
| README.md | `### MCP implementations` | 159 |
| README.md | turn on Pi's built-in MCP or install pi-mcp-adapter | 163 |
| README.md | When both are loaded, pi-mcp-adapter runs | 165 |
| README.md | `my-db` row with `mcp__plugin_foo_my_db__` | 132 |
| README.md | links `#partially-available-plugins`, `#tool-search`, `#server-status-in-info`, `#user-overrides`, `#tool-search-and-mcp`, `#project-scope-servers`, `#name-length` | 169, 170, 171, 172, 173, 174, 175 (`#name-length` also at 126) |
| README.es.md | `{requires mcp}` / `{requires pi-mcp-adapter}` / `{requires builtin mcp}` | 183 / 184 / 185 |
| README.es.md | `### Implementaciones de MCP` | 159 |
| README.es.md | activa el MCP integrado de Pi o instala pi-mcp-adapter | 163 |
| README.es.md | Cuando los dos están cargados, pi-mcp-adapter ejecuta | 165 |
| README.es.md | `my-db` row with `mcp__plugin_foo_my_db__` | 132 |
| README.es.md | the same seven links | 169, 170, 171, 172, 173, 174, 175 (`#name-length` also at 126) |
| docs/hooks-compatibility.md | Under Pi's built-in MCP, a hook sees a tool as; `mcp__echo-server__echo_text`; `first 55 characters` | 148 (all three) |

No statement was missing, so no file of plans 06-06 or 06-10 changed.

## Owned parent lines

| Parent line | Outcome | Commit |
| --- | --- | --- |
| 01-14 "CI" (re-measure the behavioral legs on the combined tree) | Local legs measured on the gate (lifecycle 1168 in 2m 24s, components 435 in 4m 14s, builtin 133 in 1m 6s); the CI measurement is handed to the parent | 9e9c116 |
| 01-14 "PROJECT.md" (D-CF1-16 amendment text) | The sentence form with placeholders is in 06-CI-HANDOFF.md; PROJECT.md is not edited here | 9e9c116 |
| 02-08 item 9 (builtin-status `info` scenarios, switch restart results) | builtin-status builtin 8/8; implementation-switch adapter 3/3 and builtin 1/1, run on a7f73bf (the strict installs and AMIG-01 parts were settled by 06-10) | a7f73bf (verified, no change) |
| 02-08 item 19 (`npx fallow dupes`, the Phase 4 and 5 built-in scenarios) | `fallow dupes` exit 0, no clone group; agent-grants builtin 6/6, mcp-tool-names builtin 3/3, tool-use builtin 2/2 | a7f73bf (verified, no change) |
| 04-06 item 11 (agent-grants under both profiles) | adapter 13/13, builtin 6/6 | a7f73bf (verified, no change) |
| 05-04 item 7 (hook files under both profiles) | mcp-tool-names adapter 2/2 and builtin 3/3; tool-use adapter 21/21 and builtin 2/2 | a7f73bf (verified, no change) |
| 03-09 known-flake note | Carried into 06-CI-HANDOFF.md `## Known flakes`; it did not occur in this gate | 9e9c116 |

## Files Created/Modified

- `.planning/phases/06-release-docs-and-combined-tree/06-CI-HANDOFF.md` - the parent's CI checklist, timeout rule, and D-CF1-16 sentence.
- `.planning/phases/06-release-docs-and-combined-tree/06-12-SUMMARY.md` - this record.

## Decisions Made

- The gate ran on the base a7f73bf. No part failed, so no fix commit exists and the gate sha is the base.
- The builtin profile got an implementation-switch row (P6-DC-1201).

## Deviations from Plan

None that changed a file. Task 1 added one row the plan did not list (the builtin run of implementation-switch.feature, P6-DC-1201). That made the table more complete and changed nothing else.

## Issues Encountered

None. The worktree's command guard refused some compound shell commands, so the runs went through scripts in the scratch folder.

## User Setup Required

None. The parent dispatches CI per 06-CI-HANDOFF.md.

## Next Phase Readiness

Plan 06-13 can commit its planning Markdown on top. The build-input diff from a7f73bf must stay empty, or `npm run check` runs again. The parent then pushes `features/mcp-builtin`, dispatches `ci.yml`, and fills `## CI timings`.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-06-25: this executor pushed nothing. T-06-26: the handoff requires the empty build-input diff or a fresh `npm run check`. T-06-29: no e2e part was deferred. T-06-SC: the installs came from the committed locks (`npm ci --ignore-scripts`, the peer-floor `ci --ignore-scripts`).

## Window records

None. No stub, skipped test, unrun verify, or deviation was left open. The CI measurement is a parent step, which 06-CI-HANDOFF.md tracks.

## Dubious Choices

- **P6-DC-1201 (Low). A builtin row for implementation-switch.feature.** The plan said the builtin profile runs none of its scenarios, because they are `@own-implementation`. But the MREC-02 scenario is `@mcp`, and the builtin profile ran it (1/1, seed 603017). I added the row. Alternatives: follow the plan and leave the row out, or record it as "none by tag design", which would be false. A measured row is better evidence than a wrong note.
- **P6-DC-1202 (Low). The gate sha is the base a7f73bf.** The plan asks for the gate "on one commit". Nothing failed, so this plan made no product commit, and the gate ran on the base before the handoff commit. Alternatives: rerun the gate on 9e9c116 or on the SUMMARY commit. That would cost 18 minutes for the same build inputs. `git diff a7f73bf HEAD -- . ':(exclude,glob).planning/**/*.md'` is empty, so gates.md allows the reuse.
- **P6-DC-1203 (Low). A clean `npm ci --ignore-scripts` over the hook's install.** The SubagentStart hook had already run `npm install` with scripts. I ran `npm ci --ignore-scripts --no-audit --no-fund` once before the gate, so the gate's `node_modules` matches CI's. Alternative: keep the hook's install, which the orchestrator allowed. The lockfile did not change either way.
- **P6-DC-1204 (Low). The handoff ends with an empty `## CI timings` heading.** The plan asks for an empty `## CI timings` section (item 7) and also for a last line saying the CI part is unverified (item 9). Both cannot hold. I put the unverified line in a `## Status` section just before the empty heading, and repeated it at the top of the file. Alternative: put the line under `## CI timings`, which would make the section non-empty.
- **P6-DC-1205 (Low). The README `#name-length` line.** The first `grep -n` match for that link is line 126, in the naming paragraph. Line 175 is the item in the "pi-mcp-adapter adds" list. The table gives 175 and notes 126. The plan's check is file-wide, so either line satisfies it.
- **P6-DC-1206 (Low). The tracer re-check did not rerun the verify commands.** Task 1 is `type="tracer"`, and the gate says to rerun its `<verify>` before expanding. The three commands ran once, after the 10 re-verification runs, on the same sha. Task 2 then ran the whole gate on that sha, which covers the same files again. A second identical run would add nothing on unchanged inputs.

## Self-Check: PASSED

- FOUND: .planning/phases/06-release-docs-and-combined-tree/06-CI-HANDOFF.md
- FOUND: 9e9c116 (ancestor of HEAD)
- Task 2 checks: the ESLint cache check exit 0; 7 `check exit status 0` lines and 1 `unit exit status 0` line; `e2e-install` and `e2e` both `exit status 0`.
- Task 3 check: exit 0 (D-CF1-16, the builtin leg name, `## CI timings`, and 1.5 present; no deferral to carry).

---
*Phase: 06-release-docs-and-combined-tree*
*Completed: 2026-11-05*
