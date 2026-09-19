---
phase: 04-strict-command-arguments
plan: 02
subsystem: edge
status: complete
requirements-completed: []
completed: 2026-09-14
plan_head_before: 08fe8e65
actuals:
  commits: 1
---

# Merged reads with local flags

Marketplace info, list, and update accept and document --local. Their reads still
combine shared and local configuration; no unused local option was threaded
through orchestration, and these operations do not acquire configuration writes.

Tests cover shared-only, local-only, and overlapping declarations, including local
entry override. Both physical configuration files are compared byte-for-byte.
Four real plugin-cascade cases exercise named and bulk marketplace updates with
and without --local. They upgrade a real local plugin, assert its complete resource
inventory and notification, and preserve both configuration files exactly.

Historical add/remove/autoupdate tests that promised ignored surplus arguments
were corrected with full rejection and unchanged state/configuration assertions.
The marketplace owner suite passed 89 cases before the four additional real
cascade cases; the cascade owner subsequently passed all 12 cases. Final integrated
counts are recorded in phase verification.

README and PRD document the user-approved policy. PRD AP-5/AP-6 now require strict
arity/unknown-flag rejection and preservation of quoted arguments and scope values.
The registered rejection matrix uses the updated usage strings.

## Evidence

Logs: `/tmp/test-backlog-args-public-green.log`,
`/tmp/test-backlog-args-direct.log`, `/tmp/test-backlog-marketplace-green.log`,
`/tmp/test-backlog-marketplace-cascade-green.log`, `/tmp/test-backlog-catalog.log`,
`/tmp/test-backlog-local-direct.log`, `/tmp/test-backlog-local-direct-recheck.log`,
`/tmp/test-backlog-phase34-typecheck.log`.

Committed in `a8ef0dac` with the other coordinated Phase 4 plans. Independent goal verification passed 7/7.

Final verification passed on 2026-09-14: 6,267/6,267 unit tests, 32/32 integration tests, and clean pre-commit checks including lint, typecheck, formatting, Fallow and changed direct pairs. All 227 production LCOV records retain exact coverage: 63,374/63,374 lines, 1,851/1,851 functions and 9,145/9,145 branches. Workflow, correspondence and direct-coverage negative controls also pass. The two unrelated direct shortfall pins remain unchanged.

Evidence: `/tmp/test-backlog-phase34-unit-final.log`, `/tmp/test-backlog-phase34-integration.log`, `/tmp/test-backlog-phase34-precommit-final.log`, and the phase VERIFICATION.md report. Earlier checkpoints above remain historical measurements.
