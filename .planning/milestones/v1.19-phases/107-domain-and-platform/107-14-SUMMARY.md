---
phase: 107-domain-and-platform
plan: 14
status: complete
requirements: [MOD-01]
---

# GitHub Authentication Summary

Replaced the Device Flow mirror with 35 isolated cases. Strict mocks define the
HTTP, notification, credential, and polling-wait interactions. Fetch-backed
adapter cases use context-owned stubs and fresh responses.

The cases cover both providers, interval behavior, every terminal outcome,
timeouts, cancellation, thrown and non-error failures, credential persistence,
request bytes, response validation, and every token response shape. The
fetch-backed adapter is private. A polling-wait dependency prevents real test
delays without changing the production default.

## Verification

- The focused test passes all 35 cases.
- Ten affected authentication tests pass.
- ESLint, TypeScript, Prettier, and diff checks pass.
- Direct coverage passes with 77 of 77 branches, ten functions, and 439 of 439
  lines.
