---
phase: 01-duplicate-integration-files
fixed_at: 2026-11-21T16:18:42Z
review_path: .planning/phases/01-duplicate-integration-files/01-REVIEW.md
iteration: 2
findings_in_scope: 3
fixed: 2
skipped: 1
status: partial
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-11-21T16:18:42Z
**Source review:** .planning/phases/01-duplicate-integration-files/01-REVIEW.md
**Iteration:** 2

**Summary:**

- Findings in scope: 3 (WR-04, WR-05, WR-06; scope `critical_warning`, so IN-01 to IN-04 stay open in REVIEW.md, IN-01 being a necessity finding)
- Fixed: 2 (WR-05, WR-06)
- Skipped: 1 (WR-04, user decision)

## Fixed Issues

### WR-05: `assertCallsAnswered` counts tool results, so a child that was offered neither `bash` nor `read` still passes the foreground scenario

**Files modified:** `features/lib/real-subagent-child.ts`
**Commit:** a7ee4ea
**Applied fix:** `assertCallsAnswered` now takes the child's `ScriptedToolCall[]` instead of a count. It selects every provider request whose first marker is the child's task marker and fails unless each of them offered every tool the child calls (`ProviderRequest.tools`, which now has a reader). It then fails unless one of them carries a result for each call. `launchChild` and `runRealSubagentChild` pass `calls` through. The comment names the reason: Pi answers a call to a tool that the session does not offer with an error result and no tool event.

**Red proof (reverted, never committed):** the foreground scenario (`features/plugin/subagent-child.feature:592`) with the `plain` agent's tools set to `Edit`:

- With the fix, the run fails in the When with `AssertionError: the child of demo:plain was offered every tool it calls`. The actual value lists `['bash', 'read']` as missing from each of the child's three requests.
- With the old guard (fix reverted in the working tree), the same break passed: 1 scenario, 6 of 6 steps passed. This confirms the gap that the review describes.

Both edits were reverted with `git checkout --`, and the fixed driver was restored before the green runs.

### WR-06: The feature description and the step overview do not cover the foreground behavior, and the `startup` row is explained only in step code

**Files modified:** `features/plugin/subagent-child.feature`, `features/step_definitions/plugin/subagent-hooks.steps.ts`
**Commit:** 011073b
**Applied fix:** The feature description now says that a background child runs a plugin's tool hooks but no main-session hook (D-PG3-08), and that a foreground child runs inside the main Pi's turn and runs no plugin hook. It also names the real-child stand-ins: the installed pi-subagents against a loopback scripted provider. It says that each real-child run installs the plugin in Pi's startup session, then starts the main session, which ends the startup session, so the `startup | SessionEnd` row reads from the feature file alone. The description's lines are rewrapped to at most 99 characters. The step module's `@fileoverview` now opens "in a pi-subagents child, background or foreground, and in the main session beside it". Its D-PG3-08 sentence is limited to a background child, and a sentence about the foreground child is added.

## Skipped Issues

### WR-04: The PR's `fallow-audit` job will fail on the `weakened-tests` warning from the two deletions

**File:** `.github/workflows/lint.yml:80-86`
**Reason:** User decision: won't fix. The orchestrator recorded this disposition. `.fallowrc.json` and `.github/workflows/*` were not touched. The PR accepts the `fallow-audit` failure once, at review.
**Original issue:** `fallow audit --base f67fe6c9` returns verdict `warn`, with `weakened-tests` (`removed-tests`) on the deleted `test/integration/hooks-spawn-end-to-end.test.ts` and `test/integration/pi-subagents-child-identity.test.ts`. The "Fail on a Fallow warning" step fails on that verdict.

## Verification

All checks ran in the main checkout (`/home/user/pi-claude-marketplace`, branch `claude/stoic-shannon-la9q7o`). No worktree was used, as the orchestrator asked, so the results can be reproduced from this tree.

- `npm run check:static`: passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features), with both fixes in the tree.
- `npm run test:cucumber:profile -- --profile adapter --parallel 2 features/plugin/subagent-child.feature features/agent/frontmatter.feature`: 61 scenarios passed (843 steps). It ran after WR-05 alone, and again with both fixes.
- The same with `--profile builtin`: 18 scenarios passed (210 steps). It ran after WR-05 alone, and again with both fixes.
- The commit hook's `npm run check:commit` passed for both commits.
- `git status --porcelain -- extensions/` is empty, `git diff -- node_modules` is empty, and the working tree was clean after the commits (before this report was written).

---

_Fixed: 2026-11-21T16:18:42Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
