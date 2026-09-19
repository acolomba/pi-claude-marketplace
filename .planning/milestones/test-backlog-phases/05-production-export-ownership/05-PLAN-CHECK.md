## ISSUES FOUND

**Phase:** 05-production-export-ownership
**Plans checked:** 28
**Issues:** 0 blockers, 2 warnings, 0 info

The plan set covers EXPORT-01 and EXPORT-02. The validation strategy maps every snapshot finding category and identity to an owner, requires a reviewed census delta after every stable wave, and makes 05-28 require an empty complete production report. Wave file ownership is disjoint, dependencies are acyclic and correctly ordered, and the final plan preserves `production: { deadCode: true, health: false, dupes: false }`, `includeEntryExports: true`, the narrow entry-default annotation, and the proven `RingBuffer.read` annotation. It also preserves aggregate production-unit coverage separately from direct-pair coverage.

### Warnings

**1. [nyquist_compliance] Each automated verification states the output or exit condition that makes it fail.**
- Plan: phase-wide (05-01 through 05-28)
- Evidence: Every task supplies an `<automated>` command, but none supplies a sibling `<fails_when>`. The validation strategy describes several failure modes globally, but it does not associate them with each task command.
- Example fix (non-binding): Add task-level failing directions, or an equally executable mapping from each command to its required exit/output condition.

**2. [scope_sanity] Large owner batches remain reviewable within their execution context.**
- Plan: 05-05, 05-08, 05-10, 05-13 through 05-16, 05-21 through 05-23, 05-28
- Evidence: These plans declare 10-14 modified files each. Their tasks are conceptually coherent and estimates stay below the 100,000-token budget, but the file count exceeds the normal 10-file warning threshold. This makes complete assertion mapping and direct-coverage repair easier to miss.
- Example fix (non-binding): Retain the batches only with a per-task assertion/coverage ledger, or split a batch around an independently executable concern.

### Structured Issues

```yaml
issues:
  - plan: null
    dimension: nyquist_compliance
    severity: warning
    required_property: "Each automated verification states the output or exit condition that makes it fail"
    description: "Plans 05-01 through 05-28 contain automated verification commands but no <fails_when> siblings; global validation prose does not bind a failing direction to each command."
    fix_hint: "Add task-level failing directions or an executable command-to-failure mapping."
  - plan: "05-05, 05-08, 05-10, 05-13..05-16, 05-21..05-23, 05-28"
    dimension: scope_sanity
    severity: warning
    required_property: "Large owner batches remain reviewable within their execution context"
    description: "These plans each modify 10-14 files, above the normal 10-file warning threshold, despite estimates being below the calibrated 100,000-token budget."
    fix_hint: "Use a per-task assertion/coverage ledger or split independent concerns."
```

### Recommendation

Two warnings require revision under the plan-review contract. There are no goal-achievement, dependency, ownership, assertion-preservation, or coverage blockers in the submitted plan set.

### Revision verification

The parent verified all 28 plans after revision: every automated command has a failing direction, and each plan requires a per-task assertion/coverage ledger. The 10–14 file groups retain coherent ownership and tasks of at most five files. Both warnings are resolved; the plan set is approved for execution. Original findings above are retained as review history.
