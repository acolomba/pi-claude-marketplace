---
phase: 10-lifecycle-test-and-harness-gaps
reviewed: 2026-10-28T21:20:58Z
depth: standard
files_reviewed: 100
files_reviewed_list:
  - .pre-commit-config.yaml
  - .agents/skills/cucumber/rules/layout.md
  - .agents/skills/cucumber/rules/world-and-stand-ins.md
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
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
  - test/architecture/workflows-marker-coverage.test.ts
  - test/bridges/agents/stage.test.ts
  - test/e2e/_rpc.ts
  - test/edge/handlers/plugin/browse.test.ts
  - test/orchestrators/import/execute.test.ts
  - test/orchestrators/marketplace/add.test.ts
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
  - test/shared/git-failure-classifiers.test.ts
findings:
  critical: 2
  warning: 1
  info: 0
  total: 3
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-10-28T21:20:58Z
**Depth:** standard
**Files Reviewed:** 100 (the retained Phase 10 scope plus the current post-Phase-11 split owners)
**Status:** issues_found
**Observed HEAD:** `885537b1`
**Runtime:** Node `v26.12.1`

## Structural Findings (fallow)

`fallow review --base 4ce415d9 --brief --format json` passed with zero dead-code, complexity, or duplication findings. The broad resolved range contained 244 changed files and was high risk, so that orientation result was not treated as a correctness gate. `fallow security --changed-since 4ce415d9` surfaced reachability candidates at path, process, and credential boundaries; direct tracing found existing containment checks, fixed manifest paths, argument-array process invocation, and redaction at the reviewed outputs. No additional security defect was proved.

CodeGraph was used first. Its current index still described some pre-split ownership, so every relevant path was checked against the current source before it was used as evidence.

## Narrative Findings (AI reviewer)

### Summary

The current tree preserves the important Phase 10 behavior boundaries: `rootCommit` crosses public planning into the dependency plan and final install member; all three CAS-08 failure routes have separate scenarios; apply exposes per-phase rollback detail; install/reinstall fixtures create loadable manifests before records; and the public install composition remains the owner after the Phase 11 split. The Phase 1/4/7 corrective changes do not reopen those boundaries.

Two behavioral tests nevertheless have false-green oracles. Both are shared Phase 8/10 PTY defects and already have Phase 8 convergence work assigned. The coverage-ledger checker also accepts a commit that cannot contain one of the evidence files it purports to identify.

## Critical Issues

### CR-01: The wait-cap scenario exercises the hosted-download timeout, not the background gate (shared Phase 8 CR-03)

**Classification:** BLOCKER

**File:** `features/marketplace/background-update.feature:60-74`, `features/step_definitions/marketplace/background-update.steps.ts:35-79`, `extensions/pi-claude-marketplace/platform/hosted-manifest-fetch.ts:18`, `extensions/pi-claude-marketplace/orchestrators/marketplace/background-gate.ts:24-34`

**Issue:** The scenario holds `GET /acme/tools/marketplace.json`. That request has its own 10,000 ms `DOWNLOAD_TIMEOUT_MS`, while the behavior under test is the gate's 30,000 ms `BACKGROUND_WAIT_CAP_MS`. The step accepts any positive duration up to 30 seconds and only proves that the held request was dropped. A focused real-PTY reproduction passed after about the hosted-fetch timeout. A broken or absent gate timer can therefore still pass when the unrelated download timeout ends the step first. This is the same shared defect already recorded as Phase 8 CR-03; it must not receive a divergent fix.

**Impact:** `XPH01-TUI-CAP` is marked as scenario coverage although the scenario proves neither the production wait-cap signal nor its deadline. A foreground command can wait indefinitely on another background operation while this suite remains green.

**Fix:** Use a held git smart-HTTP transfer whose own transport does not expire before the gate. Record that the gate's `AbortSignal` stopped it, and assert lower and upper elapsed-time bounds around the production cap. Keep the fix in the shared Phase 8 owner and consume it into Phase 10 convergence.

### CR-02: Set-normalized terminal output hides duplicate background notices

**Classification:** BLOCKER

**File:** `features/lib/pi-tui.ts:244-248`, `features/step_definitions/marketplace/background-update.steps.ts:84-91`, `features/marketplace/background-update.feature:30-58`

**Issue:** `backgroundUpdateNotices()` converts all matched notices to a `Set` before the step compares them with `[notice]`. The same-name scenario can receive the same notice twice and still pass. Phase 8's mutation reproduction demonstrated this false green by emitting one notice per updated marketplace. The current Phase 10 branch does not yet contain the corrective Phase 8 commit `7a436b05`.

**Impact:** `XPH01-TUI-DEDUPE` does not distinguish one aggregate notification from repeated per-marketplace notifications, so a user-visible duplicate-notification regression can ship green.

**Fix:** Do not infer identical emission counts from a terminal's final/redrawn screen. Retain the same-name final-state scenario and consume Phase 8 commit `7a436b05`, which adds a distinct-name cross-marketplace scenario requiring one exact combined `alpha and beta` notice plus direct oracle tests that fail under the per-marketplace mutation.

## Warnings

### WR-01: The coverage checker does not bind evidence paths and titles to their cited commit

**Classification:** WARNING

**File:** `scripts/check-phase10-coverage.mjs:127-159`, `.planning/phases/10-lifecycle-test-and-harness-gaps/10-COVERAGE.md:67`

**Issue:** The checker separately proves that `row.commit` exists and that each evidence path/title exists in the current checkout. It never reads `path` at `commit`. The current `LCTEST-ROOT-COMMIT` row cites commit `07a8b54a`, but `test/orchestrators/plugin/install-flow-planning.test.ts` does not exist at that commit; the checker still reports `56/56 rows valid`.

**Impact:** A stale or unrelated commit satisfies the supposedly exact evidence record. Refactors can silently sever the audit trail while the Phase 10 coverage gate stays green.

**Fix:** Put a commit on each evidence entry, or define the row commit as a reconciliation commit containing every cited proof. Validate via `git show <commit>:<path>` and require the title in that content. Update the root-commit row to cite commit(s) that contain both current proofs.

### Verification record

- Phase 10 coverage checker passed `56/56`, while `git show 07a8b54a:test/orchestrators/plugin/install-flow-planning.test.ts` failed with a missing path, proving WR-01.
- The wait-cap scenario passed `1 scenario / 14 steps` in a real PTY after the independent hosted-fetch timeout; its exact request evidence was one dropped `/marketplace.json` request.
- Fresh combined gate supplied to this review: `1126 scenarios`, `11509 steps`, and `309` direct-LCOV pairs, green on the current build inputs.
- Fresh Nyquist audit: COMPLIANT at `7f76cda2`; fresh security audit: SECURED at `885537b1`, 19/19 rows closed and `threats_open: 0`.
- Focused owner tests were not rerun in this dependency-light worktree because the TypeScript loader was unavailable. Their current behavior was traced directly, and the combined gate above covers the same build inputs.

Only this report was changed. No implementation or test source was modified, and no commit was created.

---

_Reviewed: 2026-10-28T21:20:58Z_
_Reviewer: Codex (gsd-code-reviewer)_
_Depth: standard_
