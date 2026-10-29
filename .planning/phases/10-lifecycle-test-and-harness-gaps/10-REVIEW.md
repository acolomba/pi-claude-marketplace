---
phase: 10-lifecycle-test-and-harness-gaps
reviewed: 2026-10-29T07:18:19Z
depth: standard
files_reviewed: 126
files_reviewed_list:
  - .pre-commit-config.yaml
  - eslint.config.js
  - .agents/skills/cucumber/rules/layout.md
  - .agents/skills/cucumber/rules/world-and-stand-ins.md
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/background-gate.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/background-update.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
  - extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts
  - extensions/pi-claude-marketplace/platform/hosted-manifest-fetch.ts
  - extensions/pi-claude-marketplace/platform/package-manager.ts
  - features/lib/git-clones.ts
  - features/lib/https-git-host/server.ts
  - features/lib/pi-tui-pty.py
  - features/lib/pi-tui.ts
  - features/lib/plugin-completions.ts
  - features/lib/run-tokens.ts
  - features/marketplace/add.feature
  - features/marketplace/background-update.feature
  - features/marketplace/failed-add.feature
  - features/marketplace/market-alias.feature
  - features/marketplace/update.feature
  - features/marketplace/usage-errors.feature
  - features/plugin/apply.feature
  - features/plugin/enable.feature
  - features/plugin/fetch.feature
  - features/plugin/git-source-update.feature
  - features/plugin/git-source.feature
  - features/plugin/import.feature
  - features/plugin/install-dependencies.feature
  - features/plugin/install-rollback.feature
  - features/plugin/install.feature
  - features/plugin/list-filters.feature
  - features/plugin/list.feature
  - features/plugin/package-dependencies.feature
  - features/plugin/prune.feature
  - features/plugin/reinstall.feature
  - features/plugin/update-dependencies.feature
  - features/plugin/update.feature
  - features/step_definitions/command.steps.ts
  - features/step_definitions/completion.steps.ts
  - features/step_definitions/config.steps.ts
  - features/step_definitions/git-host.steps.ts
  - features/step_definitions/marketplace/background-update.steps.ts
  - features/step_definitions/marketplace/checkout.steps.ts
  - features/step_definitions/mcp-configuration.steps.ts
  - features/step_definitions/plugin/installation.steps.ts
  - features/step_definitions/plugin/import.steps.ts
  - features/step_definitions/plugin/publishing.steps.ts
  - features/step_definitions/plugin/update.steps.ts
  - features/support/world.ts
  - scripts/check-features.mjs
  - scripts/check-phase10-coverage.mjs
  - test/architecture/gate-targets.ts
  - test/architecture/hooks-lifecycle.test.ts
  - test/architecture/https-git-host-server.test.ts
  - test/architecture/no-shell-out.test.ts
  - test/architecture/no-test-only-production-surface.test.ts
  - test/architecture/partial-vocabulary-guard.test.ts
  - test/architecture/pi-tui-notices.test.ts
  - test/architecture/workflows-marker-coverage.test.ts
  - test/bridges/agents/stage.test.ts
  - test/e2e/_rpc.ts
  - test/edge/handlers/plugin/browse.test.ts
  - test/edge/register.test.ts
  - test/orchestrators/import/execute.test.ts
  - test/orchestrators/marketplace/add.test.ts
  - test/orchestrators/marketplace/background-pass.test.ts
  - test/orchestrators/marketplace/update.messaging.test.ts
  - test/orchestrators/marketplace/update.test.ts
  - test/orchestrators/plugin/dependency-bindings.test.ts
  - test/orchestrators/plugin/dependency-move.test.ts
  - test/orchestrators/plugin/dependency-settle.test.ts
  - test/orchestrators/plugin/fetch.test.ts
  - test/orchestrators/plugin/install-cascade.messaging.test.ts
  - test/orchestrators/plugin/install-cascade.test.ts
  - test/orchestrators/plugin/install-flow-dependency-ledger.test.ts
  - test/orchestrators/plugin/install-flow-fixture.ts
  - test/orchestrators/plugin/install-flow-ledger.test.ts
  - test/orchestrators/plugin/install-flow-planning.test.ts
  - test/orchestrators/plugin/install-flow.test.ts
  - test/orchestrators/plugin/install.messaging.test.ts
  - test/orchestrators/plugin/marketplace-seed.ts
  - test/orchestrators/plugin/materialize-latest.test.ts
  - test/orchestrators/plugin/operations.test.ts
  - test/orchestrators/plugin/package-install.test.ts
  - test/orchestrators/plugin/reinstall-flow.test.ts
  - test/orchestrators/plugin/uninstall.test.ts
  - test/orchestrators/plugin/update-flow.test.ts
  - test/orchestrators/plugin/update-preflight.test.ts
  - test/orchestrators/plugin/update-swap.test.ts
  - test/orchestrators/reconcile/apply-outcomes.test.ts
  - test/orchestrators/reconcile/apply.test.ts
  - test/orchestrators/reconcile/notify.test.ts
  - test/orchestrators/reconcile/read-pass.test.ts
  - test/platform/hosted-manifest-fetch.test.ts
  - test/platform/package-manager.test.ts
  - test/shared/git-failure-classifiers.test.ts
  - test/shared/redact-absolute-paths.test.ts
findings:
  critical: 2
  warning: 0
  info: 0
  total: 2
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-10-29T07:18:19Z
**Depth:** standard
**Files Reviewed:** 126 (the retained Phase 10 scope plus all final Phase 6, 8, 9, and checker deltas)
**Status:** issues_found
**Observed HEAD:** `b89197ef`
**Runtime:** Node `v26.12.1`

## Structural Findings (fallow)

The merged full gate's Fallow stage passed. A fresh `fallow review --base a82101b4 --brief` could not create its temporary comparison worktree, so it supplied no new structural result. Direct review covered the complete retained scope and every final delta instead.

CodeGraph was used before direct file reads. Its index did not include every newest changed owner, so all closure and requirement evidence was verified against the current source.

## Narrative Findings (AI reviewer)

### Summary

The strict Phase 10 evidence contract remains sound: all 56 rows validate, all 28 must-haves are represented, XPH02 is bound to exactly the three required scenario titles at `741516af`, and the checker rejects absent titles and evidence commits that do not contain the title. D-PL10-13 remains the formal supersession of the older Plan 01-03 literal. The final Phase 8 stop/abort and PTY-oracle repairs remain closed, and Phase 9's structured dependency diagnostics retain their member ownership through direct update, marketplace update, and apply.

Two final integrated deltas nevertheless contain reproducible blockers: one leaks an absolute-path suffix, and one lets a timed-out package-manager run return while its descendant process is still alive.

## Critical Issues

### CR-01: An apostrophe followed by whitespace terminates a quoted path early and leaks the remaining path

**File:** `extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts:67`

**Issue:** The generic quoted-path expression accepts any matching quote followed by whitespace as the closing delimiter. An apostrophe inside a valid filename therefore closes the match early when the next filename character is a space. On the current tree,
`redactAbsolutePaths("unlink '/tmp/O' Brien/秘密/secret.json'")` returns
`unlink 'O' Brien/秘密/secret.json'`: only `/tmp/O` is reduced, while the remaining private path segments are disclosed. The special Node errno parser does not protect generic causes and rollback messages that pass through this branch.

**Fix:** Parse the final quoted path delimiter from the diagnostic boundary instead of accepting the first quote followed by whitespace. Preserve embedded quotes while a later path separator and closing quote remain. Add an owner regression for the exact apostrophe-space case and exercise it through `redactCauseChain` or a user-visible import/apply diagnostic.

### CR-02: A timed-out package-manager run resolves before its surviving process group is killed

**File:** `extensions/pi-claude-marketplace/platform/package-manager.ts:215-229`

**Issue:** Once the timeout has fired, a `close` event from the direct parent calls `settle()` and resolves the run immediately. The code deliberately leaves the SIGKILL timer active for descendants, but the caller has already resumed. `runInstallStage()` then removes the work directory in its `finally` block while the descendant package-manager process can still be writing to it. The existing test at `test/platform/package-manager.test.ts:444-475` demonstrates this ordering by awaiting `pending` before advancing the grace timers that mark the descendant stopped. This violates the module's own contract that a timed-out run settles after SIGKILL plus its grace and permits package network/file activity to continue after the command reports timeout.

**Fix:** Separate "parent closed" from "run settled" after `captured.timedOut` becomes true. Record the close code/output, but resolve only after the process-group escalation completes (or the final deadline fires). Add an assertion that the returned promise remains pending after parent close and until the descendant has received SIGKILL, then keep the existing never-closes deadline case.

### Prior finding closure

- The earlier Phase 10 PTY wait-cap blocker remains closed: the scenario holds the Git smart-HTTP request through the gate's 30-second cap and proves abort/cleanup before foreground continuation.
- The earlier aggregate-notice oracle blocker remains closed: distinct `alpha` and `beta` notices must appear in one combined redraw, and direct oracle tests reject separate notices.
- The earlier evidence-binding warning remains closed: the checker validates current paths and titles, verifies each commit, and reads every title from `git show commit:path`. Its current XPH02 rule also requires the exact three-title set.

### Verification record

- `node scripts/check-phase10-coverage.mjs`: `56/56` rows valid.
- Integrated full gate evidence at executable commit `741516af`: static checks, `1144` scenarios / `11758` steps, and `309` direct-LCOV records passed.
- Direct redaction reproduction on `b89197ef`: `unlink 'O' Brien/秘密/secret.json'` (suffix leak confirmed).
- The package-runner owner test explicitly resolves the run before advancing the timers that kill the surviving descendant, confirming CR-02's ordering.

Only this report was changed. No implementation, test, state, or configuration file was modified, and no commit was created.

---

_Reviewed: 2026-10-29T07:18:19Z_
_Reviewer: Codex (gsd-code-reviewer)_
_Depth: standard_
