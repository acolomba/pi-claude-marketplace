# Phase 3: Production Defect Corrections - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution
> agents. Decisions are captured in CONTEXT.md; this log preserves the
> alternatives considered.

**Date:** 2026-09-06
**Phase:** 03-production-defect-corrections
**Areas discussed:** Agent discovery, compact triggers, rollback errors, failure
classification and cleanup reporting

---

## Agent Discovery

| Option                                  | Description                                                                               | Selected |
| --------------------------------------- | ----------------------------------------------------------------------------------------- | -------- |
| Preserve multi-directory discovery      | Consume all resolved agent directories and retain ordered first-wins dedup with warnings. | ✓        |
| Formalize first-directory-only behavior | Narrow the bridge to one directory and remove unreachable multi-directory behavior.       |          |
| Preserve the current split              | Keep a multi-directory bridge that production only feeds one directory.                   |          |

**User's choice:** The user delegated the choice to the agent's best judgment.

**Notes:** Multi-directory component paths are valid resolver output, sibling
bridges already consume their full lists, and the agents bridge already owns the
dedup contract. Preserving that contract avoids silent loss of declared agents.

---

## Compact Triggers

| Option                     | Description                                                                                    | Selected |
| -------------------------- | ---------------------------------------------------------------------------------------------- | -------- |
| Direct semantic mapping    | Map `manual` to `manual` and `threshold`/`overflow` to `auto`, then align supportability sets. | ✓        |
| Constant automatic trigger | Preserve the stale constant-`auto` translation.                                                |          |
| Reject overflow            | Treat the upstream overflow reason as unsupported.                                             |          |

**User's choice:** The user delegated the choice to the agent's best judgment.

**Notes:** The direct mapping preserves all information representable in
Claude's two-value trigger vocabulary and follows the installed Pi event type.

---

## Rollback Errors

| Option                        | Description                                                                                                                     | Selected |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Wire the ES-4 formatter       | Make the existing formatter the single production rule and preserve the original error as `cause` when partial rollback occurs. | ✓        |
| Delete the helper             | Remove the dead helper, tests, stale comments, and pending ES-4 behavior.                                                       |          |
| Keep parallel implementations | Correct comments but leave the helper test-only and retain install's duplicate logic.                                           |          |

**User's choice:** The user delegated the choice to the agent's best judgment.

**Notes:** ES-4 is an existing pending contract, and the live install path already
duplicates most of the helper. Wiring it removes drift while adding the missing
cause chain.

---

## Failure Classification and Cleanup Reporting

| Option                     | Description                                                                                                  | Selected |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| Owner-level typed failures | Classify by error type/discriminant/code, retain structured cleanup context, and preserve the primary error. | ✓        |
| Shared universal taxonomy  | Replace local failure contracts with one cross-repository error hierarchy.                                   |          |
| Preserve message fallbacks | Continue classifying known cases from human-readable message substrings.                                     |          |

**User's choice:** The user delegated the choice to the agent's best judgment.

**Notes:** Owner-level types match existing architecture and avoid a broad
redesign. Shared classifiers remain appropriate only for genuinely shared domain
rules. Cleanup evidence must include both structured diagnostics and filesystem
state.

---

## the agent's Discretion

- The user delegated all four presented gray areas to the agent's best judgment.
- Internal type names, local helper placement, and independent correction order
  remain implementation discretion within the recorded contracts.

## Deferred Ideas

- The unused-code and type-member gate remains assigned to Phase 7.
- Broad module splitting, general test refactoring, and coverage/gate work retain
  their later roadmap routes.
