# Phase 113: Orchestrator Support and Presenters - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-31
**Phase:** 113-Orchestrator Support and Presenters
**Areas discussed:** Classifiers and planners, message producers, offline collaborator boundaries, ordering and isolation

---

The user selected all four proposed gray areas. Every question below was answered with
option 1.

## Classifiers and planners

### Behavior-matrix depth

| Option               | Description                                                                                               | Selected |
| -------------------- | --------------------------------------------------------------------------------------------------------- | -------- |
| Partition-complete   | Test every meaningful branch and boundary; enumerate only small closed state spaces exhaustively.         | ✓        |
| Full cross-product   | Test every input combination even when combinations are behaviorally redundant.                           |          |
| Representative cases | Cover the main success, failure, and boundary examples needed for direct coverage.                         |          |

### Returned decisions and diagnostics

| Option                     | Description                                                                                         | Selected |
| -------------------------- | --------------------------------------------------------------------------------------------------- | -------- |
| Complete structured values | Assert the entire result, including codes, reasons, severity, scope, ordering, and omitted fields. | ✓        |
| Decision fields only       | Assert classification or action and test diagnostic details selectively.                           |          |
| Observable effects only    | Assert downstream calls and output instead of the helper's full result.                            |          |

### Malformed and unexpected inputs

| Option             | Description                                                                                                         | Selected |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- | -------- |
| Boundary-realistic | Test malformed values that can enter through files, environment, subprocess results, or external data.             | ✓        |
| Force every fallback | Cast impossible internal states to drive all defensive/default branches.                                            |          |
| Typed inputs only  | Rely entirely on TypeScript and test only valid union members.                                                       |          |

### Matrix expression

| Option                 | Description                                                                                              | Selected |
| ---------------------- | -------------------------------------------------------------------------------------------------------- | -------- |
| Literal table cases    | Put each named input and its complete literal expected result in the case table; never calculate answers. | ✓        |
| Separate test cases    | Write each partition as an individual `test()` block.                                                     |          |
| Generated expectations | Calculate results through a test-side reference implementation.                                          |          |

## Message producers

### Presenter assertion level

| Option                 | Description                                                                                     | Selected |
| ---------------------- | ----------------------------------------------------------------------------------------------- | -------- |
| Both layers            | Assert complete structured messages or contexts and exact rendered row bytes owned by the module. | ✓        |
| Structured values only | Leave rendered text entirely to shared notification tests.                                      |          |
| Rendered output only   | Assert final text without separately checking structured fields.                                |          |

### Ordering rule

| Option                     | Description                                                                                                    | Selected |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- | -------- |
| Contract-specific ordering | Alphabetize inventories and presentation-only collections; preserve behavioral input, scope, and operation order. | ✓        |
| Alphabetical everywhere    | Normalize every emitted collection before rendering.                                                          |          |
| Producer order everywhere  | Preserve caller order for every collection.                                                                   |          |

### Reload and trailer behavior

| Option                  | Description                                                                                                     | Selected |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- | -------- |
| Complete trailer matrix | Assert presence or absence, exact text, whitespace placement, tallies, and singular/plural behavior.           | ✓        |
| Representative commands | Prove full trailers for selected commands and only presence elsewhere.                                          |          |
| Shared helper only      | Leave reload formatting entirely to central notification tests.                                                 |          |

### Status-specific fields

| Option                     | Description                                                                                             | Selected |
| -------------------------- | ------------------------------------------------------------------------------------------------------- | -------- |
| Behavior-changing variants | Cover each status and every field combination that changes output or severity; TypeScript guards impossibilities. | ✓        |
| Full field cross-product   | Test every present/absent combination even when output is identical.                                    |          |
| One case per status        | Choose one representative field set for each status.                                                    |          |

## Offline collaborator boundaries

### Filesystem and external dependencies

| Option                                | Description                                                                                                  | Selected |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| Real temporary filesystem plus fakes  | Use case-owned real files and injected fakes for git, network, subprocess, credentials, and Pi APIs.         | ✓        |
| Fake every dependency                 | Replace filesystem and external operations with in-memory doubles.                                           |          |
| Use real integrations                 | Exercise actual git and loopback services wherever practical.                                                |          |

### Offline proof

| Option             | Description                                                                                                      | Selected |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- | -------- |
| Two-layer proof    | Use fail-fast external fakes in owners and architecture gates that prohibit direct network imports.              | ✓        |
| Architecture only  | Rely on source scanning alone.                                                                                   |          |
| Behavior only      | Rely on successful cases without an explicit no-network assertion.                                               |          |

### Collaborator-call strictness

| Option                     | Description                                                                                                  | Selected |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| Contract-relevant schedules | Assert exact args, count, and order for scope precedence, cache reuse, host choice, and once-only auth.     | ✓        |
| Every call exactly         | Freeze the complete collaborator sequence, including incidental implementation details.                     |          |
| Results only               | Assert only outputs and filesystem state.                                                                   |          |

### Injected failures

| Option                    | Description                                                                                                     | Selected |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- | -------- |
| Semantic failure points   | Fail every meaningful operation, including later scheduled calls, then assert result, cleanup, and continuation. | ✓        |
| One failure per module    | Use one representative collaborator error for the module.                                                       |          |
| Generic rejection only    | Assert only that an error propagates.                                                                           |          |

## Ordering and isolation

### Alphabetical-order scope

| Option                       | Description                                                                                                  | Selected |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| Presentation and inventories | Alphabetize user-visible inventories, static catalogs, and non-behavioral test tables; preserve behavioral order. | ✓        |
| All declarations and cases   | Alphabetize source maps, test declarations, and expected arrays unless compilation prevents it.             |          |
| User-visible output only     | Leave tests and internal inventories in their existing order.                                                |          |

### Per-case isolation

| Option               | Description                                                                                                     | Selected |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | -------- |
| Case-local isolation | Each case owns temp files, fakes, expected values, and environment restoration; cases never depend on peers.   | ✓        |
| Suite-local isolation | Share mutable fixtures when suite hooks reset them.                                                            |          |
| File-level isolation | Rely on the runner's separate process and permit within-file state sharing.                                    |          |

### Persistent module state

| Option               | Description                                                                                                      | Selected |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- | -------- |
| Fresh public state   | Create fresh maps/collaborators and use production lifecycle APIs or process isolation; add no test-only seams. | ✓        |
| Fresh module imports | Dynamically re-import with cache-busting specifiers.                                                            |          |
| Explicit reset hooks | Export test-only state-reset functions.                                                                         |          |

### Duplicate existing tests

| Option                        | Description                                                                                                     | Selected |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- | -------- |
| Consolidate by responsibility | Move single-module proof into owners; retain only real cross-module, integration, parity, or architecture tests. | ✓        |
| Keep both                     | Add complete owner proof while preserving all duplicate cases.                                                  |          |
| Owner tests only             | Remove all supplemental tests, including genuine cross-module proof.                                            |          |

---

_Discussion completed: 2026-08-31_
