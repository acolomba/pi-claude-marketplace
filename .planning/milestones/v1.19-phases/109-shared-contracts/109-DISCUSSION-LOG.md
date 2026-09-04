# Phase 109: Shared Contracts - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-29
**Phase:** 109-Shared Contracts
**Areas discussed:** Notification suite consolidation

---

## Notification Suite Consolidation

### Legacy suite disposition

| Option      | Description                                                                                    | Selected |
| ----------- | ---------------------------------------------------------------------------------------------- | :------: |
| Consolidate | Absorb legacy notification coverage into mirrored owner tests and retire the old suites.       |    ✓     |
| Reclassify  | Add the owner test but retain genuinely architectural or integration suites after moving them. |          |
| Exempt      | Keep legacy shared suites by adding correspondence-gate exceptions.                            |          |

**User's choice:** Consolidate into mirrored owner tests.
**Notes:** The owner tests replace the legacy layout; the correspondence gate does not gain
an exception.

### Cross-module cases

| Option               | Description                                                                                       | Selected |
| -------------------- | ------------------------------------------------------------------------------------------------- | :------: |
| Split by ownership   | `notify-context.test.ts` proves dispatch; `notify.test.ts` proves exact bytes; remove duplicates. |    ✓     |
| Preserve integration | Add both owners and retain one cross-module integration case.                                     |          |
| Duplicate            | Copy cross-module cases into both owner tests.                                                    |          |

**User's choice:** Split by ownership.
**Notes:** The distinct contract survives under its owning production module, without a
duplicate supplemental copy.

### Exact output matrix

| Option           | Description                                                                                                | Selected |
| ---------------- | ---------------------------------------------------------------------------------------------------------- | :------: |
| Named data rows  | Group by public status and give every row an independent exact byte string plus separate lowercase phases. |    ✓     |
| Standalone cases | Use one standalone `test()` block for every output variant.                                                |          |
| Snapshots        | Store expected output in snapshot or fixture files.                                                        |          |

**User's choice:** Named data rows with exact bytes.
**Notes:** Data rows still use distinct lowercase arrange, act, and assert phases.

### Deduplication policy

| Option                      | Description                                                                           | Selected |
| --------------------------- | ------------------------------------------------------------------------------------- | :------: |
| Preserve distinct contracts | Keep every distinct public behavior; remove duplicate cases and migration commentary. |    ✓     |
| Port one-for-one            | Keep every legacy case even when several prove the same behavior.                     |          |
| Coverage minimum            | Retain only the smallest set needed for direct coverage.                              |          |

**User's choice:** Preserve distinct contracts and deduplicate.
**Notes:** Durable public/spec identifiers remain where useful; historical file movement and
work-session commentary do not.

## the agent's Discretion

- Exact section ordering, local data-row shapes, and behavior-focused case titles.
- Precise legacy-case-to-owner mapping when one old test exercises more than one module.
- Behavior-preserving internal refactors that meet the milestone's production-design rules.

## Deferred Ideas

None.
