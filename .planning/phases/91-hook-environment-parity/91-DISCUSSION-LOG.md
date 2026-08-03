# Phase 91: Hook environment parity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-03
**Phase:** 91-hook-environment-parity
**Areas discussed:** Drift-guard test shape, CLAUDE_SESSION_ID in hook env

---

## Drift-guard test shape

| Option | Description | Selected |
|--------|-------------|----------|
| Behavioral comparison | Invoke both prepareEnv/prepareAsyncEnv with identical fixtures; assert identical envs modulo documented deltas (MARKER_ENV). Survives refactors. (Recommended) | ✓ |
| Behavioral + source-shape lock | Adds a textual lock on the env-literal blocks; strongest but brittle. | |
| Source-shape lock only | Cheap; misses drift outside the literal. | |

**User's choice:** Behavioral comparison (Recommended) → D-91-01

---

## CLAUDE_SESSION_ID in hook env

| Option | Description | Selected |
|--------|-------------|----------|
| Pin explicitly | Set CLAUDE_SESSION_ID: transCtx.sessionId in both lanes; triplet always consistent per dispatch. (Recommended) | ✓ |
| Leave to the spread | Strict HENV-01 scope; alias could briefly diverge in a session-switch race. | |

**User's choice:** Pin explicitly (Recommended) → D-91-02

---

## Claude's Discretion

- Shared-constant import vs local literal for "1"/key names
- Test placement/naming within established conventions
- Comment wording (IDs only)

## Deferred Ideas

- Coverage-sweep todo: carried forward as reviewed-not-folded (decision from Phase 90).
