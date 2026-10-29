---
phase: 08-background-autoupdate
reviewed: 2026-10-29T05:17:56Z
depth: standard
files_reviewed: 39
files_reviewed_list:
  - docs/env-vars.md
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
  critical: 1
  warning: 1
  info: 0
  total: 2
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-10-29T05:17:56Z
**Depth:** standard
**Files Reviewed:** 39
**Status:** issues_found

## Narrative Findings (AI reviewer)

The integrated-tree re-review traced the TUI scheduler, foreground gate,
marketplace cascade, dependency settlement, plugin-update runner, notification
resolver/transports, real PTY host, and behavioral oracles. The three previous
blockers remain closed: dependency settlement rechecks halt/config state after
its yield; the wait-cap scenario holds a streamed git response until the gate's
30-second abort; and the distinct alpha/beta scenario plus exact owner assertion
detect split notices.

One separate stop/abort race remains in the plugin-update yield. The current
documentation also correctly describes abort-then-settle, but the scheduler's
source header still states the superseded bounded-total-wait behavior.

## Critical Issues

### CR-01: A stop or abort during the config reload still starts the plugin update

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts:334-339`

**Issue:** `yieldingPluginUpdate` checks `halt.isHalted()` before awaiting
`loadMergedScopeConfig`, then invokes the real plugin update without checking
again. A reload/new/resume/fork shutdown can set `isStopped()` while that async
read is pending; when the read resolves, the stale runtime still mutates plugin
state. The gate's 30-second timer can likewise abort `signal` during the read,
but the code still invokes `runPluginStep`; a local or otherwise successfully
settling update can be retained and reported, and the abort is not latched until
after that update returns. This violates the stopped-runtime boundary and the
rule that an aborted pass starts no further work. The dependency-settlement
wrapper already performs the required post-read `halt.isHalted() ||
signal.aborted` check at lines 229-234.

**Fix:** Recheck both states immediately after the awaited config read, latch an
aborted signal before returning, and add deterministic stop-during-read and
abort-during-read owner cases. A gate double can queue the stop/abort from the
plugin step's `beginStep`, placing it after the precheck and before config I/O
settles.

```typescript
const config = await loadMergedScopeConfig(locationsFor(scope, cwd));
if (halt.isStopped()) {
  return skippedOutcome(plugin, NOT_RUN_NOTE);
}
if (signal.aborted) {
  halt.noteStepEnded(signal);
  return skippedOutcome(plugin, ABORTED_NOTE);
}
if (halt.isHalted()) {
  return skippedOutcome(plugin, NOT_RUN_NOTE);
}
if (!isAutoupdateOn(config, marketplace)) {
  return autoupdateOffOutcome(plugin);
}
```

The regressions must assert that `updatePlugin` is never called, no update row
or notice is emitted, and an abort prevents later targets from running.

## Warnings

### WR-01: The scheduler header misstates abort-then-settle as a bounded total wait

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/background-update.ts:10-14`

**Issue:** The comment says a non-quit shutdown "waits at most the gate's wait
cap." The gate actually aborts the active signal at 30 seconds and deliberately
keeps waiting until `endStep`; `docs/env-vars.md:201` now records that behavior
correctly. This false lifecycle contract can cause a future caller or maintainer
to release state-lock ownership early or write another incorrect timing oracle.

**Fix:** State that the gate begins cancellation at the wait cap and shutdown
continues waiting for the step to settle.

```typescript
// At the gate's wait cap, cancellation of the active step begins; shutdown
// continues waiting until that step settles.
```

## Prior blocker dispositions

| Finding | Current disposition |
| --- | --- |
| Dependency settlement after stop/abort/opt-out | Closed. The wrapper yields into a fresh gate/abort scope, reloads merged config, and rechecks stopped, aborted, and autoupdate state before invoking the installer. |
| PTY wait-cap oracle reached hosted timeout | Closed. The fixture streams an unfinished git response with heartbeats; the scenario observes initial foreground blocking, the gate's 30-second abort, dropped request, unchanged installs, and no notice. |
| Aggregate-notice oracle accepted split notices | Closed. The alpha/beta scenario requires one combined visible notice, and the exact notification-entry owner test prevents same-text event-count ambiguity. |

## Validation context

- Nyquist validation is COMPLIANT.
- The supplied integrated full gate passed 1,143 scenarios, 11,742 steps, and
  309 merged LCOV records; the real PTY feature passed six scenarios and 88
  steps. Passing tests do not cover CR-01's stop/abort-during-config-read
  interleaving.
- The Phase 8 core implementation and behavioral files are byte-identical to
  the prior complete review. This pass re-read the current gate/pass/scheduler
  and behavioral path, reviewed the merged-tree deltas, and traced the later
  package/dependency/redaction changes through the background call chain.
- Later `apply.ts` and absolute-path-redactor changes do not replace the
  background pass's plugin-yield guard. Notice fields still pass through the
  credential-redacting resolver and the per-install wire schema remains closed.
- Review was read-only except for this report.

---

_Reviewed: 2026-10-29T05:17:56Z_
_Reviewer: Codex (gsd-code-reviewer)_
_Depth: standard_
