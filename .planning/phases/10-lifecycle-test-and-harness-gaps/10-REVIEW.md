---
phase: 10-lifecycle-test-and-harness-gaps
reviewed: 2026-10-29T10:48:24Z
depth: standard
files_reviewed: 130
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
  - features/plugin/staging-warnings.feature
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
  - test/orchestrators/plugin/enable-disable.test.ts
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
  - test/shared/notification-present.test.ts
  - test/shared/redact-absolute-paths.test.ts
findings:
  critical: 1
  warning: 0
  info: 0
  total: 1
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-10-29T10:48:24Z
**Depth:** standard
**Files Reviewed:** 130 (the retained Phase 10 scope plus the iteration-15 through iteration-17 deltas)
**Status:** issues_found
**Observed HEAD:** `0312a77c`
**Runtime:** Node `v26.12.1`

## Structural Findings (fallow)

The exact merged full gate's Fallow stage passed. Iterations 15 through 17 also reported clean Fallow guard/audit results for the final source and expectation deltas. Direct review covered the complete retained scope plus every final implementation, feature, presentation, and owner-test delta.

CodeGraph was used to trace the shared redactor into its cause-chain, cascade, install, apply, and notification-presentation consumers. Its index marked the changed redactor stale, so the current source and all final owner deltas were read directly.

## Narrative Findings (AI reviewer)

### Summary

The retained complete scope and all final deltas were re-reviewed. The implementation now applies the binding security-first rule for the tested quote chains, and the reconciled Cucumber and owner assertions remain exact deep/full-row comparisons rather than weakened partial assertions. The strict Phase 10 checker passes 56/56, D-PL10-13 passes 1/1, and the exact combined gate passes 1,144 scenarios, 11,758 steps, and 309 direct LCOV records. The package-manager settlement, Phase 8/9 integration, evidence-binding, and D-PL10-13 supersession evidence remain unchanged.

One quote position remains outside the final matrices. When the first embedded matching quote occurs immediately after a directory separator, the ambiguity branch validates only the prefix before that quote. That prefix ends in a separator, fails `isQuotedAbsolutePathCandidate()`, and causes the scanner to skip the entire absolute field instead of applying the approved fail-closed marker.

## Critical Issues

### CR-01: An embedded quote after a separator bypasses fail-closed redaction

**Classification:** BLOCKER
**File:** `extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts:102-110`

**Issue:** The undefined-delimiter branch slices the candidate only through the first matching quote and requires that short prefix to end in a non-separator path segment. A valid path can have a filename component whose first character is the matching quote. For `open '/tmp/'x/private/secret.json'`, the checked prefix is `/tmp/`, so `isQuotedAbsolutePathCandidate()` rejects it and lines 107-109 resume scanning without redacting anything. The result is the original absolute path unchanged. The drive form `open "C:\\private\\"x\\secret.json"` also remains unchanged; the UNC form exposes `x\\secret.json`. `redactCauseChain()` preserves the same disclosures, so cascade, apply, install, and public notification consumers inherit them. This violates the binding rule: there are multiple same-quote delimiters after an absolute-path opener, so the whole remainder must become `[redacted path]`. The 72-case matrix covers embedded quotes inside a component but not a quote immediately after a separator.

**Fix:** In the ambiguous branch, do not require the text before the first embedded quote to be a complete basename-bearing path. The opening match already proves an absolute-path prefix; fail closed when the ambiguous remainder establishes an internal separator, including a prefix ending in `/` or `\\`. Preserve the single-segment JSON-pointer exception separately. Add POSIX, drive, UNC, single-quoted, double-quoted, cause-chain, and public-presentation regressions with the embedded quote as the first character after a separator.

### Prior finding closure

- Iteration 15 closes the submitted balanced-quote ambiguity by requiring exactly one matching closer.
- Iterations 16 and 17 keep behavioral and owner expectations exact under the approved over-redaction policy.
- Marker-like suffixes inside path components preserve no raw suffix in the covered positions.
- The original early parent-close settlement and the replacement unreferenced-timer liveness defect remain closed by `1b77dd7b`.
- The earlier PTY wait-cap, aggregate-notice oracle, and evidence-binding findings remain closed.

### Verification record

- `node scripts/check-phase10-coverage.mjs`: `56/56` rows valid.
- D-PL10-13 exact owner: passed 1/1 with no skip or todo.
- Final focused owners and all changed direct pairs passed at 100% line, function, and branch coverage; direct-all merged 309 LCOV records.
- Direct adversarial probes reproduced CR-01 for POSIX, drive, UNC, single-quoted, and double-quoted inputs; `redactCauseChain()` retained the same disclosure.
- Package-manager owner and direct coverage evidence remain green on the byte-identical package-manager source.
- Exact post-fix `npm run check`: passed `1144` scenarios / `11758` steps / `309` LCOV records. The gate lacks the embedded-quote-after-separator collision.

Only this report was changed. No implementation, test, state, or configuration file was modified, and no commit was created.

---

_Reviewed: 2026-10-29T10:48:24Z_
_Reviewer: Codex (gsd-code-reviewer)_
_Depth: standard_
