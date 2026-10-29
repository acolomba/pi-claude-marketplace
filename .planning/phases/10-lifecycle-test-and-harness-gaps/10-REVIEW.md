---
phase: 10-lifecycle-test-and-harness-gaps
reviewed: 2026-10-29T08:12:52Z
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
  critical: 1
  warning: 0
  info: 0
  total: 1
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-10-29T08:12:52Z
**Depth:** standard
**Files Reviewed:** 126 (the retained Phase 10 scope plus the iteration-8 deltas)
**Status:** issues_found
**Observed HEAD:** `c4e4aa95`
**Runtime:** Node `v26.12.1`

## Structural Findings (fallow)

The exact merged full gate's Fallow stage passed. The iteration-8 fixer also reported a clean Fallow guard and audit for its three changed files. Direct review covered the complete retained scope and the iteration-8 source and test deltas.

CodeGraph was used before direct file reads. Its index did not include every newest changed owner, so all closure and requirement evidence was verified against the current source.

## Narrative Findings (AI reviewer)

### Summary

The complete 126-file scope was re-reviewed. The 123 files unchanged from the complete prior review remain byte-identical. The three source and test files changed by `442ffb14` were read against their full owners and traced through the cause-chain and notification-presentation callers. The strict Phase 10 checker still passes 56/56, binds XPH02 to the exact three required scenario titles at `741516af`, and retains its negative-mutation checks. D-PL10-13 remains the formal supersession of the older Plan 01-03 literal. The Phase 6, 8, and 9 integration evidence and 28-truth mapping remain present.

The package-manager settlement fix remains sound on the reviewed paths. The iteration-8 redaction fix closes the submitted multi-word apostrophe case and the exact `E_READ` negative control. It does not actually identify whether the next quote opens or closes a quoted value. An unrelated quoted value that begins with a character accepted by `isQuotedPathBoundary()` still makes the scanner consume slash-bearing prose as part of the absolute path.

## Critical Issues

### CR-01: The quote-role heuristic still consumes valid slash-bearing prose

**File:** `extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts:75-89`

**Issue:** `continuesQuotedPath()` decides that `nextQuote` closes the candidate by testing only the character after that quote. An opening quote also passes that test when its quoted value starts with whitespace or one of the accepted punctuation characters. For example, `open '/tmp/private/file.json' docs/errors '.hidden'` becomes `open 'errors '.hidden'`; the same corruption occurs with `':E_READ'` and `' E_READ'`. The behavior reaches `redactCauseChain` and public notification presentation because both use this shared helper. The new `E_READ` negative controls pass only because `E` is not a boundary character, so they do not discriminate the quote role that the implementation claims to recognize.

**Fix:** Do not classify a quote as a closing delimiter from its following character alone. Parse a continuation with a rule that distinguishes the candidate's closing delimiter from the opening delimiter of a later quoted value, and fail conservatively when that role is ambiguous. Add POSIX, drive, and UNC negative controls whose unrelated quoted value begins with punctuation or whitespace. Exercise the same boundary through `redactCauseChain` and public notification presentation.

### Prior finding closure

- The multi-word apostrophe disclosure is closed for the submitted `O' Mary Jane/秘密` case. CR-01 remains open because the replacement quote-role test still consumes valid immediate slash-bearing prose.
- The original early parent-close settlement and the replacement unreferenced-timer liveness defect are closed by `1b77dd7b`.
- The earlier PTY wait-cap, aggregate-notice oracle, and evidence-binding findings remain closed.

### Verification record

- `node scripts/check-phase10-coverage.mjs`: `56/56` rows valid.
- D-PL10-13 exact owner: passed, 1/1 with no skip or todo.
- Redaction and notification-presentation owners: passed 97/97; both direct pairs passed at 100% line, function, and branch coverage.
- Direct adversarial probes reproduced CR-01 for `'.hidden'`, `':E_READ'`, and `' E_READ'` immediately after slash-bearing prose.
- Package-install cleanup owner and direct coverage: passed.
- Package-manager owner module: passed 41/41 outside the process-restricted sandbox.
- Package-manager direct coverage: passed at 100% line, function, and branch coverage.
- Standalone no-ambient-handle process probe: exited 0 and emitted the complete timed-out result.
- Exact post-fix `npm run check`: passed `1144` scenarios / `11758` steps / `309` LCOV records. The gate does not include the remaining quote-role boundary above, so it does not close CR-01.

Only this report was changed. No implementation, test, state, or configuration file was modified, and no commit was created.

---

_Reviewed: 2026-10-29T08:12:52Z_
_Reviewer: Codex (gsd-code-reviewer)_
_Depth: standard_
