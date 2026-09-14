---
status: testing
phase: 01-manifest-read-fidelity
source: [01-VERIFICATION.md]
started: 2026-09-14T16:00:32Z
updated: 2026-09-14T16:00:32Z
---

## Current Test

number: 1
name: Live ui5 plugin installation
expected: |
  Install the actual ui5 marketplace plugin in a disposable Pi scope.
  Eight expected skills are installed and no duplicate-skill warning appears.
awaiting: user response

## Tests

### 1. Live ui5 plugin installation

expected: Install the actual ui5 marketplace plugin in a disposable Pi scope and capture its output and installed skills. Eight expected skills are installed and no duplicate-skill warning appears.
result: [pending]

### 2. Live ui-theme-designer plugin installation

expected: Install the actual ui-theme-designer marketplace plugin in a disposable Pi scope and capture its output and installed skills. Both expected skills are installed and no duplicate-skill warning appears.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

No implementation gaps remain. Local fixtures verify the declared shapes, but do not establish the named live-plugin installation criterion in ROADMAP.md.
