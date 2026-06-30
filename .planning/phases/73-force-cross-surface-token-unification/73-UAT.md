---
status: complete
phase: 73-force-cross-surface-token-unification
source: [73-01-SUMMARY.md]
started: 2026-06-30T12:00:00Z
updated: 2026-06-30T13:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Install-failure renders force token (XSURF-01)
expected: |
  `/claude:plugin install <plugin>@<marketplace>` (no --force) on a force-installable
  plugin renders `⊖ <plugin> (unsupported) {reasons}` + the 4-space-indented trailer
  `Re-run with --force to install the supported components.` — NOT `⊘ (unavailable)`.
result: pass
observed: |
  install hookify@claude-plugins-official rendered:
    Error: A plugin operation has failed.
     ● claude-plugins-official [user]
       ⊖ hookify (unsupported) {unsupported hooks}
         Re-run with --force to install the supported components.

### 2. Structural-unavailable still renders ⊘, no hint (XSURF-01 contrast)
expected: |
  `/claude:plugin install <plugin>@<marketplace>` on a STRUCTURALLY unavailable plugin
  (malformed manifest / hooks.json, unreadable source) still renders
  `⊘ <plugin> (unavailable) {reasons}` with NO `--force` hint trailer. The two cases
  are now visually distinct (⊖ vs ⊘).
result: pass
observed: |
  install zscaler@claude-plugins-official rendered:
    Error: A plugin operation has failed.
     ● claude-plugins-official [user]
       ⊘ zscaler (unavailable) {unsupported source}
  ⊘ glyph, (unavailable) token, no --force trailer — distinct from the ⊖ Test 1 row.

### 3. info derives force token from resolver state (XSURF-02)
expected: |
  `/claude:plugin info <plugin>@<marketplace>` for a NOT-installed force-installable
  plugin shows the `⊖ (unsupported)` token, matching what `list` shows for the same
  plugin (the info non-resolvable arm now derives status from resolver state instead
  of hardcoding "unavailable"). list and info agree.
result: pass
observed: list and info agree on ⊖ (unsupported) for the not-installed force-installable plugin.

### 4. Targeted update decline shows force-upgradable + hint (XSURF-03)
expected: |
  `/claude:plugin update <plugin>@<marketplace>` (no --force) where the newer candidate
  would degrade the plugin declines the upgrade and renders:

    ● <marketplace> [<scope>]
      ● <plugin> v1.0.0 (force-upgradable) {lsp}
        Re-run with --force to update with the supported components.

  with a leading "A plugin operation needs attention." summary (warning, because you
  targeted it). It must NOT render `⊘ (skipped) {no longer installable}`.
result: pass
observed: |
  Fixture: demo-tool installed clean v1.2.0; demo-local path-source bumped to
  candidate v1.3.0 (re-adds lspServers -> unsupported). update demo-tool@demo-local
  (no --force) rendered:
    Warning: A plugin operation needs attention.
     ● demo-local [user]
       ● demo-tool v1.2.0 (force-upgradable) {lsp}
         Re-run with --force to update with the supported components.
note: |
  Out-of-scope (pre-existing, not XSURF): marketplace update on a path source reports
  the marketplace (skipped) {up-to-date} (no clone to sync); no /reload needed to see
  the candidate (path sources read live).

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
