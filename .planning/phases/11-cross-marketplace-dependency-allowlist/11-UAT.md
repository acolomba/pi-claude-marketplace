---
status: testing
phase: 11-cross-marketplace-dependency-allowlist
source: [11-VERIFICATION.md]
started: 2026-09-23T18:56:09Z
updated: 2026-09-23T18:56:09Z
---

# Phase 11 Human Verification

## Current Test

number: 1
name: Added marketplace does not grant automatic dependency permission
expected: |
  An added marketplace alone does not authorize a new foreign dependency.
  The refusal says that the root marketplace's allowlist controls the install.
awaiting: user response

## Tests

### 1. Added marketplace does not grant automatic dependency permission

Review the `dependency-cross-marketplace` example in `docs/output-catalog.md`.
The `tools` marketplace is available, while `official` does not list it.

expected: The refusal says that `official` does not allow `tools`. It must not
describe adding `tools` as sufficient permission for automatic installation.
result: [pending]

### 2. Manual installation remains an explicit remedy

Review the same refusal and the `reconcile-dependency-cross-marketplace`
example in `docs/output-catalog.md`.

expected: The refusal names the dependency to install manually first and
separately offers an edit to the named root marketplace's
`allowCrossMarketplaceDependenciesOn` list.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

None reported.
