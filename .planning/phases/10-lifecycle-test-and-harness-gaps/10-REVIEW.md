---
phase: 10-lifecycle-test-and-harness-gaps
reviewed: 2026-10-29T09:45:18Z
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

**Reviewed:** 2026-10-29T09:45:18Z
**Depth:** standard
**Files Reviewed:** 126 (the retained Phase 10 scope plus the iteration-13 deltas)
**Status:** issues_found
**Observed HEAD:** `e8c1039a`
**Runtime:** Node `v26.12.1`

## Structural Findings (fallow)

The exact merged full gate's Fallow stage passed. The iteration-13 fixer also reported a clean Fallow guard and audit for its three changed files. Direct review covered the complete retained scope and the iteration-13 source and test deltas.

CodeGraph was used before direct file reads. Its index did not include every newest changed owner, so all closure and requirement evidence was verified against the current source.

## Narrative Findings (AI reviewer)

### Summary

The complete 126-file scope was re-reviewed. The 123 files unchanged from the complete prior review remain byte-identical. The three source and test files changed by `6be0b878` and `4a62b923` were read against their full owners and traced through the cause-chain and notification-presentation callers. The strict Phase 10 checker still passes 56/56, binds XPH02 to the exact three required scenario titles at `741516af`, and retains its negative-mutation checks. D-PL10-13 remains the formal supersession of the older Plan 01-03 literal. The Phase 6, 8, and 9 integration evidence and 28-truth mapping remain present.

The package-manager settlement fix remains sound on the reviewed paths. Iteration 13 closes the submitted marker-collision and later-quote-preselection cases: unmatched marker-bearing fields elide their entire remainder, and quote candidates are classified in order. The generic quote classifier still violates that fail-closed contract in two adjacent malformed inputs. An unclosed absolute path whose first embedded quote is followed by a boundary is accepted as closed and exposes the rest of the path. A correctly closed path followed by arbitrary slash-bearing prose and an unmatched quote is extended through the prose and rebuilt from the prose basename. Both defects reach `redactCauseChain` and public notification presentation.

## Critical Issues

### CR-01: An embedded quote can falsely close an unmatched path and expose its suffix

**Classification:** BLOCKER
**File:** `extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts:103-149,164-194`

**Issue:** `quotedPathEnd()` sees the only matching quote in an unmatched field, computes `balancedAfter=true`, and accepts it as the closing delimiter even when a path separator remains later in the message. For example, `open '/tmp/O' Brien/private/secret.json` becomes `open 'O' Brien/private/secret.json`; the supposedly fail-closed unmatched field exposes `Brien/private/secret.json`. The double-quoted, drive, and UNC forms reproduce, and `redactCauseChain()` retains the exposed suffix. The iteration-13 marker check does not help because the input needs no `failed;` or `;see=` marker. The owner tests cover an unmatched path with spaces but not an unmatched path with an embedded matching quote.

**Fix:** A quote candidate cannot close an unmatched field merely because the suffix quote set is locally balanced. When a later separator remains and no trustworthy final delimiter exists, return `undefined` so the whole remainder becomes `[redacted path]`. Add POSIX, drive, and UNC cases for single- and double-quoted unmatched paths with one or more embedded matching quotes through the utility, cause-chain, and public-presentation boundaries.

### CR-02: Arbitrary slash-bearing prose plus an unmatched quote is treated as path content

**Classification:** BLOCKER
**File:** `extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts:81-149,181-185`

**Issue:** Candidate-local classification still uses the last separator before the final matching quote. With an already closed path followed by arbitrary slash-bearing prose and one unmatched quote, the first real closing quote is classified as a continuation and the unmatched quote is accepted as the path delimiter. `open '/tmp/private/file.json' help/guide '` becomes `open 'guide '`, and `open '/tmp/private/file.json' value 'rel/path' help/guide '` has the same result. The output silently discards the real basename and most of the diagnostic instead of applying the documented ambiguity fail-closed rule. Single- and double-quoted causes reproduce through `redactCauseChain()`, so public presentation emits the corrupted message. The submitted cases use the two recognized `failed; see` / `docs/errors` strings and do not cover arbitrary slash-bearing prose.

**Fix:** When an earlier candidate can close a complete absolute path but a later unmatched quote makes the remainder ambiguous, do not extend the candidate through arbitrary slash-bearing prose. Return `undefined` and apply `[redacted path]`, or preserve the earlier local close only when a structural caller supplies that boundary. Add platform and quote-form controls for arbitrary slash-bearing prose, with and without a balanced relative value before the final unmatched quote, through utility, cause-chain, and public presentation.

### Prior finding closure

- The submitted marker-collision cases pass and no raw marker suffix survives. CR-01 covers an unmatched path with an embedded matching quote and no marker text.
- The submitted candidate-local cases pass. CR-02 covers arbitrary slash-bearing prose rather than the two recognized local suffix strings.
- The original early parent-close settlement and the replacement unreferenced-timer liveness defect are closed by `1b77dd7b`.
- The earlier PTY wait-cap, aggregate-notice oracle, and evidence-binding findings remain closed.

### Verification record

- `node scripts/check-phase10-coverage.mjs`: `56/56` rows valid.
- D-PL10-13 exact owner: passed, 1/1 with no skip or todo.
- Redaction and notification-presentation focused owners: passed 306/306; both direct pairs passed at 100% line, function, and branch coverage.
- Direct adversarial probes reproduced CR-01 for POSIX, drive, UNC, single-quoted, and double-quoted unmatched paths with an embedded matching quote; `redactCauseChain` retained each directory suffix.
- Direct adversarial probes reproduced CR-02 with arbitrary `help/guide` prose both directly and after a balanced relative quoted value; `redactCauseChain` returned `guide` instead of failing closed.
- Package-install cleanup owner and direct coverage: passed.
- Package-manager owner module: passed 41/41 outside the process-restricted sandbox.
- Package-manager direct coverage: passed at 100% line, function, and branch coverage.
- Standalone no-ambient-handle process probe: exited 0 and emitted the complete timed-out result.
- Exact post-fix `npm run check`: passed `1144` scenarios / `11758` steps / `309` LCOV records. The gate does not include either adversarial boundary above.

Only this report was changed. No implementation, test, state, or configuration file was modified, and no commit was created.

---

_Reviewed: 2026-10-29T09:45:18Z_
_Reviewer: Codex (gsd-code-reviewer)_
_Depth: standard_
