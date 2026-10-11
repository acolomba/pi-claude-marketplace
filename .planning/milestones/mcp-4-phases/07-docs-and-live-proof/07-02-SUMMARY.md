---
phase: 07-docs-and-live-proof
plan: 02
subsystem: testing
tags: [mcp, pi-mcp-adapter, live-uat, canary, migration, tool-search, status]

requires:
  - phase: 07-docs-and-live-proof
    provides: "07-01: the pi-mcp-adapter >=5.2.0 <6 floor, so PI_MCP_ADAPTER_ROOT names the 5.2.0 scratch install"
  - phase: 05-migration
    provides: the mcp.json -> mcp-adapter.json move and its notice (AMIG-01, AMIG-03)
  - phase: 06-live-mcp-status
    provides: the info status tokens read from the adapter status channel (ASTAT-01, ASTAT-02)
provides:
  - "tests/live-uat/mcp-adapter-canary.mjs: operator-run live UAT against pi-mcp-adapter 5.2.0, assertions M0-M4, I1, A1-A4, --invert and --capture-legacy"
  - "tests/live-uat/fixtures/mcp-adapter-canary/legacy-v0.19.2.json: legacy files captured from 0.19.2 on Pi 1.0.0, re-rooted at @@SANDBOX@@"
  - "tests/live-uat/openai-stub-server.mjs: STUB_SCRIPT tool-call replay and a bound-port startup line; default `ready` path unchanged"
  - "Measured: the move needs exactly 1 reload until plugin_echo_echo_ is live and echo is gone"
affects: [07-04, 07-05]

actuals:
  tokens: 13778
  tasks: 2
  commits: 2
plan_head_before: d8d43dddedec19669a7a98f62a4446aa887f1559
plan_head_after: 5860d9c57dbdec03ba0773034e60567712274744

tech-stack:
  added: []
  patterns:
    - "Live canary over Pi RPC: a run-time helper extension (canary-reload, canary-wait, canary-status) paces the session and taps pi-mcp-adapter/status/v1"
    - "Every session's first step is /canary-wait 1500; an answer under 1400 ms routes human_needed, because the waits could not pace the run"
    - "The keyless stub replays a script chosen by a marker in the last user message; the step index is the count of tool results after it"

key-files:
  created:
    - tests/live-uat/mcp-adapter-canary.mjs
    - tests/live-uat/fixtures/mcp-adapter-canary/legacy-v0.19.2.json
  modified:
    - tests/live-uat/openai-stub-server.mjs

key-decisions:
  - "Routing: a missing migration notice (M1), a missing ping install row (I1) and an A1 token other than status unknown are regressions (exit 2); a route A turn that sends the stub no request is inconclusive (exit 1)"
  - "Capture mode starts no stub and writes only the base settings; the stub provider settings exist only in a seeded run"

patterns-established:
  - "PI_MCP_ADAPTER_ROOT for the canary must name a pi-mcp-adapter 5.2.0 install (exact version)"

requirements-completed: [ADOC-02]

coverage:
  - id: D1
    description: "The legacy fixture is captured from the published 0.19.2 on Pi 1.0.0 with one command, re-rooted at @@SANDBOX@@, and holds no home, repository or sandbox path"
    requirement: "ADOC-02"
    verification:
      - kind: other
        ref: "TMPDIR=/var/tmp/mcp4-p7-02 node tests/live-uat/mcp-adapter-canary.mjs --capture-legacy /var/tmp/mcp4-p7-research/v0192 (CANARY_EXIT=0) + Task 1 fixture node -e check"
        status: pass
    human_judgment: false
  - id: D2
    description: "Seeded from the fixture, a real Pi 1.0.0 with pi-mcp-adapter 5.2.0 shows the migration row, lists echo and info (not loaded) before any reload, writes plugin_echo_echo_ with toolPrefix mcp and directTools search, and needs exactly 1 reload"
    requirement: "ADOC-02"
    verification:
      - kind: other
        ref: "PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter TMPDIR=/var/tmp/mcp4-p7-02 node tests/live-uat/mcp-adapter-canary.mjs (PASS M0-M4, CANARY_EXIT=0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A plugin installed fresh in the session (ping) is written as plugin_ping_ping_ and is live in the adapter after the same reload"
    requirement: "ADOC-02"
    verification:
      - kind: other
        ref: "tmp/p7-02-run.log PASS I1 and PASS M4"
        status: pass
    human_judgment: false
  - id: D4
    description: "Route A in a fresh Pi process: info (status unknown), mcp({ search }) returns mcp__plugin_echo_echo__echo_canary declared only after the search, the call returns echo-canary:hi, info then (connected); --invert exits 2 at A3"
    requirement: "ADOC-02"
    verification:
      - kind: other
        ref: "tmp/p7-02-run.log PASS A1-A4 (CANARY_EXIT=0); tmp/p7-02-invert.log PASS A2 then REGRESSION -- A3 (CANARY_EXIT=2)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The stub replays STUB_SCRIPT tool calls, binds a free port with STUB_PORT=0 and prints it, still answers ready without a script, and exits 1 on a malformed script"
    requirement: "ADOC-02"
    verification:
      - kind: other
        ref: "local drive of openai-stub-server.mjs (scripted stream and non-stream, past-end and no-marker ready, no-script ready, bad script exit 1)"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-10-09
status: complete
---

# Phase 7 Plan 02: Live pi-mcp-adapter 5.2.0 canary Summary

**An operator-run canary drives a real Pi 1.0.0 over RPC with this extension and pi-mcp-adapter 5.2.0. It seeds the legacy entry captured from the published 0.19.2 and proves the move: the notice row, `not loaded` before any reload, the moved entry's owned fields, and exactly 1 reload to make the new key live. It also proves that a fresh install loads, and that route A's scripted `mcp({ search })` finds and calls the plugin tool while info goes from `status unknown` to `connected`.**

## Performance

- **Duration:** about 14 min
- **Started:** 2026-10-09T22:01:55Z
- **Completed:** 2026-10-09T22:15:38Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Scratch installs (`tmp/p7-02-scratch.txt`)

- `/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter` is 5.2.0. Lock and registry integrity are both `sha512-I1J8jEtInPYlwxoOk0WyVzHsBnP2ahYwSNKOKPEsDgwL+8dvUaGCcD220lSxwbMhaLIgnar6DCbufjoU6caHpw==`.
- `/var/tmp/mcp4-p7-research/v0192/node_modules/pi-claude-marketplace` is 0.19.2. Lock and registry integrity are both `sha512-FWydGrOzFJfJv6fAWIVTd4oOF4pjWUN0MZL0+rBBuiBr34j7AMAkxZ9xGN0Jn3HQWlRZDkEZslaTIPA/b6w9/Q==`.

## Capture (D-07-04)

0.19.2 loads on Pi 1.0.0, so the stop condition did not trigger.

```text
$ TMPDIR=/var/tmp/mcp4-p7-02 node tests/live-uat/mcp-adapter-canary.mjs --capture-legacy /var/tmp/mcp4-p7-research/v0192
[mcp-adapter-canary] PASS: M0: Pi 1.0.0 (/home/acolomba/src/pi-claude-marketplace-mcp-4/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js), pi-claude-marketplace 0.19.2 at /var/tmp/mcp4-p7-research/v0192/node_modules/pi-claude-marketplace, sandbox parent /var/tmp/mcp4-p7-02
[mcp-adapter-canary] captured tests/live-uat/fixtures/mcp-adapter-canary/legacy-v0.19.2.json
CANARY_EXIT=0
```

The fixture has the same keys and shapes as the research capture under `/var/tmp/mcp4-p7-research/s1/agent/`: `mcp.json` with the marked `echo` entry, `state.json` schemaVersion 2 with the `canary-mkt` path source and the `echo` record (`mcpServers: ["echo"]`), and `claude-plugins.json`. Paths and timestamps differ. It holds 12 `@@SANDBOX@@` occurrences and no `$HOME` path. It was formatted with Prettier.

## Full run (`tmp/p7-02-run.log`)

```text
[mcp-adapter-canary] PASS: M0: Pi 1.0.0 (/home/acolomba/src/pi-claude-marketplace-mcp-4/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js), pi-mcp-adapter 5.2.0 at /var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter, sandbox parent /var/tmp/mcp4-p7-02
[mcp-adapter-canary] observed: pi-mcp-adapter first-start warning: <sandbox>/agent/mcp.json: Ignored settings (details in /mcp-adapter): "echo": _piClaudeMarketplace.
[mcp-adapter-canary] PASS: M1: AMIG-03: the migration notice lists "echo -> plugin_echo_echo_ (echo) [user]"
[mcp-adapter-canary] PASS: M2: AMIG-03, ASTAT-02: before any reload the adapter lists [["echo","cached"]] and info shows (not loaded)
[mcp-adapter-canary] PASS: M3: AMIG-01, ANAME-01, ANAME-04: mcp.json keeps no marked entry; mcp-adapter.json holds plugin_echo_echo_ with toolPrefix "mcp" and directTools "search"
[mcp-adapter-canary] PASS: I1: AFILE-01: ping installed fresh is written to mcp-adapter.json as plugin_ping_ping_
[mcp-adapter-canary] observed: reloads until plugin_echo_echo_ is live and echo is gone: 1
[mcp-adapter-canary] PASS: M4: AMIG-03, ASTAT-01, AFILE-01: after 1 reload the adapter lists [["plugin_echo_echo_","cached"],["plugin_ping_ping_","cached"]]; info shows echo (cached, connects on first use) and ping (cached, connects on first use)
[mcp-adapter-canary] PASS: A1: ASTAT-02: in a fresh deferred session info shows (status unknown)
[mcp-adapter-canary] observed: route A first model request tools: ["read","bash","edit","write","tool_search","pi_claude_marketplace_list","pi_claude_marketplace_plugin_list","mcp"]
[mcp-adapter-canary] PASS: A2: ANAME-01, ANAME-04: mcp({ search }) returned mcp__plugin_echo_echo__echo_canary, declared only after the search
[mcp-adapter-canary] PASS: A3: ADOC-02: mcp__plugin_echo_echo__echo_canary returned "echo-canary:hi"
[mcp-adapter-canary] PASS: A4: ASTAT-01: after the first MCP use the adapter reports plugin_echo_echo_ connected and info shows (connected)
[mcp-adapter-canary] all assertions proven; exit 0
CANARY_EXIT=0
```

**Reload count: 1.** This matches the notice's promise. Task 1's seeded run (`tmp/p7-02-t1.log`, without ping and route A) also passed M0-M4 with a count of 1.

## Negative control (`tmp/p7-02-invert.log`)

The control was run before the PASS was trusted. It fails at A3 with exit 2, after the A2 PASS:

```text
[mcp-adapter-canary] PASS: M0: ... (as above)
[mcp-adapter-canary] PASS: M1 ... M4, A1 (as above)
[mcp-adapter-canary] PASS: A2: ANAME-01, ANAME-04: mcp({ search }) returned mcp__plugin_echo_echo__echo_canary, declared only after the search

[mcp-adapter-canary] ADOC-02 REGRESSION -- A3 failed:
  mcp__plugin_echo_echo__echo_canary returned "echo-canary:hi" (isError false); expected "echo-canary:inverted".
CANARY_EXIT=2
```

After both runs, no `mcp-adapter-canary-*` sandbox is left under `/var/tmp/mcp4-p7-02`, and `pgrep` finds no canary-sandbox or stub process.

## Accomplishments

- The canary seeds the fixture, drives three extensions in a hermetic RPC session, and counts reloads against live adapter snapshots, not against timing.
- Pi 1.0.0 with pi-mcp-adapter 5.2.0 loads both the migrated entry and an install-written entry.
- Route A shows the deferred-tool flow end to end. The plugin tool is absent from the first model request and present from a later one.
- The stub's scripted mode serves both search routes. `route-b` is ready for 07-04.

## Task Commits

1. **Task 1 (tracer): legacy capture, seed, migration, reload count** - `16e86df6` `test(live-uat): prove a legacy MCP entry migrates on a real adapter`
   - Files: `tests/live-uat/mcp-adapter-canary.mjs`, `tests/live-uat/fixtures/mcp-adapter-canary/legacy-v0.19.2.json`
   - Hook: `npm run check:commit` ran and passed. Non-test files under `tests/` were staged, so it ran all source-test pairs. `SKIP=npm-check pre-commit` ended `PRECOMMIT_EXIT=0`. `fallow audit --base d8d43ddd`: no issues in 2 changed files.
   - The tracer gate (end-of-phase, automated verify only) re-ran the verify on the committed code: it passed, so expansion continued.
2. **Task 2: scripted stub, fresh install, route A** - `5860d9c5` `test(live-uat): find and call a plugin MCP tool through a scripted stub`
   - Files: `tests/live-uat/openai-stub-server.mjs`, `tests/live-uat/mcp-adapter-canary.mjs`
   - Hook: `npm run check:commit` ran and passed (all pairs). `SKIP=npm-check pre-commit` ended `PRECOMMIT_EXIT=0`. `fallow audit --base d8d43ddd`: no issues in 3 changed files.

`git diff d8d43ddd..HEAD -- package.json package-lock.json` is empty, so no dependency was added.

## Files Created/Modified

- `tests/live-uat/mcp-adapter-canary.mjs` - the canary: preconditions, sandbox, marketplace and MCP server generator, run-time helper extension, RPC driver, capture mode, seed, M0-M4, I1, A1-A4, `--invert`
- `tests/live-uat/fixtures/mcp-adapter-canary/legacy-v0.19.2.json` - the captured legacy files with `@@SANDBOX@@`
- `tests/live-uat/openai-stub-server.mjs` - `STUB_SCRIPT` replay, tool-call replies, bound-port startup line; `sendStream`, `sendCompletion` and `logRequest` are unchanged

## Decisions Made

- Assertion routing follows the honesty contract. An observation that contradicts the expected behavior exits 2: a missing migration notice (M1), a missing ping install row (I1), or an A1 token other than `status unknown`. A drive that cannot observe exits 1: no adapter snapshot, no info row, a step timeout, or a route A turn that sends the stub no request.
- Capture mode starts no stub. The stub's provider settings and `models.json` are written only in a seeded run.

## Deviations from Plan

None - plan executed exactly as written.

Notes:
- The stub's first header paragraph now names `mcp-adapter-canary.mjs` beside `stop-canary.mjs` and says the `ready` reply applies without a script. That keeps the header true after the new mode.
- Task 1's header described only what Task 1 proved. Task 2 added the route A, fresh-install and `--invert` lines, so each commit's header matches its code.
- This was a sequential run on the main checkout with `node_modules` present, so the plan's worktree `node_modules` link step did not apply.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

The T-07-05 to T-07-10 mitigations are in place:
- Each Pi child gets an allowlisted environment (HOME, PI_CODING_AGENT_DIR, PI_OFFLINE, PATH, TMPDIR) inside the realpath'd `mkdtemp` sandbox.
- The canary refuses a temp directory inside the repository and passes `--offline`.
- The stub binds 127.0.0.1 with `apiKey: "stub"`.
- The capture refuses to write a fixture that holds the sandbox, repository or home path.
- Pi runs in its own process group and is killed on close. The stub is killed in `finally`. The scratch packages were checked against the registry integrity.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 07-04 can extend this canary with route B (the `route-b` script is already in the stub file), the `--no-extensions` measurement and the README section.
- Verification status: focused task verification passed; full phase/PR verification pending. `npm run check` on the merged tree is the orchestrator's gate. It does not run this canary.

---
*Phase: 07-docs-and-live-proof*
*Completed: 2026-10-09*

## Self-Check: PASSED

- FOUND: tests/live-uat/mcp-adapter-canary.mjs, tests/live-uat/fixtures/mcp-adapter-canary/legacy-v0.19.2.json, tests/live-uat/openai-stub-server.mjs
- FOUND commits: 16e86df6, 5860d9c5 (ancestors of HEAD)
- Task 1 and Task 2 acceptance criteria re-checked: header marker 1, no decision IDs, imports only `node:` and `../pi-runtime.ts`, fixture placeholder present and no `$HOME`, capture log exit 0, Prettier clean, PASS order M0 M1 M2 M3 I1 M4 A1 A2 A3 A4, each commit lists exactly its two files
