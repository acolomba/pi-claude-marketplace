---
phase: 01-staging-warning-channels
reviewed: 2026-10-28T15:17:15Z
depth: standard
source_commit: da9756bdb4362e255c829bb263b594e6f37bf1f4
review_head: 6e56b22fc54a3534465927e7e5daf37e426a7b86
review_fix_commits:
  - 15e12fdf24c5c0444d5707646983980dae58b438
  - da9756bdb4362e255c829bb263b594e6f37bf1f4
files_reviewed: 16
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/staging-diagnostics.ts
  - extensions/pi-claude-marketplace/shared/compare-name-scope.ts
  - features/plugin/staging-warnings.feature
  - test/orchestrators/plugin/install-flow-dependency-ledger.test.ts
  - test/orchestrators/plugin/install-flow-ledger.test.ts
  - test/orchestrators/plugin/install-flow-planning.test.ts
  - test/orchestrators/plugin/install-flow-results.test.ts
  - test/orchestrators/plugin/install-flow-fixture.ts
findings:
  critical: 1
  warning: 0
  info: 0
  total: 1
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-10-28T15:17:15Z
**Depth:** standard
**Files reviewed:** 16
**Status:** issues_found

## Summary

Re-review of the two fixes recorded in `01-REVIEW-FIX.md`, against HEAD
`6e56b22f`. CR-02 is closed. CR-01 is partially fixed: successful installs,
later dependency-move failures and caught final-root failures preserve the
earlier MCP notices, but a non-throwing final-root validation failure still
loses them.

The scope is the nine source/test/feature files changed by the two fix commits,
plus seven directly relevant callers, renderers, ordering helpers and fixture
modules listed above. Large existing test modules were reviewed at the changed
cases and their surrounding fixture/assertion contracts. The previous review's
assessment of unchanged Phase 1 producers and integrations is the baseline;
this report does not claim a new full-file review of its entire 47-file scope.

## Narrative Findings (AI reviewer)

### CR-01: Final-root validation abort still drops committed dependency MCP notices

**Classification:** BLOCKER
**File:** `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-a-14710/extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts:1069-1080`
**Related lines:** `install-flow-ledger.ts:533,1082-1126`;
`install-flow-planning.ts:264-270`.
**Disposition:** Original CR-01 remains open on an unhandled return path.

**Issue:** The fix carries dependency-step notices into `InstallAfterPlan`
and reads them as `priorNotices`. It merges those notices in the catch,
promotion, disable-failure and installed arms. The `invalid-config` arm
returns `failedRowOutcome(...)` directly, without the prior notices.
The `marketplace-absent`, `refused` and `declared` arms likewise bypass
the notice finalizer.

These are not necessarily pre-mutation aborts of the whole operation: the
dependency plan releases the state lock and commits its steps before entering
the final root transaction. A user or another process can edit the config
between those transactions. When the final read rejects that config, changes
made by earlier steps remain, including an MCP rewrite that removed comments.
The returned outcome omits its notice, and standalone mode never tells the
user that the comments were removed.

**Reproduction:** Ran the real `createInstallPlugin` entry point with the
existing hermetic fixture helpers, in both standalone and orchestrated modes:

1. Install `aaa@1.0.0`.
2. Publish `app@1.0.0 -> aaa@^2.0.0`, `aaa@2.0.0 -> zzz`, and
   `zzz@1.0.0` with an MCP server.
3. Seed project `mcp-adapter.json` with
   `// mine\n{"mcpServers":{}}\n`.
4. Wrap the existing transaction owner. Before acquiring the final root lock,
   once durable state records `aaa@2.0.0` and `zzz`, write malformed
   `claude-plugins.json`. This deterministically models an interleaved config
   edit; the wrapper otherwise calls the real transaction unchanged.
5. Install `app`.

Both runs return `status: "failed"` with no `mcpConfigNotices`. The MCP file
contains `zzz`'s server and no comment. Standalone mode emits only the failed
cascade, naming the invalid config and the landed dependencies; orchestrated
mode emits nothing and gives its caller no notice to render.

**Fix:** Finalize prior-step notices for every terminal result after a plan,
including non-throwing aborts. For example, wrap the invalid-config result
in `withMcpConfigNotices(ctx, run, orchestrated, failedRowOutcome(...), priorNotices)`,
and apply the same rule to the other early result arms. Prefer one outcome
boundary if that can preserve the current row/diagnostic-before-notice order
without emitting notices twice. Keep outcome properties absent when the notice
list is empty.

Add regression cases for an interleaved invalid config in both modes. Assert
the exact `comments-dropped` payload on the returned outcome, exactly one
standalone notice after the failed rows, and zero direct notifications in
orchestrated mode. Retain the successful, later-move-failure and caught-failure
cases.

## Fix Dispositions

| Finding | Verdict | Evidence |
| --- | --- | --- |
| CR-01 | Partially fixed; remains BLOCKER above. | Planning forwards `ran.mcpConfigNotices` on success and failed moves; the failed-moves projection uses the common mode-aware notice helper. Final-root success and catch retain the notices. Non-throwing validation aborts still omit them. |
| CR-02 | Closed. | `cascadeStagingDiagnostics` at `install-flow-results.ts:811-840` sorts the root's display name and members' qualified row keys with the same `compareByNameThenScope` used by `composeCascadeMemberRows`. It excludes the root member by exact key and preserves diagnostic header names. The ledger emits the resulting sequence after cascade rows and before MCP notices. |

The previously closed selected findings remain outside the fix delta. No
additional Critical, Warning or Info finding was established in this re-review.
The open CR-01 is a continuation of the original notice-loss finding, not a
duplicate counted under a new ID.

## Verification Evidence and Limits

- Read the existing review/fix report, project instructions, relevant Phase 1
  requirements and planning records, both fix diffs, changed source modules,
  changed test cases and their supporting call chains. Applied the TypeScript,
  unit-test, Cucumber and local-verification review rules. The reviewer-specific
  configured-skill query returned no additional skills.
- Used CodeGraph before locating implementation symbols. Its index predates
  the four source changes, so their current source was read directly.
- Inspected the four new CR-01 success/later-move-failure cases, the CR-02
  full-notification install case, the projection's exact row/header identity
  assertions, and all three added behavioral scenarios. They discriminate
  the original reproductions but do not cover the final validation abort.
- Ran two inline hermetic probes for the open finding, one per notification
  mode, on Node `v26.12.1`; both completed with exit 0 and produced the
  incorrect outputs described above.
- Ran five additional inline hermetic checks, exit 0: final-root success and
  caught final-root failure in both notification modes, plus the
  `aaa`/`zroot` diagnostic-order case. The four MCP checks asserted the exact
  single notice on the outcome, exactly one standalone notice or zero
  orchestrated notifications. The ordering check asserted three notifications:
  cascade, `aaa` diagnostic, `zroot` diagnostic.
- Probes used existing production entry points and fixture helpers, changed only
  disposable scope data, and removed each temporary project in `finally`.
  No implementation or test file was edited.
- The fix report records successful direct coverage for all four changed source
  pairs, mandatory commit hooks and 19 passing Phase 1 Cucumber scenarios
  (227 steps) at `da9756bd`. The coordinating owner is running the required
  combined-tree `npm run check`; it was not duplicated here, and this report
  does not claim its result before the owner supplies it.
- Confirmed `git diff da9756bd -- . ':(exclude,glob).planning/**/*.md'`
  is empty at review HEAD and that no untracked build inputs exist. These
  fixes are the only implementation differences from the preceding review.
- Ran `node_modules/.bin/fallow review --base 15e12fdf^ --brief`, exit 0,
  after an escalated retry allowed its disposable comparison worktree.
  It reported zero dead-code, complexity and duplication metrics and identified
  the public composition root as a consumer; that caller was reviewed.
  Its test-reach hints were not treated as proof of missing tests because the
  actual changed tests call both named functions.
- No external reviewer evidence or structural-findings payload was supplied.
  Only this report was written. No commit was created by the reviewer.

---

_Reviewer: gsd-code-reviewer_
_Depth: standard_
