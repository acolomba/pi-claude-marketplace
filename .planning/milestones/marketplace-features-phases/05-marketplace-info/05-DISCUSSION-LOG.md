# Phase 5: Marketplace Info - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-18
**Phase:** 5-marketplace-info
**Areas discussed:** Invalid-manifest result shape, mixed-scope manifest failures, scoped misses, allowed-marketplace ordering

---

## Invalid-Manifest Result Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve the existing row | Keep the shipped `plugin-info` failed-row shape with `{invalid manifest}`. | ✓ |
| Add a marketplace failure type | Introduce a new marketplace-specific failure message and renderer. | |

**User's choice:** Preserve the existing row.
**Notes:** Claude Code 2.1.296 has no `marketplace info` command, so no upstream result shape applies. The selected option keeps the existing project grammar and avoids an unrelated notification-type expansion.

---

## Mixed-Scope Manifest Failures

| Option | Description | Selected |
|--------|-------------|----------|
| Report scopes independently | Preserve project-first order; show a healthy block and a failed row when only one manifest is invalid. | ✓ |
| Fail the whole command | Suppress the healthy scope when either manifest is invalid. | |

**User's choice:** Report scopes independently.
**Notes:** One scope's corrupt manifest must not hide usable information from the other scope.

---

## Scoped Misses

| Option | Description | Selected |
|--------|-------------|----------|
| Fail the requested scope and indicate the other copy | Show the requested scope in the failed row and preserve the cross-scope indication. | ✓ |
| Fail without the cross-scope indication | Show only the requested scope's failure. | |
| Fall back to the other scope | Render the marketplace from the scope the user did not request. | |

**User's choice:** Option 1.
**Notes:** The reply was `11`; it was interpreted as option `1` and confirmed by continuing with that decision.

---

## Allowed-Marketplace Ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve manifest order | Display names in `allowCrossMarketplaceDependenciesOn` declaration order. | ✓ |
| Sort alphabetically | Reorder names before display. | |

**User's choice:** Preserve manifest order.
**Notes:** The behavioral scenario should use deliberately non-alphabetical names so the choice is observable.

---

## the agent's Discretion

- Exact Gherkin wording, fixture names, helper boundaries, and plan split.
- Whether already-correct production behavior needs code changes or only behavioral coverage.
- The concrete non-alphabetical names used for the ordering proof.

## Deferred Ideas

- Remote no-request coverage and activation of the tagged URL/GitHub rows remain in Phases 9 and 10.
- Marketplace update and external manifest-path behavior remain in Phase 6.
