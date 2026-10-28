---
phase: 08-background-autoupdate
fixed_at: 2026-10-28
review_path: .planning/phases/08-background-autoupdate/08-SECURITY.md
iteration: 1
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 08 Security Fix Evidence

## SEC-08-01 / T-08-17: Prove aggregate TUI notices

**Commit:** `7a436b05daff149cacb110258051d65675b1e8b2`

**Files:** `features/lib/pi-tui.ts`, `features/step_definitions/marketplace/background-update.steps.ts`, `features/marketplace/background-update.feature`, `test/architecture/pi-tui-notices.test.ts`.

The driver now names its oracle `backgroundUpdateNoticeTexts` and documents that it returns distinct visible texts, not emission counts. Both behavior steps and the focused tests use that parser. The existing same-name, cross-scope scenario remains. A new scenario updates `alpha@tools` in project scope and `beta@extras` in user scope, requires the combined notice, and verifies both installed versions.

## Red evidence and oracle boundary

- Before editing the parser, calling the real driver's parsing boundary with two identical notice lines returned one line. An assertion expecting two failed.
- Captured real PTY output uses synchronized screen updates, absolute cursor positions, line clearing, and OSC sequences. It is screen output, not a notification event stream. Identical notifications and redraws cannot be counted reliably from these bytes.
- A temporary production mutation emitted a separate notice for every updated plugin. With one plugin per marketplace, this also models one notice per marketplace. The existing same-name scenario passed incorrectly: 1 scenario, 19 steps, seed `786300`.
- The new distinct-name scenario failed against that mutation: the expected `Plugins updated: alpha and beta · Run /reload to apply` never appeared; the captured terminal showed the final separate `beta` notice. Result: 16 passed, 1 failed, 2 skipped steps, seed `354764`.
- The mutation was removed before verification and commit. Production code matches the baseline. The new tests explicitly preserve the identical-write ambiguity and reject separate distinct texts as the combined notice. This fix does not claim to count identical emission events.

## Verification

All checks ran in the assigned isolated worktree `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-b-258`, with Node `v26.12.1`.

- Focused driver, notification architecture, and background pass/update/gate owner suites: 119 tests passed. The driver contributes 4 tests.
- `npx cucumber-js --parallel 1 features/marketplace/background-update.feature`: 6 scenarios and 83 steps passed with real PTYs, seed `437800`.
- `fallow audit --base HEAD --format human`: exit 0, no issues in the four changed files. It emitted the existing TypeScript cache entry-point skip warning.
- Pre-commit formatters passed. The first commit attempt found one test callback lint error; it was fixed. The retry passed all normal hooks, including `npm run check:commit` and gitlint. The hook covers typecheck, lint, Fallow, formatting, source/test pairing, feature dry-run, and unpaired tests.
- No production source/test pair changed, so no direct-coverage pair applies to this harness-only change.

A fresh combined-tree `npm run check` and security re-verification remain with the orchestrator. This report does not change REVIEW or SECURITY dispositions and is left uncommitted for the orchestrator.
