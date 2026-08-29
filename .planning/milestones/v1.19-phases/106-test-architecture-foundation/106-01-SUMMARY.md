---
phase: 106-test-architecture-foundation
plan: 01
status: complete
requirements: [COV-02, COV-03]
---

# Direct Coverage Runner Summary

Added `strong-mock` as the strict interaction-mock library. Added one direct
coverage runner for focused, changed-pair, and all-pair use.

The runner derives the mirror from either member of a source-test pair. It runs
the test alone and reads only the paired source record from LCOV. It requires
complete function, line, and branch coverage.

The runner has one narrow exception for a type-only module. A negative control
proves that a runtime module cannot use this exception.

## Verification

- The type-only and runtime negative controls pass.
- The `domain/name` source and test paths report the same incomplete counts.
- A missing path and an unrelated path return errors.
- Changed-pair mode succeeds when no changed pair exists.
- All-pair mode fails on the first missing mirror during migration.
