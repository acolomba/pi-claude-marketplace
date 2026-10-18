---
phase: 04-marketplace-remove-and-list
reviewed: 2026-10-18T14:54:35Z
depth: standard
diff_base: 3dbf4224924498cb1cda0f1e409f72151a6c6bfc
reviewed_commit: 5953a8d34318e147d5c71cd17574ae3c6715282a
files_reviewed: 3
files_reviewed_list:
  - features/marketplace/list.feature
  - features/marketplace/remove.feature
  - tests/integration/marketplace-layer-remove.test.ts
findings:
  critical: 1
  warning: 0
  info: 0
  total: 1
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-10-18T14:54:35Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the changes since the supplied base in all three scoped files, including the complete files and the assertion, session-start, and reconciliation code they call. The new integration cases compare complete JSON payloads and persisted partial-removal state. One new behavioral scenario can pass despite violating the no-mutation behavior its title promises: its final observation occurs after automatic reconciliation can repair the mutation.

## Structural Findings (fallow)

The orchestrator supplied a passing audit at `3dbf4224924498cb1cda0f1e409f72151a6c6bfc`:

- Verdict: `pass`.
- Dead-code issues: 0.
- Complexity findings: 0.
- Duplication clone groups: 0.
- Introduced and inherited gated counts: 0.

The reviewer's supplementary orientation command could not create its temporary base worktree and exited 2. That failed command is not evidence of a clean scan; the supplied successful structural pre-pass is the structural evidence used here.

## Narrative Findings (AI reviewer)

### Critical Issues

#### CR-01: Reconciliation can hide mutation during a refused removal

**Classification:** BLOCKER

**File:** `/home/acolomba/src/pi-claude-marketplace-cucumber-behavioral-tests/features/marketplace/remove.feature:557-564`

**Issue:** The scenario “A refused remove reports every blocking plugin without removing any” checks the refusal payload and desired config, then starts a new session before checking the five installed skills. It never observes the installed state or staged artifacts between the refused command and that session. An implementation that removes the otherwise eligible `elm` record and skill while retaining desired config, then returns the two preflight blockers, can pass: the config checks still match, and the new session reinstalls `elm` before the skill comparison. The scenario therefore does not distinguish refusal without mutation from refusal followed by automatic repair.

**Evidence:** `features/step_definitions/session.steps.ts:32-33` delegates this step to `startSession`. `features/lib/pi-commands.ts:103-116` sends `new_session` and reads the skill inventory; it does not reject reconciliation entries emitted during that request. Resource discovery invokes `applyReconcile` in `extensions/pi-claude-marketplace/index.ts:123-130`. The planner schedules installation of a still-declared plugin whose installed record is absent at `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:521-523`. The scenario expressly preserves `elm@tools` in the base declaration at lines 545-549, so this repair path applies. This is an assertion-gap finding established by tracing those paths; no production mutation was performed.

**Fix:** Add an observation before `new_session` that proves the refusal left installed state and staged skill bytes unchanged. A focused integration companion can reuse the two-blocker-plus-`elm` arrangement, capture the state/config footprint and all five staged skill files before `removeMarketplace`, then compare them immediately after the refusal. Keep the subsequent session inventory as a separate persistence check. The new assertion must fail if `elm`'s installed record and staged skill are removed while its desired declaration remains.

## Verification

All checks used Node `v26.11.1` and the reviewed commit above; no source files were modified during review.

| Command | Exit | Result |
| --- | --- | --- |
| `node --test tests/integration/marketplace-layer-remove.test.ts` | 0 | Owner test module passed; no failures, skips, or todos reported. |
| `npm run check:features` | 0 | Feature/step definition checks passed. |
| `npm run test:cucumber -- features/marketplace/remove.feature features/marketplace/list.feature` | 0 | Outside sandbox: 48 scenarios, 535 steps, and 16 hooks passed. |

The initial sandboxed Cucumber attempt exited 1 because Pi exited during the setup hook before any scenario action. The successful rerun outside the sandbox resolved that execution limitation; it is not classified as a defect in the reviewed files. The orchestrator's existing passing hook evidence was reused for type checking and lint. These focused checks do not replace the combined-tree GSD gate.

---

_Reviewer: gsd-code-reviewer_
_Depth: standard_
