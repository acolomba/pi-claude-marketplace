---
phase: 10-lifecycle-test-and-harness-gaps
reviewed: 2026-10-29T09:24:54Z
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

**Reviewed:** 2026-10-29T09:24:54Z
**Depth:** standard
**Files Reviewed:** 126 (the retained Phase 10 scope plus the iteration-12 deltas)
**Status:** issues_found
**Observed HEAD:** `8bddeb05`
**Runtime:** Node `v26.12.1`

## Structural Findings (fallow)

The exact merged full gate's Fallow stage passed. The iteration-12 fixer also reported a clean Fallow guard and audit for its three changed files. Direct review covered the complete retained scope and the iteration-12 source and test deltas.

CodeGraph was used before direct file reads. Its index did not include every newest changed owner, so all closure and requirement evidence was verified against the current source.

## Narrative Findings (AI reviewer)

### Summary

The complete 126-file scope was re-reviewed. The 123 files unchanged from the complete prior review remain byte-identical. The three source and test files changed by `0cdbdf52` and `07f2f310` were read against their full owners and traced through the cause-chain and notification-presentation callers. The strict Phase 10 checker still passes 56/56, binds XPH02 to the exact three required scenario titles at `741516af`, and retains its negative-mutation checks. D-PL10-13 remains the formal supersession of the older Plan 01-03 literal. The Phase 6, 8, and 9 integration evidence and 28-truth mapping remain present.

The package-manager settlement fix remains sound on the reviewed paths. Iteration 12 closes its submitted unmatched-field and distant-quote cases, but both new delimiter recognizers operate on untrusted substrings rather than structural boundaries. A recognized unclosed suffix inside a valid filename is copied verbatim after the placeholder, exposing the remaining directory suffix. The local-close helper searches the whole remaining message for any later `quote + known suffix`, so a later relative quoted value can be mistaken for the absolute path's delimiter and replace the correct basename with that value's basename. Both defects reach `redactCauseChain` and public notification presentation.

## Critical Issues

### CR-01: Recognized unmatched-field suffixes can be filename bytes and escape redaction

**Classification:** BLOCKER
**File:** `extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts:131-159`

**Issue:** `unclosedQuotedPathSuffix()` preserves the first raw `" failed; "` or `";see="` substring after an absolute-path opener. Those byte sequences are legal inside POSIX and Windows path components, so they do not prove that a diagnostic suffix has started. A correctly closed path is also forced through this branch whenever the substring precedes the selected quote. For example, `open '/tmp/private;see=secret/dir/file.json' docs/errors 'x'` becomes `open '[redacted path];see=secret/dir/file.json' docs/errors 'x'`; the private suffix `secret/dir/file.json` remains visible. `open '/tmp/private failed; secret/dir/file.json' docs/errors 'x'` leaks the same suffix after `failed;`. The same output is retained by `redactCauseChain`, so cascade, apply, install, and public-presentation consumers inherit the disclosure. The new tests prove only that the two substrings are preserved when they really are prose; they do not discriminate the equally valid filename collision.

**Fix:** Do not preserve suffixes from an unmatched arbitrary string by substring search. Fail closed over the entire ambiguous remainder, or carry the path and diagnostic suffix as separate structured values from the caller that knows their boundary. Add POSIX, drive, and UNC cases where each recognized delimiter occurs inside a closed and an unclosed path, and require utility, cause-chain, and public presentation to expose no directory component.

### CR-02: The local-close search can select a later quoted value as the path delimiter

**Classification:** BLOCKER
**File:** `extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts:79-88,152-168`

**Issue:** `locallyClosedQuotedPathEnd()` searches the entire remaining message for any quote immediately followed by `" failed; see "` or `" docs/errors "`, then returns the earliest such occurrence before consulting the generic parser. It does not establish that this quote closes the absolute path. In `open '/tmp/private/file.json' value 'x/y' docs/errors '`, it selects the quote after `x/y`, treats everything from `/tmp` through that relative value as one path, and returns `open 'y' docs/errors '` instead of `open 'file.json' value 'x/y' docs/errors '`. A delimiter collision inside the absolute path also leaks components: `open '/tmp/O' docs/errors /private/secret.json'` becomes `open 'O' docs/errors secret.json'`. These failures reproduce through `redactCauseChain`; presentation serializes the rebuilt chain unchanged. The submitted monotonic cases place the known separator immediately after the real path delimiter, so they cannot detect the unbounded search.

**Fix:** Evaluate each quote candidate in order and recognize a local suffix only at that candidate; never preselect a later `quote + suffix` from the whole remainder. If an embedded quote makes the candidate ambiguous, fail closed instead of consuming intervening quoted values. Add POSIX, drive, and UNC controls with an earlier closed path plus a later relative quoted value before each known separator, and with each known separator sequence embedded inside the path. Exercise utility, cause-chain, and public presentation.

### Prior finding closure

- The submitted fail-closed unmatched-field cases pass. CR-01 covers the recognized suffix text occurring inside the path itself, where it is not a suffix at all.
- The submitted local-monotonic cases pass. CR-02 covers a known separator after a later quoted value or inside the path, which the global `indexOf` search cannot distinguish from the real delimiter.
- The original early parent-close settlement and the replacement unreferenced-timer liveness defect are closed by `1b77dd7b`.
- The earlier PTY wait-cap, aggregate-notice oracle, and evidence-binding findings remain closed.

### Verification record

- `node scripts/check-phase10-coverage.mjs`: `56/56` rows valid.
- D-PL10-13 exact owner: passed, 1/1 with no skip or todo.
- Redaction and notification-presentation focused owners: passed 295/295; both direct pairs passed at 100% line, function, and branch coverage.
- Direct adversarial probes reproduced CR-01 with both recognized unmatched-field suffixes inside valid path components; `redactCauseChain` retained the exposed directory suffixes.
- Direct adversarial probes reproduced CR-02 with a later relative quoted value before `docs/errors` and with `docs/errors` inside the absolute path; `redactCauseChain` retained the same corruption/disclosure.
- Package-install cleanup owner and direct coverage: passed.
- Package-manager owner module: passed 41/41 outside the process-restricted sandbox.
- Package-manager direct coverage: passed at 100% line, function, and branch coverage.
- Standalone no-ambient-handle process probe: exited 0 and emitted the complete timed-out result.
- Exact post-fix `npm run check`: passed `1144` scenarios / `11758` steps / `309` LCOV records. The gate does not include either adversarial boundary above.

Only this report was changed. No implementation, test, state, or configuration file was modified, and no commit was created.

---

_Reviewed: 2026-10-29T09:24:54Z_
_Reviewer: Codex (gsd-code-reviewer)_
_Depth: standard_
