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

## Iteration 2: CR-02 and CR-03

**Fixed at:** 2026-10-28. **Source review:** `08-REVIEW.md` at `26279bbf`.
**Commit:** `4412c2cb989acc1f02fd88348970d77450c5d291` (`fix: gate background dependency settlement and verify cancellation`).
**Disposition:** both fixes implemented; fresh combined-tree verification and re-review remain required. The two findings share one behavioral regression and are committed together. Earlier dispositions above are preserved.

### CR-02: Dependency settlement respects the background boundary

`background-pass.ts` wraps the dependency installer. It skips settlement after stop or abort, yields through the real gate, then checks current stop/abort/autoupdate state again. An eligible settlement runs under its own gate signal's async scope. Its `finally` records abort without releasing the gate; `updateOneMarketplace` still owns the gate until the entire marketplace operation returns.

Red-first owner evidence used real `createBackgroundPass`, `updateMarketplace`, a real gate, and temporary persisted state. All five initial regressions failed before the production change:

- Stopped, aborted, and opted-out cascades still called the dependency installer.
- Settlement had only two gate signals (refresh and plugin), instead of its own third signal.
- At foreground cancellation, the dependency installer's active async signal was not aborted.

The final suite adds a stop while yielding to foreground and a real held-scope-lock refusal/retry. The cancellation case holds settlement open after abort and proves the order `dependencies settled`, `marketplace settled`, `foreground`. No production seam or public API was added.

The real PTY scenario also fails without the wrapper. It uses existing publication and agent-file-collision fixtures: `app` declares an available missing dependency, its update is refused before dependency installation, and the later `ghp` git update is held until foreground cancellation. With the wrapper removed, the final installed-record assertion found an unexpected `dep@tools` installation after abort: seed `986902`, 18 steps passed and 1 failed. With the wrapper, only the two original plugins remain installed.

### CR-03: The PTY scenario exercises git cancellation

The hosted-request scenario is replaced by `A foreground command cancels a held background git update before dependency settlement`. Its host arm writes an unfinished git packet and continues sending one byte per second. This prevents the independent HTTP idle timeout from ending the request before the 30-second gate deadline. The interval is unreferenced and cleared when the response closes. Existing bounded PTY shutdown releases a failed scenario. The original host `hold` arm remains for its existing architecture contract; its unused Cucumber step was replaced.

The scenario observes the request before sending the foreground command, rejects foreground output during the first second while the request is pending, requires output after the 30-second deadline and within a five-second cleanup margin, then checks that the request was dropped and no update notice appeared. The owner test separately proves that the gate is retained until marketplace settlement completes. Same-name and distinct-name notice scenarios remain intact.

Mutation evidence against the final combined scenario:

- Removing `step.abort()` from the gate: foreground output timed out at 35 seconds; seed `24268`, 16 steps passed, 1 failed, 2 skipped.
- Bypassing `waitForStep()` in `runForeground`: the early blocking assertion failed (`true !== false`); seed `905303`, 16 steps passed, 1 failed, 2 skipped.

Both mutations were removed before committing. `background-gate.ts` matches the baseline exactly. An initial non-streaming held git body ended at the independent HTTP idle timeout; that fixture was rejected and is not the committed oracle.

### Iteration 2 verification

Checks ran in the assigned worktree `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-b-258`, Node `v26.12.1`.

- Background-pass owner suite: 36 tests passed, including seven new real-cascade cases.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts`: exit 0, 100% direct line/function/branch coverage. This is the only changed production source/test pair.
- Background gate/update, marketplace update, notice architecture, TUI oracle, and transaction-lifecycle integration suites: 236 tests passed.
- Existing HTTPS git-host architecture suite: 8 tests passed.
- Full `features/marketplace/background-update.feature` over real PTYs: 6 scenarios and 88 steps passed, seed `991744`.
- Fallow audit: exit 0, no issues in six changed files; the existing TypeScript cache entry-point skip warning remains.
- Final normal commit hooks passed, including `npm run check:commit` and gitlint. The first attempt exposed the old host-arm architecture consumer and one switch-spacing lint error; both were fixed before the successful retry. Hooks were never bypassed.

The commit changes only `background-pass.ts`, its paired test, the background feature and steps, and the existing git-host fixture and steps. REVIEW and SECURITY are untouched. This appendix is left uncommitted. A fresh full `npm run check` and independent re-review remain with the orchestrator.

## Iteration 3: Wait-cap documentation

Commit `9384204a1b380379f019b2f08e56d2de8f5440b2` changes only the background wait paragraph in `docs/env-vars.md`. It states that cancellation starts after 30 seconds and the command or session keeps waiting until the active step finishes. The canceled step fails cleanly, earlier completed changes remain, background work stops for that runtime, and quit does not wait. The wording was checked against D-PL8-23..25, `background-gate.ts`, and the shutdown handler.

No owner test reads this document. The exact seven-name verification loop and pre-commit command in `08-02-PLAN.md` passed in the assigned `pl-reverify-b-258` worktree. Fallow reported no issues. Normal commit hooks, including Markdown formatting, Markdown lint, and gitlint, passed. The npm hook correctly skipped this documentation-only input. No implementation or test file changed. This minimal fix evidence is left uncommitted for the orchestrator.
