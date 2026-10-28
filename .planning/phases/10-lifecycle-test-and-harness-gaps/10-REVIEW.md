---
phase: 10-lifecycle-test-and-harness-gaps
reviewed: 2026-10-28T22:58:34Z
depth: standard
files_reviewed: 106
files_reviewed_list:
  - .pre-commit-config.yaml
  - .agents/skills/cucumber/rules/layout.md
  - .agents/skills/cucumber/rules/world-and-stand-ins.md
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/background-gate.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
  - extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts
  - extensions/pi-claude-marketplace/platform/hosted-manifest-fetch.ts
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
  - features/step_definitions/plugin/update.steps.ts
  - features/support/world.ts
  - scripts/check-features.mjs
  - scripts/check-phase10-coverage.mjs
  - test/architecture/gate-targets.ts
  - test/architecture/hooks-lifecycle.test.ts
  - test/architecture/https-git-host-server.test.ts
  - test/architecture/no-test-only-production-surface.test.ts
  - test/architecture/partial-vocabulary-guard.test.ts
  - test/architecture/pi-tui-notices.test.ts
  - test/architecture/workflows-marker-coverage.test.ts
  - test/bridges/agents/stage.test.ts
  - test/e2e/_rpc.ts
  - test/edge/handlers/plugin/browse.test.ts
  - test/orchestrators/import/execute.test.ts
  - test/orchestrators/marketplace/add.test.ts
  - test/orchestrators/marketplace/background-pass.test.ts
  - test/orchestrators/marketplace/update.test.ts
  - test/orchestrators/plugin/dependency-bindings.test.ts
  - test/orchestrators/plugin/dependency-move.test.ts
  - test/orchestrators/plugin/dependency-settle.test.ts
  - test/orchestrators/plugin/fetch.test.ts
  - test/orchestrators/plugin/install-cascade.messaging.test.ts
  - test/orchestrators/plugin/install-cascade.test.ts
  - test/orchestrators/plugin/install-flow-fixture.ts
  - test/orchestrators/plugin/install-flow-ledger.test.ts
  - test/orchestrators/plugin/install-flow-planning.test.ts
  - test/orchestrators/plugin/install-flow.test.ts
  - test/orchestrators/plugin/install.messaging.test.ts
  - test/orchestrators/plugin/marketplace-seed.ts
  - test/orchestrators/plugin/materialize-latest.test.ts
  - test/orchestrators/plugin/package-install.test.ts
  - test/orchestrators/plugin/reinstall-flow.test.ts
  - test/orchestrators/plugin/update-flow.test.ts
  - test/orchestrators/plugin/update-swap.test.ts
  - test/orchestrators/reconcile/apply-outcomes.test.ts
  - test/orchestrators/reconcile/apply.test.ts
  - test/orchestrators/reconcile/read-pass.test.ts
  - test/platform/hosted-manifest-fetch.test.ts
  - test/shared/git-failure-classifiers.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 10: Code Review Report

**Reviewed:** 2026-10-28T22:58:34Z
**Depth:** standard
**Files Reviewed:** 106 (the retained Phase 10 scope plus the current post-split and integrated background-update owners)
**Status:** clean
**Observed HEAD:** `a82101b4`
**Runtime:** Node `v26.12.1`

## Structural Findings (fallow)

`fallow review --base 885537b1 --brief --format json --quiet` passed with zero dead-code, complexity, or duplication findings across the integrated corrective range. It classified the 50-file range as high risk because it includes deep cross-module changes, so direct review and focused owner checks were still required. `fallow security --changed-since 885537b1` surfaced the existing hosted-fetch, marketplace path, loopback fixture, and coverage-checker process/path boundaries. Direct tracing found the existing URL and metadata guards, containment checks, loopback-only stand-ins, and argument-array Git invocation; no security finding was proved.

CodeGraph was used before direct file reads. Its index did not include every newest changed owner, so all closure and requirement evidence was verified against the current source.

## Narrative Findings (AI reviewer)

### Summary

All 106 reviewed files meet the Phase 10 quality standard. No blocker, warning, or informational finding remains.

The seven success criteria remain covered on the integrated tree. The 56-row ledger accounts for every TST-01/TST-02 item and rejects missing, stale, or mismatched evidence; the install and reinstall fixtures create loadable manifests before records (TST-03); the three CAS-08 failure routes retain separate scenarios; the MIM-05 scenario asserts per-phase rollback detail; and the XPH-01/XPH-02 corrections retain their scenario or justified owner-test evidence. The post-split `rootCommit` proof remains divided at the correct boundaries: dependency planning selects the previewed commit, and public install planning materializes that exact pin after a dependency move. Later Phase 1/4/7 changes do not weaken these owners.

### Prior finding closure

- **CR-01 closed (`4412c2cb`).** The real PTY scenario now holds a streaming git smart-HTTP response rather than a hosted manifest request. The fixture keeps the transfer active without its own earlier timeout; the foreground step proves the request is still pending before the cap, requires a 30-35 second wait, observes the request become `dropped`, and verifies neither installation nor notice advances. Production runs refresh, plugin update, and dependency settlement inside gate-owned abort scopes. Focused owner cases prove an aborted step halts later work, dependency settlement receives the abort, and the foreground command waits for cascade/reporting cleanup before it runs.
- **CR-02 closed (`7a436b05`).** The aggregate PTY scenario uses distinct `alpha` and `beta` plugins and requires one exact combined notice. Separate per-marketplace notices can no longer satisfy the assertion. Four direct oracle cases document redraw deduplication and prove separate distinct notices are rejected.
- **WR-01 closed (`d4c3220b`).** The checker retains current-path containment and title checks, proves each eight-hex commit exists, and uses argument-array `git show commit:path` to require every path and title at that commit. All five reconciled rows cite commits containing their current evidence, including both `rootCommit` owners and the two corrected PTY scenarios.

### Verification record

- `node scripts/check-phase10-coverage.mjs`: `56/56` rows valid.
- `node --test --test-reporter=spec test/architecture/pi-tui-notices.test.ts`: passed.
- Focused `background-pass.test.ts` owner selection covering aborted dependency settlement, foreground cancellation/cleanup, and refresh abort-at-cap: passed.
- Integrated full gate supplied at merge commit `28915add`: static checks, `1131` scenarios / `11584` steps, and `309` direct-LCOV records passed. The only later source-like change is the standalone Phase 10 checker, which is outside `npm run check` and was reviewed and exercised above.
- Existing focused real-PTY evidence on the integrated source: CR-01 `1` scenario / `19` steps; CR-02 `1` scenario / `19` steps. The CR-02 direct oracle passed `4/4`; the checker owner passed `56/56` and rejected a negative mutation.

Only this report was changed. No implementation, test, state, or configuration file was modified, and no commit was created.

---

_Reviewed: 2026-10-28T22:58:34Z_
_Reviewer: Codex (gsd-code-reviewer)_
_Depth: standard_
