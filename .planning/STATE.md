---
gsd_state_version: 1.0
milestone: v1.17
milestone_name: env-parity
current_phase: 90
current_phase_name: Session environment initialization
status: executing
stopped_at: Phase 91 context gathered
last_updated: "2026-08-03T14:43:18.015Z"
last_activity: 2026-08-03
last_activity_desc: Phase 90 execution started
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 1
  completed_plans: 1
  percent: 20
---

# Project State

## Current Position

Phase: 90 (Session environment initialization) — EXECUTING
Plan: 1 of 1
Status: Executing Phase 90
Last activity: 2026-08-03 — Phase 90 execution started
env-parity planning docs per validation findings
Amended: Requirements/roadmap amended 2026-08-02 after validation pass (PENV-01 added; MENV-01 extended; pi-mcp-adapter question resolved)

## Roadmap Summary

- 5 phases (Phases 90-94), continuing the global counter from Phase 89 (v1.16
  stop-hooks). All 14 v1 requirements mapped, no orphans. Execution order:
  90 → 91 (the hook lane leans on the session-env groundwork); 92 (MCP) and 93
  (substitution) are independent of the env lane and of each other; 94 (docs)
  LAST and sequential (non-worktree) so it documents shipped behavior.

- **Phase 90 — Session environment initialization** (SENV-01, SENV-02, SENV-03, PENV-01): the shared runtime-injection groundwork. At session start the extension sets `CLAUDECODE=1`, `CLAUDE_CODE_SESSION_ID=<Pi session id>`, and the pi-only `CLAUDE_SESSION_ID` alias on Pi's live `process.env`, and appends each installed enabled plugin's `<pluginRoot>/bin` to `process.env.PATH` (appended not prepended, deduplicated/idempotent, recomputed from install state, added even if absent — PENV-01). Pi's bash tool builds every child env fresh at each spawn: `getShellEnv()` spreads the full live `process.env` (its only mutation: prepends Pi's managed bin dir to `PATH`), then `resolveSpawnContext()` deletes and re-derives exactly five named keys (`PI_SESSION_ID`, `PI_SESSION_FILE`, `PI_PROVIDER`, `PI_MODEL`, `PI_REASONING_LEVEL`) — there is no `PI_*`-prefix scrub, so extension mutations of `process.env` reach every later bash child. The session-id value must track the active session (fresh after switch / `/reload`).

- **Phase 91 — Hook environment parity** (HENV-01, HENV-02): `CLAUDECODE=1` +
  `CLAUDE_CODE_SESSION_ID` (from the authoritative `transCtx.sessionId` snapshot,
  not the `process.env` spread) join the existing `CLAUDE_PROJECT_DIR`/
  `CLAUDE_PLUGIN_ROOT`/`CLAUDE_PLUGIN_DATA`/`CLAUDE_ENV_FILE` set on BOTH hook spawn
  lanes — `prepareEnv` (`bridges/hooks/dispatch-exec.ts`) and its deliberate
  hand-mirror `prepareAsyncEnv` (`bridges/hooks/async-rewake/registry.ts`) — pinned
  together by a drift-guard test so the mirror can't silently rot.

- **Phase 92 — MCP staging parity** (MENV-01..04): the biggest gap —
  `stampServers` (`bridges/mcp/stage.ts`) writes MCP entries to `mcp.json` verbatim
  today. Substitute the set `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, and — project-scope installs only — `${CLAUDE_PROJECT_DIR}` (user-scope `${CLAUDE_PROJECT_DIR}` a documented absence, unknowable at install time) in each server's
  `command`/`args`/`env`, and inject `CLAUDE_PLUGIN_ROOT`/`CLAUDE_PLUGIN_DATA` (plus
  `CLAUDE_PROJECT_DIR` for project-scope only — user-scope value varies per session)
  into each server's `env`, plugin-declared keys winning over injected defaults
  (Claude's spread order). Rationale: Claude Code substitutes all three at config load; pi-mcp-adapter does NOT interpolate `command`/`args` at all and replaces unknown `${VAR}` in env with the empty string — so stage-time substitution is the only delivery path for `command`/`args` and the only correct one for per-plugin `env` values. The `update`/`reinstall` re-stage paths re-derive so a
  plugin-root change (e.g. a new sha-addressed clone dir) never leaves stale paths.
  Atomic writes (NFR-1), containment (NFR-10) hold.

- **Phase 93 — Substitution completion** (SUB-01, SUB-02): extend
  `shared/vars.ts::substituteClaudeVars` (today only `${CLAUDE_PLUGIN_ROOT}`/
  `${CLAUDE_PLUGIN_DATA}`) and its four call sites across the three bridges (skills stage ×2 — description augmentation and whole-file; commands stage; agents convert) so `${CLAUDE_SKILL_DIR}` resolves to the skill's installed dir and project-scope `${CLAUDE_PROJECT_DIR}` resolves to the project root; user-scope `${CLAUDE_PROJECT_DIR}` passes through untouched (documented divergence — Claude Code substitutes it at invoke time even for user-scope artefacts, so such an artefact works under Claude Code but stays literal under Pi; no env var rescues it, and Claude Code's own bash children carry no `CLAUDE_PROJECT_DIR` so Pi deliberately sets none; DOC-06 states the gap).

- **Phase 94 — Environment-variable documentation** (DOC-06, DOC-07): NEW
  `docs/env-vars.md` — the per-variable × per-surface matrix (Claude Code ground
  truth vs Pi delivery), the two-mechanism model (install-time textual substitution
  for install-stable per-plugin values vs runtime env injection for session-scoped
  values), documented absences, and the resolved pi-mcp-adapter `process.env`-
  inheritance answer; `docs/hooks-compatibility.md`'s env table reconciled against
  it. Runs sequentially (non-worktree) per project convention for docs phases that
  touch shared planning/state files.

- **Verified finding (2026-08-02, documented in Phase 94)**: pi-mcp-adapter 2.10.0 `server-manager.ts::resolveEnv` spawns stdio servers with `{...process.env, ...interpolated(config.env)}` — full live `process.env` inheritance, config keys winning; `${VAR}`/`$env:VAR` interpolation applies to env values, cwd, headers, bearerToken (unknown var → empty string), NOT to command/args. Session vars set by Phase 90 reach MCP servers spawned afterward (matching Claude Code, whose stdio MCP spawn injects `CLAUDECODE=1`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_PROJECT_DIR`); user-scope `CLAUDE_PROJECT_DIR` stays absent for Pi MCP servers (documented); DOC-06 records the spawn-order caveat (servers spawned before the session-start handler miss the session vars) and session-switch staleness (a running server keeps spawn-time env).

## Session

**Last session:** 2026-08-03T14:43:17.980Z
**Stopped at:** Phase 91 context gathered
**Resume file:** .planning/phases/91-hook-environment-parity/91-CONTEXT.md

No plans executed yet for v1.17. Next: `/gsd-plan-phase 90`.

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| —    | —        | —     | —     |

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260802-v2z | amend v1.17 env-parity planning docs per validation findings | 2026-08-02 | 1ce8f203 | [260802-v2z-amend-v1-17-env-parity-planning-docs-per](./quick/260802-v2z-amend-v1-17-env-parity-planning-docs-per/) |

## Decisions

Design decisions are pre-captured in the Roadmap Summary above and in
PROJECT.md's "Current Milestone: v1.17 env-parity" section (ground truth verified
2026-08-01 against the Claude Code v2.1.212 binary). Plan-phase and execution will
record per-plan decisions here.

## Deferred Items

Items acknowledged and deferred at the v1.14 milestone close on 2026-07-23 and
re-acknowledged unchanged at the v1.16 close on 2026-07-31 (override_closeout,
known verification overrides: 5). Cross-milestone carryover — none originate from
v1.17 env-parity.

| Category | Item | Status |
|----------|------|--------|
| backlog | REASON-01 — unify all parse-error reasons under a `{malformed <feature>}` family | deferred |
| debug | knowledge-base | unknown |
| quick_task | 260621-kmm-add-explicit-enabled-boolean-field-to-pl | unknown |
| quick_task | 260718-tli-fix-pr-88-external-contribution-to-pass- | unknown |
| todo | 2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in | testing |
| seed | SEED-001-remote-plugin-status-fetch-verb | dormant (superseded by url-source/fetch-plugin) |

## Operator Next Steps

- Plan the first phase with `/gsd-plan-phase 90` (session environment
  initialization — the shared groundwork the hook lane leans on).

- Release npm 0.12.0 for v1.16 is complete (PR #109 squash-merged via v-tag CI
  publish); no outstanding v1.16 release work.

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| —    | —        | —     | —     |

## Deferred Verification

| Phase | State | Resume |
|-------|-------|--------|
| 90 | verification_deferred_human | /gsd-verify-work 90 |
