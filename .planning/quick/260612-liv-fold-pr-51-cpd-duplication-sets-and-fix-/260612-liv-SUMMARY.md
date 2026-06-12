---
phase: 260612-liv
plan: 01
subsystem: orchestrators/plugin + docs
tags: [cpd, refactor, docs, readme, sonarcloud]
dependency_graph:
  requires: []
  provides:
    - "orchestrators/plugin/shared.ts::maybeWritePluginConfigBack"
    - "orchestrators/plugin/shared.ts::applyPartialCascadeFold"
  affects:
    - "orchestrators/plugin/update.ts"
    - "orchestrators/plugin/reinstall.ts"
    - "orchestrators/plugin/uninstall.ts"
    - "orchestrators/plugin/enable-disable.ts"
    - "README.md"
tech_stack:
  added: []
  patterns:
    - "single-source CPD helpers in orchestrators/plugin/shared.ts (precedent: 7fa0a2c, 17a0e97)"
key_files:
  created: []
  modified:
    - "extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts"
    - "extensions/pi-claude-marketplace/orchestrators/plugin/update.ts"
    - "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts"
    - "extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts"
    - "extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts"
    - "README.md"
decisions:
  - "maybeWritePluginConfigBack: unified options-object signature; reinstall's unused _state parameter dropped"
  - "applyPartialCascadeFold: structural-shape parameter typed as mutable string[] so both uninstall.ts inline shape and enable-disable.ts InstalledPluginRecord callers type-check unchanged"
  - "README user-scope cells now read `~/.pi/agent/claude-plugins{,.local}.json` to match locations.ts::locationsFor (getAgentDir defaults to ~/.pi/agent/ and honors PI_CODING_AGENT_DIR)"
metrics:
  duration_seconds: 1299
  completed_date: 2026-06-12
---

# Quick Task 260612-liv: Fold PR #51 CPD duplication sets and fix README user-scope paths Summary

One-liner: Folded the two SonarCloud CPD duplication sets surfaced on
PR #51 into shared `maybeWritePluginConfigBack` /
`applyPartialCascadeFold` helpers in `orchestrators/plugin/shared.ts`
(byte-neutral on rendered output), and corrected the README
user-scope config-path cells to `~/.pi/agent/claude-plugins{,.local}.json`
on top of the operator's uncommitted heading + punctuation edits.

## What changed

### Task 1: Fold both CPD sets into `orchestrators/plugin/shared.ts`

- Added `maybeWritePluginConfigBack(opts: { locations, marketplace,
  plugin, local })` to `shared.ts` -- the unified post-success config
  write-back gate previously duplicated between
  `update.ts::maybeWritePluginConfigBackUpdate` (lines 1086-1138)
  and `reinstall.ts::maybeWritePluginConfigBack` (lines 1106-1167).
  Load-bearing rationale (S5 invalid-config arm carries the warning
  row, RECON-05 mtime stability on existing-entry short-circuit, D-04
  `{...existing, ...{}}` patch shape, WB-01 / A7 deep-equal gate)
  moved onto the helper; call-site comments dropped. The reinstall
  variant's unused `_state: ExtensionState` parameter was dropped in
  the unified signature.
- Added `applyPartialCascadeFold(installed, dropped)` to `shared.ts`
  -- the unified I3 / TR-03 partial-cascade dropped-fold previously
  duplicated between `uninstall.ts::applyPartialCascadeFold` and
  `enable-disable.ts::applyPartialDisableCascadeFold`. The
  parameter type is the inline structural shape (mutable
  `string[]` arrays) so both call sites (uninstall.ts inline shape
  and enable-disable.ts's `InstalledPluginRecord` alias)
  type-check without casts. The asymmetric
  `dropped.commands -> resources.prompts` mapping is preserved per
  TR-03 cascade primitive naming.
- Imports updated:
  - `shared.ts` gained `writePluginConfigEntry` from
    `../../persistence/config-write-back.ts`.
  - `update.ts` and `reinstall.ts` dropped now-unused imports of
    `loadConfig`, `writePluginConfigEntry`, and `ScopeConfig`;
    added `maybeWritePluginConfigBack` to their `./shared.ts`
    named-import list.
  - `uninstall.ts` and `enable-disable.ts` added
    `applyPartialCascadeFold` to their `./shared.ts` named-import
    list.
- Call sites in `update.ts`, `reinstall.ts`, `uninstall.ts`, and
  `enable-disable.ts` delegate to the shared helpers; the local
  duplicates were deleted. `enable-disable.ts:276`'s prose comment
  was updated from `Mirrors the uninstall.ts:applyPartialCascadeFold
  TR-03 path; ...` to `Uses the shared applyPartialCascadeFold helper
  (TR-03 path); ...`. A stray prose mention of
  `maybeWritePluginConfigBackUpdate` in a comment at `update.ts:960`
  was updated to the new name `maybeWritePluginConfigBack`.
- Comment policy: kept decision/requirement IDs (`WB-01`, `RECON-05`,
  `S5`, `D-04`, `I3`, `TR-03`, `A7`, `NFR-3`, `D-11`); no phase / plan
  / wave / milestone tokens were introduced.

### Task 2: README user-scope config-path correction

- Changed the user-scope path cell in the "Configuration files" table
  from `~/.pi/claude-plugins.json` to `~/.pi/agent/claude-plugins.json`.
- Changed the user-scope path cell in the "Local configuration files"
  table from `~/.pi/claude-plugins.local.json` to
  `~/.pi/agent/claude-plugins.local.json`.
- Project-scope cells (`<cwd>/.pi/claude-plugins{,.local}.json`) and
  the `.gitignore` example block (`.pi/claude-plugins.local.json`)
  are unchanged -- both are correct for the project scope and were
  out of scope here.
- Operator's uncommitted README wording edits preserved verbatim in
  the same commit: heading rename `claude-plugins.local.json and the
  .local convention` -> `Local configuration files`, and the colon ->
  period punctuation tweaks on the four lead-in sentences in the
  section.

## Verification

- `npm run check` GREEN after each task (typecheck + ESLint + Prettier +
  tests, including catalog-uat byte-equality and notify-v2 byte gates).
- Pre-commit hooks GREEN at each commit (run via `pre-commit run
  --files <changed>` before `git commit`); no `--no-verify` used.
- Source-shape guards (from PLAN.md verify block) all pass:
  - Zero matches for `maybeWritePluginConfigBackUpdate` under
    `extensions/`.
  - Zero matches for `applyPartialDisableCascadeFold` under
    `extensions/`.
  - No `^async function maybeWritePluginConfigBack` survives in
    `reinstall.ts`; no `^function applyPartialCascadeFold` survives
    in `uninstall.ts`.
  - Both unified helpers exported from
    `orchestrators/plugin/shared.ts`.
- `docs/output-catalog.md` was NOT edited
  (`git diff docs/output-catalog.md` empty across both commits).
- README path-cell guards pass:
  - `~/.pi/agent/claude-plugins.json` present.
  - `~/.pi/agent/claude-plugins.local.json` present.
  - `~/.pi/claude-plugins.json` absent.
  - `~/.pi/claude-plugins.local.json` absent.

## Commits

- `6b5605f` -- `refactor(cpd): fold PR #51 plugin write-back +
  cascade-fold sets`
- `65d2323` -- `docs(readme): correct user-scope config file paths`

Both Conventional Commits; titles within the 72-char limit; body
lines within the 80-char limit; pre-commit hooks GREEN; no
`--no-verify`. Committing from the MAIN working tree (not a
worktree), so `SKIP=trufflehog` was NOT used per the operator's
constraint note.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stray prose reference to deleted symbol in
update.ts comment**

- **Found during:** Task 1 verify guards (the
  `grep -rln "maybeWritePluginConfigBackUpdate" extensions/`
  assertion failed with one hit).
- **Issue:** The docstring at `update.ts:960` (the
  `refreshDisabledRecord` D-UPD docstring) carried a parenthetical
  reference `The standalone-direct write-back
  (maybeWritePluginConfigBackUpdate) is SKIPPED ...` to the
  now-deleted local function name.
- **Fix:** Renamed the parenthetical to the new shared helper name
  `maybeWritePluginConfigBack`. No semantic change -- the docstring
  still documents that this code path SKIPS the write-back.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`
- **Commit:** folded into `6b5605f` (the refactor commit).

No other deviations.

## Self-Check: PASSED

Verified before declaring complete:

- `[ -f extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts ]` -> FOUND
- `[ -f extensions/pi-claude-marketplace/orchestrators/plugin/update.ts ]` -> FOUND
- `[ -f extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts ]` -> FOUND
- `[ -f extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts ]` -> FOUND
- `[ -f extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts ]` -> FOUND
- `[ -f README.md ]` -> FOUND
- `git log --oneline --all | grep -q "6b5605f"` -> FOUND
- `git log --oneline --all | grep -q "65d2323"` -> FOUND
