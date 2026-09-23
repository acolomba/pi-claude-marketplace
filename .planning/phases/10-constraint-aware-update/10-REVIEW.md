---
phase: 10-constraint-aware-update
reviewed: 2026-09-23T02:27:16Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - docs/dependency-resolution.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/edge/types.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - scripts/check-unused-type-members.contracts.json
  - tests/architecture/dependency-doc-agreement.test.ts
  - tests/e2e/import-command.test.ts
  - tests/edge/handlers/marketplace/update.test.ts
  - tests/edge/register.test.ts
  - tests/edge/types.test.ts
  - tests/orchestrators/marketplace/update.messaging.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/info.messaging.test.ts
  - tests/orchestrators/plugin/seed-unconstrained-target.ts
  - tests/orchestrators/plugin/update-cascade.test.ts
  - tests/orchestrators/plugin/update-constraint-gate.test.ts
  - tests/orchestrators/plugin/update-flow.test.ts
  - tests/orchestrators/plugin/update-preflight.test.ts
  - tests/orchestrators/plugin/update-row.test.ts
  - tests/scripts/check-unused-type-members.negative.test.ts
  - tests/shared/notification-types.test.ts
findings:
  critical: 1
  warning: 0
  info: 0
  total: 1
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-09-23T02:27:16Z
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Summary

The post-review production fixes are coherent: the autoupdate tag memos now start once per marketplace-update command, the two command forms share the resulting update function, the constrained disclosure no longer claims an unproven ceiling, and update-only skipped causes are removed from the base skipped-row contract. TypeScript, ESLint, workflow gates, fallow, and source formatting passed. Fourteen of the fifteen directly changed test modules passed; the remaining type-member negative suite could not launch its nested Node process in the sandbox (`spawnSync ... EPERM`), so that environmental failure is not a finding. The full project gate also stopped on an unrelated, pre-existing Prettier failure in `.planning/config.json`.

One test-reliability defect remains. The new D-10-20 case does not exercise the constraint-gate branch that decides whether an entry with its own `sha` is still tag-probed, so the exact regression it was added to prevent can return while the suite stays green.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: The pinned-entry regression test injects the behavior it claims to prove

**File:** `tests/orchestrators/plugin/update-preflight.test.ts:791-836`

**Issue:** The case says it proves that a constraint-selected tag overrides a marketplace entry's own declared `sha`, but lines 815-823 replace the real constraint gate with a stub that directly returns the selected `tagOid`. The test therefore exercises only `resolveUpdateCandidate`'s handling of an already-produced pin. It never reaches `constraintTagSource` at `extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts:271-275`, which is the branch that must treat a `url` / `git-subdir` / `github` source as tag-probeable even when `source.sha` is present.

A plausible wrong implementation still passes: restore the previously proposed exemption `parsed.sha === undefined ? { kind: "git", source: parsed } : { kind: "absent" }`. Production would then stop probing tags for commit-pinned entries and D-10-20 would fail in real use, while this test remains green because its stub bypasses that decision and supplies the tag pin anyway. Under the project's unit-test rules, a case that a plausible wrong implementation passes is a blocking test-reliability defect.

**Fix:** Add a real-gate case for a `url`, `git-subdir`, or `github` entry that already carries `sha`. Drive `evaluateUpdateConstraint` with an injected `UpdateConstraintSeam`, assert that `probeDependencyTags` receives that source and returns a different tag oid, and assert the verdict carries that oid/version. Keep the existing preflight case to prove that the resulting pin overrides the entry sha during materialization. Alternatively, drive the full update flow with a local tagged repository and assert the persisted record moves from the entry sha to the constraint-selected tag.

---

_Reviewed: 2026-09-23T02:27:16Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
