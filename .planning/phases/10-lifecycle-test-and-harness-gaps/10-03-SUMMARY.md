---
phase: 10-lifecycle-test-and-harness-gaps
plan: "03"
subsystem: plugin-install
tags: [cascade, failure-carrier, cucumber, redaction]
requires:
  - phase: 10-lifecycle-test-and-harness-gaps
    plan: "01"
    provides: fail-closed lifecycle harness ownership
provides:
  - Typed root-ledger, dependency-plan, and mid-walk failure carriers
  - Complete failed rows for every resolved but uninstalled cascade member
  - Presentation-time cause redaction for cascade failure rows
affects: [phase-11-install-flow-split, plugin-lifecycle-verification]
actuals:
  tokens: 6164
  tasks: 3
  commits: 1
plan_head_before: 518289bc4412549f01b9a1904ac78167f066f6c7
plan_head_after: 5c89ac8ca7ab12796597b118324db863db09b123
tech-stack:
  added: []
  patterns:
    - ordered typed member carriers populated at information-loss seams
    - one deduplicating failed-row builder shared by cascade and plan-step output
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
    - test/orchestrators/plugin/install-flow.test.ts
    - test/orchestrators/plugin/install-cascade.messaging.test.ts
    - features/plugin/install-dependencies.feature
key-decisions:
  - "Carry member keys from the walk and dependency plan while those typed structures are still available; never re-walk a catalog or parse a rendered error in a catch path."
  - "Keep the original typed Error for outcome dispatch and redact a presentation copy when composing the user-visible cascade row."
requirements-completed: [CAS-08, XPH-02]
duration: 16min
completed: 2026-10-27
status: complete
---

# Phase 10 Plan 03: Closure Failure Rows Summary

**Root-ledger, dependency-plan, and mid-walk failures now list every resolved cascade member that did not install, while preserving typed errors and redacting row causes.**

## Performance

- **Duration:** 16 min
- **Completed:** 2026-10-27
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Carried root-ledger phase members into the cascade subject when a root fails after its dependencies were resolved and rolled back.
- Recorded successful catalog reads before a mid-walk throw and carried that ordered set without a catch-path re-walk.
- Projected the dependency plan's typed step/final members before execution, then listed members a failed plan step did not materialize.
- Centralized unmaterialized-row deduplication and redacted the presentation copy of a failure cause without replacing the typed outcome error.
- Added separately titled, complete-row Cucumber scenarios for all three CAS-08 routes.

## Task Commits

1. **Tasks 1-3: Carry and render closure failure members** - `5c89ac8c`

The three tasks share the same discriminated carrier and row builder, so their implementation and complete-route proof landed as one cohesive commit.

## Verification

| Check | Result |
| --- | --- |
| Three named CAS-08 Cucumber scenarios | 3 scenarios, 39 steps passed |
| `node --test test/orchestrators/plugin/install-flow.test.ts` | 321/321 passed |
| Direct coverage: `install-flow.ts` | 100% passed |
| Direct coverage: `install-cascade.ts` | 100% passed |
| Direct coverage: `install-cascade.messaging.ts` | 100% passed |
| Direct coverage: `update-cascade.ts` | 100% passed |
| `npm run check:features` | Passed |
| `npm exec -- fallow audit --base 518289bc` | No issues in 5 changed files |
| Commit hook (`npm run check:commit`) | Passed |

## Decisions Made

- A root-only ledger failure stays on the established single-row path. A root failure with resolved dependencies uses the cascade subject so those dependencies remain visible.
- Mid-walk state is appended only after a catalog read returns. The throwing member is the subject; earlier successful reads become the unmaterialized carrier.
- The dependency plan is projected once before its steps run. Failed and already-landed keys are excluded from the remaining-member rows using typed plan and row fields.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Redacted root causes after routing them through cascade messaging**

- **Found during:** Task 1 root-ledger scenario
- **Issue:** Moving a root failure onto the cascade carrier exposed an absolute staging path that the former scenario token could detect.
- **Fix:** Build a redacted presentation Error while retaining the original typed Error for outcome dispatch.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts`
- **Commit:** `5c89ac8c`

**2. [Rule 3 - Blocking] Passed a fresh resolved-key accumulator to the planning catalog**

- **Found during:** Task 2 dependency-plan scenario
- **Issue:** The planning catalog's direct call did not supply the new accumulator and threw before the plan could run.
- **Fix:** Default each direct catalog lookup to its own empty accumulator; transaction catalogs still share their explicit ordered accumulator.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts`
- **Commit:** `5c89ac8c`

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

The Phase 11 install-flow split barrier is released. All three route scenarios, owner tests, direct coverage pairs, and the commit hook passed at `5c89ac8c`.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

The planned mitigations are present: member identities come from typed walk/plan records, no catch path re-reads untrusted catalogs or parses error text, duplicate rows are removed by key, and failure causes are redacted before presentation.

## Self-Check: PASSED

- All five modified files exist.
- Commit `5c89ac8c` is an ancestor of `HEAD`.
- The three named scenarios and all four direct coverage pairs pass.

---

*Phase: 10-lifecycle-test-and-harness-gaps*
*Completed: 2026-10-27*
