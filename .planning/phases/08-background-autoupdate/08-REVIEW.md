---
phase: 08-background-autoupdate
reviewed: 2026-10-28T21:55:54Z
depth: standard
files_reviewed: 38
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
  - features/lib/https-git-host/server.ts
  - features/step_definitions/git-host.steps.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 8: Code Review Report

**Reviewed:** 2026-10-28T21:55:54Z
**Depth:** standard
**Files Reviewed:** 38
**Status:** clean

## Narrative Findings (AI reviewer)

No actionable findings remain. The final re-review at `2fab7ba3` inspected
commit `4412c2cb`, its real-cascade regression tests, the streaming git fixture,
the PTY scenario, and affected gate, marketplace-update, and dependency-install
callers. The previously reviewed remainder is unchanged. All reviewed files
meet quality standards.

## Blocker closures

### CR-02: Dependency settlement bypassed the background boundary — resolved

The background pass now supplies a dependency wrapper that checks halted state
before yielding. After acquiring a fresh gate step, it reads current
configuration and checks stopped/aborted state and autoupdate eligibility before
invoking the installer.

Eligible settlement receives the fresh gate signal through the async abort
scope. The wrapper records abort in `finally` without releasing the gate; the
enclosing marketplace operation retains ownership until its cascade and
reporting settle. Results and errors continue through existing reporting paths.

Seven real-cascade cases cover stopped and aborted passes, opt-out, fresh signal
ownership, foreground cancellation and settlement order, stop during a yield,
and held-scope-lock refusal followed by a later successful pass. The cancellation
case verifies dependency settlement, then marketplace settlement, then the
foreground command. The command-level regression also proves cancellation leaves
no unexpected dependency installation; removing the wrapper produced an extra
`dep@tools` record.

### CR-03: The PTY scenario exercised hosted timeout — resolved

The replacement scenario holds a git response body. An unfinished git packet
receives one byte per second, preventing the independent HTTP idle timeout from
ending the request before the gate's 30-second deadline.

The scenario verifies a pending request and no foreground result during the
initial interval, then requires output after 30 seconds within a five-second
cleanup margin. It checks the dropped request, absence of an update notice, and
unchanged installed records. Removing cancellation times out awaiting foreground
output; bypassing the foreground gate fails the early blocking assertion.

The heartbeat is unreferenced and cleared on response close. Scenario release
stops the PTY process group and disarms the repository; host shutdown closes
connections and sandbox teardown removes fixture files.

## Prior finding dispositions

| Finding | Final disposition |
| --- | --- |
| Original CR-01 / SEC-08-01 | Resolved by distinct alpha/beta aggregation, split-notice mutation evidence, and an exact-entry owner assertion. |
| WR-01 | Resolved by RPC quiet-window collection; TUI parsing reports distinct visible texts, not event counts. |
| WR-02 | Resolved by synchronous scheduling and deferred-pass owner coverage; RPC is a TUI-only negative control. |
| WR-03 | Resolved: completed updates are reported before early failure while preserving the original error. |
| WR-04 | Resolved for plugin updates and dependency settlement eligibility. |
| IN-01 | Resolved: resolver documentation attaches correctly. |
| IN-02 | Resolved: halted passes do not read later scopes. |
| IN-03 | Resolved: environment-lifetime comments are accurate. |
| IN-04 | Superseded by D-PL8-23 through D-PL8-25, with dependency signal propagation corrected. |
| CR-02 | Resolved by the gated dependency wrapper and real-cascade regressions. |
| CR-03 | Resolved by streaming git I/O, blocking/order assertions, and cancellation/bypass mutations. |

Current decisions remain respected: TUI-only scheduling, official-name defaults
with explicit configuration precedence, invalid-config fail-closed behavior,
bare-name notice deduplication, and cancellation at the wait cap followed by
operation settlement. Quit retains its recorded immediate-return exception.

The same-name and distinct-name notice scenarios remain intact. Synchronized
terminal redraw bytes cannot establish identical-event counts; the complementary
exact-entry owner assertion and distinct-name mutation proof remain sufficient.

## Validation evidence

- Fresh `npm run check` at `4412c2cb` passed 1,125 scenarios, 11,486 steps,
  and 309 LCOV records on Node `v26.12.1`.
- Supplied focused evidence: 36 background-pass owner tests, 236 adjacent tests,
  eight host tests, and six PTY scenarios with 88 steps. The changed production
  pair reached 100% direct coverage; Fallow and hooks passed.
- The reviewer reran four focused modules successfully.
- The non-planning diff from `4412c2cb` to `2fab7ba3` is empty, so the full gate
  applies to the reviewed build inputs.
- Review was read-only.

---

_Reviewer: Codex (gsd-code-reviewer)_
_Depth: standard_
