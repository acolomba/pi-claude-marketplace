---
status: complete
source: .planning/branch-uat.md
started: 2026-05-31T19:30:00Z
updated: 2026-05-31T20:15:00Z
---

## Current Test

[testing complete]

## Tests

### T-01: List empty state
expected: "(no marketplaces)" -- no label, no reload trailer
result: pass

### T-02: Marketplace add (path source)
expected: "● uat-mp [user] (added)" -- no Warning/Error, no reload trailer
result: pass

### T-03: List after add (4 plugin rows)
expected: marketplace header + alpha(available) + beta(available) + claude-only(unavailable){hooks} + hashplugin(available)
result: pass

### T-04: Autoupdate enable + idempotent
expected: fresh="● uat-mp [user] <autoupdate>" (info); repeat="● uat-mp [user] <autoupdate> {already autoupdate}" (info, no Warning:)
result: pass

### T-05: Autoupdate disable + idempotent
expected: fresh="● uat-mp [user] <no autoupdate>" (info); repeat="● uat-mp [user] <no autoupdate> {already no autoupdate}" (info, no Warning:)
result: pass

### T-06: Marketplace list -- no last-updated token (UXG-01)
expected: "● uat-mp [user] <autoupdate>" with no "<last-updated ...>" token anywhere
result: pass

### T-07: Marketplace update no-op (UXG-02 + UXG-05)
expected: "● uat-mp [user] (skipped) {up-to-date}" -- info (no Warning:), no reload trailer
result: pass

### T-08: Install alpha (success)
expected: "● uat-mp [user]\n  ● alpha v1.0.0 (installed)\n\n/reload to pick up changes"
result: pass

### T-09: List after install -- no reload trailer (G-21-01)
expected: installed alpha row, 3 other rows, NO "/reload to pick up changes" at end
result: pass

### T-10: Install already-installed -- UXG-07 error summary line
expected: "Error: 1 plugin operation failed.\n\n● uat-mp [user]\n  ⊘ alpha (failed) {already installed}\n    cause: ..."
result: pass

### T-11: Install not-in-manifest -- UXG-07
expected: "Error: 1 plugin operation failed.\n\n● uat-mp [user]\n  ⊘ ghost (failed) {not in manifest}\n    cause: ..."
result: pass

### T-12: Update not-installed plugin -- UXG-07 warning summary line
expected: "Warning: 1 plugin operation skipped.\n\n● uat-mp [user]\n  ⊘ beta v2.0.0 (skipped) {not installed}"
result: pass

### T-13: Update manifest-absent plugin -- UXG-08
expected: "Error: 1 plugin operation failed.\n\n● uat-mp [user]\n  ⊘ ghost (failed) {not in manifest}" (NOT "(skipped) {not installed}")
result: pass

### T-14: Update alpha up-to-date -- UXG-02 benign info
expected: "● uat-mp [user]\n  ⊘ alpha (skipped) {up-to-date}" -- NO "Warning:" prefix, dim text
result: pass

### T-15: Update after version bump -- version arrow (SNM-34)
expected: "● uat-mp [user]\n  ● alpha 1.0.0 → v1.1.0 (updated)\n\n/reload to pick up changes" (bare from, v-prefixed to)
result: issue
reported: "from version should also be v-prefixed: want 'v1.0.0 → v1.1.0' not '1.0.0 → v1.1.0'"
severity: minor

### T-16: Install hashplugin -- v#<7hex> display (SNM-35)
expected: installed row shows "v#XXXXXXX" (7 hex chars), NOT "vhash-<12hex>"
result: pass

### T-17: Uninstall alpha
expected: "● uat-mp [user]\n  ○ alpha (uninstalled)\n\n/reload to pick up changes"
result: pass

### T-18: Marketplace remove -- reload fires on plugin unstaging
expected: "● uat-mp [user] (removed)\n  ○ hashplugin (uninstalled)\n\n/reload to pick up changes"
result: pass

## Summary

total: 18
passed: 17
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "version arrow displays v-prefix on both from and to sides (e.g. v1.0.0 → v1.1.0)"
  status: failed
  reason: "User reported: from version should also be v-prefixed: want 'v1.0.0 → v1.1.0' not '1.0.0 → v1.1.0'"
  severity: minor
  test: 15
  artifacts: []
  missing: []
