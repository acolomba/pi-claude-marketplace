---
phase: 01-pi-1-0-floor-and-adapter-only-detection
plan: 09
subsystem: live-uat
tags: [live-uat, canaries, pi-1.0, workflow-engine, stop-hook]

requires:
  - phase: 01-pi-1-0-floor-and-adapter-only-detection
    provides: "Pi 1.0.0 in package-lock.json and node_modules (01-01); the final extension tree every earlier plan produced (01-02..01-08)"
provides:
  - "tests/live-uat/openai-stub-server.mjs: keyless loopback OpenAI-compatible chat-completions stub (STUB_PORT, STUB_HTTP_LOG)"
  - "tests/live-uat/stop-canary.mjs on the Pi 1.0.0 floor: capWarningNeedsHuman, stopRegression(reason), capBoundFailure returning { kind, reason }, the child's own exit status, exit 2 for a proven STOP-07 regression"
  - "Verbatim Pi 1.0.0 Stop evidence and engine 3.13.1 / Pi 1.0.0 evidence in tests/live-uat/README.md"
  - "scripts/pi.sh companion pins: pi-mcp-adapter@5.0.0, pi-subagents@0.74.0, @quintinshaw/pi-dynamic-workflows@3.13.1"
  - "docs/workflows-compatibility.md graded against the 3.13.0 -> 3.13.1 body diff and the 3.13.1 canary runs"
affects: [live-uat, workflows-compatibility, launcher]

actuals:
  tokens: 26000
  tasks: 3
  commits: 2
plan_head_before: 374bf698681173784723065a2c530089c64ffa90
plan_head_after: e911c06d4a26772b42034207c960e1ae39e0de8c

tech-stack:
  added: []
  patterns:
    - "A live canary separates a proven regression (exit 2) from the expected human_needed result and from an inconclusive drive (both exit 1), so a script that reads only the exit code can tell them apart"
    - "A canary reads its child's { code, signal } from close and defines a normal end as an explicit exit code, never as the harness timer not firing"

key-files:
  created:
    - tests/live-uat/openai-stub-server.mjs
    - .planning/phases/01-pi-1-0-floor-and-adapter-only-detection/deferred-items.md
  modified:
    - tests/live-uat/stop-canary.mjs
    - tests/live-uat/manifest-absence-canary.mjs
    - tests/live-uat/README.md
    - tests/live-uat/workflow-storage-canary.mjs
    - .fallowrc.json
    - scripts/pi.sh
    - docs/workflows-compatibility.md
    - .planning/codebase/CONVENTIONS.md
    - .planning/codebase/STACK.md

key-decisions:
  - "The Stop canary's cap check has four rows keyed on `settled` (exit 0, no signal, no timeout): above the cap and at the cap without a normal end are regressions (exit 2), below the cap without a normal end is inconclusive (exit 1), below the cap after a normal end is a regression (exit 2); an agent_settled count that differs from the block count is also a regression"
  - "The retained epilogue clone dup:cc950b18:2 no longer matches after the exit-code change, so it was removed from .fallowrc.json with both drivers' justification paragraphs; the spawn/close clone between the two drivers existed before this plan, is not suppressed, and stays below the 3% gate"
  - "Every canary passed, so the D-01-08 failure path did not fire: BACKLOG.md, WINDOWS.md and the PIFL-07 text are unchanged"

patterns-established:
  - "A regression exit code is proven by a planted copy of the canary that breaks the contract constant, run once and deleted"

requirements-completed: [PIFL-07]

coverage:
  - id: D1
    description: "Stop canary ported to the Pi 1.0.0 floor with IN-01 (cap-trip warning wording, capWarningNeedsHuman), IN-08 (child exit status, settled flag, agent_settled equals blocks), IN-09 (observation-only at-cap row) and IN-10 (stopRegression, exit 2); keyless stub server added"
    requirement: PIFL-07
    verification:
      - kind: other
        ref: "TMPDIR=/var/tmp/mcp4-uat PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/agent node tests/live-uat/stop-canary.mjs (blocks=8, agent_settled=8, turn_start=8, pi exit 0, STOP-01 and STOP-03 PASS, cap-trip warning -> human_needed, STOP_EXIT=1, the documented expected-headless code)"
        status: pass
      - kind: other
        ref: "planted copy with STOP_OVERRIDE_CAP=7: STOP-07 REGRESSION -- failed:, STOP_PLANTED_EXIT=2"
        status: pass
      - kind: other
        ref: "negative controls: PI_CODING_AGENT_DIR unset -> STOP_NEG_UNSET_EXIT=1; PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/../../.pi/agent -> STOP_NEG_ESCAPE_EXIT=1; both LIVE RUNTIME REQUIRED"
        status: pass
      - kind: other
        ref: "npm run fallow (tmp/p09-t1-fallow.log, exit 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both engine canaries pass at @quintinshaw/pi-dynamic-workflows 3.13.1 with the scratch prefix's pi-coding-agent at 1.0.0; --invert controls fail at A1 and [user] W2; the unset-root control routes to LIVE ENGINE REQUIRED"
    requirement: PIFL-07
    verification:
      - kind: other
        ref: "workflow-agent-failure-canary.mjs: A0-A3 PASS, EXIT=0; --invert: FAILED A1, EXIT=1"
        status: pass
      - kind: other
        ref: "workflow-storage-canary.mjs: W0 and both scopes' W1-W5 PASS, EXIT=0; --invert: FAIL [user] W2, EXIT=1; PI_WORKFLOW_ENGINE_ROOT unset: LIVE ENGINE REQUIRED, EXIT=1"
        status: pass
    human_judgment: false
  - id: D3
    description: "tests/live-uat/README.md records every run verbatim under dated Observed result headings naming pi 1.0.0 (and engine 3.13.1), keeps exactly four ## sections, and keeps the 0.80.10 Stop result as history"
    requirement: PIFL-07
    verification:
      - kind: other
        ref: "grep -n '^## ' tests/live-uat/README.md (4 headings, unchanged); rg -n 'Observed result \\(2026-09-21, engine 3\\.13\\.0\\)' tests/live-uat/README.md (no output)"
        status: pass
    human_judgment: false
  - id: D4
    description: "scripts/pi.sh pins pi-mcp-adapter@5.0.0, pi-subagents@0.74.0 and @quintinshaw/pi-dynamic-workflows@3.13.1; entry paths exist in the three tarballs"
    requirement: PIFL-07
    verification:
      - kind: other
        ref: "rg -n 'pi-mcp-adapter@5\\.0\\.0|pi-subagents@0\\.74\\.0|pi-dynamic-workflows@3\\.13\\.1' scripts/pi.sh (3 lines); ls ad/package/index.ts sa/package/index.js b/package/extensions/workflow.ts in the unpacked tarballs"
        status: pass
    human_judgment: false
  - id: D5
    description: "docs/workflows-compatibility.md re-graded: runtime claims at 3.13.1, source-read claims stamped unchanged at 3.13.1 only where every cited body is byte-identical, the errors.ts/agent.ts change described, the engine bullet names 3.13.1"
    requirement: PIFL-07
    verification:
      - kind: unit
        ref: "node --test tests/architecture/workflows-doc-pins.test.ts (tmp/p09-t3-docpins.log: 4 pass, 0 fail, EXIT=0)"
        status: pass
      - kind: other
        ref: "diff -rq a/package/src b/package/src and cmp of every cited file (see Tarball diff)"
        status: pass
    human_judgment: false

duration: 16 min
completed: 2026-10-02
status: complete
---

# Phase 1 Plan 09: Live canaries on Pi 1.0 Summary

**The Stop canary runs live on Pi 1.0.0 against a keyless loopback stub (8 blocks, 8 settles, 8 turns, pi exit 0, expected exit 1), a proven STOP-07 regression now exits 2, both engine canaries pass at 3.13.1 with Pi 1.0.0 underneath, the launcher pins the new companions, and the compatibility doc is graded against the measured 3.13.0 -> 3.13.1 diff.**

## Performance

- **Duration:** 16 min to this SUMMARY (the single pre-commit run follows it)
- **Started:** 2026-10-02T22:50:15Z
- **Completed:** 2026-10-02T23:06:00Z
- **Tasks:** 3 of 3
- **Files modified:** 11 (9 modified, 2 created) plus tracking files

## Accomplishments

- Stop canary ported as one specification from `4f82096f`, `0febc4ea`, `4460d902` and `e0ccc16e`, with IN-01, IN-08, IN-09 and IN-10 closed. The floor precondition reads Pi `1.0.0`.
- Keyless stub server added at `tests/live-uat/openai-stub-server.mjs` with the live-UAT `fallow-ignore-file unused-file` marker. It binds `127.0.0.1` and logs no headers. No spike directory exists.
- Live Stop run on Pi 1.0.0, both negative controls, and a planted regression control, all recorded.
- Both engine canaries and three controls at engine 3.13.1 with the engine's Pi peer at 1.0.0, all recorded.
- `scripts/pi.sh` pins `pi-mcp-adapter@5.0.0`, `pi-subagents@0.74.0`, `@quintinshaw/pi-dynamic-workflows@3.13.1`.
- `docs/workflows-compatibility.md` re-graded for 3.13.1 from the tarball diff and the new runs.

## Task Commits

1. **Task 1: Stop canary on Pi 1.0 end to end** - `5df69d88` (`test(live-uat): run the Stop canary on Pi 1.0`)
2. **Tasks 2 and 3: engine canaries, launcher pins and doc re-grade** - `e911c06d` (`docs: record the engine canaries and re-grade for 3.13.1`). Task 2 is staged, not committed, by plan design; Task 3 commits both.

**Plan metadata:** the docs commit that follows them (this SUMMARY, `deferred-items.md`, STATE, ROADMAP, REQUIREMENTS, state.json).

Both code commit SHAs were fixed before the pre-commit run, as in earlier plans. Each object was built with `git commit-tree` from a temporary index. Tree `ff1393d9` is HEAD plus the five Task 1 files; its README holds HEAD's text above `## Stop contract canary` and the new Stop section below it. Tree `e27d6463` is that tree plus the six Task 2-3 files. Dates are pinned to `2026-10-02T23:40:00+0000` and `23:41:00+0000`. `git commit` then uses the same trees, parents, dates and messages.

## Live runs (verbatim exit lines)

All runs used the committed bytes (`sha256sum` taken before each batch; no canary file changed afterward). Scratch root `/var/tmp/mcp4-uat`; sandboxes under `tmp/pi-uat`; nothing pointed at `~/.pi/agent`.

**Stop canary** (`/var/tmp/mcp4-uat/stop.log`), run 2026-10-02T22:55:13Z. Excerpt only: `...` marks elided text and the explanatory lines after the routing header are omitted; the README carries the full output verbatim.

```text
[stop-canary] PASS: live pi 1.0.0 (.../node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js) >= 1.0.0, sandbox .../tmp/pi-uat/agent
[stop-canary] observed: Stop-hook blocks=8, agent_settled=8, turn_start=8, cap=8, capWarning=false.
[stop-canary] drive: pi exited with code 0.
[stop-canary] PASS: STOP-01: ...
[stop-canary] PASS: STOP-03: ... (8 turns for one prompt; ...)
[stop-canary] SCRIPTABLE HALF PROVEN, cap-trip warning -> human_needed:
STOP_EXIT=1
```

The stub logged **8** requests (`STUB_REQUESTS=8`, one line per turn, `"stream":true`, `"tools":[]`). The healthy run's pi exit code is 0, so `PI_NORMAL_EXIT_CODE = 0` needs no exception comment.

| Run | Command (all with `TMPDIR=/var/tmp/mcp4-uat`) | Exit line |
| --- | --- | --- |
| Stop, healthy | `PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/agent node tests/live-uat/stop-canary.mjs` | `STOP_EXIT=1` (expected headless code) |
| Stop, control: unset | `env -u PI_CODING_AGENT_DIR node tests/live-uat/stop-canary.mjs` | `STOP_NEG_UNSET_EXIT=1`, `LIVE RUNTIME REQUIRED` |
| Stop, control: escape | `PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/../../.pi/agent node tests/live-uat/stop-canary.mjs` | `STOP_NEG_ESCAPE_EXIT=1`, `LIVE RUNTIME REQUIRED` |
| Stop, planted regression | temporary copy with `STOP_OVERRIDE_CAP = 7`, deleted after | `STOP_PLANTED_EXIT=2`, `STOP-07 REGRESSION -- failed:` |
| Engine agent | `PI_WORKFLOW_ENGINE_ROOT=/var/tmp/mcp4-uat/wf-engine/node_modules PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/wf-agent node tests/live-uat/workflow-agent-failure-canary.mjs` | A0-A3 PASS, `EXIT=0` |
| Engine agent `--invert` | same, `--invert` | `[wf-agent-canary] FAILED:` at A1, `EXIT=1` |
| Engine storage | same root, `PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/wf-store node tests/live-uat/workflow-storage-canary.mjs` | W0, `[user]` and `[project]` W1-W5 PASS, `EXIT=0` |
| Engine storage `--invert` | same, `--invert` | `FAIL: [user] W2`, `EXIT=1` |
| Engine storage, root unset | `env -u PI_WORKFLOW_ENGINE_ROOT ...` | `LIVE ENGINE REQUIRED`, `EXIT=1` |

Scratch engine: `TMPDIR=/var/tmp/mcp4-uat npm install --prefix /var/tmp/mcp4-uat/wf-engine @quintinshaw/pi-dynamic-workflows@3.13.1` (`INSTALL_EXIT=0`, no `--ignore-scripts`). `@earendil-works/pi-coding-agent` in that prefix reported `1.0.0`; the engine reported `3.13.1`. npm 11.19.1 printed `install-scripts ... not yet covered by allowScripts` for `@google/genai`, `esbuild` and `protobufjs`; the canaries passed regardless. The prefix, `tmp/pi-uat/wf-agent`, `tmp/pi-uat/wf-store` and `tmp/pi-uat/agent` were removed; `tmp/pi-uat` is empty.

## Tarball diff (D-01-10)

`npm pack @quintinshaw/pi-dynamic-workflows@3.13.0 @quintinshaw/pi-dynamic-workflows@3.13.1` in `/var/tmp/mcp4-uat/pack`, then `diff -rq a/package/src b/package/src`:

```text
Files a/package/src/agent.ts and b/package/src/agent.ts differ
Files a/package/src/display.ts and b/package/src/display.ts differ
Files a/package/src/errors.ts and b/package/src/errors.ts differ
Files a/package/src/pi-extension.ts and b/package/src/pi-extension.ts differ
Files a/package/src/workflow-authoring-coverage.ts and b/package/src/workflow-authoring-coverage.ts differ
Files a/package/src/workflow-commands.ts and b/package/src/workflow-commands.ts differ
```

`cmp` of every cited file: identical `workflow.ts`, `saved-commands.ts`, `workflow-saved.ts`, `workflow-paths.ts`, `workflow-tool.ts`, `workflow-capability-contract.ts`, `workflow-manager.ts`; changed `pi-extension.ts`, `errors.ts`, `agent.ts`. `diff -u` of `pi-extension.ts` is one added line, `export { installHostCreateAgentSession } from "./agent.js";`, so the session-start registration body the doc cites is byte-identical. `errors.ts` widens `classifyProviderLimit` with `out of\s+(?:your\s+)?(?:extra|included)\s+usage`. `agent.ts` adds `installHostCreateAgentSession` and `throwIfAssistantError`, which throws a recoverable `AGENT_EXECUTION_ERROR` when the provider ends the turn with an error. The `acorn` range (`^8.16.0`) and the peers (`pi-coding-agent >=0.80.8`, `pi-tui >=0.80.6`) are the same in both. `extensions/workflow.ts` also changed (it calls `installHostCreateAgentSession`); the doc cites it nowhere.

### Remaining `3.13.0` sites in docs/workflows-compatibility.md

| Line | Site | Why it keeps 3.13.0 |
| --- | --- | --- |
| 7 | "re-read against 3.13.0, published 2026-09-20, and against 3.13.1" | provenance history; 3.13.1 added beside it |
| 11 | grade definition: diffed 3.10.1 -> 3.13.0 and 3.13.0 -> 3.13.1 | describes the diff chain |
| 12 | grade label list | `runtime-measured at 3.13.0` is still used at :222 |
| 19 | "At 3.13.0 and at 3.13.1 the bodies ... sit roughly 110 lines lower" | `workflow.ts` is byte-identical at 3.13.1, so both carry the line numbers |
| 119 | "source-read at 3.13.0 ...; unchanged at 3.13.1" | the original read was at 3.13.0 |
| 146, 154, 160 | "runtime-measured at 3.10.1, at 3.13.0 and at 3.13.1" | measurement history |
| 156 | "came back at 3.13.0, and again at 3.13.1" and the errors.ts/agent.ts change | history plus the one added sentence for the changed bodies |
| 192 | "the same floors 3.10.1 and 3.13.0 declared" | peer history |
| 196 | manual saved-workflow run on Pi 0.86.1 + engine 3.13.0 (2026-09-23) | dated runtime observation; no canary re-measures it |
| 198 | "Engine 3.13.0 still has two visible limits" | dated runtime observation; no canary re-measures it |
| 220 | "60 versions ... through `3.13.0` on 2026-09-20" | dated registry count; not re-measured |
| 222 | "runtime-measured at 3.13.0, and at 3.13.1" | measurement history |

No claim stamped `unchanged at 3.13.0` cites a body that changed, so none keeps that stamp. The `errors.ts` and `agent.ts` citations never carried an "unchanged" stamp; they keep their 3.10.1 grade and the change is described at :156.

## Verification Evidence

Focused task verification passed; full phase/PR verification pending.

- **Task 1 tracer verify** (re-run before expansion): `STOP_EXIT=1`, both `PASS: STOP-0` lines, four `##` headings, `npm run fallow` exit 0 (`tmp/p09-t1-fallow.log`) -> `T1_VERIFY_EXIT=0`. `workflow.auto_advance` is false and the verify is automated-only, so the re-run was the gate. Its pre-commit clause is covered by the single run below.
- **Task 1 acceptance:** `rg -n '0\.86\.1|0\.99\.2|capNeedsHumanDrive|un-sustainable' tests/live-uat/stop-canary.mjs` printed nothing; `grep -n 'STOP-07 REGRESSION'` shows the helper at line 123; the README's cap-check table and the `agent_settled` bullet state exit 2; `head -n 6` of the stub contains the marker and line 26 binds `127.0.0.1`; `test -d .planning/spikes/028-pi-099-builtin-mcp` fails.
- **fallow dupes:** before the edits the epilogue clone was suppressed (`clone_groups_ignored: 1`). After them no group matched the entry; with the entry removed, no epilogue clone is reported. The spawn/close clone `dup:c77b3abb6f87acd9-r24` (now `-r7`) existed before this plan and is not suppressed. Duplication 1.47%, gate 3%, `DUPES_EXIT=0`.
- **Task 2 acceptance:** the three pin lines; `rg -n '3\.13\.0' scripts/pi.sh tests/live-uat/workflow-storage-canary.mjs` printed nothing; the old `Observed result (2026-09-21, engine 3.13.0)` headings are gone; four `##` headings.
- **Task 3:** `node --test tests/architecture/workflows-doc-pins.test.ts` -> 4 pass, 0 fail, `EXIT=0` (`tmp/p09-t3-docpins.log`); the engine bullet greps at line 192.
- **Fallow audit:** `fallow audit --format json --quiet --explain --gate-marker agent` gives verdict `warn`, not `fail`, with 0 dead-code issues and 0 complexity findings (`tmp/p09-fallow-audit.json`).
- **Commit messages:** `pre-commit run gitlint --hook-stage commit-msg` passed for both.
- **Pre-commit:** one run covers both code commits and the docs commit, per the operator's pay-once rule: `TMPDIR=/var/tmp/mcp4-p09 SKIP=trufflehog pre-commit run --files <11 code paths + this SUMMARY, deferred-items.md, STATE.md, ROADMAP.md, REQUIREMENTS.md, state.json>`, log `tmp/p09-precommit.log`. `git commit` runs only after that log ends with `PRECOMMIT_EXIT=0`. A failed hook means no commit.

## Files Created/Modified

- `tests/live-uat/openai-stub-server.mjs` - keyless loopback chat-completions stub
- `tests/live-uat/stop-canary.mjs` - Pi 1.0.0 floor, exit-code contract, `capBoundFailure`, `stopRegression`, `capWarningNeedsHuman`, child exit status
- `tests/live-uat/manifest-absence-canary.mjs` - retained-clone paragraph removed; the pi-runtime paragraph stands alone
- `tests/live-uat/README.md` - Stop prerequisites, stub route, routing table, Pi 1.0.0 evidence; engine sections at 3.13.1
- `tests/live-uat/workflow-storage-canary.mjs` - install example names 3.13.1
- `.fallowrc.json` - `duplicates.ignoredClones` removed
- `scripts/pi.sh` - companion pins and comment
- `docs/workflows-compatibility.md` - 3.13.1 re-grade
- `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/STACK.md` - marker recount and no retained clone
- `.planning/phases/01-pi-1-0-floor-and-adapter-only-detection/deferred-items.md` - two out-of-range stale wordings

## Decisions Made

- The at-cap row covers every abnormal end (timeout, non-zero exit, signal), not only the timeout, and states which one it saw. A slow but healthy run that hits the 120-second timeout at 8 blocks still reads as a regression; the message says what was observed and names no cause (IN-09).
- An `agent_settled` count that differs from the block count routes to `stopRegression` (exit 2): the healthy run settles once per block, so a mismatch is a structural deviation, not missing evidence.
- CONVENTIONS.md and STACK.md travel with the docs commit, as the plan's Task 3 groups them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pi-runtime paragraph left dangling after the clone paragraph was removed**
- **Found during:** Task 1, step 3
- **Issue:** both drivers' next paragraph said "The no-sibling-import rule above covers `tests/live-uat/` siblings", and the rule lived in the removed paragraph.
- **Fix:** restated it in place: each driver imports nothing from a sibling, so it runs on its own and one bad edit cannot fail two canaries.
- **Files modified:** `tests/live-uat/stop-canary.mjs`, `tests/live-uat/manifest-absence-canary.mjs`
- **Committed in:** `5df69d88`

**2. [Rule 1 - Bug] CONVENTIONS.md and STACK.md described the removed clone entry**
- **Found during:** Task 3, step 3
- **Issue:** CONVENTIONS.md said `ignoredClones` holds `dup:cc950b18:2`, and STACK.md said one ignored clone is pre-approved. The marker sentence also said 11 and named a `scripts/revalidation.mjs` marker that no longer exists.
- **Fix:** both sentences rewritten from the recount (13 lines: 10 markers, 3 string fixtures) and the empty `ignoredClones`. STACK.md is outside the plan's file list.
- **Files modified:** `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/STACK.md`
- **Committed in:** `e911c06d`

**3. [Operator rule] One pre-commit run instead of `tmp/p09a-precommit.log` and `tmp/p09b-precommit.log`**
- **Found during:** commit preparation
- **Issue:** the plan runs the hooks twice. Both runs widen to the full `npm run check` (`.fallowrc.json`, `.mjs` drivers, `state.json`), and the operator rule says to pay it once.
- **Fix:** one run over every path of all three commits, log `tmp/p09-precommit.log`; the code commit SHAs were fixed first with `git commit-tree`.
- **Committed in:** n/a

**4. [Rule 2 - Missing critical] Planted regression control**
- **Found during:** Task 1, step 4
- **Issue:** IN-10's exit 2 had no run proving it fires.
- **Fix:** a temporary copy with the cap constant at 7, run once and deleted; it exited 2. Recorded in the README.
- **Committed in:** `5df69d88` (README record)

---

**Total deviations:** 4 (1 blocking, 1 bug, 1 operator rule, 1 missing critical). **Impact:** no scope change; the clone removal the plan anticipated made two notes stale, and one control was added.

## Issues Encountered

- Two stale wordings sit outside the plan's edit range and are logged in `deferred-items.md`: the Stop human-checklist intro and item 4 still say headless Pi cannot sustain the loop, and the agent-failure canary's install comment names 3.10.1 under `/tmp`.

- The state verbs left `last_activity_desc` and the Current Position "Last activity" line naming 01-08; both were hand-edited to name 01-09. `state.advance-plan` reported `last_plan` and set the status to ready for verification.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PIFL-07 is met without the D-01-08 path: the Stop canary passes its scriptable half on Pi 1.0.0, both engine canaries pass at 3.13.1 with Pi 1.0.0 underneath, and the launcher pins the three companions.
- The STOP-07 cap-trip warning remains the standing interactive item 4 in the README checklist; print/json mode cannot show `ctx.ui.notify`.
- This is the last plan of the phase. The phase gate needs the full `npm run check` on the combined tree.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-01-SC: the engine install went to `/var/tmp/mcp4-uat/wf-engine` only, its Pi peer was checked, the prefix was deleted, and `package.json`/`package-lock.json` are untouched. T-01-16: both Stop controls and the storage unset-root control ran and refused. T-01-17: the stub binds `127.0.0.1`, logs time, URL, stream flag and tool names only, and the sandbox key is the literal `stub`. T-01-18: every README block is copied from an unpiped log ending in an exit line.

## Self-Check: PASSED

- `tests/live-uat/openai-stub-server.mjs` and `deferred-items.md` exist; the nine modified files carry the changes above; this SUMMARY exists.
- `5df69d88` and `e911c06d` exist as commit-tree objects (`git cat-file -t` reports `commit`) over trees `ff1393d9` and `e27d6463`; `git rev-list --count 374bf698..e911c06d` is 2. `git commit` makes them the plan's code commits only after `tmp/p09-precommit.log` ends with `PRECOMMIT_EXIT=0`.
- Every acceptance criterion of Tasks 1-3 was re-run and passed, except the two per-task pre-commit logs, replaced by the single run (deviation 3).
