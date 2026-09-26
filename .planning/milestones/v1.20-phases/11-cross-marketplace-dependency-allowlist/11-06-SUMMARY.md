---
phase: 11-cross-marketplace-dependency-allowlist
plan: "06"
subsystem: dependency-install
tags: [dependencies, marketplace, allowlist, reload, reconcile]
requires:
  - phase: 11-cross-marketplace-dependency-allowlist
    provides: cascade policy and structured cross-marketplace refusal from plans 11-04 and 11-05
  - phase: 09-reload-installs-missing-dependencies
    provides: grouped missing-dependency planning and transactional reload install
provides:
  - original declarer authorization before a missing dependency's cascade
  - complete eligible declarer lists in reconcile buckets and install options
  - typed cross-marketplace reason in reload's failed dependency row
  - regression coverage for nested policy, retry, scope fallback, and multi-source grants
affects: [reconcile, install-flow, dependency-cascade, reload]
tech-stack:
  added: []
  patterns: [locked pre-cascade authorization, first-error retention with later-source grant]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/orchestrators/reconcile/plan.test.ts
    - tests/orchestrators/reconcile/apply.test.ts
    - tests/orchestrators/reconcile/types.test.ts
    - tests/orchestrators/reconcile/notify.test.ts
    - scripts/check-unused-type-members.contracts.json
key-decisions:
  - "Authorize the original edge under the missing-install lock after the recorded and target-source checks, then run the missing root's own cascade."
  - "Check every same-marketplace declarer before reading foreign policies; otherwise retain the first policy error until a later source grants access."
  - "Keep requiredBy as the first eligible diagnostic source while collecting distinct declarers and all raw ranges."
requirements-completed: [XMKT-01, XMKT-02]
actuals:
  tokens: 8680
  tasks: 3
  commits: 1
commits: 1
plan_head_before: d791b2d12506efdd612e57dab15d6b183be3c813
duration: 60min
completed: 2026-09-23
status: complete
coverage:
  - id: D1
    description: A reload authorizes a missing dependency using any eligible original declarer before starting its cascade and reports an actionable refusal otherwise.
    requirement: XMKT-01
    verification:
      - kind: integration
        ref: tests/orchestrators/plugin/install-flow.test.ts#XMKT-01 reload refuses an unlisted original declarer before installing the missing root
        status: pass
      - kind: integration
        ref: tests/orchestrators/reconcile/apply.test.ts#XMKT-01 reload evaluates second foreign policy
        status: pass
    human_judgment: false
  - id: D2
    description: The planner carries distinct eligible declarers in verdict order, all ranges, and the first requiredBy label to reload application.
    requirement: XMKT-01
    verification:
      - kind: unit
        ref: tests/orchestrators/reconcile/plan.test.ts#XMKT-01 retains each eligible original declarer once without dropping ranges
        status: pass
      - kind: integration
        ref: tests/orchestrators/reconcile/apply.test.ts#XMKT-01 reload evaluates later same-marketplace source
        status: pass
    human_judgment: false
  - id: D3
    description: The missing root's own policy governs its descendants, while denial remains fail-clean and a corrected policy is retryable.
    requirement: XMKT-02
    verification:
      - kind: integration
        ref: tests/orchestrators/plugin/install-flow.test.ts#XMKT-01 missing B uses B's policy
        status: pass
      - kind: integration
        ref: tests/orchestrators/plugin/install-flow.test.ts#XMKT-01 reload refuses an unlisted original declarer before installing the missing root
        status: pass
    human_judgment: false
---

# Phase 11 Plan 06: Reload original-edge authorization summary

Explicit reload now checks each eligible original declarer's marketplace policy before installing a missing dependency. A same-marketplace declarer or any valid foreign allowlist grants access; otherwise the failed row retains the cross-marketplace reason and the first declarer's remedies. The missing dependency's own marketplace policy still governs its descendants.

## Accomplishments

- Added the complete, ordered declarer list to the missing-dependency bucket and passed it unchanged through reload application. The first `requiredBy` label and every raw range remain intact.
- Added locked, scope-aware original-edge authorization with recorded-first and target-source precedence. A later valid grant can override an earlier unreadable policy, while a lone malformed policy keeps its typed error.
- Proved real denial and corrected-policy retry leave state, configuration, and artifact inventory clean; covered same-marketplace, second-source, nested, recorded-child, and project/user source cases.

## Task Commit

- `11fd46bb` — `feat: authorize reload dependencies from every declarer` (the three coupled tasks and required fixtures).

## Verification

- Install-flow, reconcile plan/apply/types, and notify owner suites passed. The architecture no-network gate passed 4/4.
- Direct source-test coverage passed for install-flow (217/217 branches), plan (170/170), apply (181/181), and types (5/5). The pre-commit changed-pair coverage hook also passed.
- `npm run typecheck`, changed-file ESLint and Prettier, positive and negative type-member gates, Fallow base audit, and Fallow JSON agent gate passed. The agent verdict was `warn` with no new complexity finding. The complete ten-file pre-commit run passed every applicable hook with the required worktree TruffleHog skip.
- The full `npm run check` belongs to the orchestrator's post-merge wave gate.

## Deviations from Plan

- **Rule 3 — Required fixture repair:** The new required `declarers` field exposed three hand-built rows in `tests/orchestrators/reconcile/notify.test.ts`. The orchestrator authorized this tenth file; its owner suite and typecheck pass.
- **Rule 1 — Gate findings:** Fallow flagged the expanded planner bucket's cognitive complexity, and the type-member gate flagged an inline group type after extraction. A small group-fold helper and shared private group interface resolved both without changing eligibility or range behavior.
- The TDD RED tests were recorded and validated before implementation. The code and tests share one commit because the plan requires the coupled contract to be complete and pre-commit's direct-coverage gate rejects a deliberately failing RED tree. The direct-coverage CLI was run per source path where it accepts one target at a time.

## Issues Encountered

- Git LFS and child-process sandbox restrictions required escalated execution for the Fallow base audit and pre-commit. No package download or external setup was needed.
- The owner instruction reserves `.planning/STATE.md` and `.planning/ROADMAP.md` for the orchestrator; this worktree leaves both untouched.

## Next Phase Readiness

All three tasks and plan-focused gates are complete. The orchestrator can merge this worktree and run the full post-merge `npm run check`.

## Self-Check: PASSED

The summary, key source/test files, and `11fd46bb` exist. The implementation commit deleted no tracked files.
