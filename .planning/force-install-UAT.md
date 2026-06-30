---
status: complete
milestone: force-install
scope: Phases 64-72 (resolver three-way state, force install/update, glyphs, list filters, backfill, severity, partial hooks, unsupported render token)
source: [phase 64-72 SUMMARY.md + REQUIREMENTS.md]
started: 2026-06-29T11:30:00Z
updated: 2026-06-29T13:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Resolver three-way state visible in list
phase: 64 (RSTATE-01)
expected: |
  `/claude:plugin list` against claude-plugins-official shows not-installed
  plugins partitioned across ○ available, ⊖ unsupported, ⊘ unavailable.
result: pass

### 2. install --force degrades, does not block
phase: 65 (FORCE-01), 66 (FSTAT-02/07), 69 (SEV-01)
expected: |
  `install hookify@claude-plugins-official --force` installs supported
  components, drops unsupportable hooks, reads "force-installed" at INFO (no
  Warning:).
result: pass

### 3. install WITHOUT --force on unsupported -> error pointing at --force
phase: 65 (FORCE-03), 69 (SEV-02)
expected: |
  install of an unsupported plugin without --force fails at ERROR and the
  message points at --force.
result: pass

### 4. install on structural-unavailable -> error, NO --force hint
phase: 65 (FORCE-05), 69 (SEV-02)
expected: |
  A ⊘ unavailable plugin errors with NO --force suggestion (force cannot help).
result: pass
note: |
  Validated via an unavailable plugin caused by an unsupported source (not a
  malformed manifest). Confirmed: row shows ⊘ (unavailable) and the install
  error did NOT mention --force. Same SEV-02 no-hint arm — valid coverage.

### 5. list glyph vocabulary (incl. unsupported token)
phase: 66 (FSTAT-02), 72 (USTAT-01)
expected: |
  list shows ● installed / ◉ force-installed / ○ available / ⊖ unsupported /
  ⊘ unavailable, all visually distinct; the test-2 plugin wears ◉.
result: pass

### 6. list filters: --unsupported / --installed span / no --upgradable
phase: 67 (LIST-01)
expected: |
  `/claude:plugin list --unsupported` shows ONLY ⊖ unsupported plugins.
  `/claude:plugin list --installed` includes BOTH ● installed AND ◉
  force-installed. There is NO `--upgradable` filter (unknown/rejected).
result: pass

### 7. info: dropped-component detail + reasons
phase: 66 (FSTAT-07), 64 (RSTATE-05)
expected: |
  `/claude:plugin info hookify@claude-plugins-official` reports force-installed
  and surfaces the dropped-component detail ({unsupported hooks}); per-kind
  reason braces match what `list` shows for the same plugin.
result: pass

### 8. partial hooks: supportable handlers install, rest drop
phase: 71 (PHOOK-01..05)
expected: |
  Force-installing a plugin whose hooks.json mixes supportable + unsupportable
  handlers installs ONLY the supportable handlers; unsupportable events/matchers
  drop and surface as {unsupported hooks}.
result: pass
evidence: |
  Verified from disk (tmp/work/tmp/pihome/agent/pi-claude-marketplace/hooks/):
  - security-guidance: MATCHER-level drop — source PostToolUse matcher
    "Edit|Write|MultiEdit|NotebookEdit" (regex alternation) dropped; "Bash"
    group kept (with its `if` rules + asyncRewake). SessionStart +
    UserPromptSubmit kept.
  - hookify: EVENT-level drop — source had PreToolUse/PostToolUse/Stop/
    UserPromptSubmit; "Stop" (non-bucket-A) dropped, three bucket-A events kept.
  - state.json records both supported:[...hooks...] + unsupported:['hooks'].

### 9. reinstall always overwrites; no --force axis
phase: 67 (RINST-01)
expected: |
  `/claude:plugin reinstall <installed>` overwrites (repair). `reinstall
  <plugin> --force` is NOT accepted (axis removed).
result: pass

### 10. severity sweep (info vs warning vs error)
phase: 69 (SEV-01..05)
expected: |
  Direct force degrade -> INFO; reinstall manual-recovery / missing soft-dep
  companion -> WARNING; unsupported without --force -> ERROR (+hint);
  unavailable -> ERROR (no hint).
result: pass
note: |
  Three arms observed live and correct: info (force degrade + clean reinstall),
  error+hint (unsupported no --force), error-no-hint (unavailable). The WARNING
  arm was not manufactured: reinstall cleanly overwrites foreign content by
  design (-> info, not warning); (manual recovery) is a ManualRecoveryError
  fault-injection case (agents-bridge commit leak, stage.ts) not stageable by
  hand; the soft-dep companion warning ({requires pi-subagents}/{requires
  pi-mcp}) needs an env without that companion loaded. Warning arm is covered by
  the green automated SEV-01 catalog + severity tests. Accepted by operator.

### 11. update --force / force-upgradable
phase: 65 (FORCE-02), 66 (FSTAT-04/06)
expected: |
  An installed plugin whose newer candidate would newly degrade it shows
  force-upgradable (● glyph); `update --force` degrades it to ◉ force-installed.
result: pass
note: |
  Built a local path-source fixture (demo-local / demo-tool): v1.0.0 clean (skill
  only) installed, then candidate bumped to v1.1.0 with a `.lsp.json` (unsupported
  lspServers). After /reload, list correctly showed `● demo-tool v1.0.0
  (force-upgradable) {lsp}` and `update demo-tool@demo-local --force` degraded it
  to `◉ v1.1.0 (force-installed) {lsp}` (FORCE-02 / FSTAT-04). Targeted no-force
  decline rendered WARNING, bulk no-force skip rendered INFO — both per SEV-04 /
  D-69-02. Fixture-authoring note: the upgrade-candidate version must be declared
  in the marketplace.json plugin ENTRY (list's upgradable check reads
  manifestEntry.version), not only plugin.json. Findings filed in Gaps below.

### 12. load-time backfill  [SKIPPABLE]
phase: 68 (BFILL-01/02)
expected: |
  A force-installed plugin whose previously-unsupported components later become
  supported is re-materialized in place at load time after an extension-version
  change, with no manual command.
result: skipped
reason: |
  Not stageable in this environment: backfill fires when the EXTENSION gains
  support for a previously-unsupported KIND (gated on lastReconciledExtensionVersion).
  The only available unsupported kind is lspServers (permanently unsupported), and
  every genuinely-supported kind (skills/commands/agents/hooks) is already
  supported — so no supported-kind boundary can move without a code change.
  Covered by the green automated BFILL-01/02 tests.

### 13. force state clears on clean upgrade (FSTAT-03)
phase: 66 (FSTAT-03)
expected: |
  A force-installed plugin whose newer version is fully supported returns to
  (installed) automatically after upgrade, with no lingering force state.
result: pass
note: |
  Added at operator's suggestion (the v1.2.0-drops-lsp idea). Bumped the demo-tool
  fixture to v1.2.0 with the `.lsp.json` removed (clean again). demo-tool was
  ◉ force-installed v1.1.0; `update demo-tool@demo-local` (no --force needed — the
  candidate is fully supported) upgraded it to v1.2.0 and `list` then showed
  `● demo-tool v1.2.0 (installed)` — the ◉ force state cleared automatically, no
  {lsp} reason, no lingering degrade.

## Summary

total: 13
passed: 12
issues: 0
pending: 0
skipped: 1

## Gaps

Behavior is to-spec; these are operator-surfaced UX findings (not test failures),
filed for follow-up. Two distinct buckets:

### Bucket A — force cross-surface unification (candidate Phase 73)
- truth: "A force-installable plugin is described consistently across surfaces."
  status: finding
  severity: minor
  detail: |
    - install-error surface still renders ⊘ (unavailable) + --force hint for a
      force-installable plugin, while list/info now show ⊖ (unsupported).
    - IN-01: info.ts non-resolvable arm hardcodes "unavailable" instead of keying
      on resolved.state (masked today; latent cross-surface divergence).
    - manual `update` decline of a force-upgradable plugin renders
      `(skipped) {no longer installable}` with NO --force hint — contradicts
      list's `(force-upgradable)` and gives no recovery affordance. (Severity IS
      correct per SEV-04: targeted=warning, bulk=info.)

### Bucket B — bulk update grammar refinement (pre-existing v1.5/v1.11, not force-specific)
- truth: "A bulk update reports only what it changed."
  status: finding
  severity: minor
  detail: |
    - bulk `update` lists every up-to-date plugin as `(skipped) {up-to-date}`
      (UXG-05 catalog all-up-to-date-noop) — noise the project suppresses
      elsewhere (UXG-02).
    - "Plugin update: N successes" counts info-severity (at-desired-state) rows,
      so up-to-date no-ops inflate the count (e.g. "5 successes" when 1 plugin was
      actually updated). Reads as "N updated" but means "N at desired state."
