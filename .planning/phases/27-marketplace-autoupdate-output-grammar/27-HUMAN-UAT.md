---
status: complete
phase: 27-marketplace-autoupdate-output-grammar
source: [27-VERIFICATION.md]
started: 2026-05-31T00:07:43Z
updated: 2026-05-31T00:16:00Z
---

## Current Test

[testing complete]

## Tests

### 1. List surface renders no `<last-updated>` marker in live output
expected: Run `/claude:plugin marketplace list` with a marketplace that has `lastUpdatedAt` populated in state. The header renders `● <mp> [<scope>] <autoupdate>` (or no autoupdate marker) with no ISO timestamp / `<last-updated …>` token anywhere on the line.
result: pass

### 2. Autoupdate flip renders marker grammar in live output
expected: Run `/claude:plugin marketplace autoupdate <name>` then `noautoupdate <name>` (fresh flips), then repeat each (idempotent). Fresh flips render `● <mp> [<scope>] <autoupdate>` / `<no autoupdate>`; idempotent repeats render `<autoupdate> {already autoupdate}` / `<no autoupdate> {already no autoupdate}` at `warning` severity with no `/reload` trailer. The old `(autoupdate enabled/disabled)` and `(skipped) {already enabled/disabled}` forms must not appear.
result: pass
note: |
  Marker grammar, warning severity, and no `/reload` trailer all confirmed in live output.
  User observed the host severity label prefix on the idempotent no-op, e.g.
  `Warning: ● uat-mp [user] <autoupdate> {already autoupdate}`. This is the host's
  faithful rendering of the intentional `warning` severity (Phase 27 keeps idempotent
  flips at `warning`), NOT a Phase 27 grammar defect. Removing the `Warning:` prefix on
  benign no-ops is Phase 28 / UXG-02 (demote benign no-ops to `info`); label-on-cascade
  handling is UXG-03. Pre-flagged in 27-REVIEW.md as IN-03 (deferred, not a regression).

### 3. `marketplace update` no-op renders `(skipped) {up-to-date}` in live output
expected: Run `/claude:plugin marketplace update <name>` against an unchanged path-source marketplace (autoupdate OFF). The line renders `● <mp> [<scope>] (skipped) {up-to-date}` at `warning` severity with no `/reload` trailer — not `(updated)`. A genuinely-changed update still renders `(updated)`.
result: issue
reported: "looks good for some (save for the warning), but the claude-plugins-official marketplace always says `● claude-plugins-official [user] (updated)` -- i don't think it can tell when we picked new changes via git"
severity: major
note: |
  PATH-source no-op works (renders `(skipped) {up-to-date}`) — partial pass.
  GITHUB-source no-op is broken: `claude-plugins-official` (github) always renders
  `(updated)`, never `(skipped) {up-to-date}`. The "save for the warning" remark is
  the same deferred UXG-02/Phase 28 severity-label item (Test 2), NOT part of this gap.
  Suspected root cause (refreshRecord github branch, update.ts:285-313): the manifest
  content-compare `preKey !== postKey` always reads as changed for github. Prime
  suspects per 27-REVIEW.md: WR-01 (loadMarketplaceManifest uses raw JSON.parse, not
  .Parse — no canonical key order), WR-02 (bare `catch {}` makes an unreadable PRE
  manifest default to "changed"), WR-03 (github no-op was never actually tested).

## Summary

total: 3
passed: 2
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "`marketplace update` against an unchanged github-source marketplace renders `● <mp> [<scope>] (skipped) {up-to-date}`, not `(updated)`"
  status: failed
  reason: "User reported: looks good for some (save for the warning), but the claude-plugins-official marketplace always says `● claude-plugins-official [user] (updated)` -- i don't think it can tell when we picked new changes via git"
  severity: major
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
