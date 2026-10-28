# Phase 10 Coverage Ledger

This ledger maps the Phase 10 test and cross-phase backlog to exact automated
evidence. The final reconciliation in Plan 10-07 checks that every source item
has exactly one row.

## Package Process-Tree Disposition

The package process-tree case remains unit-only. The public command surface
uses the production 60-second package-manager timeout and does not expose a
shorter timeout. A Cucumber scenario would therefore add more than one minute
to the normal suite and still depend on process scheduling. Adding a
test-only production timeout seam is forbidden because it would make the
scenario exercise a path users cannot select.

The existing real-child case is discriminating:
`test/platform/package-manager.test.ts#D-PL9-19: stops the whole process tree
of a package manager that outlives the timeout`. It starts a parent which
starts a grandchild that ignores `SIGTERM`; the grandchild would print
`late\n` after the grace period if it survived. The asserted output is exactly
`started\n`, with `timedOut: true`, so either a surviving parent or descendant
makes the test fail. The adjacent POSIX owner case also asserts `SIGTERM` then
`SIGKILL` are sent to the process group and never only to the direct child.

Disposition: `unit-with-reason`. Evidence commit: `fc8e78bc` (the existing
D-PL9-19 real-child proof); re-run on 2026-10-27 with Node v26.12.1, exit 0,
one matching test and no skipped or todo tests.
