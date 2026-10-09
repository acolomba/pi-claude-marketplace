---
phase: 06-live-mcp-status-in-info
verified: 2026-10-09T20:00:00Z
status: passed
score: 10/10 must-haves verified
covered_files:
  - .planning/phases/06-live-mcp-status-in-info/06-01-PLAN.md
  - .planning/phases/06-live-mcp-status-in-info/06-01-SUMMARY.md
  - .planning/phases/06-live-mcp-status-in-info/06-02-PLAN.md
  - .planning/phases/06-live-mcp-status-in-info/06-02-SUMMARY.md
  - .planning/phases/06-live-mcp-status-in-info/06-03-PLAN.md
  - .planning/phases/06-live-mcp-status-in-info/06-03-SUMMARY.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/edge/types.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info-mcp-status.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/platform/mcp-status.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - tests/integration/mcp-status-conformance.test.ts
  - tests/integration/pi-mcp-adapter-peer.ts
  - tests/orchestrators/plugin/info-mcp-status.test.ts
  - tests/platform/mcp-status.test.ts
covered_digest: "v3:sha256:d74ad21dc646ccd384c19f10deec1c78eff2b2779d729259bad1397677a33eec"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 6: Live MCP status in info Verification Report

**Phase Goal:** `/claude:plugin info` tells the user what state each plugin MCP server is in, as the adapter reports it, and says plainly when it does not know.
**Verified:** 2026-10-09
**Status:** passed
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1/ASTAT-01: info shows each written server's adapter state from `pi-mcp-adapter/status/v1`, without importing the adapter or connecting servers | VERIFIED | `platform/mcp-status.ts` subscribes once via `events.on` (the `PiEventSource` port is on-only; no `.emit(` and no adapter import under `extensions/`). `index.ts:77` builds `createMcpStatusTracker(pi.events)` and threads it through `EdgeDeps.mcpStatus` -> `register.ts:98` -> `edge/handlers/plugin/info.ts:76` -> `getPluginInfo` -> `withServerStatus` (`info.ts` single-block and fan-out) -> `withMcpServerStatus`. The renderer `mcpEntryText` prints `entry.status` first inside the parentheses. Tests pass: `tests/orchestrators/plugin/info.test.ts`, `tests/index.test.ts`, `tests/edge/handlers/plugin/info.test.ts` (256/256). |
| 2 | SC2: a lazy server not yet connected shows its resting state, not a failure | VERIFIED | `RUNTIME_STATUS_TOKENS` maps `cached` -> `cached, connects on first use` and `not-connected` -> `not connected`; `failed` only from the adapter's own `failed`. Owner test matrix `ASTAT-01: ... answering <answer> reads <token>` passes. |
| 3 | SC3/ASTAT-02: no snapshot, the empty shutdown snapshot, an absent adapter, a malformed or wrong-version payload, and an unknown status show an explicit unknown, not a guess | VERIFIED | `readSnapshot` returns `undefined` for an invalid payload or an empty `servers` list; every payload replaces `latest`; `lookup` returns `no-snapshot` / `unrecognized`, both mapped to `status unknown`; an unlisted key is `not loaded`. `tests/platform/mcp-status.test.ts` (invalid replaces valid, throwing getter, status mutated after the check) passes. Conformance test with the real adapter's shutdown snapshot passes. |
| 4 | SC4/ASTAT-02: every new token is a closed-catalog amendment and the catalog gates pass | VERIFIED | `McpServerStatus` is a ten-member union in `notification-types.ts`. `docs/output-catalog.md` carries the token table (~L2597-2607) and byte-locked states `installed-with-mcp-not-loaded`, `installed-both-scopes-mcp-overridden` and the status-bearing states. Catalog contract, parser and `notify-closed-set-locks` tests pass; the full `npm run check` was green on HEAD `3aafdfe3` (cited, not re-run). |
| 5 | Shadow rule (D-06-09): same plugin in both scopes gives the project row the state and the user row `overridden by project scope`; no snapshot gives both `status unknown`; a disabled, non-listing or unreadable project record does not override | VERIFIED | `projectOverrides` + `stampEntries` in `info-mcp-status.ts` (the no-snapshot rule precedes the shadow rule). `info.test.ts` ASTAT-01/02 cases at L7324-7493 (fan-out, `--scope user`, unparseable project `state.json`, disabled record, different server, no snapshot) pass. |
| 6 | `--scope user` reads the project record read-only (prohibition: no write, no file or directory created) | VERIFIED | `readProjectInstallRecord` calls `loadState(..., { persistMigration: false })` inside `try`/`catch` (`state-io.ts:526` gates the write). The unparseable-`state.json` test asserts the directory still holds only `state.json` and the bytes are unchanged. The test tier is wired, so the prohibition is not treated as unverified. |
| 7 | Severity unchanged and no extra detail (D-06-04/05/10); `(disabled)` and not-installed rows, unresolved components, left-out and unrecorded servers show no state; `requires: ... (missing)` keeps its bytes | VERIFIED | `withMcpServerStatus` returns the block untouched unless the row is installed or partially-installed with resolved components and a record; stamped entries skip `unsupportedFeature` and servers the record does not list. Owner tests at `info-mcp-status.test.ts` L131-249 pass; the catalog 2710-2719 state keeps the `(missing)` line. |
| 8 | Prohibitions: no rendering of payload text; no stale or guessed state; no publishing or connecting; no persistence | VERIFIED | Tokens come only from closed maps; the schema reads only `version`, `servers[].name` and `servers[].status`. Names are used only as Map keys. The factory test mocks the bus strictly (`tests/index.test.ts:279`, only `on`). No file is written by the tracker. `06-SECURITY.md` has `threats_open: 0`. |
| 9 | Conformance with pi-mcp-adapter 5.1.0: its own channel and version, the real install keys in both scopes, the empty shutdown snapshot | VERIFIED | Ran `tests/integration/mcp-status-conformance.test.ts` under a temp HOME/PI_CODING_AGENT_DIR with `PI_MCP_ADAPTER_ROOT` at a 5.1.0 copy (`/var/tmp/mcp4-p4-08/adapter/...`): 3/3 pass, 0 skipped. The first adapter copy tried was 5.0.0 and correctly failed on the peer range. The full check also ran this suite. |
| 10 | Drift guard pins the adapter's status union, channel and snapshot version | VERIFIED | The third conformance case passes against `dist/types.d.ts`, which holds the 7-status union, `"pi-mcp-adapter/status/v1"` and version `1`. |

**Score:** 10/10 truths verified (0 present, behavior-unverified)

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|-------------|--------------|--------|----------|
| ASTAT-01 | 06-01, 06-02, 06-03 | SATISFIED | Truths 1, 2, 5, 6, 7, 9, 10. Marked `[x]` and Complete in REQUIREMENTS.md. |
| ASTAT-02 | 06-01, 06-02, 06-03 | SATISFIED | Truths 3, 4, 9. Marked `[x]` and Complete in REQUIREMENTS.md. |

No orphaned requirements: REQUIREMENTS.md maps only ASTAT-01 and ASTAT-02 to Phase 6, and all three plans claim both.

### Anti-Patterns Found

None blocking. No TBD, FIXME or XXX markers in the phase's source files. Review findings: WR-01 fixed in `03a4104e` (the code now reads each field once and re-checks that it is a string); IN-01 and IN-02 are open info items by design (a defensive own-key guard, and a comment that is slightly inexact about `servers`), neither affecting behavior.

### Deferred Items

The live deferred-session reading (`status unknown` until the first MCP use, then a live state; D-06-06a) cannot be observed here without a real Pi session. It is carried by Phase 7 ROADMAP success criterion 2 (ADOC-02 live UAT), which names it explicitly. It is not raised as a human item for this phase.

### Human Verification Required

None.

## Gaps Summary

No gaps. All four roadmap success criteria and the plan-level truths, key links and prohibitions hold in the code. Targeted runs: 197/197 on the owner and catalog suites, 256/256 on the info, index and edge-handler suites, and 3/3 on the 5.1.0 conformance suite. `npm run check` (exit 0 on `3aafdfe3`, adapter 5.1.0 conformance included) is cited, not re-run.

---

_Verified: 2026-10-09_
_Verifier: Claude (gsd-verifier)_
