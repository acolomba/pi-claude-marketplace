---
phase: 91-hook-environment-parity
fixed_at: 2026-08-03T00:00:00Z
review_path: .planning/phases/91-hook-environment-parity/91-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 1
skipped: 1
status: partial
---

# Phase 91: Code Review Fix Report

**Fixed at:** 2026-08-03
**Source review:** .planning/phases/91-hook-environment-parity/91-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope (critical + warning): 2
- Fixed: 1
- Skipped: 1 (documented decision)
- Info-tier (IN-01): out of scope, unchanged

**Verification environment:** All gates (typecheck, targeted `node --test`,
`pre-commit run --files`, and the commit-time hook suite) ran in the **main
working tree** (`workflow.use_worktrees` opt-out honored per the orchestrator
directive), so the numbers are reproducible from the checked-out tree.

## Fixed Issues

### WR-01: Session-env contract duplicated verbatim across two spawn sites

**Files modified:** `extensions/pi-claude-marketplace/shared/session-env.ts`,
`extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts`,
`extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`
**Commit:** 96cb08c5
**Applied fix:** Extracted the three-key Claude-Code session-env block
(`CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_SESSION_ID`) into a single
`claudeSessionEnvFor(sessionId)` producer in `shared/session-env.ts`, and
replaced the verbatim inline literals in both spawn lanes (`prepareEnv` in
`dispatch-exec.ts` and `prepareAsyncEnv` in `async-rewake/registry.ts`) with
`...claudeSessionEnvFor(transCtx.sessionId)`, spread in the same position
(after the `...process.env` spread) so the per-dispatch snapshot still wins
(D-91-02). `applySessionEnv` (the bash-tool `process.env` mutator in the same
module) now also delegates to the producer via `Object.assign`, so the
three-key contract has exactly one source of truth and lane parity holds by
construction rather than only by the D-91-01 drift-guard test.

Behavior is byte-identical: same keys, same values, same override position.
Both lanes import from `shared/`, which the bridge layer may legally do per the
D-11 import matrix (both files already import other `shared/` modules).

**Verification:** `npm run typecheck` clean; targeted suite green
(`node --test tests/bridges/hooks/dispatch-exec.test.ts
tests/architecture/hooks-async-rewake.test.ts tests/shared/session-env.test.ts`
— 63 pass / 0 fail / 1 pre-existing platform skip); the D-91-01 drift-guard and
`applySessionEnv` non-interference tests stayed green unchanged; full
`pre-commit run --files` on the three changed files passed (lint, prettier,
typecheck, TruffleHog), and the commit-time hook suite passed.

## Skipped Issues

### WR-02: `CLAUDECODE="1"` asserts Claude-Code identity but inherited `CLAUDE_CODE_*` / `ANTHROPIC_*` vars are not scrubbed

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:312-324`
and `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:609-621`
**Reason:** Skipped by explicit user decision — "document, don't scrub." The
milestone's non-interference stance stands: inherited parent
`CLAUDE_CODE_*` / `ANTHROPIC_*` vars are deliberately NOT scrubbed from the
spawned child env. No scrub behavior was added. The nested-host caveat (Pi
launched inside a real Claude Code session seeing a partially-stale parent
Claude identity) will be documented by Phase 94's DOC-06 rather than mitigated
in code. No code change made.
**Original issue:** Both env blocks spread `...process.env` then set
`CLAUDECODE="1"`; if Pi runs nested inside a real Claude Code process, companion
vars (`CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_CODE_REMOTE`, `CLAUDE_CODE_SSE_PORT`,
`ANTHROPIC_*`) pass through the spread while only `CLAUDE_CODE_SESSION_ID` is
overridden, yielding an inconsistent partially-stale Claude identity.

## Out of Scope

### IN-01: Drift-guard test exercises 2 of 10 dispatchable events

Info-tier finding; not in the critical+warning fix scope. Left unchanged. The
review itself notes "No change required now" — the two chosen events already
cover both sides of the sole `SessionStart`-branching env arm.

---

_Fixed: 2026-08-03_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
