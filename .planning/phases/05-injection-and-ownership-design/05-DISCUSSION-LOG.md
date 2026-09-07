# Phase 5: Injection and Ownership Design - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-07
**Phase:** 05-injection-and-ownership-design
**Areas discussed:** Hidden dependency classification, Mutable state ownership, Public contract cleanup

---

## Hidden Dependency Classification

| Option                                            | Description                                                                                         | Selected |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------- |
| Classify each use and prefer real temporary state | Use real case-owned state by default and a narrow production port only for irreproducible behavior. | ✓        |
| Inject every filesystem operation                 | Put all filesystem access behind injected operations regardless of reproducibility.                 |          |
| Keep process-global patching                      | Preserve builtin namespace mutation in shared-process tests.                                        |          |

**User's choice:** Apply the agent's recommended option under autonomous interactive delegation.
**Notes:** Exactly two composition-flow exceptions remain: `applyReconcile` and `bootstrapClaudePlugin`. This does not exempt their independent state-read or fault-control boundaries.

## Mutable State Ownership

| Option                               | Description                                                                                         | Selected |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- | -------- |
| Explicit lifecycle/factory instances | Give hooks state and completion caches production-owned instances; tests construct fresh instances. | ✓        |
| Module singletons with reset exports | Keep global cells and expose resets for isolation.                                                  |          |
| Disable stateful behavior            | Remove caching and lifecycle continuity instead of owning them.                                     |          |

**User's choice:** Apply the agent's recommended option under autonomous interactive delegation.
**Notes:** Hooks state belongs to the extension lifecycle. Completion caching belongs to the extension or command composition lifetime. Production lifecycle actions may invalidate state, but test setup is not a valid reason for an exported reset.

## Public Contract Cleanup

| Option                       | Description                                                           | Selected |
| ---------------------------- | --------------------------------------------------------------------- | -------- |
| Trace-preserving removal     | Remove or privatize test-shaped surfaces and test public behavior.    | ✓        |
| Label test surfaces internal | Keep the same exports with documentation discouraging production use. |          |
| Add a testing API            | Formalize resets and constants as a separate public testing surface.  |          |

**User's choice:** Apply the agent's recommended option under autonomous interactive delegation.
**Notes:** Remove the `BOOLEAN_FLAGS` export/import and tautological case while preserving the independent catalog pin. Phase 5 prepares genuine contracts only; Phase 6 owns the approved split program.

## the agent's Discretion

- Exact object representation, type names, file placement, and migration order.
- Smallest consumer-owned port boundary for each ledger-authorized irreproducible case.
- Temporary internal adapters that disappear before Phase 5 closes.

## Deferred Ideas

- Global builtin-patch removal and the large-module split program remain in Phase 6.
- No `bridges/skills/stage.test.ts` or pid-table work without a dedicated terminal finding.
- Stale architecture-count documentation remains deferred.
