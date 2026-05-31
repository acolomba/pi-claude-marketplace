---
status: resolved
phase: 27-marketplace-autoupdate-output-grammar
source: [27-VERIFICATION.md]
started: 2026-05-31T00:07:43Z
updated: 2026-05-31T10:16:29Z
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
expected: Run `/claude:plugin marketplace update <name>` against an unchanged path-source marketplace (autoupdate OFF). The line renders `● <mp> [<scope>] (skipped) {up-to-date}` at `warning` severity with no `/reload` trailer -- not `(updated)`. A genuinely-changed update still renders `(updated)`.
result: pass
reported: "looks good for some (save for the warning), but the claude-plugins-official marketplace always says `● claude-plugins-official [user] (updated)` -- i don't think it can tell when we picked new changes via git"
severity: major
note: |
  RESOLVED by Plan 27-05 (commit 932e405) + code-review follow-up 57068f0: the
  autoupdate-ON branch now consults `snapshot.changed && cascadeIsNoOp` and renders
  `(skipped) {up-to-date}` on a true no-op (update.ts:746-751), mirroring the
  autoupdate-OFF path. Covered by orchestrator + notify-v2 + catalog-uat tests;
  npm run check GREEN 1149/1149.
  PATH-source no-op works (renders `(skipped) {up-to-date}`) -- partial pass.
  "save for the warning" = deferred UXG-02/Phase 28 severity-label item (Test 2), NOT this gap.
  CONFIRMED ROOT CAUSE (code-verified): the user's `claude-plugins-official` record has
  `autoupdate: true`. UXG-05's no-op `(skipped) {up-to-date}` rendering was wired ONLY
  into the autoupdate-OFF branch (update.ts:683-695). The autoupdate-ON branch
  (update.ts:705-714) unconditionally emits marketplace `status: "updated"` and never
  consults `snapshot.changed`, so a no-op update on an autoupdate-ON marketplace always
  renders `(updated)`. NOT a clone/persistence bug and NOT WR-01/WR-02: the change
  detector itself is correct (proven via reproduction), it is simply not consulted on
  the autoupdate-ON path. The live clone advances + persists correctly (tmp/pihome clone
  went 1a2f18b/172 -> 2a822c0/204, lastUpdatedAt fresh). Earlier "frozen clone" evidence
  was from the wrong directory (~/.pi/agent stale clone; live home is tmp/pihome).

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "`marketplace update` with no change renders `● <mp> [<scope>] (skipped) {up-to-date}`, not `(updated)` -- including autoupdate-ON marketplaces"
  status: resolved
  resolved_by: "27-05 (commit 932e405) + code-review follow-up 57068f0; npm run check GREEN 1149/1149"
  reason: "User reported: looks good for some (save for the warning), but the claude-plugins-official marketplace always says `● claude-plugins-official [user] (updated)` -- i don't think it can tell when we picked new changes via git"
  severity: major
  test: 3
  root_cause: "UXG-05 no-op detection was wired only into the autoupdate-OFF branch (update.ts:683-695). The autoupdate-ON branch (update.ts:705-714) unconditionally emits marketplace status 'updated' and never consults snapshot.changed, so a no-op update on an autoupdate-ON marketplace (e.g. claude-plugins-official) always renders (updated). Change-detector logic is correct but not consulted on this path. Clone advance/persistence is healthy (verified against the real tmp/pihome clone)."
  artifacts:
    - path: "extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts"
      issue: "autoupdate-ON branch (L705-714) hardcodes marketplace status 'updated'; ignores snapshot.changed and the cascade outcomes' no-op-ness"
  missing:
    - "On the autoupdate-ON path, render marketplace `(skipped) {up-to-date}` when snapshot.changed is false AND every cascaded plugin outcome is a no-op (none updated/installed/failed) -- mirroring the autoupdate-OFF no-op and the plugin-level up-to-date no-op"
    - "Catalog (output-catalog.md) + catalog-uat coverage for the autoupdate-ON no-op marketplace-update case"
    - "Test that the autoupdate-ON path renders (skipped) {up-to-date} on a true no-op (WR-03-class coverage gap)"
  debug_session: ".planning/debug/uxg05-github-always-updated.md"
