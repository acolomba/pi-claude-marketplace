---
phase: 107-domain-and-platform
plan: 12
status: complete
requirements: [MOD-01]
---

# Hook Tool-Name Summary

Replaced the architecture test with the module's corresponding mirror. The 15
cases cover the complete public reverse map, every built-in forward mapping,
custom-name pass-through, Claude-form pass-through, and the literal type
boundary.

The forward map and its conditional helper type are now private. Production
callers still use the public reverse map, `PiToolName`, and translation
function.

## Verification

- The focused test passes all 15 cases.
- ESLint and TypeScript checks pass.
- Direct coverage passes with three of three branches, one function, and 133 of
  133 lines.
