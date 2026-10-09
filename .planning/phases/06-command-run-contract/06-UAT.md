---
status: testing
phase: 06-command-run-contract
source: [06-VERIFICATION.md]
started: "2026-10-09T23:32:54.832192+00:00"
updated: "2026-10-09T23:32:54.832192+00:00"
---

# Command-run contract human verification

## Current Test

number: 1
name: Invocation correlation and failure presentation
expected: |
  Accept both intent judgments below, or identify the item that needs changes.
awaiting: user response

## Tests

### 1. Invocation IDs serve only command-run correlation

expected: Each command gets a fresh ID. Pi can retain that ID in its session entries. No persistent user identifier, cross-command tracking relationship, or telemetry is introduced. Load and hook roots carry no command ID.
result: [pending]

Evidence: The verifier traced per-run allocation, local state, strict origin
projection, and all production identity consumers. Session retention is
explicit here. It is not a claim that IDs exist only in memory.

### 2. Failure output does not imply rollback

expected: `Command failed unexpectedly.` and its redacted causes report failure without claiming that completed changes were undone. Completed changes remain, previously known needsReload stays true, and transport recovery neither retries nor rolls back business work.
result: [pending]

Evidence: The verifier inspected the exact payload wording and passing
partial-success, retained-state, reload, and recovery tests. This item asks
for acceptance of what that output communicates to a consumer.

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

None found. All 15 positive verification truths passed. These two items
are descriptor-less intent constraints and require human judgment.
The user's earlier option 1 accepted redaction behavior only. That decision
remains resolved and is not repeated here.
