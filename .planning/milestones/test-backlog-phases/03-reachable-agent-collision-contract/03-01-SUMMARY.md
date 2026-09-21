---
phase: 03-reachable-agent-collision-contract
plan: 01
subsystem: agents
status: complete
requirements-completed: []
key-files:
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/convert.ts
    - scripts/test-coverage-direct.pin.json
completed: 2026-09-14
---

# Validated tool mapping

The existing AG-11 validator is now an assertion function. It narrows the
explicit tool mapping to a nonempty tuple and preserves the omitted arm.
`toolsFields` accepts that validated mapping and emits it directly. The
second unreachable throw is removed without casts, new exports, exclusions,
or changes to user-facing validation errors.

The complete existing converter owner passed 39 cases. Direct coverage:
749/749 lines, 25/25 functions, 124/124 branches. The gate correctly rejected
the old shortfall pin as obsolete; removing only the converter row made the
gate pass. The command-discovery and install-outcome pins remain intact.

Full unit measurement outside the sandbox on Node v26.8.2:

- 6,016 tests passed; zero failures or skips.
- 227 production LCOV records.
- Lines: 63,343/63,343.
- Functions: 1,851/1,851.
- Branches: 9,111/9,111.
- Typecheck and full ESLint passed.

Logs: `/tmp/test-backlog-agent-direct.log`,
`/tmp/test-backlog-agent-typecheck.log`, `/tmp/test-backlog-unit-restored.log`,
`/tmp/test-backlog-sonar-full-lint.log`. Coverage data: `coverage/unit.lcov`.

This restores FINAL-01's starting invariant. FINAL-01 remains open until
the full milestone's final verification; this summary does not prematurely
close it. Collision-contract work remains a separate plan in this phase.

## Finalization

Committed in `b663bc68` with the other coordinated Phase 3 plans. Independent phase verification passed 18/18.

Final verification passed on 2026-09-14: 6,267/6,267 unit tests, 32/32 integration tests, and clean pre-commit checks including lint, typecheck, formatting, Fallow and changed direct pairs. All 227 production LCOV records retain exact coverage: 63,374/63,374 lines, 1,851/1,851 functions and 9,145/9,145 branches. Workflow, correspondence and direct-coverage negative controls also pass. The two unrelated direct shortfall pins remain unchanged.

Evidence: `/tmp/test-backlog-phase34-unit-final.log`, `/tmp/test-backlog-phase34-integration.log`, `/tmp/test-backlog-phase34-precommit-final.log`, and the phase VERIFICATION.md report. Earlier checkpoints above remain historical measurements.
