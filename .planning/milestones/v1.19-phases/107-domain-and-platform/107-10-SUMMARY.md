---
phase: 107-domain-and-platform
plan: 10
status: complete
requirements: [MOD-01]
---

# Version Summary

Replaced the version mirror with seven cases. Each filesystem case owns a
private temporary tree. Fixed complete hashes cover empty, nested, ignored,
normalized, carriage-return, and symlink behavior.

The walk filter is now private. The unused SHA regular expression and predicate
are removed. Shared rendering cases no longer live in this test. An in-range
Buffer read replaces an unreachable undefined guard.

## Verification

- The focused test passes all seven cases.
- ESLint and TypeScript checks pass.
- Direct coverage passes with 25 of 25 branches, six functions, and 107 of 107
  lines.
