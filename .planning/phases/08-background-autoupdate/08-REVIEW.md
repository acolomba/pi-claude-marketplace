---
phase: 08-background-autoupdate
reviewed: 2026-10-28T21:14:45Z
depth: standard
files_reviewed: 36
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/marketplace/background-gate.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/background-update.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-json.ts
  - extensions/pi-claude-marketplace/shared/notification-resolve.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notification-wire.ts
  - features/lib/pi-commands.ts
  - features/lib/result-rows.ts
  - features/marketplace/background-update.feature
  - features/step_definitions/marketplace/background-update.steps.ts
  - features/step_definitions/session.steps.ts
  - features/support/world.ts
  - test/e2e/_rpc.ts
  - test/orchestrators/marketplace/background-gate.test.ts
  - test/orchestrators/marketplace/background-pass.test.ts
  - test/orchestrators/marketplace/background-update.test.ts
  - test/index.test.ts
  - test/edge/register.test.ts
  - extensions/pi-claude-marketplace/domain/official-marketplaces.ts
  - extensions/pi-claude-marketplace/platform/git.ts
  - extensions/pi-claude-marketplace/platform/hosted-manifest-fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - features/lib/pi-tui.ts
  - features/lib/pi-tui-pty.py
  - features/support/pi-process.ts
  - test/architecture/pi-tui-notices.test.ts
  - test/architecture/background-update-notice.test.ts
  - test/architecture/hermetic-git-environment.test.ts
  - test/platform/hermetic-environment.ts
  - test/edge/handlers/marketplace-seed.ts
findings:
  critical: 2
  warning: 0
  info: 0
  total: 2
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-10-28T21:14:45Z
**Depth:** standard
**Files Reviewed:** 36
**Status:** issues_found

## Narrative Findings (AI reviewer)

The final integrated review found two blockers outside the otherwise correct
SEC-08-01 notice-oracle fix. Five focused owner and architecture suites pass,
but they do not exercise these integrated dependency and cancellation paths.

## CR-02 — BLOCKER: Missing-dependency installation bypasses the background halt boundary

**Files:**

- `extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts:190-199`
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:791-829`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:2474`

`background-pass` forwards `installMissingDependencies` unchanged. The real
marketplace cascade invokes it after the plugin loop, including when the
background wrapper skipped plugins because the runtime stopped or the pass
aborted.

A hermetic reproduction used real `createBackgroundPass`, real
`updateMarketplace`, a real gate, and temporary state. The injected plugin
operation set `isStopped()` to true, after which the dependency installer ran:

```text
["plugin update", "dependency installer called with stopped=true"]
```

The production callback plans and executes dependency installations. This
contradicts D-PL8-15 and D-PL8-25. It also resumes in the original refresh
abort scope after plugin wrappers used the gate's current nested signal.

**Fix scope:** wrap the dependency step at the background boundary. Recheck
halt and current autoupdate eligibility before it starts, run it in a correctly
owned gate/abort scope, and retain the gate until the marketplace operation
settles. Add real-cascade cases for stopped, aborted, and mid-cascade opt-out,
plus dependency-step foreground cancellation.

## CR-03 — BLOCKER: The PTY wait-cap scenario tests hosted timeout, not gate cancellation

**Files:**

- `features/marketplace/background-update.feature:90`
- `features/step_definitions/marketplace/background-update.steps.ts:37-81`
- `extensions/pi-claude-marketplace/platform/hosted-manifest-fetch.ts:18,294`

The scenario holds a hosted catalog request. That fetch has its own ten-second
timeout and does not use the gate's git abort scope. Gate cancellation begins
after thirty seconds, so the hosted request finishes first.

Its assertions only require foreground output after a positive duration and
within thirty seconds, followed eventually by a dropped hosted request. A
foreground command that bypasses the gate also satisfies them. The scenario
therefore cannot prove D-PL8-23 and violates the behavioral-test quality rule.

**Fix scope:** hold a git request reached through `runWithGitAbortSignal`.
Assert the foreground command remains blocked before cancellation and completes
only after the active operation settles. Allow bounded cleanup beyond the
cancellation deadline. Record red evidence with cancellation removed and with
foreground gating bypassed. Keep any hosted-timeout case under an accurate title.

## Prior finding dispositions

| Finding | Disposition |
| --- | --- |
| Original CR-01 / SEC-08-01 | Resolved. Distinct alpha/beta scenario detects split notices; exact-entry owner assertion checks one emission. |
| WR-01 | Resolved by RPC quiet-window collection. The TUI oracle explicitly reports distinct texts, not emission counts. |
| WR-02 | Scheduler and owner coverage prove deferred execution; RPC is a negative control under TUI-only scheduling. |
| WR-03 | Resolved: completed updates are reported before an early failure, preserving the original error if notification also fails. |
| WR-04 | Resolved for plugin updates through config revalidation. CR-02 identifies the uncovered dependency extension. |
| IN-01 | Resolved: documentation attaches to the correct resolver. |
| IN-02 | Resolved: halted passes skip later scopes. |
| IN-03 | Resolved: comments describe process environment lifetime accurately. |
| IN-04 | Superseded by D-PL8-23..25. CR-02 exposes an integrated dependency-path gap. |

The four oracle tests accurately document synchronized-redraw ambiguity.
Identical-notification event counts cannot be inferred from PTY screen bytes;
the complementary exact-entry owner assertion and distinct-name mutation
evidence are sufficient for SEC-08-01.

## Validation evidence

- Five focused owner and architecture modules passed independently.
- The supplied full gate at `7a436b05` passed 1,125 scenarios, 11,481 steps,
  and 309 LCOV records.
- The non-planning diff from that commit to reviewed HEAD `98eee938` is empty.
- Real integrated and behavioral probes reproduced CR-02 and CR-03 despite
  those passing checks.
- This review changed no files and created no commit.

---

_Reviewer: Codex (gsd-code-reviewer)_
_Depth: standard_
