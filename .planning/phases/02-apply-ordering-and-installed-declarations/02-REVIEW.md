---
phase: 02-apply-ordering-and-installed-declarations
reviewed: 2026-10-28T17:19:33Z
depth: standard
files_reviewed: 44
files_reviewed_list:
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/edge/types.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - features/marketplace/add.feature
  - features/plugin/apply.feature
  - features/plugin/bootstrap.feature
  - features/plugin/enable.feature
  - features/plugin/update-dependencies.feature
  - extensions/pi-claude-marketplace/orchestrators/marketplace/hosted-catalog.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/README.md
  - extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts
  - test/orchestrators/reconcile/pending.test.ts
  - test/orchestrators/reconcile/read-pass.test.ts
  - features/plugin/import.feature
  - test/orchestrators/marketplace/add.test.ts
  - test/orchestrators/reconcile/load.test.ts
  - test/orchestrators/reconcile/notify.test.ts
  - features/plugin/state-lock.feature
  - test/orchestrators/plugin/operations.test.ts
  - test/orchestrators/plugin/update-constraint-gate.test.ts
  - test/orchestrators/reconcile/apply.test.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/constraint-fold.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts
  - extensions/pi-claude-marketplace/transaction/with-state-guard.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 2: Code Review Report

**Reviewed:** 2026-10-28T17:19:33Z
**Depth:** standard
**Files Reviewed:** 44
**Status:** clean

## Narrative Findings (AI reviewer)

## Summary

Final re-review of branch HEAD `fdf127dc`, with implementation/test HEAD
`9692623df10a567019acdb7a24e5e3229a72cc80`. No Critical, Warning, or Info
findings remain.

The review covers the implementation/test commits since `67a589aa`, retaining
the prior review of unchanged source and inspecting the later locking,
fast-path, retry, rollback, and regression-test changes with their relevant
callers. Phase 2 plans, summaries, and CONTEXT are unchanged from the earlier
review; current VALIDATION and SECURITY were also consulted. Recorded decisions
remain authoritative.

## Previous finding dispositions

| Finding | Disposition | Evidence |
|---|---|---|
| CR-01: Pending/load reject source changes that apply repairs | Resolved | Pending applies the shared source-repair policy to its initial plan and every replan. The pending renderer suppresses only replacement markers paired with an add in the same scope. Other mismatch diagnostics remain failures. Ordinary replacement and official fallback scenarios cover pending, load, and apply. |
| CR-02: Hosted URL replacement fails with stale clone | Resolved | Hosted sources use the existing managed-directory set-aside, restore-on-failure, and discard-after-save flow. Tests cover hosted-to-hosted, hosted-to-git, failed-save restoration, preserved installed records, and apply/import behavior. |

## Final regression assessment

- Installed declaration reads with a potential distinct holder run inside
  `withExistingScopeLock`. This prevents a cooperating same-scope uninstall or
  clone cleanup from removing the copy during the declaration walk. Acquisition,
  compromise, and release failures reject the gate. The lock is released before
  tag probing and candidate resolution, avoiding nested acquisition there.
- The no-holder fast path excludes exactly the target and requester records
  excluded by `collectHolders`. Every other installed record still requires the
  locked declaration walk. The fast path continues through the normal fold, so
  requester ranges and excluded versions remain effective.
- `efb65789` is forward-restored by `33f1ce71`: both project- and user-scope
  candidate-version failure expectations are restored. The final
  `features/plugin/state-lock.feature` has no net change against the pre-change
  version. The fast path restores the corresponding sole-record behavior.
- The real dependency-install lock test calls
  `createDependencyInstallOperation`, the same production composition used by
  apply. It verifies a typed held-lock failure, byte-identical state after the
  refusal, successful retry after release, the installed record, and no direct
  notifications.
- The apply read-failure backstop checks that the committed dependency move
  survives, the missing dependency remains absent after the failure, and the
  next apply installs it without reporting the move again.
- The missing-dependency rollback case checks that the failed root and its
  earlier cascade member leave neither installation records nor the member's
  staged skill.
- The new fixtures use temporary scope roots and the existing hermetic
  environment helpers. Lock acquisition and release are explicitly sequenced.
  No additional authorization or containment bypass was found in these changes.

## Validation evidence

- The orchestrator supplied the fresh `npm run check` result at `9692623d`,
  Node `v26.12.1`: exit 0; Cucumber passed 1122 scenarios and 11447 steps;
  direct coverage merged 309 LCOV records.
- Independently verified that the source/test diff from `9692623d` to
  `fdf127dc` is empty. The only dirty file is the orchestrator-owned
  `02-VERIFICATION.md`.
- Independently ran targeted lock, no-holder, requester, retry, and rollback
  cases in `update-constraint-gate.test.ts`, `operations.test.ts`, and
  `apply.test.ts` using `node --test --test-reporter=spec
  --test-name-pattern=...`: exit 0; all three reported file results passed.
- Previously repeated source-repair and hosted-replacement regression checks
  remain applicable: their implementation and tests are unchanged by the later
  locking commits.
- `git diff --check` passed.
- This final review made no file changes and no commit.

---

_Reviewer: Codex (gsd-code-reviewer)_
_Depth: standard_
