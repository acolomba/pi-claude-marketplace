---
status: diagnosed
phase: ws-notification-refactor
source:
  - phases/01-localized-type-model-command-context-spine/*-SUMMARY.md
  - phases/02-caller-stamped-severity-reload-reducer/*-SUMMARY.md
  - phases/03-desired-state-output-atomic-catalog-supersession/*-SUMMARY.md
  - phases/04-concern-module-extraction-open-closed-proof/*-SUMMARY.md
started: 2026-06-25
updated: 2026-06-25
sandbox: ~/pi-cm-uat
---

## Current Test

[testing complete]

## Tests

### 1. marketplace add (path source, offline)
command: `marketplace add ~/pi-cm-uat/test-marketplace --scope project`
expected: |
  ● test-mp [project] (added)
  (no reload trailer; path source → no network — NFR-5)
result: pass

### 2. marketplace list
command: `marketplace list`
expected: |
  ● test-mp [project]
  (no <autoupdate> marker — path source defaults off; no trailer)
result: pass

### 3. install alpha (skill-only) — info success + reload trailer
command: `install alpha@test-mp --scope project`
expected: |
  ● test-mp [project]
    ● alpha v1.0.0 (installed)

  /reload to pick up changes
  (NO leading severity sentence — info severity omits it; SEV/RLD/OUT)
result: pass

### 4. install alpha AGAIN — desired-state error
command: `install alpha@test-mp --scope project`
expected: |
  A plugin operation has failed.

  ● test-mp [project]
    ⊘ alpha (failed) {already installed}
  (leading severity sentence; host "Error:" label; no version; no reload trailer.
   Caller-stamped error for an already-at-desired target — SEV-03)
result: pass

### 5. install beta (skill+command+agent+mcp) — one plugin row, no soft-dep markers
command: `install beta@test-mp --scope project`
expected: |
  ● test-mp [project]
    ● beta v1.0.0 (installed)

  /reload to pick up changes
  (ONE plugin row for the whole plugin — components are not per-row.
   No {requires …} markers: pi-subagents + pi-mcp-adapter are loaded under pi.sh)
result: pass

### 6. install gamma — info success
command: `install gamma@test-mp --scope project`
expected: |
  ● test-mp [project]
    ● gamma v1.0.0 (installed)

  /reload to pick up changes
result: pass

### 7. list (all installed) — inventory surface, NO reload trailer
command: `list`
expected: |
  ● test-mp [project]
    ● alpha v1.0.0 (installed)
    ● beta v1.0.0 (installed)
    ● gamma v1.0.0 (installed)
  (marketplace header always rendered; NO "/reload" trailer on a read-only
   inventory surface — RLD-02 inventory carve-out. Row order is caller-supplied.)
result: pass

### 8. update @test-mp (all up-to-date) — info + trailing tally, no trailer
command: `update @test-mp --scope project`
expected: |
  ● test-mp [project]
    ⊘ alpha (skipped) {up-to-date}
    ⊘ beta (skipped) {up-to-date}
    ⊘ gamma (skipped) {up-to-date}

  Plugin update: 3 successes
  (NO leading sentence — all-benign skip cascade computes info. Trailing tally
   counts idempotent skips as successes — OUT-03. No reload trailer.)
result: pass

### 9. disable beta — info + reload trailer
command: `disable beta@test-mp --scope project`
expected: |
  ● test-mp [project]
    ◌ beta v1.0.0 (disabled)

  /reload to pick up changes
  (◌ glyph + (disabled) token; reload trailer FIRES — disable stamps
   needsReload:true even though severity is info — RLD-05)
result: pass

### 10. list (beta disabled) — disabled inventory row, no trailer
command: `list`
expected: |
  ● test-mp [project]
    ● alpha v1.0.0 (installed)
    ◌ beta v1.0.0 (disabled)
    ● gamma v1.0.0 (installed)
  (◌ (disabled) inventory row; version pin preserved; NO reload trailer — ENBL-04)
result: issue
reported: "the description under the disabled plugin is missing. the rest is correct"
severity: minor
resolution: |
  FIXED. Added `description?` to PluginDisabledMessage (shared/notify.ts),
  added `disabled` to the PL-4 render guard in composePluginLinesWith
  (shared/notify.ts), and spread `...descriptionField` into the disabled
  branch of the list builder (orchestrators/plugin/list.ts). Locked with a
  notify-v2 unit test + a new `disabled-inventory-with-description` catalog
  state and catalog-uat byte fixture. Catalog PL-4 prose updated (four→five
  list-surface variants). `npm test` green (2345 pass, serial).

### 11. enable beta — info + reload trailer
command: `enable beta@test-mp --scope project`
expected: |
  ● test-mp [project]
    ● beta v1.0.0 (installed)

  /reload to pick up changes
  (bare marketplace header — NO "(added)" token; (installed) row; reload trailer)
result: pass

### 12. uninstall alpha — info + reload trailer
command: `uninstall alpha@test-mp --scope project`
expected: |
  ● test-mp [project]
    ○ alpha v1.0.0 (uninstalled)

  /reload to pick up changes
  (○ glyph + (uninstalled) token; reload trailer fires)
result: pass

### 13. uninstall alpha AGAIN — desired-state error (absent target)
command: `uninstall alpha@test-mp --scope project`
expected: |
  A plugin operation has failed.

  ● test-mp [project]
    ⊘ alpha (failed) {not installed}
  (standalone command names an absent target → error, not silence — D-01/PU-5)
result: pass

### 14. marketplace remove test-mp — cascade uninstall + reload trailer
command: `marketplace remove test-mp --scope project`
expected: |
  ● test-mp [project] (removed)
    ○ beta (uninstalled)
    ○ gamma (uninstalled)

  /reload to pick up changes
  (marketplace (removed) header + cascade (uninstalled) rows — name-only, no
   version; reload trailer fires; alpha already gone so only beta+gamma cascade.
   Row order caller-supplied.)
result: pass

## Summary

total: 14
passed: 13
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "On the `list` inventory surface, every plugin row renders its manifest
    description on a 4-space-indented second line — including disabled plugins."
  status: failed
  reason: "User reported: the description under the disabled plugin is missing. the rest is correct"
  severity: minor
  test: 10
  root_cause: "The `disabled` list-row variant cannot carry a description. (1)
    `PluginDisabledMessage` (shared/notify.ts:622-627) is the only list-surface
    variant lacking the `description?` field that installed/available/unavailable/
    upgradable all declare. (2) The disabled branch in the list builder
    (orchestrators/plugin/list.ts:259-270) is the only row branch that omits the
    `...descriptionField` spread — `descriptionField` is already computed in scope
    at list.ts:250-251. The `disabled` variant was added later (D-54-01/ENBL-04)
    and PL-4 description support was never extended to it; the catalog
    disabled-inventory block (docs/output-catalog.md:306-313) likewise documents
    the row without a description, so it is an unintended consistency gap rather
    than a designed floor."
  artifacts:
    - path: "extensions/pi-claude-marketplace/shared/notify.ts"
      issue: "PluginDisabledMessage (622-627) lacks `readonly description?: string`"
    - path: "extensions/pi-claude-marketplace/orchestrators/plugin/list.ts"
      issue: "disabled branch (259-270) omits the `...descriptionField` spread"
    - path: "docs/output-catalog.md"
      issue: "disabled-inventory catalog block (306-313) + any catalog-uat byte fixture omit the description line"
  missing:
    - "Add `readonly description?: string` to PluginDisabledMessage"
    - "Spread `...descriptionField` into the disabled return in list.ts (reuse existing PL-4 truncation/render path)"
    - "Verify the disabled renderer arm appends the PL-4 description line (same helper as installed)"
    - "Update docs/output-catalog.md disabled-inventory block + regenerate catalog-uat byte fixtures atomically"
  debug_session: ""
