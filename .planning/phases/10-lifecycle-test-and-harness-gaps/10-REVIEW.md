---
phase: 10-lifecycle-test-and-harness-gaps
reviewed: 2026-10-29T09:00:18Z
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

**Reviewed:** 2026-10-29T09:00:18Z
**Depth:** standard
**Files Reviewed:** 126 (the retained Phase 10 scope plus the iteration-11 deltas)
**Status:** issues_found
**Observed HEAD:** `4aa9561a`
**Runtime:** Node `v26.12.1`

## Structural Findings (fallow)

The exact merged full gate's Fallow stage passed. The iteration-11 fixer also reported a clean Fallow guard and audit for its three changed files. Direct review covered the complete retained scope and the iteration-11 source and test deltas.

CodeGraph was used before direct file reads. Its index did not include every newest changed owner, so all closure and requirement evidence was verified against the current source.

## Narrative Findings (AI reviewer)

### Summary

The complete 126-file scope was re-reviewed. The 123 files unchanged from the complete prior review remain byte-identical. The three source and test files changed by `9ce72385` and `98683fb7` were read against their full owners and traced through the cause-chain and notification-presentation callers. The strict Phase 10 checker still passes 56/56, binds XPH02 to the exact three required scenario titles at `741516af`, and retains its negative-mutation checks. D-PL10-13 remains the formal supersession of the older Plan 01-03 literal. The Phase 6, 8, and 9 integration evidence and 28-truth mapping remain present.

The package-manager settlement fix remains sound on the reviewed paths. Iteration 11 closes the submitted post-embedded-quote matrix and the exact unclosed-path prose cases. The generic parser still has two uncovered failure families. Its whitespace-bounded fallback exposes the rest of an unclosed path when the path itself contains whitespace, and consumes slash-bearing prose when there is no whitespace. Separately, its whole-message quote-balance calculation lets a later unmatched quote retroactively invalidate an earlier correct path delimiter, so it consumes unrelated prose and relative quoted values.

## Critical Issues

### CR-01: The unclosed-path fallback either leaks the path suffix or consumes later prose

**Classification:** BLOCKER
**File:** `extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts:115-139`

**Issue:** `unclosedQuotedPathEnd()` treats the first whitespace as the end of an unclosed path token and treats the end of the entire diagnostic as the end when no whitespace exists. Both choices are incorrect for input shapes this helper promises to sanitize. `open '/tmp/private dir/秘密/secret.json` becomes `open 'private dir/秘密/secret.json`, exposing directory components after the first space instead of a basename. Conversely, `open '/tmp/private/file.json;see=docs/errors` becomes `open 'errors`, because the fallback includes the prose separator and `pathBasename()` selects its last slash. Both results reproduce through `redactCauseChain` and public notification presentation. The new tests cover a path with no internal whitespace followed by whitespace-delimited prose; they do not discriminate either branch of this fallback.

**Fix:** Do not infer an unmatched quoted field's extent from one whitespace position or from the end of the message. Parse the known diagnostic forms structurally; for an unknown unmatched field, fail closed with an explicit redacted-path placeholder and preserve a suffix only after a positively recognized diagnostic delimiter. Add POSIX, drive, and UNC controls for unclosed paths with internal horizontal/Unicode whitespace and for no-space punctuation followed by slash-bearing prose, through utility, cause-chain, and public-presentation boundaries.

### CR-02: A later unmatched quote changes the delimiter of an already closed path

**Classification:** BLOCKER
**File:** `extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts:75-112,125-139`

**Issue:** `quotedPathEnd()` computes quote balance over every matching quote in the rest of the message. A later malformed quoted fragment can therefore make the suffix after a correct closing path quote look unbalanced and force the scanner past that delimiter. `open '/tmp/private/file.json' docs/errors '` becomes `open 'errors '`. A balanced relative value followed by an unmatched quote is worse: `open '/tmp/private/file.json' docs/errors 'x/y' tail 'unclosed` becomes `open 'y' tail 'unclosed`. The correct basename and intervening prose are lost, and the same malformed text reaches cause-chain and public notification output. The supplied later-value matrix uses fully balanced values, while the unclosed tests start with an unclosed path; neither covers an already closed path followed by unrelated unmatched quote data.

**Fix:** Bound quote-role inference to the candidate path and its immediate syntactic context. Once a delimiter locally closes a valid absolute path, do not let distant unmatched quote fragments retroactively reopen it. Add POSIX, drive, and UNC cases for a correctly closed path followed by slash-bearing prose plus a bare unmatched quote, an unmatched quoted token, and a balanced relative quoted value followed by an unmatched token; verify utility, cause-chain, and public presentation.

### Prior finding closure

- The submitted embedded-quote boundary matrix and the prior 72-case multi-quote/trailing-whitespace plus 33-case later-value matrices pass. CR-01 covers unmatched quoted fields whose own path or following prose defeats the first-whitespace fallback.
- The submitted unclosed-path cases pass. CR-02 covers a correctly closed path followed by a separate malformed quoted fragment, which the whole-message balance calculation incorrectly lets change the earlier delimiter.
- The original early parent-close settlement and the replacement unreferenced-timer liveness defect are closed by `1b77dd7b`.
- The earlier PTY wait-cap, aggregate-notice oracle, and evidence-binding findings remain closed.

### Verification record

- `node scripts/check-phase10-coverage.mjs`: `56/56` rows valid.
- D-PL10-13 exact owner: passed, 1/1 with no skip or todo.
- Redaction and notification-presentation focused owners: passed 281/281; both direct pairs passed at 100% line, function, and branch coverage.
- Direct adversarial probes reproduced CR-01 for an unclosed path with an internal space and for an unclosed path followed by no-space `;see=docs/errors`; both failures propagated through cause-chain and public presentation.
- Direct adversarial probes reproduced CR-02 for a correctly closed path followed by slash-bearing prose and a bare unmatched quote, and for a balanced relative quoted value followed by an unmatched quote; both failures propagated through cause-chain and public presentation.
- Package-install cleanup owner and direct coverage: passed.
- Package-manager owner module: passed 41/41 outside the process-restricted sandbox.
- Package-manager direct coverage: passed at 100% line, function, and branch coverage.
- Standalone no-ambient-handle process probe: exited 0 and emitted the complete timed-out result.
- Exact post-fix `npm run check`: passed `1144` scenarios / `11758` steps / `309` LCOV records. The gate does not include either adversarial boundary above.

Only this report was changed. No implementation, test, state, or configuration file was modified, and no commit was created.

---

_Reviewed: 2026-10-29T09:00:18Z_
_Reviewer: Codex (gsd-code-reviewer)_
_Depth: standard_
