---
gsd_state_version: 1.0
milestone: v1.17
milestone_name: env-parity
status: planning
last_updated: "2026-08-02T03:28:05.000Z"
last_activity: 2026-08-01
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Current Position

Phase: Not started (roadmap created — Phases 90-94 mapped)
Plan: —
Status: Roadmap created, awaiting phase planning
Last activity: 2026-08-01 — v1.17 env-parity roadmap created

## Roadmap Summary

- 5 phases (Phases 90-94), continuing the global counter from Phase 89 (v1.16
  stop-hooks). All 13 v1 requirements mapped, no orphans. Execution order:
  90 → 91 (the hook lane leans on the session-env groundwork); 92 (MCP) and 93
  (substitution) are independent of the env lane and of each other; 94 (docs)
  LAST and sequential (non-worktree) so it documents shipped behavior.

- **Phase 90 — Session environment initialization** (SENV-01, SENV-02, SENV-03):
  the shared runtime-injection groundwork. At session start the extension sets
  `CLAUDECODE=1`, `CLAUDE_CODE_SESSION_ID=<Pi session id>`, and the pi-only
  `CLAUDE_SESSION_ID` alias on Pi's live `process.env`; Pi's bash tool builds every
  child env from `process.env` via `getShellEnv()` (scrubbing only `PI_*`), so
  skill/command scripts inherit all three exactly as under Claude Code. The
  session-id value must track the active session (fresh after switch / `/reload`).

- **Phase 91 — Hook environment parity** (HENV-01, HENV-02): `CLAUDECODE=1` +
  `CLAUDE_CODE_SESSION_ID` (from the authoritative `transCtx.sessionId` snapshot,
  not the `process.env` spread) join the existing `CLAUDE_PROJECT_DIR`/
  `CLAUDE_PLUGIN_ROOT`/`CLAUDE_PLUGIN_DATA`/`CLAUDE_ENV_FILE` set on BOTH hook spawn
  lanes — `prepareEnv` (`bridges/hooks/dispatch-exec.ts`) and its deliberate
  hand-mirror `prepareAsyncEnv` (`bridges/hooks/async-rewake/registry.ts`) — pinned
  together by a drift-guard test so the mirror can't silently rot.

- **Phase 92 — MCP staging parity** (MENV-01..04): the biggest gap —
  `stampServers` (`bridges/mcp/stage.ts`) writes MCP entries to `mcp.json` verbatim
  today. Substitute `${CLAUDE_PLUGIN_ROOT}`/`${CLAUDE_PLUGIN_DATA}` in each server's
  `command`/`args`/`env`, and inject `CLAUDE_PLUGIN_ROOT`/`CLAUDE_PLUGIN_DATA` (plus
  `CLAUDE_PROJECT_DIR` for project-scope only — user-scope value varies per session)
  into each server's `env`, plugin-declared keys winning over injected defaults
  (Claude's spread order). The `update`/`reinstall` re-stage paths re-derive so a
  plugin-root change (e.g. a new sha-addressed clone dir) never leaves stale paths.
  Atomic writes (NFR-1), containment (NFR-10) hold.

- **Phase 93 — Substitution completion** (SUB-01, SUB-02): extend
  `shared/vars.ts::substituteClaudeVars` (today only `${CLAUDE_PLUGIN_ROOT}`/
  `${CLAUDE_PLUGIN_DATA}`) and its three call sites (skills stage, commands stage,
  agents convert) so `${CLAUDE_SKILL_DIR}` resolves to the skill's installed dir and
  project-scope `${CLAUDE_PROJECT_DIR}` resolves to the project root; user-scope
  `${CLAUDE_PROJECT_DIR}` passes through untouched (documented — SENV-03 shell
  expansion / env inheritance covers it).

- **Phase 94 — Environment-variable documentation** (DOC-06, DOC-07): NEW
  `docs/env-vars.md` — the per-variable × per-surface matrix (Claude Code ground
  truth vs Pi delivery), the two-mechanism model (install-time textual substitution
  for install-stable per-plugin values vs runtime env injection for session-scoped
  values), documented absences, and the resolved pi-mcp-adapter `process.env`-
  inheritance answer; `docs/hooks-compatibility.md`'s env table reconciled against
  it. Runs sequentially (non-worktree) per project convention for docs phases that
  touch shared planning/state files.

- **Implementation-time verification** (lands in Phase 92, documented in Phase 94):
  whether pi-mcp-adapter spawns MCP servers inheriting Pi's `process.env` — this
  determines the runtime coverage for user-scope `CLAUDE_PROJECT_DIR` (deliberately
  not baked into `env` in MENV-03) and for the session vars in MCP server processes.
  The finding feeds `docs/env-vars.md` (DOC-06).

## Session

**Last session:** 2026-08-01 — v1.17 env-parity roadmap created
**Stopped at:** ROADMAP.md / REQUIREMENTS.md traceability / STATE.md written
**Resume file:** None

No plans executed yet for v1.17. Next: `/gsd-plan-phase 90`.

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| —    | —        | —     | —     |

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

None.
