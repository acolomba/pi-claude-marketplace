---
phase: 08-background-autoupdate
reviewed: 2026-10-29T13:40:00Z
reviewed_commit: ed25c8764eda4ba606ef4923198e9f67464ed5fb
depth: standard
files_reviewed: 53
files_reviewed_list:
  - docs/env-vars.md
  - docs/json-output.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/domain/official-marketplaces.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/background-gate.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/background-update.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/persistence/config-merge.ts
  - extensions/pi-claude-marketplace/platform/git.ts
  - extensions/pi-claude-marketplace/platform/hosted-manifest-fetch.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-json.ts
  - extensions/pi-claude-marketplace/shared/notification-resolve.ts
  - extensions/pi-claude-marketplace/shared/notification-run.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notification-wire.ts
  - features/lib/https-git-host/server.ts
  - features/lib/pi-commands.ts
  - features/lib/pi-tui-pty.py
  - features/lib/pi-tui.ts
  - features/lib/result-rows.ts
  - features/marketplace/background-update.feature
  - features/step_definitions/git-host.steps.ts
  - features/step_definitions/marketplace/background-update.steps.ts
  - features/step_definitions/session.steps.ts
  - features/support/pi-process.ts
  - features/support/world.ts
  - schema/claude-plugin.schema.json
  - test/architecture/background-update-notice.test.ts
  - test/architecture/hermetic-git-environment.test.ts
  - test/architecture/no-credential-leak.test.ts
  - test/architecture/pi-tui-notices.test.ts
  - test/architecture/wire-schema.test.ts
  - test/domain/official-marketplaces.test.ts
  - test/e2e/_rpc.ts
  - test/edge/handlers/marketplace-seed.ts
  - test/edge/register.test.ts
  - test/index.test.ts
  - test/orchestrators/marketplace/background-gate.test.ts
  - test/orchestrators/marketplace/background-pass.test.ts
  - test/orchestrators/marketplace/background-update.test.ts
  - test/orchestrators/marketplace/update.test.ts
  - test/platform/hermetic-environment.ts
  - test/shared/notification-grammar.test.ts
  - test/shared/notification-json.test.ts
  - test/shared/notification-resolve.test.ts
  - test/shared/notification-wire.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 8: Code Review Report

**Reviewed:** 2026-10-29T13:40:00Z
**Depth:** standard
**Files Reviewed:** 53
**Status:** clean

## Narrative Findings (AI reviewer)

The complete retained Phase 8 scope is clean on the final integrated tree. The
scope contains 61 non-`AGENTS.md` covered entries; after the required review
filter removes the eight Phase 8 planning plans and summaries, 53 source,
behavior, test, schema, and product-documentation files remain. All 53 are
listed above. No current BLOCKER or WARNING was found.

The evaluation-scope resolver reports a degraded phase range because it cannot
reach Phase 8 task commits from the integrated history. This review therefore
retains the explicit 53-file manifest from the prior complete review. An exact
path-limited comparison from that review's `c172f9b5` source tree through
`ed25c876` is empty, so every reviewed file is byte-identical to the tree that
received the prior full standard review. The final-head pass nevertheless
rechecked the background gate, pass, scheduler, PTY wait-cap oracle, aggregate
notice oracle, hosted-manifest redirect boundary, and git remote-read boundary.

Fallow's focused security scan raised two candidates, neither of which is a
finding. The `listRemotes` read joins `.git/config` to a clone directory supplied
by its containment-enforcing callers; it does not accept a user-selected output
path. The hosted-manifest fetch deliberately permits the user-selected start
origin, sends no credentials, and applies the documented HTTPS, userinfo,
redirect-count, cross-origin protocol, local-address, metadata-address, timeout,
and body-size checks to server-selected redirects. The same-origin exception is
an explicit tested contract, not an unchecked redirect.

## Fixed finding verification

### CR-01: stop and abort during the config reload

Closed by `f61d5848`. After the awaited merged-config read,
`yieldingPluginUpdate` now checks the live runtime-stop state and the current
step signal before it evaluates the config or calls the real update runner.
The stop path retains the marketplace-owned step, so shutdown still waits for
the cascade to settle. The abort path calls `halt.noteStepEnded(signal)` before
returning, so the aborted state is latched and every later target is skipped.
There is no additional asynchronous boundary between these checks and the
update call at which either state can change unnoticed.

The two deterministic owner cases place the action after the original halt
check while the real config read is pending. They prove that a stop starts no
plugin update, an abort starts no plugin update and prevents the later target,
both return the correct skipped outcomes, and neither emits a notification.
The fix report's RED run observed the unwanted update in both cases before the
production guard was added. The focused cases and direct-coverage pair pass on
the reviewed commit.

The config boundary remains correct: a foreground command can still turn
autoupdate off between plugin steps; invalid config still fails closed; and a
post-read stop or abort takes precedence over the config result.

### WR-01: shutdown wait contract comment

Closed by `5384e63b`. The scheduler header now says exactly what the gate does:
at 30 seconds it starts cancellation by aborting the active step, then shutdown
continues waiting until that step calls `endStep` and settles. It no longer
claims that 30 seconds bounds the total shutdown wait.

## Earlier blocker dispositions

| Finding | Current disposition |
| --- | --- |
| Dependency settlement after stop, abort, or opt-out | Closed. The dependency wrapper yields into a fresh gate and abort scope, reloads merged config, and rechecks stopped, aborted, and autoupdate state before invoking the installer. The enclosing marketplace retains step ownership until cascade/reporting settlement. |
| PTY wait-cap oracle reached the hosted-fetch timeout | Closed. The fixture keeps a git response open with heartbeats; the behavior waits for the gate's 30-second abort, observes the dropped git request, preserves installed state, and emits no update notice. |
| Aggregate-notice oracle accepted split notices | Closed. Distinct alpha/beta updates must appear in one combined visible notice, and the notification-entry owner assertion prevents identical-screen-write ambiguity. |
| Background notification credentials or local paths could leak | Closed. Background-update fields pass through the shared credential-redacting resolver, structured payloads use the closed wire schema, and the architecture cases cover both text and structured transports. |

## Validation context

- The exact integrated `npm run check` gate passed 1,145 scenarios, 11,777
  steps, and 309 direct-coverage LCOV records on this source/test tree.
- Phase 8 Nyquist validation is COMPLIANT for AUP-01 through AUP-03 and all four
  roadmap truths at `ed25c876`.
- The focused owner/architecture set passed 10/10, and all five direct-coverage
  pairs passed at 100%.
- The real PTY feature passed six scenarios and 88 steps.
- Fallow reports no confirmed dead-code, complexity, duplication, or security
  finding in the reviewed scope.

All reviewed files meet the Phase 8 correctness, security, and quality
requirements. No issues found.

---

_Reviewed: 2026-10-29T13:40:00Z_
_Reviewer: Codex (gsd-code-reviewer)_
_Depth: standard_
