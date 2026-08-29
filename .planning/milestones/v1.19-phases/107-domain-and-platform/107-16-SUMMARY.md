---
phase: 107-domain-and-platform
plan: 16
status: complete
requirements: [MOD-01]
---

# Git Credential Adapter Summary

Replaced the shell-driven credential tests with 16 direct cases. The adapter
now accepts a narrow process factory and timeout while its default operations
still use `git credential` with the same non-interactive environment.

The cases cover wire input and output, incomplete credentials, process and exit
failures, timeouts, control characters, best-effort writes, and a missing Git
executable. They do not access a configured credential helper or keychain.

## Verification

- The focused and affected tests pass all 53 cases.
- ESLint and TypeScript checks pass.
- Direct coverage passes with 45 of 45 branches, 19 functions, and 316 of 316
  lines.
