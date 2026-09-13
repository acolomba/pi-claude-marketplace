# Phase 4: Hermetic Test Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution
> agents. Decisions are captured in CONTEXT.md; this log preserves the
> alternatives considered.

**Date:** 2026-09-07
**Phase:** 04-hermetic-test-infrastructure
**Areas discussed:** Hermetic environment boundaries, function-bearing call
snapshots, authentication proofs, typed values and role-based naming

---

## Hermetic Environment Boundary

| Option                                       | Description                                                                                                        | Selected |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------- |
| Case-owned root with full precedence control | Pin `PI_CODING_AGENT_DIR` and any consulted home input beneath one temporary root, then restore exact prior state. | ✓        |
| Replace `HOME` only                          | Isolate the home fallback but allow an ambient higher-precedence Pi agent directory.                               |          |
| Production test seam                         | Add a production-only location override to make tests choose synthetic paths.                                      |          |

**User's choice:** The user delegated the choice to the agent's best judgment.

**Notes:** Production location resolution gives `PI_CODING_AGENT_DIR` precedence,
so changing only `HOME` is not hermetic. A test-owned environment boundary
preserves the real production path without exposing developer state.

---

## Function-Bearing Call Snapshots

| Option                     | Description                                                                                         | Selected |
| -------------------------- | --------------------------------------------------------------------------------------------------- | -------- |
| Explicit typed snapshot    | Copy data fields deliberately and retain the production auth bundle with usable callback functions. | ✓        |
| Caller-side auth stripping | Make each consumer remove auth before recording and observe it through a parallel path.             |          |
| Generic serialization      | Stringify or erase function-bearing values to keep one generic snapshot mechanism.                  |          |

**User's choice:** The user delegated the choice to the agent's best judgment.

**Notes:** `GitAuthBundle` deliberately contains functions. Rejecting it with
`structuredClone`, or hiding it from the shared fake, makes the double less
capable than the production collaborator and prevents realistic failure tests.

---

## Authentication Proofs

| Option                                | Description                                                                                                                           | Selected |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Public-path hostile and failure cases | Prove exact hostile-host rejection, optional collaborator wiring, and callback failure propagation through production-shaped bundles. | ✓        |
| Predicate-only coverage               | Test host predicates in isolation and leave orchestration wiring implicit.                                                            |          |
| Friendly fixtures only                | Cover supported hosts and successful callbacks without adversarial neighbors or propagated failures.                                  |          |

**User's choice:** The user delegated the choice to the agent's best judgment.

**Notes:** The selected cases separate domain matching, dependency wiring, and
error propagation while keeping all network behavior injected and offline.

---

## Typed Values and Double Naming

| Option                       | Description                                                                                                                     | Selected |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Exact traced migration       | Rename the 16 selected factories by collaborator role and replace only terminally traced broad casts and test-shaped artifacts. | ✓        |
| Repository-wide rename       | Replace all `Mock` and `Fake` names, including unrelated established domain fakes.                                              |          |
| Preserve fixture terminology | Keep the current names and broad asserted objects because they occur only in tests.                                             |          |

**User's choice:** The user delegated the choice to the agent's best judgment.

**Notes:** The exact traced migration satisfies `MF-DEC-08` without turning a
test-infrastructure correction into a repository-wide vocabulary rewrite. Real
safety checks and intentional reusable fake types remain intact.

---

## the agent's Discretion

- The user delegated every Phase 4 gray-area choice to the agent's best
  judgment and requested autonomous continuation.
- Exact local helper names, snapshot implementation, and plan ordering remain
  implementation discretion within the contracts recorded in CONTEXT.md.

## Deferred Ideas

- Gate-integrity and unused-member work remains assigned to Phase 7.
- Production enable/disable refactors and general module splitting retain their
  existing roadmap routes.
- Untraced fake families are not part of the selected naming migration.
