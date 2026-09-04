---
phase: 111-non-hook-component-bridges
fixed_at: 2026-08-30T21:26:18Z
review_path: .planning/phases/111-non-hook-component-bridges/111-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 111: Code Review Fix Report

**Fixed at:** 2026-08-30T21:26:18Z
**Source review:** `.planning/phases/111-non-hook-component-bridges/111-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: Malformed-skill outcomes are only partially asserted

**Files modified:** `tests/bridges/skills/stage.test.ts`
**Commit:** cfce24bb
**Applied fix:** Added a case-owned complete staging-result oracle with the exact degraded record and parser message. The parse-backstop case now compares the complete error name, message, and cause projection.

### WR-02: The commands recovery test does not verify the recovery payload

**Files modified:** `tests/bridges/commands/stage.test.ts`
**Commit:** 10d53fae
**Applied fix:** Imported `ManualRecoveryError`, required the concrete error class, and compared the exact message, ordered leak list, and structured cause against case-owned expectations.

### WR-03: Double assertions conceal invalid test arrangements

**Files modified:** `tests/bridges/agents/convert.test.ts`, `tests/bridges/commands/stage.test.ts`, `tests/bridges/mcp/stage.test.ts`
**Commit:** ad03ad04
**Applied fix:** Replaced the malformed getter's double assertion with a targeted `@ts-expect-error`. Created real command and MCP replacement handles, structured-cloned their cloneable state, and reattached the original type-valid `ScopedLocations` so the complete handles have unknown `WeakMap` identities without type assertions.

## Verification

Verification ran in the isolated review-fix worktree.

- Focused owners passed: agent conversion, command staging, MCP staging, and skill staging.
- `npm run typecheck` passed after every finding.
- Targeted ESLint and Prettier checks passed for every modified file.
- Direct coverage passed at 100% branches, functions, and lines for `agents/convert.ts`, `commands/stage.ts`, `mcp/stage.ts`, and `skills/stage.ts`.

---

_Fixed: 2026-08-30T21:26:18Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
