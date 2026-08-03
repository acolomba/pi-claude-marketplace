---
phase: 91-hook-environment-parity
reviewed: 2026-08-03T15:44:24Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
  - extensions/pi-claude-marketplace/shared/session-env.ts
  - tests/architecture/hooks-async-rewake.test.ts
  - tests/bridges/hooks/dispatch-exec.test.ts
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: clean
---

# Phase 91: Code Review Report

**Reviewed:** 2026-08-03T15:44:24Z
**Depth:** standard
**Status:** clean

## Summary

Iteration 2 re-review of the hook environment-parity work. Focus: verify the
WR-01 fix (commit `96cb08c5`) that extracted the duplicated three-key session
env block into `shared/session-env.ts::claudeSessionEnvFor`, and confirm no new
defects were introduced.

**WR-01 is fixed and complete.** The extraction is total: a tree-wide grep for
the raw session keys (`CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`,
`CLAUDE_SESSION_ID`) finds no remaining inline assignments outside
`session-env.ts` and the tests. All three consumers now route through the single
producer:

- `bridges/hooks/dispatch-exec.ts:323` — sync lane spreads
  `...claudeSessionEnvFor(transCtx.sessionId)` after `...process.env`.
- `bridges/hooks/async-rewake/registry.ts:620` — async lane spreads the same
  producer after `...process.env` (and after the async-only `MARKER_ENV`).
- `index.ts:130` — `applySessionEnv` (the bash-tool `session_start` path)
  delegates via `Object.assign(process.env, claudeSessionEnvFor(sessionId))`.

Correctness checks:

- **Parity by construction.** Both hook lanes derive `transCtx` from the same
  `ctx` and call one pure producer, so the three session values are identical by
  construction rather than by convention. `MARKER_ENV` is the sole async-only
  key — exactly what the `assertLaneParity` drift guard pins
  (hooks-async-rewake.test.ts:1388-1398).
- **Spread ordering preserved (D-91-02).** In both lanes the producer is spread
  *after* `...process.env`, so the authoritative per-dispatch snapshot wins over
  a divergent live `process.env`. dispatch-exec.test.ts:296 (`session id keys
  read from the ctx snapshot win over a divergent process.env value`) proves
  this for the sync lane; the async lane shares the identical construction.
- **Value correctness pinned in both lanes.** dispatch-exec.test.ts:287-289 and
  hooks-async-rewake.test.ts:438-440 assert the concrete values (`CLAUDECODE=1`,
  session id echoed to both keys), so an empty/undefined sessionId cannot pass
  silently as "equal-but-wrong".
- **Import direction legal (D-11).** `bridges/*` → `shared/*` and `index.ts` →
  `shared/*` are permitted; `session-env.ts` imports only `node:path`, preserving
  the pure-leaf posture.
- **Comment policy clean.** Touched lines carry only decision/requirement IDs
  (WR-01, D-91-02, HENV-01/02, SENV-01/02/03) — no phase/plan references.

No BLOCKER or WARNING findings. WR-02 was resolved by user decision (inherited
parent `CLAUDE_CODE_*` / `ANTHROPIC_*` vars intentionally not scrubbed under the
non-interference stance; nested-host caveat documented in Phase 94 DOC-06) —
recorded here as resolved-by-decision, not re-flagged. The two failing
pi-subagents integration tests are the known pre-existing environment issue,
unrelated to this change.

## Info

### IN-01: Lane-parity drift guard exercises 2 of the 10 dispatchable events

**File:** `tests/architecture/hooks-async-rewake.test.ts:1408-1452`
**Issue:** The `hook env parity (HENV-02)` drift guard (`assertLaneParity`)
drives the sync and async lanes for `PreToolUse` and `SessionStart` only — 2 of
the 10 `DispatchableEvent` variants. Carried forward from iteration 1 and still
adequate, not a defect: env construction branches on event identity in exactly
one place (the `SessionStart`-only `CLAUDE_ENV_FILE` arm), and the two chosen
events cover both sides of that branch; the session keys do not vary by event.
With WR-01's single producer now backing both lanes, the residual drift surface
is smaller still — the guard is belt-and-suspenders over a by-construction
guarantee.
**Fix:** No change required. If a future event grows event-specific env keys,
extend the parity table to include that event.

---

_Reviewed: 2026-08-03T15:44:24Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
