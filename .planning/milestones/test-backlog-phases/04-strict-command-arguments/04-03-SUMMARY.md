---
phase: 04-strict-command-arguments
plan: 03
subsystem: edge
status: complete
requirements-completed: [ARGS-01, ARGS-02, ARGS-03]
completed: 2026-09-14
plan_head_before: 08fe8e65
actuals:
  commits: 1
---

# Complete marketplace flag catalog

The catalog now includes all 19 canonical plugin and marketplace verbs. Completion
resolves the full marketplace command and its ls/rm aliases, consumes all catalog
boolean flags when locating the positional argument, and keeps name completion
working after --local. Bootstrap no longer offers unsupported scope suggestions.

Read-only marketplace flag descriptions explicitly describe merged reads and no
configuration writes. Existing write commands keep their file-selection meaning.
The router/catalog inventory comparison includes every alias. Independent accepted
flag pins and real owner tests are distinct from catalog-derived completion
consistency; missing/extra flag controls fail the same comparison used by the gate.

Catalog, completion, and drift suite: 134 tests passed. Typecheck passed. Direct
provider and catalog measurements passed; final counts and integrated validation
are recorded in phase verification. No thresholds or production exclusions changed.

## Evidence

Logs: `/tmp/test-backlog-args-public-green.log`,
`/tmp/test-backlog-args-direct.log`, `/tmp/test-backlog-marketplace-green.log`,
`/tmp/test-backlog-marketplace-cascade-green.log`, `/tmp/test-backlog-catalog.log`,
`/tmp/test-backlog-local-direct.log`, `/tmp/test-backlog-local-direct-recheck.log`,
`/tmp/test-backlog-phase34-typecheck.log`.

Committed in `a8ef0dac` with the other coordinated Phase 4 plans. Independent goal verification passed 7/7.

Final verification passed on 2026-09-14: 6,267/6,267 unit tests, 32/32 integration tests, and clean pre-commit checks including lint, typecheck, formatting, Fallow and changed direct pairs. All 227 production LCOV records retain exact coverage: 63,374/63,374 lines, 1,851/1,851 functions and 9,145/9,145 branches. Workflow, correspondence and direct-coverage negative controls also pass. The two unrelated direct shortfall pins remain unchanged.

Evidence: `/tmp/test-backlog-phase34-unit-final.log`, `/tmp/test-backlog-phase34-integration.log`, `/tmp/test-backlog-phase34-precommit-final.log`, and the phase VERIFICATION.md report. Earlier checkpoints above remain historical measurements.
