---
phase: 23-uninstall-and-prune-parity
plan: 01
status: complete
requirements: [PRN-02, PRN-03, UNI-01]
---

# Phase 23 Plan 01: Summary

Executed inline in the phase worktree (no executor subagent; worktree
isolation off), sequentially.

## What changed

- **PRN-02.** `PluginWillUninstallMessage` has `version?`; `pluginVersion`,
  the JSON `wireVersion`, and the text layout (`version: "single"`) carry it.
  prune `--dry-run` stamps `candidate.record.version`. `pending` builds a
  `(scope, marketplace, plugin) → version` map from each scope's state
  (`recordedVersionEntries`) and `buildReconcilePendingNotification` stamps it
  on both `will uninstall` producers. Row: `○ lib v1.2.0 (will uninstall) {dependency pruned}`.
- **PRN-03.** prune's operation-failure row passes a `StateLockHeldError`
  through unredacted; every other prune cause keeps `redactCauseChain`.
- **UNI-01.** `uninstall.ts::readDeclarers` builds `enabledIndex` (the
  declaration index without holders the user or a config disabled) and the
  dependents report and the LAYER-08 needer walk read it; the orphan sweep
  keeps the full index (D-05-04). Upstream evidence: Claude Code 2.1.309
  `Nfe` / `Z1t` count only enabled reverse dependents.
- Tests: uninstall (4 UNI-01 cases + a reworked dependents case), prune,
  pending, reconcile notify (PRN-02 version map), notification types / grammar
  / json; catalog fixtures and the contract byte count (47_615).
- Features: prune dry-run and pending rows gain `version`; new pending
  scenario for a removed marketplace; prune state-lock scenarios assert the
  absolute lock path; new uninstall scenario "Uninstalling a dependency whose
  only dependent is disabled uninstalls it".
- Docs: `output-catalog.md`, `messaging-style-guide.md`,
  `dependency-resolution.md`, `README.md`.

## Deviations

- `docs/json-output.md` needed no edit: its plugin-row `version` is already
  optional for every status.
- Review WR-01 refined UNI-01: a record held down by the load-time check
  (`dependencyDisabled`) still counts as enabled (CONTEXT D-13).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced (T-23-01, the unredacted lock path, is accepted there).
