---
phase: 113-orchestrator-support-and-presenters
fixed_at: 2026-09-01T06:54:42Z
review_path: .planning/phases/113-orchestrator-support-and-presenters/113-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 113: Code Review Fix Report

**Fixed at:** 2026-09-01T06:54:42Z
**Source review:** `.planning/phases/113-orchestrator-support-and-presenters/113-REVIEW.md`
**Iteration:** 1
**Verdict:** converged

## Summary

- Findings in scope: 2
- Fixed: 2
- Skipped: 0
- Remaining critical/warning findings: 0

Both Phase 113 review warnings are resolved by commits `99621c17` and `0f16051c`. The restored module contracts compile and import, fallow accepts their narrow compatibility suppressions, and the six affected test owners now use fresh plain collaborators without broad proxy mocks or cross-case mutable mock state. The focused, repository-wide unit, integration, type, lint, fallow, formatting, and static-diff gates are green.

## Finding Status

| Finding | Commit     | Status | Convergence evidence                                                                                                               |
| ------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| WR-01   | `99621c17` | fixed  | Eight runtime barrel functions import; `EnabledPluginRef` and `AsyncRewakeEntry` type imports compile; fallow is green.            |
| WR-02   | `0f16051c` | fixed  | All six owner files are free of `strong-mock`, `anyTimes()`, `STUB_PI`, and mutable interaction mocks; 303/303 focused cases pass. |

## Fixed Issues

### WR-01: The aggregate dead-code repair silently narrows two shipped module contracts

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/import/index.ts`, `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`
**Commit:** `99621c17`
**Status:** fixed and converged

**Applied fix:** The import barrel again exports `buildClaudeImportPlan`, `planMarketplaceSourcesForRefs`, `extractEnabledPluginRefs`, `parseEnabledPluginRef`, `loadMergedClaudeSettingsForScope`, `mergeClaudeSettings`, `resolveClaudeSettingsPaths`, and the `EnabledPluginRef` type alongside `importClaudeSettings`. The registry again exports `AsyncRewakeEntry`. Each compatibility-only binding carries a narrow fallow suppression and an explicit note deferring any future surface narrowing to its dedicated owner.

**Verification evidence:**

- A real ESM import loaded all eight runtime functions and confirmed every binding is callable.
- An in-memory TypeScript program imported all eight runtime bindings plus the `EnabledPluginRef` and `AsyncRewakeEntry` types with zero diagnostics.
- `npm run fallow` passed: dead-code found no issues, health stayed above its configured threshold, and the duplicates gate exited successfully.
- Global `npm run typecheck` passed, so the restored exports remain valid against the current source graph.

### WR-02: Broad unverified mocks weaken interaction and case-isolation evidence

**Files modified:** `tests/integration/fold-adoption.test.ts`, `tests/orchestrators/marketplace/update.test.ts`, `tests/orchestrators/plugin/enable-disable.test.ts`, `tests/orchestrators/plugin/install.test.ts`, `tests/orchestrators/plugin/reinstall.test.ts`, `tests/orchestrators/reconcile/apply.test.ts`
**Commit:** `0f16051c`
**Status:** fixed and converged

**Applied fix:** All six harnesses now construct fresh plain typed Pi/context stubs and notification recorders. Canned `getAllTools`, `cwd`, and `ui.notify` behavior no longer uses proxy expectations. Reconcile replaced its module-scope `STUB_PI` with a fresh `makePi()` call at every consumer and replaced the notification interaction mock with a case-owned typed call recorder. Existing product assertions continue to check notification contents and cardinality directly.

**Verification evidence:**

- Scoped source scans found no `strong-mock`, `anyTimes()`, `STUB_PI`, `strictMock`, or `mock.fn` in the six files.
- Static inspection found fresh `makeCtx`, `makePi`, `makePiWithSubagents`, and `toolInfo` factories at the owner seams; there is no module-scope collaborator instance shared across cases.
- The six complete files passed as 303 individual cases:
  - `fold-adoption.test.ts`: 2
  - `marketplace/update.test.ts`: 45
  - `plugin/enable-disable.test.ts`: 46
  - `plugin/install.test.ts`: 103
  - `plugin/reinstall.test.ts`: 74
  - `reconcile/apply.test.ts`: 33

## Verification

- Focused six-file run with normal file isolation: 6/6 files passed.
- Focused six-file run without file isolation: 303/303 cases passed, 0 failed, 0 skipped, 0 todo.
- Repository-wide `npm test`: 4,590/4,590 tests passed across 260 suites. The first sandboxed attempt was blocked only when an unrelated marketplace-add case tried to create a Unix-domain socket (`EPERM`); the required unsandboxed rerun passed cleanly.
- `npm run test:integration`: 10/10 integration files passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed for the complete `extensions`, `tests`, and ESLint configuration scope.
- `npm run fallow`: passed.
- Targeted Prettier check passed for both WR-01 source files and all six WR-02 test files.
- `git diff --check 99621c17^..0f16051c` passed for the eight fix-owned files.
- The fix-range prohibited-pattern scan found no added impossible cast, coverage/type suppression, skipped/only test, uppercase AAA marker, `anyTimes()`, `strong-mock` import, or `STUB_PI`.

## Convergence Verdict

**CONVERGED.** WR-01 and WR-02 are both resolved, their direct regression surfaces pass, and no new critical or warning finding was identified in the fix range.

---

_Verified: 2026-09-01T06:54:42Z_
_Verifier: Codex (review-fix convergence audit)_
_Iteration: 1_
