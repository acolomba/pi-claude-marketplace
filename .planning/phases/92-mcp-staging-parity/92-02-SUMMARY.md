---
phase: 92-mcp-staging-parity
plan: 02
subsystem: bridges/mcp
tags: [mcp, staging, env-injection, scope, MENV, tests]
status: complete
requires:
  - "bridges/mcp/substitute.ts engine (substituteAndInject, buildVarMap) from Plan 01"
  - "prepareStageMcpServers → subCtx wiring + StageMcpInput.pluginRoot/pluginData from Plan 01"
provides:
  - "MENV-02 injection-targeting + declared-wins test coverage (stage.test.ts)"
  - "MENV-03 project-vs-user CLAUDE_PROJECT_DIR scope-arm coverage"
  - "MENV-04 re-derivation + idempotency + theirs-verbatim coverage"
  - "withTmpUserScope hermetic user-scope test fixture (PI_CODING_AGENT_DIR tmp)"
affects:
  - "tests/bridges/mcp/stage.test.ts (9 new tests, 2 new helpers)"
tech-stack:
  added: []
  patterns:
    - "Hermetic user-scope fixture: set PI_CODING_AGENT_DIR to a tmp dir for the test body (getAgentDir re-reads it per call)"
    - "Cross-scope comparison staged under isolated scopes so collision slots never overlap"
key-files:
  created: []
  modified:
    - tests/bridges/mcp/stage.test.ts
decisions:
  - "User-scope fixture drives locationsFor('user', cwd) with PI_CODING_AGENT_DIR pointed at a tmp agent dir — real scope value, hermetic disk."
  - "MENV-03 cross-check stages the project-scope reference in its own withTmpScope BEFORE the user stage, so the user 'srv' in the tmp agent dir (collision slot[1]) never trips the project stage's cross-slot check."
metrics:
  duration: ~15m
  completed: 2026-08-03
actuals:
  tokens: 3775
  tasks: 3
  commits: 3
---

# Phase 92 Plan 02: MCP staging env-injection + scope + re-derivation coverage Summary

Test-only plan. Pinned the MENV-02 injection contract (stdio-only targeting,
declared-wins precedence, empty/malformed env), the MENV-03 project-vs-user
`CLAUDE_PROJECT_DIR` scope arms, and the MENV-04 re-derivation / idempotency /
theirs-verbatim invariants through the real `prepareStageMcpServers` →
`commitPreparedMcp` path built in Plan 01. No production-code changes.

## What was built

Nine new tests in `tests/bridges/mcp/stage.test.ts` plus two helpers
(`readCommittedServers`, `withTmpUserScope`).

**Task 1 — `test` `99bcbbfd` (MENV-02 / D-92-02 injection targeting):**
- `MENV-02 stdio env carries CLAUDE_PLUGIN_ROOT and CLAUDE_PLUGIN_DATA` — a
  command-bearing server with no env gains both injected keys, injected-first.
- `MENV-02 plugin-declared env key wins over injected default` — a declared
  `CLAUDE_PLUGIN_ROOT` literal wins (appears once); a declared value carrying
  `${CLAUDE_PLUGIN_ROOT}` is substituted AND still wins; a custom key
  referencing `${CLAUDE_PLUGIN_DATA}` is substituted; the non-declared
  `CLAUDE_PLUGIN_DATA` default is still injected.
- `MENV-02 stdio entry without env gains injected keys; malformed env treated
  as absent` — `env: {}` and a non-object `env` both receive the injected keys.
- `D-92-02 url-type entry keeps declared env untouched and gains no env; string
  values still substituted` — a url-only entry's `url` is substituted but no
  `env` is synthesized; a url entry with a declared env keeps it verbatim.

**Task 2 — `test` `48e53379` (MENV-03 scope arms):**
- `MENV-03 project scope substitutes and injects CLAUDE_PROJECT_DIR=cwd` —
  command `${CLAUDE_PROJECT_DIR}/run` resolves to `<cwd>/run` (project root =
  cwd, not scopeRoot); `env.CLAUDE_PROJECT_DIR == cwd` ordered after the two
  plugin keys.
- `MENV-03 user scope omits CLAUDE_PROJECT_DIR (token passes through, no env
  key)` — same source under `locationsFor("user", …)` keeps the literal token
  and injects no `CLAUDE_PROJECT_DIR`; a cross-check confirms the scope arm is
  the ONLY divergence (marker + plugin env keys match the project stage).
- Added `withTmpUserScope`: sets `PI_CODING_AGENT_DIR` to a tmp dir for the
  test body so the user-scope `mcp.json` never touches the real agent dir.

**Task 3 — `test` `ce4989d2` (MENV-04 re-derivation + isolation):**
- `MENV-04 re-stage with new pluginRoot leaves no stale path` — staging the
  same placeholder-bearing source with a new root leaves the new-root substring
  and NO substring of the old root in the serialized doc.
- `MENV-04 re-stage with same pluginRoot is idempotent` — two stages with the
  same root produce byte-identical `mcp.json` (no double-substitution).
- `MENV-04 re-stage preserves foreign (theirs) entries verbatim` — a foreign
  entry (different marker, placeholder token, own env) and a top-level non-mcp
  field survive re-stage deep-equal, gaining no injected `CLAUDE_*` keys.

## Verification

- `node --test tests/bridges/mcp/stage.test.ts` → 30 pass (21 existing + 9 new),
  0 fail.
- `tsc --noEmit` (`npm run typecheck`) → green.
- ESLint clean (`--fix` applied: `type` → `interface` for the local
  `CommittedServer` shape, three redundant non-null assertions removed where TS
  already narrows, one padding-line rule); Prettier clean.
- The MENV-02/03/04 concurrency probe stays a documented backstop: the commit is
  a single `atomicWriteJson` with pure in-memory substitution before it, so this
  plan adds no new interleaving surface — nothing new to test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] MENV-03 cross-check collision under a shared agent dir**
- **Found during:** Task 2.
- **Issue:** Staging the project-scope cross-check reference AFTER the user
  stage failed with `McpServerCollisionError` — the user stage had already
  written `srv` into the tmp agent dir, which is collision slot[1]
  (`<agentDir>/mcp.json`) in the cross-slot walk, so the project stage saw it as
  a foreign declarer in a different slot.
- **Fix:** Capture the project-scope reference entry FIRST via its own isolated
  `withTmpScope` (distinct cwd/agent dir), before the user stage writes to the
  agent dir. The two stages then never share a populated slot.
- **Files modified:** tests/bridges/mcp/stage.test.ts.
- **Commit:** `48e53379`.

**2. [Rule 1 - Lint] ESLint auto-fixes on the new tests**
- `type CommittedServer` → `interface CommittedServer`
  (`@typescript-eslint/consistent-type-definitions`); removed three
  `@typescript-eslint/no-unnecessary-type-assertion` non-null assertions on
  already-narrowed `env` accesses; added one required blank line
  (`@stylistic/padding-line-between-statements`).
- **Commit:** `ce4989d2` (fixes applied before the Task 3 commit).

## Known Stubs

None. Test-only plan; every listed test is implemented and asserting.

## Threat Flags

None. No new network endpoints, auth paths, or trust-boundary surface. The
tests assert the plan's threat-register mitigations directly: T-92-05 (url-type
never env-injected, Task 1), T-92-06 (user-scope CLAUDE_PROJECT_DIR absence,
Task 2), T-92-07 (no stale path on re-derivation, Task 3), T-92-08 (theirs
verbatim, Task 3).

## Notes for downstream

- `withTmpUserScope` is now available for any future MCP test needing a real
  user-scope `ScopedLocations` without polluting the real agent dir.
- Trufflehog pre-commit hook cannot run in the worktree sandbox
  (`failed to read index file: .git/index: not a directory`); commits used
  `SKIP=trufflehog` per CLAUDE.md. The diff is test-only TypeScript and path
  literals — no secrets.

## Self-Check: PASSED

- `tests/bridges/mcp/stage.test.ts` — FOUND (9 new tests, 30 total pass)
- `92-02-SUMMARY.md` — FOUND
- Commit `99bcbbfd` — FOUND
- Commit `48e53379` — FOUND
- Commit `ce4989d2` — FOUND
