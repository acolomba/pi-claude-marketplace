---
phase: 10-lifecycle-test-and-harness-gaps
reviewed: 2026-10-29T10:05:34Z
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

**Reviewed:** 2026-10-29T10:05:34Z
**Depth:** standard
**Files Reviewed:** 126 (the retained Phase 10 scope plus the iteration-14 deltas)
**Status:** issues_found
**Observed HEAD:** `89b1a356`
**Runtime:** Node `v26.12.1`

## Structural Findings (fallow)

The exact merged full gate's Fallow stage passed. The iteration-14 fixer also reported a clean Fallow guard and health check for its three changed files. Direct review covered the complete retained scope and the iteration-14 source and test deltas.

CodeGraph was used to trace the shared redactor into its cause-chain, cascade, install, apply, and notification-presentation consumers. Its index marked the changed redactor stale, so the current source was read directly.

## Narrative Findings (AI reviewer)

### Summary

The complete 126-file scope was re-reviewed. The 123 files unchanged from the complete prior review are byte-identical; the three files changed by `98433651` were read in full and traced through their public consumers. The strict Phase 10 checker passes 56/56, and the D-PL10-13 exact owner passes 1/1 with no skip or todo. The package-manager settlement, Phase 8/9 integration, evidence-binding, and D-PL10-13 supersession evidence remain unchanged.

Iteration 14 simplifies the generic quoted-path grammar and correctly fails closed for its submitted embedded, surplus, and unmatched quote matrices. One adjacent same-quote chain still violates the binding policy: an embedded quote is accepted as the absolute field's delimiter when later quotes form a balanced value. That exposes the remaining absolute-path suffix through the utility, cause-chain, and notification consumers.

## Critical Issues

### CR-01: A balanced later value makes an embedded path quote look unambiguous

**Classification:** BLOCKER
**File:** `extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts:76-106`

**Issue:** `quotedPathEnd()` takes the first matching quote as `delimiter`. When another quote exists, it accepts that first quote whenever `hasResolvedQuoteChain()` can pair the later quotes. The later chain being balanced does not prove that the first quote closed the absolute field: it can be an embedded filename character followed by a separate balanced value. For example, `open '/tmp/O' Brien/private/secret.json 'x'` becomes `open 'O' Brien/private/secret.json 'x'`, exposing `Brien/private/secret.json`. The drive, UNC, double-quoted, and `redactCauseChain()` forms reproduce. This contradicts the binding fail-closed rule because the same-quote chain has two valid interpretations. The reconciled matrices cover an embedded quote by itself and a closed path followed by a balanced value, but not their collision, so a plausible leaking implementation still passes all owner tests.

**Fix:** Treat a first quote plus a later balanced same-quote value as ambiguous whenever the intervening text can still be absolute-path continuation, and return `undefined` so the whole remainder becomes `[redacted path]`. If the generic string grammar cannot distinguish that collision from slash-bearing prose, apply the approved security-first policy and fail closed for both. Add POSIX, drive, UNC, single-quoted, double-quoted, cause-chain, and public-presentation cases combining an embedded quote with a later balanced quoted value.

### Prior finding closure

- Iteration 14 closes the submitted unmatched embedded-quote and arbitrary slash-prose cases by full elision.
- Marker-like suffixes inside path components preserve no raw suffix.
- The original early parent-close settlement and the replacement unreferenced-timer liveness defect remain closed by `1b77dd7b`.
- The earlier PTY wait-cap, aggregate-notice oracle, and evidence-binding findings remain closed.

### Verification record

- `node scripts/check-phase10-coverage.mjs`: `56/56` rows valid.
- D-PL10-13 exact owner: passed 1/1 with no skip or todo.
- Iteration-14 focused owners: passed 265 redactor tests and 48 presentation tests; both direct pairs passed 100% line, function, and branch coverage.
- Direct adversarial probes reproduced CR-01 for POSIX, drive, UNC, single-quoted, and double-quoted inputs; `redactCauseChain()` retained the exposed suffix.
- Package-manager owner and direct coverage evidence remain green on the byte-identical package-manager source.
- Exact post-fix `npm run check`: passed `1144` scenarios / `11758` steps / `309` LCOV records. The gate lacks the embedded-quote-plus-balanced-value collision.

Only this report was changed. No implementation, test, state, or configuration file was modified, and no commit was created.

---

_Reviewed: 2026-10-29T10:05:34Z_
_Reviewer: Codex (gsd-code-reviewer)_
_Depth: standard_
