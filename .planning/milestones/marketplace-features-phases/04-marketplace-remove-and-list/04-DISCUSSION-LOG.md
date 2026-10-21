# Phase 4: Marketplace Remove and List - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-18
**Phase:** 4-marketplace-remove-and-list
**Areas discussed:** Unscoped removal, cascade failure behavior, result ordering

---

## Unscoped Removal

### Same name in both scopes

| Option | Description | Selected |
| --- | --- | --- |
| Remove from both scopes | Match Claude Code 2.1.296. | |
| Remove only the project copy | Preserve RM-08 as an explicit upstream divergence. | ✓ |
| Refuse as ambiguous | Require an explicit scope. | |

**User's choice:** Remove only the project copy.
**Notes:** The final context requires a stable project decision ID for this deliberate divergence.

### Communicating the remaining user copy

| Option | Description | Selected |
| --- | --- | --- |
| Report only the project removal | Let the row's scope communicate the boundary. | ✓ |
| Add a warning | State that the user copy remains. | |
| Report both scopes | Add an unchanged status for the user copy. | |

**User's choice:** Report only the project-scoped removal row.

### Sole user-scope match

| Option | Description | Selected |
| --- | --- | --- |
| Remove the sole user match | Treat project-first as ambiguous-match precedence. | ✓ |
| Fail as absent from project | Treat omission as a project default. | |
| Require `--scope user` | Refuse the unscoped form. | |

**User's choice:** Remove the sole user-scope match.

### Scope and layer resolution

| Option | Description | Selected |
| --- | --- | --- |
| Resolve project, then enforce its target layer | Fail as local-layer-only without falling through. | ✓ |
| Skip the mismatched project layer | Remove the actionable user base-layer copy. | |
| Remove the project local layer | Let scope precedence override `--local`. | |

**User's choice:** Resolve scope first, then enforce the selected layer.

---

## Cascade Failure Behavior

### Initial atomicity question

| Option | Description | Selected |
| --- | --- | --- |
| Roll back the whole command | Leave every plugin and the marketplace unchanged. | ✓ (superseded) |
| Keep successful removals and retain the marketplace | Continue per plugin and preserve partial progress. | |
| Remove the marketplace despite failures | Permit orphaned failed plugins. | |

**User's initial choice:** Command-wide rollback.
**Notes:** This answer was superseded after code inspection exposed the shipped MR-3 continuation contract. The assistant's original recommendation incorrectly conflated atomic disk mutations with command-wide atomicity.

### Preflight blocker reporting

| Option | Description | Selected |
| --- | --- | --- |
| Report every blocker | Emit no successful rows because preflight made no change. | ✓ |
| Report only the first | Fail fast. | |
| Report every cascade member | Mark non-blockers skipped. | |

**User's choice:** Report every discovered blocker.

### Initial clean-rollback reload question

| Option | Description | Selected |
| --- | --- | --- |
| No reload | No lasting change occurred. | ✓ (superseded) |
| Reload | A removal was attempted. | |
| Conditional | Depend on whether execution began. | |

**Notes:** Superseded because the binding marketplace-remove contract continues across plugins instead of rolling back the command.

### Initial rollback-partial question

| Option | Description | Selected |
| --- | --- | --- |
| Retain marketplace, expose rollback details, reload | Make inconsistent artifacts explicit. | ✓ (superseded) |
| Remove the marketplace | Complete the top-level action. | |
| Generic failure without reload | Hide rollback detail. | |

**Notes:** Superseded by the later decision to preserve the exact shipped partial payload.

### Binding-contract correction

| Option | Description | Selected |
| --- | --- | --- |
| Preserve shipped partial results | Successful removals persist; failed plugins and the marketplace remain. | ✓ |
| Add command-wide rollback | Replace MR-3 and its existing tests and catalog contract. | |

**User's choice:** Preserve the shipped partial-result behavior.

### Exact partial payload

| Option | Description | Selected |
| --- | --- | --- |
| Preserve exactly | Successes first and reload-bearing; failures second and non-reload-bearing. | ✓ |
| Change rollback-partial failures | Add details and request reload on failure-only leakage. | |

**User's choice:** Preserve the exact shipped payload.

---

## Result Ordering

### Rows within one scope

| Option | Description | Selected |
| --- | --- | --- |
| Preserve insertion order | Match state-record and current list behavior. | ✓ |
| Sort names | Use case-insensitive alphabetical order. | |
| Sort by last update | Show most recent first. | |

**User's choice:** Preserve insertion order.

### Rows across scopes

| Option | Description | Selected |
| --- | --- | --- |
| Group project before user | Preserve LS-02 and current behavior. | ✓ |
| Sort names globally | Use scope only as a same-name tie-breaker. | |
| Interleave by last update | Ignore scope grouping. | |

**User's choice:** Group every project row before every user row.

### Successful cascade rows

| Option | Description | Selected |
| --- | --- | --- |
| Preserve execution order | Match current cascade behavior. | ✓ |
| Sort names | Use case-insensitive alphabetical order. | |
| Group direct plugins before dependencies | Expose provenance in the flat result. | |

**User's choice:** Preserve cascade execution order.

### Failed rows

| Option | Description | Selected |
| --- | --- | --- |
| Preserve discovery order | Use the traversal that found each failure. | ✓ |
| Sort names | Use case-insensitive alphabetical order. | |
| Group by failure reason | Make remediation categories define order. | |

**User's choice:** Preserve discovery order.

## Agent's Discretion

- Exact Gherkin wording, fixture names, helper boundaries, plan split, and scenario-versus-existing-coverage choices.

## Deferred Ideas

None.
