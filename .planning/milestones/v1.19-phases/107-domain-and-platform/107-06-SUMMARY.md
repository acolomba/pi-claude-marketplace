---
phase: 107-domain-and-platform
plan: 06
status: complete
requirements: [MOD-01]
---

# Hook If-Target Table Summary

Added the missing hook if-target mirror. One case compares the complete mapping
with independent sets. A second case owns the prefix precedence order.

The test does not copy parser or predicate behavior from the consuming bridge.

## Verification

- The focused test passes both cases.
- ESLint and TypeScript checks pass.
- Direct coverage passes with one branch and 94 of 94 lines.
