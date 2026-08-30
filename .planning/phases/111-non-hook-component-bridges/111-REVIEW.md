---
phase: 111-non-hook-component-bridges
reviewed: 2026-08-30T21:13:37Z
depth: standard
files_reviewed: 34
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/mcp/marker.ts
  - extensions/pi-claude-marketplace/bridges/skills/stage.ts
  - tests/bridges/agents/convert.test.ts
  - tests/bridges/agents/discover.test.ts
  - tests/bridges/agents/frontmatter.test.ts
  - tests/bridges/agents/index-mutation.test.ts
  - tests/bridges/agents/index.test.ts
  - tests/bridges/agents/marker.test.ts
  - tests/bridges/agents/stage.test.ts
  - tests/bridges/agents/types.test.ts
  - tests/bridges/agents/unstage.test.ts
  - tests/bridges/commands/discover.test.ts
  - tests/bridges/commands/index.test.ts
  - tests/bridges/commands/stage.test.ts
  - tests/bridges/commands/types.test.ts
  - tests/bridges/commands/unstage.test.ts
  - tests/bridges/integration-materialization-gate.test.ts
  - tests/bridges/mcp/collision-slots.test.ts
  - tests/bridges/mcp/index.test.ts
  - tests/bridges/mcp/marker.test.ts
  - tests/bridges/mcp/parse.test.ts
  - tests/bridges/mcp/safe-set.test.ts
  - tests/bridges/mcp/stage.test.ts
  - tests/bridges/mcp/substitute.test.ts
  - tests/bridges/mcp/types.test.ts
  - tests/bridges/mcp/unstage.test.ts
  - tests/bridges/skills/discover.test.ts
  - tests/bridges/skills/frontmatter-degrade.test.ts
  - tests/bridges/skills/frontmatter-scan.test.ts
  - tests/bridges/skills/index.test.ts
  - tests/bridges/skills/rewrite-frontmatter.test.ts
  - tests/bridges/skills/stage.test.ts
  - tests/bridges/skills/types.test.ts
  - tests/bridges/skills/unstage.test.ts
findings:
  critical: 0
  warning: 3
  info: 0
  total: 3
status: issues_found
---

# Phase 111: Code Review Report

**Reviewed:** 2026-08-30T21:13:37Z
**Depth:** standard
**Files Reviewed:** 34
**Status:** issues_found

## Summary

The two production changes match the locked Phase 111 contract. MCP marker parsing now rejects inherited marker and identity fields, and the removed skills-stage branches are unreachable after Pi's parser reaches the degradation throw arm. All 32 scoped test files, typecheck, and all 31 direct coverage gates pass. The deleted shared fixtures have corresponding case-local scenarios, and every runtime case uses the required lowercase arrange/act/assert structure.

Three warning-level test defects remain. Two cases use partial or regex-based oracles where the contract requires complete public outcomes, and three owner files bypass their public type contracts with double assertions. These defects can let regressions pass while preserving nominal coverage.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Malformed-skill outcomes are only partially asserted

**Severity:** WARNING
**File:** `tests/bridges/skills/stage.test.ts:290-302,552-555`

**Issue:** The degradation case checks the three simple result arrays independently, then checks only the degraded-array length, generated name, and a broad parser-message regex. It never compares the complete public `prepared.result`, so a regression in the degradation record can pass as long as one item retains the same name and a message containing either `unterminated` or `flow sequence`. The parse-backstop case repeats the same broad regex instead of asserting the complete thrown error. This violates locked decision D-09 and the project rule that expected outcomes must be complete and independently authored.

**Fix:** Define a case-local `expectedResult` before the action, including the complete `degraded` record and exact pinned parser error, then use `assert.deepStrictEqual(prepared.result, expectedResult)`. For the backstop, assert the error class and a complete independently authored `{ name, message, cause }` projection rather than a regex.

### WR-02: The commands recovery test does not verify the recovery payload

**Severity:** WARNING
**File:** `tests/bridges/commands/stage.test.ts:1016-1025`

**Issue:** The test accepts any `Error` whose mutable `name` string is `ManualRecoveryError`, casts it to an ad hoc leaks shape, and accepts any non-empty leak array containing one phrase. A plain renamed `Error`, missing or extra leak entries, corrupted paths, or a wrong `cause` can all pass. This leaves the rollback result under-specified despite locked decision D-09 requiring complete rollback outcomes and the project convention requiring structured error assertions.

**Fix:** Import `ManualRecoveryError`, assert `error instanceof ManualRecoveryError`, and deep-compare its complete `message`, ordered `leaks`, and structured `cause` against case-local expected values. The agents-stage owner at `tests/bridges/agents/stage.test.ts:2036-2057` demonstrates the required pattern.

### WR-03: Double assertions conceal invalid test arrangements

**Severity:** WARNING
**Files:**

- `tests/bridges/agents/convert.test.ts:501-506`
- `tests/bridges/commands/stage.test.ts:1028-1033`
- `tests/bridges/mcp/stage.test.ts:899-904`

**Issue:** These cases use `as unknown as` to force values through the public type contract. The commands and MCP cases manufacture structurally invalid replacement objects rather than exercising the identity guard with a type-valid handle that is unknown to the module's `WeakMap`. The agent case hides an intentionally invalid getter return behind a double assertion. This violates locked decision D-07 and the project prohibition on double assertions, while weakening confidence that the covered failure paths match possible boundary inputs.

**Fix:** For replacement identity tests, create a real replacement and pass a `structuredClone` of it so the value remains structurally type-valid but lacks the private `WeakMap` identity. For the deliberately malformed agent getter, express the invalid return directly with a narrowly placed `@ts-expect-error` and a reason, or construct the malformed runtime descriptor through an `unknown` boundary without lying about the getter's return type.

---

_Reviewed: 2026-08-30T21:13:37Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
