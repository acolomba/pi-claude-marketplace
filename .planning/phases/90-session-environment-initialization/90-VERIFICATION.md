---
phase: 90-session-environment-initialization
verified: 2026-08-03T00:00:00Z
status: human_needed
score: 13/13 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 90: Session environment initialization Verification Report

**Phase Goal:** A skill or command script launched through Pi's bash tool sees the Claude Code session environment variables — exactly as it would under Claude Code — because the extension sets them on Pi's live `process.env` at session start and Pi's bash tool builds every child env fresh at each spawn (getShellEnv() spreads full live process.env; resolveSpawnContext() re-derives only five named PI_* keys; no PI_*-prefix scrub). Establishes `CLAUDECODE=1`, `CLAUDE_CODE_SESSION_ID` (fresh per session_start), and the pi-only `CLAUDE_SESSION_ID` shim, plus PENV-01 plugin-bin PATH wiring.
**Verified:** 2026-08-03
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A bash child sees `CLAUDECODE=1` whenever the extension is loaded (SENV-01) | ✓ VERIFIED | `shared/session-env.ts:33` sets `process.env.CLAUDECODE = "1"`; wired via `pi.on("session_start", ...)` in `index.ts:128-134`; test `applySessionEnv: sets the three session keys` passes. Host mechanism independently re-verified against installed peer `@earendil-works/pi-coding-agent@0.82.1` (`dist/utils/shell.js:103-114` `getShellEnv` spreads full `process.env`; `dist/core/tools/bash.js:114-133` `resolveSpawnContext` deletes/re-derives only 5 `PI_*` keys) — matches RESEARCH.md citations exactly. |
| 2 | Bash child sees `CLAUDE_CODE_SESSION_ID` = `ctx.sessionManager.getSessionId()`, overwritten every `session_start` (SENV-02) | ✓ VERIFIED | `applySessionEnv` assigns unconditionally on every call; `index.ts:128-134` reads `ctx.sessionManager.getSessionId()` fresh on each `session_start`. Test `re-invoking overwrites both session-id keys` passes. `session_start` firing for startup/reload/new/resume/fork independently re-verified against `dist/core/agent-session.js:151,2069` (startup + reload emit sites present). |
| 3 | `CLAUDE_SESSION_ID` set to same value as `CLAUDE_CODE_SESSION_ID` (SENV-03 pi-only shim) | ✓ VERIFIED | `shared/session-env.ts:35`; test `distinct keys, same value` passes, including a mutation-independence assertion. |
| 4 | `applySessionEnv` assigns only the three named keys; before/after delta is exactly those three | ✓ VERIFIED | Test `touches exactly the three named keys and nothing else` — set-difference assertion over `process.env` keys, passes. |
| 5 | `CLAUDE_CODE_SESSION_ID`/`CLAUDE_SESSION_ID` are distinct keys, never merge (adjacency) | ✓ VERIFIED | Same test as #3; mutating one key directly does not move the other. |
| 6 | Empty `getSessionId()` return assigned verbatim without throwing (backstop) | ✓ VERIFIED | Test `empty input assigns empty string verbatim without throwing` passes; explicit behavioral evidence, not inferred. |
| 7 | Three keys assigned in fixed statement order; order-independent since keys are distinct (ordering) | ✓ VERIFIED | `shared/session-env.ts:33-35` — three sequential, unconditional, order-independent assignments (distinct keys, no shared mutable target). |
| 8 | Each enabled plugin's `<resolvedSource>/bin` (both scopes) present on `PATH`, appended not prepended, added even if absent (PENV-01) | ✓ VERIFIED | `orchestrators/plugin-path.ts::collectBinDirs` + `shared/session-env.ts::applyPathLedger`; tests `appends fresh bin dirs after existing entries (never prepend)` and `adds a bin dir even when it does not exist on disk (no fs stat)` pass. End-to-end test `recomputePluginPath: appends both user and project scope bin dirs` seeds real per-scope `state.json` fixtures and confirms both scopes land on `process.env.PATH`. |
| 9 | Deterministic order (user before project, stable within scope); two recomputes over identical state produce byte-identical PATH | ✓ VERIFIED | `orchestrators/plugin-path.ts:70` `[...collectBinDirs(userState), ...collectBinDirs(projState)]`; end-to-end test asserts entry order `["/usr/bin", userplug/bin, projplug/bin]`. |
| 10 | Duplicate bin dirs deduplicated; repeated recompute idempotent | ✓ VERIFIED | Test `dedupes a fresh dir already present and is idempotent` threads the returned ledger back in and asserts byte-identical second result. |
| 11 | Zero enabled plugins removes prior ledger entries and appends nothing (empty ledger); single plugin appends exactly one entry (empty/single input) | ✓ VERIFIED | Test `zero fresh dirs removes prior-owned entries and empties the ledger` passes; single-entry case covered by the append-not-prepend test. |
| 12 | Recompute removes exactly the ledger-recorded entries and rewrites the ledger from the fresh set — reload-durable cleanup (D-90-01) | ✓ VERIFIED | Test `reload-durable cleanup removes an uninstalled plugin via the ledger` passes — seeds a 2-entry ledger, drops one from the fresh set, confirms the dropped entry is gone and no duplicate/stale leak. |
| 13 | A malformed/unreadable `state.json` during recompute is swallowed and debug-logged; `resources_discover` returns normally, never blocks Pi load (NFR-2, backstop) | ✓ VERIFIED | `recomputePluginPath` unit test proves the throw (`state.json` malformed → rejects); `index.ts:103-107` wraps the call in try/catch routing through `hookDebugLog`. **Independently confirmed by a live behavioral spot-check** (executed the actual exported `claudeMarketplaceExtension` factory, registered the real `resources_discover` handler, seeded a malformed project-scope `state.json`, and invoked the handler): the handler returned normally with populated `skillPaths`/`promptPaths` and did not throw — closing the backstop with explicit runtime evidence rather than static inference alone. |

**Score:** 13/13 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/shared/session-env.ts` | `applySessionEnv`, `PATH_LEDGER_ENV`, `applyPathLedger` (pure) | ✓ VERIFIED | Exists, exports match, no `process.env`/`fs` access in the pure functions, imported by `index.ts` and `orchestrators/plugin-path.ts`. |
| `extensions/pi-claude-marketplace/orchestrators/plugin-path.ts` | `collectBinDirs`, `recomputePluginPath` (I/O shell) | ✓ VERIFIED | New file (deviation from plan's stated single-module placement, documented and justified in SUMMARY.md — D-11 import-direction rule forbids `shared/` importing `persistence/`); imported and called from `index.ts:104`. |
| `tests/shared/session-env.test.ts` | SENV-01/02/03 + non-interference + empty-input | ✓ VERIFIED | 5/5 tests pass (`node --test`). |
| `tests/shared/plugin-path.test.ts` | PENV-01 append/dedupe/idempotency/order/reload-cleanup/malformed-state | ✓ VERIFIED | 12/12 tests pass (`node --test`); SUMMARY.md states "11/11" — a minor documentation miscount, not a functional gap; actual run confirms all pass. |
| `extensions/pi-claude-marketplace/index.ts` (modified) | `session_start` + `resources_discover` wirings | ✓ VERIFIED | Both wirings present, each independently NFR-2-guarded (own try/catch + `hookDebugLog`). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `index.ts` `session_start` handler | `applySessionEnv` | direct call, wrapped in try/catch (WR-02 fix) | ✓ WIRED | `index.ts:128-134`; regression test `WR-02 session_start swallows a throwing or undefined sessionManager` passes. |
| `index.ts` `resources_discover` handler (after `applyReconcile`) | `recomputePluginPath(event.cwd)` | direct call, own try/catch, `hookDebugLog` | ✓ WIRED | `index.ts:103-107`, placed after `applyReconcile` (line 80) and before `aggregateDiscoveredResources` (line 109), matching D-90-03. |
| `recomputePluginPath` | `loadState(locationsFor(scope,cwd).extensionRoot)` (both scopes) → `collectBinDirs` → `applyPathLedger` → `process.env.PATH`/`PI_CLAUDE_MARKETPLACE_PATH` | direct calls | ✓ WIRED | `orchestrators/plugin-path.ts:63-75`; end-to-end test seeds real `state.json` fixtures for both scopes and confirms the full chain. |
| `process.env` mutations | Pi `getShellEnv()` spread → `resolveSpawnContext()` → bash child env | host mechanism (peer package, not in-repo) | ✓ WIRED | Independently re-verified against installed `@earendil-works/pi-coding-agent@0.82.1` source (`dist/utils/shell.js:103-114`, `dist/core/tools/bash.js:114-133`) — full spread, no scrub of the extension's new keys, matches phase goal claim exactly. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SENV-01 | 90-01-PLAN.md | `CLAUDECODE=1` whenever loaded | ✓ SATISFIED | Truths #1, #4, #6, #7 above. |
| SENV-02 | 90-01-PLAN.md | `CLAUDE_CODE_SESSION_ID` fresh per session_start | ✓ SATISFIED | Truth #2 above. |
| SENV-03 | 90-01-PLAN.md | `CLAUDE_SESSION_ID` pi-only shim | ✓ SATISFIED | Truths #3, #5 above. |
| PENV-01 | 90-01-PLAN.md | Enabled plugin `<pluginRoot>/bin` on PATH, append/dedupe/idempotent/reload-durable | ✓ SATISFIED | Truths #8-13 above. |

No orphaned requirements — REQUIREMENTS.md maps exactly SENV-01/02/03 and PENV-01 to Phase 90, and all four appear in the plan's `requirements` frontmatter and are covered by an executed task. (Note: REQUIREMENTS.md's traceability table and per-requirement checkboxes still read "Pending"/unchecked — this is a document bookkeeping field, not a codebase gap; it is normally updated at phase-complete/milestone-close, outside this plan's file-modification list.)

### Anti-Patterns Found

None. Grep for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|placeholder|not yet implemented` across the phase's modified/created files found only pre-existing, unrelated hits in `index.ts` (the `placeholderCtx` variable at line 56, predating this phase — `git blame` confirms commit `d4b88da6`, 2026-06-19, unrelated to Phase 90's changes).

### Code Review

`90-REVIEW.md` (iteration 3, final): status `clean`, 0 critical, 0 warning, 1 info (intentional, not a defect — `collectBinDirs` admits enabled-but-non-installable records per PENV-01's "every enabled plugin" contract). Two prior warnings (WR-01 untrusted-search-path guard, WR-02 session_start throw-swallow) were fixed and landed with regression tests (`822924cd`/`876a0d8c`, `050835f8`/`e9bd4a96`), independently re-confirmed in this verification pass.

### Test Suite Status

- `node --test tests/shared/session-env.test.ts tests/shared/plugin-path.test.ts tests/shared/index-smoke.test.ts` — 21/21 pass, 0 fail.
- `npm run typecheck` — green.
- `npx eslint` on all phase-touched files — green, no output.
- `npm run test:integration` — 16/18 pass; the 2 failures (`provenance-invisibility.test.ts`, `skill-path-resolution.test.ts`) are a documented pre-existing environment issue unrelated to this phase (they resolve the `pi-subagents` peer from `npm root -g` and fail locally on a stale global version; skipped in CI). Not a Phase 90 regression — neither failing test touches session-env, plugin-path, or index.ts's new wirings.

### Human Verification Required

Both items below are the VALIDATION.md "Manual-Only Verifications" rows, explicitly deferred to live-Pi runtime and outside what a unit test or static grep can confirm. Per the honest-verifier contract, these do not fail the phase (all automatable evidence is green) but must be resolved by a human before full `passed` status is warranted.

### 1. Live bash-child session env visibility

**Test:** In a live Pi session with the extension loaded, run `env | grep -E 'CLAUDECODE|CLAUDE_CODE_SESSION_ID|CLAUDE_SESSION_ID'` through Pi's bash tool. Then run `/reload` and re-check.
**Expected:** `CLAUDECODE=1`; both session-id keys equal the current Pi session id; after `/reload`, the id is refreshed (matches the new session, never stale).
**Why human:** Requires a live Pi session with a real bash-tool spawn and a real session lifecycle event; unit tests only exercise `applySessionEnv` in isolation and the underlying host mechanism (`getShellEnv`/`resolveSpawnContext`) has been verified by direct source inspection but not by actually spawning a Pi bash child end-to-end.

### 2. Live plugin-bin PATH install/uninstall + reload cycle

**Test:** Install a plugin whose plugin root has a `bin/` directory; run `echo $PATH` through Pi's bash tool and confirm `<pluginRoot>/bin` is appended at the end. Uninstall the plugin, `/reload`, and confirm the entry is gone (no stale leak).
**Expected:** The bin dir appears (appended, not prepended) after install; disappears after uninstall + `/reload`, with no duplicate or stale entry.
**Why human:** Requires a real install/uninstall lifecycle plus a real `/reload` against a live Pi session and a real `resources_discover` firing — unit tests cover the pure ledger logic and an end-to-end `recomputePluginPath` call against seeded fixtures, but not the live host lifecycle (real plugin install → real `bin/` dir → real bash-tool PATH visibility → real uninstall → real reload).

### Gaps Summary

No gaps. All 13 must-have truths, all artifacts (existence + substance + wiring), all key links, and both prohibitions are verified against the actual codebase — including two independent re-derivations beyond what SUMMARY.md claimed: (1) direct inspection of the installed `@earendil-works/pi-coding-agent@0.82.1` source confirming the `getShellEnv`/`resolveSpawnContext`/`session_start`-firing claims cited in RESEARCH.md, and (2) a live behavioral spot-check of the actual `resources_discover` handler with a malformed project-scope `state.json`, closing the NFR-2 backstop truth with runtime evidence rather than static inference alone. The only open items are the two VALIDATION.md manual-only rows (live-Pi bash-child visibility, live install/uninstall+reload PATH cycle), which by design require a live Pi session and cannot be resolved by static analysis or `node:test`.

---

_Verified: 2026-08-03_
_Verifier: Claude (gsd-verifier)_
