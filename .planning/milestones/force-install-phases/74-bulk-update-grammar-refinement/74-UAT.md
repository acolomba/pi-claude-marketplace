---
status: complete
phase: 74-bulk-update-grammar-refinement
source: [74-01-SUMMARY.md]
started: 2026-06-30T13:10:00Z
updated: 2026-06-30T13:40:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Bulk force-upgradable decline = info + nothing-to-update (UGRM-01 / SEV-04 bulk)
expected: |
  `update @demo-local` (bulk) with demo-tool force-upgradable renders:
    ● demo-local [user]
      ● demo-tool v1.2.0 (force-upgradable) {lsp}
        Re-run with --force to update with the supported components.

    Plugin update: nothing to update
  At INFO severity — NO leading "Warning:" summary (the targeted form in 73-T4 was
  warning; bulk is info per SEV-04). The headline is the no-op constant.
result: pass
observed: |
  update @demo-local (bulk, demo-tool force-upgradable) rendered the decline row at
  info (no Warning: prefix) + "Plugin update: nothing to update".

### 2. All-up-to-date bulk suppresses skip rows (UGRM-01)
expected: |
  With demo-tool candidate reverted to v1.2.0 (== installed, clean/up-to-date), a bulk
  `update @demo-local` prints ONLY `Plugin update: nothing to update` — no per-plugin
  `(skipped) {up-to-date}` row, no marketplace header (empty body).
result: pass
observed: |
  update @demo-local with demo-tool up-to-date printed only
  "Plugin update: nothing to update" — no header, no skip row. (Pre-74 would have shown
  the header + ⊘ (skipped) {up-to-date} + "1 success".) This also proves up-to-date
  no-ops no longer inflate the count (count 0, not 1).

### 3. Bulk count reflects realized updates only (UGRM-02)
expected: |
  A bulk `update` with one realized update and >=1 up-to-date plugin shows the updated
  row, suppresses the up-to-date plugin(s), and the headline counts only the realized
  transition — `Plugin update: 1 updated` (verb "updated", NOT "1 success" / inflated
  "N successes" counting no-ops).
result: pass
observed: |
  demo-tool candidate set to clean v1.3.0. update @demo-local rendered:
    ● demo-local [user]
      ● demo-tool v1.2.0 → v1.3.0 (updated)

    Plugin update: 1 updated

    /reload to pick up changes
  Verb "updated" (not "success"), realized count 1, version arrow, reload trailer.
  Combined with Test 2 (up-to-date counts as 0), confirms no-ops do not inflate the
  count. NOTE: this realized the upgrade — demo-tool is now installed at v1.3.0.

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
