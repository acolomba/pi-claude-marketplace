---
phase: 03-dependency-cascade-rows-and-status
fixed_at: 2026-10-28T22:53:29Z
review_path: .planning/phases/03-dependency-cascade-rows-and-status/03-REVIEW.md
iteration: 2
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-10-28T22:53:29Z
**Source review:** `.planning/phases/03-dependency-cascade-rows-and-status/03-REVIEW.md`
**Iteration:** 2

**Summary:**

- Findings in scope: 1
- Fixed: 1
- Skipped: 0

## Fixed Issues

### CR-02: Materialized dependency rows discard malformed-frontmatter degradation

**Status:** fixed: requires human verification

**Files modified:**

- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts`
- `test/orchestrators/plugin/install-cascade.test.ts`
- `test/orchestrators/plugin/install-cascade.messaging.test.ts`
- `test/orchestrators/plugin/install-flow-ledger.test.ts`
- `features/plugin/install-dependencies.feature`
- `features/step_definitions/plugin/publishing.steps.ts`

**Commit:** `43124fa7fb552c9c1942ab43596ce22563e3d539` (`fix(plugin): report degraded cascade members`)

**Applied fix:** Materialized members now reuse `ledgerDegradationSignals(summary)` and carry `orphanRewake` and `degradedKinds` through both member interfaces. The row composer uses the existing `LedgerDegradationSignals` type and `malformedReasonsForKinds` mapper. It retains origin reasons first, then orphan rewake and ordered, deduplicated malformed reasons, then partial-install unsupported reasons. Malformed content raises severity to warning. Orphan rewake alone leaves companion severity intact.

The requesting plugin's own status remains independent. The partial-member correction from iteration 1, commit `0ee37cf01ac4e3e8830b502f8b003ed3d27a68e6`, remains intact. No root status logic or shared reason vocabulary changed.

**Regression assertions:** The cascade summary case now carries both degraded kinds and orphan rewake on the dependency while keeping the root summary separate. Six new composer cases cover malformed skill, malformed command, reason order and deduplication, orphan-only info severity, and degraded partial members with current-copy or re-enable reasons. Existing companion-warning and partial-member cases remain green.

Two real-install regressions install `app -> lib` and compare the complete notification. One gives lib a malformed skill; the other combines a malformed command with partial installation. Both require warning severity, retain app's installed row, and verify that both persisted records remain enabled.

The new Cucumber scenario checks the entire warning payload and both plugin rows on a fresh install. Its narrow publishing step rewrites the published skill using the existing publication helper and verifies the written bytes. No new fixture API or file was created.

## Verification

All checks ran in the assigned isolated worktree `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-c-369`, on `agent-reverify-c`, with Node `v26.12.1`. The fixer created no additional worktree. The orchestrator owns merging and teardown.

- Mandatory reread: modified source and test sections inspected; surrounding code intact.
- Before the source fix, all six new composer cases failed on missing reasons or incorrect severity. Both real-install cases reproduced the missing malformed reason and info severity. These focused unit runs used `node --test --test-isolation=none --test-name-pattern ...`; the sandboxed default isolated runner reported only a file-level failure.
- Before the source fix, the exact Cucumber scenario failed because severity was info instead of warning.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts`: exit 0. All three owner suites passed with 100% direct line, function, and branch coverage. The final commit hook repeated direct coverage for these pairs after the style correction.
- `npx cucumber-js --parallel 1 --name '^Installing a dependency with malformed frontmatter warns while its requester stays installed$'`: exit 0 on the final source; 1 scenario, 9 steps, and 2 hooks passed.
- `SKIP=npm-check pre-commit run --files <the seven modified files>`: exit 0 after formatting. A focused rerun on the composer passed after the style correction.
- `node_modules/.bin/fallow audit --base HEAD --format json --quiet`, before the fix commit and after the final source edit: exit 0, verdict pass; zero dead-code issues, complexity findings, and duplication groups.
- `git commit -m 'fix(plugin): report degraded cascade members'`: exit 0 with every hook enabled. `npm run check:commit` passed static checks, feature validation, unpaired tests, and direct coverage for the staged source/test pairs.
- `git diff --check`: exit 0 before commit. The worktree was clean after commit, before this report was written.

The first commit attempt caught a nested conditional forbidden by ESLint. Replacing it with explicit branches resolved the error; the normal commit retry passed without bypassing hooks. The first post-fix Cucumber run also required its expected payload to include the warning summary. Its corrected whole-payload assertion passed.

These focused checks do not replace the combined-tree `npm run check` gate or standard-depth re-review. No unresolved defect was observed in the scoped regressions. The workflow's human-verification flag remains because this is a logic correction. The report is intentionally uncommitted for the orchestrator.

---

_Fixer: gsd-code-fixer_
_Iteration: 2_
