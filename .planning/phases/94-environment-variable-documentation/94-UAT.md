---
status: complete
phase: 94-environment-variable-documentation
source: 94-01-SUMMARY.md
started: 2026-08-05T02:27:13Z
updated: 2026-08-05T02:31:00Z
---

## Current Test

[testing complete]

## Tests

### 1. env-vars.md overview matrix and two-mechanism model
expected: docs/env-vars.md opens with the two-mechanism model prose (install-time substitution vs runtime env injection), then an overview matrix with a single S/E/—/✗ legend. All delivered variables appear as rows, including the two pi-only rows with the Claude Code column set to —. A worked bash-children detail table states the CLAUDE_PROJECT_DIR bash-parity fact.
coverage_id: D1
requirement: DOC-06
result: pass

### 2. env-vars.md per-surface tables, Divergences, Not-delivered
expected: docs/env-vars.md contains per-surface tables (skills, commands, agents, hooks, MCP config, MCP env), a Divergences section covering carrier items C-1..C-6 (no-scrub, PATH ledger, session-id alias, MCP resolveEnv + spawn-order + staleness, user-scope pass-through, SECURITY citations), and a Not-delivered section recording affirmative absences.
coverage_id: D2
requirement: DOC-06
result: pass

### 3. hooks-compatibility.md env table reconciled
expected: docs/hooks-compatibility.md env table shows CLAUDE_ENV_FILE flipped to supported under Pi, new rows for CLAUDECODE / CLAUDE_CODE_SESSION_ID / pi-only CLAUDE_SESSION_ID, and one authority line naming docs/env-vars.md authoritative on conflict. Only the ## Environment variables region changed.
coverage_id: D3
requirement: DOC-07
result: pass

### 4. Matrix cells and divergence claims accurate to shipped code
expected: Every matrix cell and divergence claim in docs/env-vars.md is accurate to the shipped code (not just present) — spot-check S/E/—/✗ cells against vars.ts, session-env.ts, dispatch-exec.ts, async-rewake/registry.ts, mcp/substitute.ts.
coverage_id: D4
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
