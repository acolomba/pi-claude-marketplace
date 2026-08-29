---
phase: 107-domain-and-platform
plan: 05
status: complete
requirements: [MOD-01]
---

# Clone Key Summary

Replaced the clone key mirror with ten cases grouped by its three exports.
Every key expectation is a fixed known string. The test no longer computes an
expected hash with the same algorithm as production.

The cases cover URL and SHA sensitivity, verbatim URL hashing, and all three
git source shapes.

## Verification

- The focused test passes all ten cases.
- ESLint and TypeScript checks pass.
- Direct coverage passes with six of six branches, three functions, and 83 of
  83 lines.
