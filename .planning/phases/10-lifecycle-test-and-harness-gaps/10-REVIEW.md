---
phase: 10-lifecycle-test-and-harness-gaps
reviewed: 2026-10-29T07:45:51Z
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

**Reviewed:** 2026-10-29T07:45:51Z
**Depth:** standard
**Files Reviewed:** 126 (the retained Phase 10 scope plus all final Phase 6, 8, 9, and checker deltas)
**Status:** issues_found
**Observed HEAD:** `d4985207`
**Runtime:** Node `v26.12.1`

## Structural Findings (fallow)

The reported merged full gate's Fallow stage passed. A fresh `fallow guard` accepted all five final changed files. Direct review covered the complete retained scope and both final fixes.

CodeGraph was used before direct file reads. Its index did not include every newest changed owner, so all closure and requirement evidence was verified against the current source.

## Narrative Findings (AI reviewer)

### Summary

The complete 126-file scope was re-reviewed. The 121 files unchanged from the complete `b89197ef` review are byte-identical; the five files changed by `d93cd43a` and `bb50b890` were read in full and traced through their callers. The strict Phase 10 checker still passes 56/56, binds XPH02 to the exact three required scenario titles at `741516af`, and retains its negative-mutation checks. The exact D-PL10-13 owner passes, so that decision remains the formal supersession of the older Plan 01-03 literal. The Phase 6, 8, and 9 integration evidence and the 28-truth mapping remain present.

The final fixes are not clean. CR-01's exact leak is closed, but its new quote scanner corrupts valid diagnostics when ordinary prose between two quoted values contains a slash. CR-02 keeps the promise pending through escalation, but its unreferenced escalation timers can now leave that promise permanently unsettled once the parent and descendant handles close. The platform owner and direct-coverage pair fail on the submitted tree, so the reported full-gate result cannot be accepted for these inputs.

## Critical Issues

### CR-01: The quote-continuation heuristic consumes unrelated prose that contains a path separator

**File:** `extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts:75-89`

**Issue:** `continuesQuotedPath()` treats any slash or backslash before the next matching quote as proof that the first quote belongs inside the path. That includes unrelated diagnostic prose. For POSIX, drive, and UNC inputs such as `open '/tmp/private/file.json' failed; see docs/errors 'E_READ'`, the current implementation returns `open 'errors 'E_READ'`. It drops the actual basename and most of the error text. The exact apostrophe-space leak is fixed, but the scanner is not conservative across the platform grammars it accepts. The fix also has no exact Cucumber case that would fail if this user-visible redaction behavior regressed; the existing install scenario uses a different path shape.

**Fix:** Recognize a continuation only when the text immediately after the ambiguous quote is syntactically a path component that reaches a separator before prose, rather than searching the whole interval for any separator. Add POSIX, drive, and UNC negative controls with a closed path followed by slash-bearing prose, retain the exact apostrophe-space positive cases, and add a command-surface Cucumber regression for the exact disclosure fix.

### CR-02: Unreferenced escalation timers can leave a timed-out package-manager run unsettled forever

**File:** `extensions/pi-claude-marketplace/platform/package-manager.ts:164-185`

**Issue:** After the timeout, a parent `close` deliberately no longer settles the promise. Settlement then depends on the grace and final-deadline timers, but both are unreferenced. If the parent closes on SIGTERM and the descendant either uses independent stdio or dies on SIGKILL, no referenced child or pipe handle remains to keep Node alive, and a pending Promise does not keep the event loop alive. A standalone run exits with Node's `Detected unsettled top-level await` warning and status 13 instead of resolving. On the submitted tree, both `node --test test/platform/package-manager.test.ts` and `npm run test:coverage:direct -- extensions/pi-claude-marketplace/platform/package-manager.ts` fail at the file wrapper. This also means `runInstallStage()` cannot reach its promised cleanup deterministically.

**Fix:** Keep the post-timeout grace and final-deadline timers referenced until `settle()` cancels them; only the initial timeout may rely on the live child handle. Add a child-process regression that runs with no ambient referenced handle and requires the promise to resolve after group escalation. Then require the platform owner module and its direct source-test coverage pair to pass in isolation before reusing any full-gate claim.

### Prior finding closure

- The original apostrophe-space suffix disclosure is closed for the exact POSIX utility and cause-chain cases; CR-01 above is a new correctness regression in the scanner introduced by that fix.
- The original early parent-close settlement is closed; CR-02 above is the replacement liveness defect created by relying exclusively on unreferenced timers.
- The earlier PTY wait-cap, aggregate-notice oracle, and evidence-binding findings remain closed.

### Verification record

- `node scripts/check-phase10-coverage.mjs`: `56/56` rows valid.
- D-PL10-13 exact owner: passed, 1/1 with no skip or todo.
- Redaction owner tests and direct coverage: passed; adversarial POSIX, drive, and UNC prose probes reproduced CR-01.
- Package-install cleanup owner and direct coverage: passed.
- Package-manager owner module: failed on the current tree.
- Package-manager direct coverage: failed on the current tree.
- Standalone no-ambient-handle process probe: exited 13 with unsettled top-level await, reproducing CR-02.
- The supplied aggregate-gate claim was `1144` scenarios / `11758` steps / `309` LCOV records, but a required direct pair is red on the same submitted source and therefore invalidates that claim as a final verdict.

Only this report was changed. No implementation, test, state, or configuration file was modified, and no commit was created.

---

_Reviewed: 2026-10-29T07:45:51Z_
_Reviewer: Codex (gsd-code-reviewer)_
_Depth: standard_
