---
phase: 07-docs-and-live-proof
plan: 04
subsystem: testing
tags: [mcp, pi-mcp-adapter, live-uat, canary, tool-search, docs]

requires:
  - phase: 07-docs-and-live-proof
    provides: "07-02: the canary (sessions 1 and 2, M0-M4, I1, A1-A4) and the stub's route-b script"
provides:
  - "tests/live-uat/mcp-adapter-canary.mjs: route B in session 3 (B1-B4) and the two --no-extensions probe readings"
  - "tests/live-uat/README.md: the five-canary table, the STUB_SCRIPT and STUB_PORT=0 notes, and the MCP adapter canary section with both verbatim transcripts"
  - "Measured on Pi 1.0.0: --no-extensions drops tool_search; -e builtin:tool-search restores it"
affects: [07-05]

actuals:
  tokens: 10400
  tasks: 2
  commits: 2
plan_head_before: cc66ea613f663c4c82a4e99e030b0dcd7a48d23a
plan_head_after: 0bff6f9c2663b0b70260e4ac631c4da7d34a850e

tech-stack:
  added: []
  patterns:
    - "One route driver (proveRoute) with a route table serves both search routes, so A1-A4 and B1-B4 share code and print the same line shapes"
    - "Probe sessions use sendStep and closeSession directly, so a failed probe prints `not measured (<reason>)` and never routes the run"

key-files:
  created: []
  modified:
    - tests/live-uat/mcp-adapter-canary.mjs
    - tests/live-uat/README.md
    - .planning/codebase/CONVENTIONS.md

key-decisions:
  - "Route A and route B run through one proveRoute(route) driver instead of two near-identical functions; route A's output lines are unchanged"
  - "The --no-extensions probes are observed: lines only; they never change the exit code and print `not measured` on a failed session"

patterns-established:
  - "A live-UAT README Observed result is pasted from the log of the committed file, with a sha256 check that the file did not change after the final runs"

requirements-completed: [ADOC-02]

coverage:
  - id: D1
    description: "Route B in a fresh Pi session: info shows status unknown, tool_search loads mcp__plugin_echo_echo__echo_canary (undeclared in the first request, declared later), the call returns echo-canary:via-tool-search, info then shows connected"
    requirement: "ADOC-02"
    verification:
      - kind: other
        ref: "PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter TMPDIR=/var/tmp/mcp4-p7-04 node tests/live-uat/mcp-adapter-canary.mjs (tmp/p7-04-final.log PASS B1-B4, EXIT=0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The canary records whether Pi 1.0.0 declares tool_search under --no-extensions (no) and under --no-extensions -e builtin:tool-search (yes)"
    requirement: "ADOC-02"
    verification:
      - kind: other
        ref: "tmp/p7-04-final.log observed: lines for both probes"
        status: pass
    human_judgment: false
  - id: D3
    description: "The negative control exits 2 at A3 after A2 passed, on the committed canary"
    requirement: "ADOC-02"
    verification:
      - kind: other
        ref: "node tests/live-uat/mcp-adapter-canary.mjs --invert (tmp/p7-04-invert.log REGRESSION -- A3, EXIT=2)"
        status: pass
    human_judgment: false
  - id: D4
    description: "tests/live-uat/README.md documents the canary with every required part and both verbatim transcripts; every cited tests/ path resolves"
    requirement: "ADOC-02"
    verification:
      - kind: test
        ref: "tests/architecture/no-stale-test-citations.test.ts"
        status: pass
      - kind: other
        ref: "every line of tmp/p7-04-final.log found with grep -qxF in the README (tmp/p7-04-missing.txt empty)"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-10-09
status: complete
---

# Phase 7 Plan 04: Route B, the --no-extensions readings and the canary README Summary

**The live canary now proves both search routes on a real pi-mcp-adapter 5.2.0. In its own fresh Pi session, Pi's `tool_search` loads `mcp__plugin_echo_echo__echo_canary`, the call returns `echo-canary:via-tool-search`, and info goes from `status unknown` to `connected`. The canary also records that Pi 1.0.0 drops `tool_search` under `--no-extensions` and restores it with `-e builtin:tool-search`. The live-UAT README documents the canary with the verbatim output of a full run and of the control.**

## Performance

- **Duration:** about 11 min
- **Started:** 2026-10-09T22:32:30Z
- **Completed:** 2026-10-09T22:43:15Z
- **Tasks:** 2
- **Files modified:** 3

## Final run (`tmp/p7-04-final.log`, tail)

```text
[mcp-adapter-canary] PASS: B1: ASTAT-02: in a fresh deferred session info shows (status unknown)
[mcp-adapter-canary] observed: route B first model request tools: ["read","bash","edit","write","tool_search","pi_claude_marketplace_list","pi_claude_marketplace_plugin_list","mcp"]
[mcp-adapter-canary] PASS: B2: ANAME-01, ANAME-04: tool_search loaded mcp__plugin_echo_echo__echo_canary, declared only after the search
[mcp-adapter-canary] PASS: B3: ADOC-02: mcp__plugin_echo_echo__echo_canary returned "echo-canary:via-tool-search"
[mcp-adapter-canary] PASS: B4: ASTAT-01: after the first MCP use the adapter reports plugin_echo_echo_ connected and info shows (connected)
[mcp-adapter-canary] observed: --no-extensions: tool_search declared: no
[mcp-adapter-canary] observed: --no-extensions -e builtin:tool-search: tool_search declared: yes
[mcp-adapter-canary] all assertions proven; exit 0
EXIT=0
```

M0 to M4, I1 and A1 to A4 passed before these lines, with the same text as in 07-02.

## Negative control (`tmp/p7-04-invert.log`, tail)

The control ran on the committed canary before its PASS was recorded:

```text
[mcp-adapter-canary] PASS: A2: ANAME-01, ANAME-04: mcp({ search }) returned mcp__plugin_echo_echo__echo_canary, declared only after the search

[mcp-adapter-canary] ADOC-02 REGRESSION -- A3 failed:
  mcp__plugin_echo_echo__echo_canary returned "echo-canary:hi" (isError false); expected "echo-canary:inverted".
EXIT=2
```

## Readings

- **Reload count: 1.** M4 asserts it, and it matches the notice.
- **`--no-extensions`: `tool_search` declared: no.**
- **`--no-extensions -e builtin:tool-search`: `tool_search` declared: yes.** This is the expected reading, so the `scripts/pi.sh` fix from 07-01 rests on a measured fact.
- B2's first route B request did not declare the plugin tool. Route A's activation in session 2 was not persisted, so no `mcp-adapter.json` check was needed.

After every run, no `mcp-adapter-canary-*` sandbox was left under `/var/tmp/mcp4-p7-04`, and no stub or Pi process remained.

## Accomplishments

- Route B runs in session 3, a fresh Pi process. Both routes share one driver (`proveRoute`) with a route table.
- Two probe sessions record the `--no-extensions` facts as `observed:` lines. They never change the exit code.
- `tests/live-uat/README.md` has the five-canary table, the stub's `STUB_SCRIPT` and `STUB_PORT=0` notes, and the `## MCP adapter canary` section. The section has Prerequisites, Run, the assertions M0 to B4 with requirement IDs, What it records, the human_needed routing, the negative control, the 0.19.2 fixture capture, and both verbatim transcripts.
- `.planning/codebase/CONVENTIONS.md` counts the `fallow-ignore` markers correctly.

## Task Commits

1. **Task 1 (tracer): route B end to end** - `5e93f91c` `test(live-uat): find a plugin MCP tool through Pi's tool_search`
   - File: `tests/live-uat/mcp-adapter-canary.mjs`
   - Hook: `npm run check:commit` ran and passed. `SKIP=npm-check pre-commit` ended `PRECOMMIT_EXIT=0`. `fallow audit --base cc66ea61`: no issues in 1 changed file.
   - Verify: `tmp/p7-04-t1.log` held PASS A4, B1 to B4 and `CANARY_EXIT=0`. The tracer gate (end-of-phase, automated verify only) re-ran the verify on the committed file (`tmp/p7-04-t1-gate.log`, `CANARY_EXIT=0`), so expansion continued.
2. **Task 2: probes, final runs, README, conventions count** - `0bff6f9c` `docs(live-uat): document the MCP adapter canary and its result`
   - Files: `tests/live-uat/mcp-adapter-canary.mjs`, `tests/live-uat/README.md`, `.planning/codebase/CONVENTIONS.md`
   - Hook: `npm run check:commit` ran and passed. `SKIP=npm-check pre-commit` first failed on mdformat (it reformatted the README table). The rerun ended `PRECOMMIT_EXIT=0`. `fallow audit`, `fallow health` and `fallow dupes` were clean before the final runs.
   - The committed canary's sha256 equals the file's sha256 recorded before the final runs (`d79f2236...`), so the transcripts come from the committed file.

`git diff cc66ea61..HEAD -- package.json package-lock.json` is empty.

## Files Created/Modified

- `tests/live-uat/mcp-adapter-canary.mjs` - route B (B1 to B4), the shared route driver, `openSession` flags, the two `--no-extensions` probes, and the header
- `tests/live-uat/README.md` - the table row and "All five", one opening sentence, the stub paragraph, and the canary section
- `.planning/codebase/CONVENTIONS.md` - the suppression count and the driver list

## CONVENTIONS.md correction

The line said 18 markers and four `fallow-ignore-file unused-file` drivers. `rg -n "fallow-ignore" extensions tests scripts` finds 20 markers and six such drivers. The two missing drivers were `openai-stub-server.mjs` (its marker came in `5df69d88`, before this milestone) and `mcp-adapter-canary.mjs` (`16e86df6`). The total is now 20, the count is "Six", and the list names both. The other counts in the line (2 unused-export, 2 private-type-leak, 1 unused-type, 1 unused-class-member, 8 code-duplication) are correct and unchanged.

## Decisions Made

- Both routes run through one `proveRoute(route)` driver with a route table. Two near-identical session functions would be a clone group. Route A's output lines are unchanged.
- The probes call `sendStep` and `closeSession` directly. `run` and `closeChecked` would print `LIVE RUNTIME REQUIRED` or route the run on a probe failure, and the probes must not change the exit code.

## Deviations from Plan

None - plan executed exactly as written.

Notes:
- The plan's interfaces described `openSession` with an optional `--no-extensions` flag. The 07-02 file had no such parameter, so Task 2 added a `flags` parameter.
- This was a sequential run on the main checkout with `node_modules` present, so the worktree `node_modules` link step did not apply.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-07-15 is mitigated: every line of `tmp/p7-04-final.log` and `tmp/p7-04-invert.log` is in the README verbatim, and the sha256 check shows the canary did not change after the final runs. T-07-SC: the only install used is the existing 5.2.0 scratch outside the repository, and package.json and the lock are unchanged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 07-05 (docs/mcp-compatibility.md, READMEs, catalog note) can cite the README section and the two `--no-extensions` readings.
- Verification status: focused task verification passed; full phase/PR verification pending. The orchestrator's wave gate runs `npm run check`, which includes `tests/architecture/no-stale-test-citations.test.ts`. It does not run the canary.

---
*Phase: 07-docs-and-live-proof*
*Completed: 2026-10-09*

## Self-Check: PASSED

- FOUND: tests/live-uat/mcp-adapter-canary.mjs, tests/live-uat/README.md, .planning/codebase/CONVENTIONS.md
- FOUND commits: 5e93f91c, 0bff6f9c (ancestors of HEAD; `git rev-list --count cc66ea61..HEAD` = 2)
- Task 1 acceptance: `rg -c 'route-b'` = 2; t1 log has B1 to B4 after A4 and the route B `observed:` line; the commit lists only the canary
- Task 2 acceptance: no missing transcript line; the canary diff since base is non-empty and the committed file matches the run; no decision ID in the canary or the new README section; `rg -c 'mcp-adapter-canary'` in CONVENTIONS.md = 1; package.json and the lock unchanged
- Plan verification: two Conventional Commits titles with no GSD phase, plan or decision ID
