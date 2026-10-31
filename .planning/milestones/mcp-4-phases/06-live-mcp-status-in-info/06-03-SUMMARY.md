---
phase: 06-live-mcp-status-in-info
plan: 03
subsystem: mcp
tags: [mcp, status, pi-mcp-adapter, conformance, integration]

requires:
  - phase: 06-live-mcp-status-in-info
    provides: "06-01 `createMcpStatusTracker` and `McpStatusReader.lookup`; 06-02 the `overridden by project scope` shadow rule in info"
provides:
  - "`tests/integration/mcp-status-conformance.test.ts`: the both-scopes join through Pi's real event bus, the shutdown snapshot, the `dist/types.d.ts` drift guard"
  - "`PiMcpAdapterTypes`; `loadPiMcpAdapterModule` accepts `\"types\"`; `readPiMcpAdapterDist` accepts `\"types.d.ts\"`"
affects: [phase 7 docs and live UAT]

actuals:
  tokens: 2840
  tasks: 2
  commits: 1
plan_head_before: b6ef889a383309a28973afe46386ed83342fca78
plan_head_after: 6e44fa793e8778d1eb1791a19883d3cb9a812629

tech-stack:
  added: []
  patterns:
    - "A peer drift guard that pins exact `.d.ts` declaration lines, so a contract change fails CI instead of degrading output"

key-files:
  created:
    - tests/integration/mcp-status-conformance.test.ts
  modified:
    - tests/integration/pi-mcp-adapter-peer.ts
    - extensions/pi-claude-marketplace/platform/mcp-status.ts

key-decisions:
  - "The snapshot is built by hand in the adapter's shape and keyed by the names the real install wrote, because the adapter's snapshot builder ships only as TypeScript source under node_modules"

patterns-established: []

requirements-completed: [ASTAT-01, ASTAT-02]

coverage:
  - id: D1
    description: "a snapshot on the adapter's own channel and version, for the key install wrote in both scopes, reaches info: project row connected, user row overridden by project scope"
    requirement: "ASTAT-01"
    verification:
      - kind: integration
        ref: "tests/integration/mcp-status-conformance.test.ts#ASTAT-01: a snapshot on pi-mcp-adapter's own channel, for the keys install wrote, reaches info through Pi's event bus"
        status: pass
    human_judgment: false
  - id: D2
    description: "the adapter's empty shutdown snapshot reads as no usable snapshot"
    requirement: "ASTAT-02"
    verification:
      - kind: integration
        ref: "tests/integration/mcp-status-conformance.test.ts#ASTAT-02: pi-mcp-adapter's shutdown snapshot leaves the tracker with no usable snapshot"
        status: pass
    human_judgment: false
  - id: D3
    description: "the channel, snapshot version and seven-status union are pinned to the adapter's dist/types.d.ts"
    requirement: "ASTAT-01"
    verification:
      - kind: integration
        ref: "tests/integration/mcp-status-conformance.test.ts#ASTAT-01: pi-mcp-adapter's status union, channel and snapshot version are the ones info maps"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-10-09
status: complete
---

# Phase 6 Plan 03: MCP status conformance against pi-mcp-adapter 5.1.0 Summary

**An integration suite proves, against pi-mcp-adapter 5.1.0's own constants and a real install in both scopes, that the status tracker reads the adapter's channel and snapshot version and that info joins on the key install wrote. A drift guard pins the adapter's status contract.**

## Performance

- **Duration:** about 6 min
- **Completed:** 2026-10-09T18:50Z
- **Tasks:** 2 of 2
- **Files modified:** 3

## Accomplishments

- `tests/integration/pi-mcp-adapter-peer.ts` loads `dist/types.js` in place (the module the adapter's `exports` map publishes as `./types`), exports `PiMcpAdapterTypes`, and can read `dist/types.d.ts`.
- `tests/integration/mcp-status-conformance.test.ts` has three cases:
  - Tracer (ASTAT-01): `hello@mp` is installed for real in the user and project scopes. Both `mcp-adapter.json` files hold the one key `plugin_hello_srv_`. A snapshot emitted on `MCP_STATUS_EVENT` with `MCP_STATUS_SNAPSHOT_VERSION`, both imported from the adapter, goes through Pi's real `createEventBus()` to the real tracker. `getPluginInfo` without `--scope` prints the project row `connected` and the user row `overridden by project scope`. The whole notification is asserted.
  - ASTAT-02: after a full snapshot answers `connected`, the adapter's empty shutdown snapshot makes `lookup` answer `no-snapshot`.
  - Drift guard (ASTAT-01): the `MCP_STATUS_EVENT`, `MCP_STATUS_SNAPSHOT_VERSION` and `McpServerRuntimeStatus` lines of `dist/types.d.ts` equal the 5.1.0 text, in file order.
- `platform/mcp-status.ts`: one header sentence names the conformance suite. No code change.

## Task Commits

The plan commits once, as it requires:

1. **Tasks 1-2: conformance suite, peer loader, tracker header pointer** - `6e44fa79` (test)

## Files Created/Modified

See `key-files` in the frontmatter. `package.json` is unchanged: `rg -n "pi-mcp-adapter" package.json` still prints only the peer range and the `peerDependenciesMeta` key.

## Decisions Made

See `key-decisions`.

## Deviations from Plan

None - plan executed exactly as written. The info output matched the planned lines on the first run, so no expected line changed.

## Verification

- Conformance run with `PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p4-08/adapter/node_modules/pi-mcp-adapter TMPDIR=/var/tmp/mcp4-p6-03`: 3 pass, 0 fail, 0 skipped. The tracer case alone passed first (1 pass, 0 skipped).
- With `PI_MCP_ADAPTER_ROOT` unset: 0 pass, 0 fail, 3 skipped (the skip path).
- `npm run typecheck` exit 0. `node --test tests/platform/mcp-status.test.ts tests/architecture/no-stale-test-citations.test.ts`: 28 pass, 0 fail. `npx eslint` on the three files exit 0.
- `PRECOMMIT_EXIT=0` (the last line of `tmp/p6-03-precommit.log`, first run, no fixer rewrites).
- Commit hook: the first `git commit` passed every hook, including `npm run check:commit` and gitlint, and created `6e44fa79`.
- `npx fallow audit --base b6ef889a` exit 0: "No issues in 3 changed files".
- No added line under `extensions/` or `tests/` cites a decision ID (`D-06-N`).
- Every install runs under `withHermeticEnvironment`. Node v26.11.0.

focused task verification passed; full phase/PR verification pending

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. Importing `dist/types.js` from the peer is the planned T-06-10 surface, and the drift guard is the T-06-11 mitigation.

## Next Phase Readiness

- Phase 7 can run the live UAT against a real pi-mcp-adapter publisher, including the deferred-session reading.
- Moving the adapter floor past 5.1.0 will fail the drift guard on purpose until the new contract is reviewed.

## Self-Check: PASSED

- FOUND: tests/integration/mcp-status-conformance.test.ts, tests/integration/pi-mcp-adapter-peer.ts, extensions/pi-claude-marketplace/platform/mcp-status.ts
- FOUND: commit 6e44fa79 (ancestor of HEAD)
