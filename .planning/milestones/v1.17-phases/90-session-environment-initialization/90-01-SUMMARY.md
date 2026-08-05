---
phase: 90-session-environment-initialization
plan: "01"
subsystem: runtime-env-injection
tags: [session-env, plugin-path, process-env, ledger, penv-01, senv]
requires:
  - "persistence/state-io.ts loadState + PluginInstallRecord (enabled, resolvedSource)"
  - "persistence/locations.ts locationsFor(scope, cwd)"
  - "shared/debug-log.ts hookDebugLog (NFR-2 swallow trail)"
  - "index.ts resources_discover + factory-time registration seams"
provides:
  - "applySessionEnv(sessionId): sets CLAUDECODE/CLAUDE_CODE_SESSION_ID/CLAUDE_SESSION_ID"
  - "PATH_LEDGER_ENV + applyPathLedger pure PATH-ledger core"
  - "collectBinDirs(state) + recomputePluginPath(cwd) plugin-PATH recompute"
  - "PI_CLAUDE_MARKETPLACE_PATH reload-durable env-var ledger"
affects:
  - "extensions/pi-claude-marketplace/index.ts (session_start + resources_discover wirings)"
  - "every bash child spawned via Pi getShellEnv() (inherits the new env)"
tech-stack:
  added: []
  patterns:
    - "pure-leaf env seam in shared/ (mirrors shared/debug-log.ts)"
    - "I/O shell in orchestrators/ over a pure core in shared/ (D-11 import direction)"
    - "process.env env-var ledger for reload-durable ownership tracking (D-90-01)"
key-files:
  created:
    - extensions/pi-claude-marketplace/shared/session-env.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin-path.ts
    - tests/shared/session-env.test.ts
    - tests/shared/plugin-path.test.ts
  modified:
    - extensions/pi-claude-marketplace/index.ts
    - tests/shared/index-smoke.test.ts
decisions:
  - "Split persistence-dependent code (collectBinDirs, recomputePluginPath) into orchestrators/plugin-path.ts because the D-11 import-direction rule forbids shared/ from importing persistence/ (even type-only)."
  - "Deterministic PATH order: user scope before project scope, stable within scope (D-90-04)."
  - "Reused hookDebugLog for the NFR-2 swallow trail rather than adding a new console seam."
metrics:
  duration: ~30m
  completed: 2026-08-03
status: complete
actuals:
  tokens: 6674
  tasks: 2
  commits: 2
---

# Phase 90 Plan 01: Session environment initialization Summary

Runtime env-injection groundwork for the v1.17 env-parity milestone: at
`session_start` the extension sets `CLAUDECODE=1`, `CLAUDE_CODE_SESSION_ID`,
and the pi-only `CLAUDE_SESSION_ID` shim on Pi's live `process.env`, and on
`resources_discover` (after `applyReconcile`) it appends every enabled plugin's
`<resolvedSource>/bin` (both scopes) to `PATH`, tracked by a reload-durable
`PI_CLAUDE_MARKETPLACE_PATH` env-var ledger so recompute removes exactly its own
prior entries with no stale leak.

## What Was Built

### Task 1 — Session env vars (SENV-01/02/03) — commit `3e3e87dd`

- `shared/session-env.ts` exporting `applySessionEnv(sessionId: string): void`,
  a pure-leaf setter that assigns exactly three keys on `process.env`
  (`CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_SESSION_ID`), overwriting on
  every call so the id tracks the active session (SENV-02 freshness).
- Wired `pi.on("session_start", (_event, ctx) => applySessionEnv(ctx.sessionManager.getSessionId()))`
  at factory time in `index.ts` (mirrors the `edge/register.ts` precedent; no
  try/catch — three unconditional string assignments cannot throw).
- `tests/shared/session-env.test.ts`: values set, refresh-on-re-invoke,
  distinct-keys/same-value, empty-input, and the non-interference before/after
  key-delta (the mechanism that proves no host-identity/entrypoint var is set).

### Task 2 — Plugin PATH recompute + env-var ledger (PENV-01) — commit `a5b02528`

- `shared/session-env.ts` extended with the pure ledger core:
  `PATH_LEDGER_ENV = "PI_CLAUDE_MARKETPLACE_PATH"` and
  `applyPathLedger(currentPath, priorLedger, freshBinDirs)` (remove exactly the
  prior-owned entries, dedupe-append the fresh set, never prepend, no fs stat).
- `orchestrators/plugin-path.ts` (new) with the persistence-dependent halves:
  `collectBinDirs(state)` (enabled records → `<resolvedSource>/bin`, stable
  order) and `recomputePluginPath(cwd)` (loads both scopes' state, user before
  project, threads through the ledger core into `process.env`).
- Wired `await recomputePluginPath(event.cwd)` into `resources_discover` after
  `applyReconcile`, in its own try/catch that swallows + `hookDebugLog`s so a
  malformed `state.json` never blocks Pi load (NFR-2, T-90-04).
- `tests/shared/plugin-path.test.ts`: enabled-filter, both scopes,
  append-not-prepend, add-when-bin-absent (no fs), dedupe/idempotency,
  non-owned-entry survival, empty input, reload-durable stale removal via the
  ledger, deterministic order, plus the malformed-state throw.

## Deviations from Plan

### Auto-fixed / structural

**1. [Rule 3 - Blocking] Split the state-reading code out of `shared/`**
- **Found during:** Task 2 (lint).
- **Issue:** The plan placed `recomputePluginPath` and `collectBinDirs` in
  `shared/session-env.ts`, but the enforced `import-x/no-restricted-paths` rule
  (D-11 import direction) forbids `shared/` from importing `persistence/` —
  including the type-only import of `ExtensionState` — so `loadState`,
  `locationsFor`, and the `ExtensionState`-typed `collectBinDirs` cannot live in
  `shared/`.
- **Fix:** Kept the truly-pure, dependency-free pieces (`applySessionEnv`,
  `PATH_LEDGER_ENV`, `applyPathLedger`) in `shared/session-env.ts`; moved
  `collectBinDirs` + `recomputePluginPath` into a new
  `orchestrators/plugin-path.ts` (orchestrators/ legally imports persistence/
  and shared/, and is exactly where `index.ts` already wires `applyReconcile`).
  The plan's public surface and test coverage are preserved; only the module
  boundary shifted to satisfy the existing architecture. No new
  library/service/schema — conforming to the enforced layering, not changing it.
- **Files:** extensions/pi-claude-marketplace/orchestrators/plugin-path.ts (new),
  extensions/pi-claude-marketplace/shared/session-env.ts, index.ts,
  tests/shared/plugin-path.test.ts.
- **Commit:** a5b02528.

**2. [Rule 1 - Test correctness] Updated index-smoke registration expectation**
- **Found during:** Task 2 (full-suite run).
- **Issue:** `tests/shared/index-smoke.test.ts` pins the exact multiset of
  `pi.on` registrations; the new `session_start` handler raises `session_start`
  multiplicity from 2 to 3.
- **Fix:** Added the third `session_start` to the expected array and updated the
  explanatory comment to name the SENV-01/02/03 session-env registration. This
  is the intended consequence of the Task 1 wiring (caught by the fuller run
  during Task 2, folded into the Task 2 commit).
- **Files:** tests/shared/index-smoke.test.ts.
- **Commit:** a5b02528.

**3. [Rule 1 - Test hermeticity] Non-interference test clears target keys first**
- **Found during:** Task 1 (test run).
- **Issue:** The executor runs under Claude Code where `CLAUDECODE=1` is already
  exported, so the before/after delta could not observe the `CLAUDECODE`
  assignment.
- **Fix:** The non-interference test deletes the three target keys before the
  before-snapshot so the delta is measured from a known baseline regardless of
  ambient env.
- **Files:** tests/shared/session-env.test.ts.
- **Commit:** 3e3e87dd.

## Verification

- `node --test tests/shared/session-env.test.ts` — 5/5 pass.
- `node --test tests/shared/plugin-path.test.ts` — 11/11 pass.
- `npm run typecheck` — green.
- `eslint` + `prettier --check` on all changed files — green.
- Full unit suite (`npm test`) — 3176 pass, 0 fail, 1 pre-existing skip.
- `npm run test:integration` NOT run in this worktree (no local node_modules;
  the worktree symlinks the main checkout's modules for unit runs only). The
  phase-level `npm run check` (including integration) is the `/gsd-verify-work`
  gate.
- Live-Pi UAT (VALIDATION.md manual-only rows) deferred to `/gsd-verify-work`:
  `env | grep CLAUDE` through the bash tool shows the three session vars fresh
  after `/reload`; install/uninstall + `/reload` reflects the `<pluginRoot>/bin`
  PATH entry with no stale leak.

## Threat Mitigations Applied

- T-90-01 (EoP, PATH shadow): append-not-prepend — pinned by the
  append-not-prepend test.
- T-90-02 (Tampering, non-owned removal): only ledger-recorded entries are
  removed — pinned by the non-owned-entry-survival test.
- T-90-03 (Spoofing, key set): exactly three session keys — pinned by the
  non-interference key-delta test.
- T-90-04 (DoS, malformed state): `recomputePluginPath` wrapped in a
  swallow + `hookDebugLog` try/catch in `resources_discover` — pinned by the
  malformed-state throw test plus the caller wrapping.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/shared/session-env.ts
- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin-path.ts
- FOUND: tests/shared/session-env.test.ts
- FOUND: tests/shared/plugin-path.test.ts
- FOUND: commit 3e3e87dd
- FOUND: commit a5b02528
