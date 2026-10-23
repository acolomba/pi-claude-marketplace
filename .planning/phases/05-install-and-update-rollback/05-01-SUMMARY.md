---
phase: 05-install-and-update-rollback
plan: 01
subsystem: behavioral-tests
tags: [cucumber, rollback, install, update, failure-injection]
requirements-completed: [INS-07, UPD-04]
key-files:
  created:
    - features/plugin/update-rollback.feature
  modified:
    - features/plugin/install-rollback.feature
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - test/orchestrators/plugin/update-flow.test.ts
---

# Phase 5 Plan 01: Install and Update Rollback Summary

**A failed install leaves nothing behind and a failed update keeps the
installed version; both succeed on retry once the obstruction is gone. An
update that hits a local file error now reads `unreadable`, not
`unreadable manifest`.**

## Commits

1. `7671e03f` fix(update): report a local file error as unreadable
2. `83fd54fb` test(features): check that a failed update keeps the installed version

## Scenarios

`features/plugin/install-rollback.feature` (3):
- the failed install row (`failed`, empty reasons, EISDIR cause chain), no declaration, no installed plugin (Phase 1 seed);
- new: a new session after the failed install offers no skills;
- the retry after the directory is removed installs 1.0.0 and a session offers its skill (Phase 1 seed).

`features/plugin/update-rollback.feature` (5, Background: install 1.0.0, offer 1.1.0, block mcp-adapter.json):
- the failed update row (`failed` / `unreadable`, EISDIR cause chain), with the record at 1.0.0, the declaration, and the staged `demo-skill` kept;
- `list` after the failure: `upgradable`, version 1.0.0;
- `info` after the failure: `installed`, version 1.0.0, skill `demo-skill`;
- a new session offers `A skill of demo 1.0.0.`;
- the retry after the directory is removed updates 1.0.0 to 1.1.0 and records 1.1.0.

## Deviations

- **[Rule 1 - Bug] Update failure blamed the marketplace manifest.** Measured
  first run: `failed` / `unreadable manifest` for EISDIR on
  `mcp-adapter.json`. `narrowDirectFailReason` now maps EISDIR, EIO, and EBADF
  to `unreadable` (CONTEXT D-04). The first commit attempt failed fallow
  health (cognitive 17 > 15), so the errno arms moved into a
  `narrowErrnoFailReason` switch.
- The install EISDIR row with empty reasons stays as is (CONTEXT D-03:
  documented D-15-01 design; Claude Code prints the raw message).

## Verification

- `npx cucumber-js features/plugin/install-rollback.feature features/plugin/update-rollback.feature`: 8 scenarios, 95 steps passed.
- `npm run check:features` exit 0; the three new unit rows pass; commit hook (`check:commit`) passed.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## For the orchestrator

- A commit attempt was killed (exit 137) during the host restart while the
  pre-commit hook held the unstaged install-rollback edit in its stash; the
  edit was restored from `~/.cache/pre-commit/patch1792740996-1509500`. Nothing
  else was lost.
- The lock-held update row still falls to the `unreadable manifest` fallback
  (no errno code); Phase 15 owns it.
