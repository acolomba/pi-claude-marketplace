---
phase: quick-260829-pyv
plan: 01
subsystem: plugin-resolution
tags: [typescript, workflows, resolver, notifications, regression-tests]

requires: []
provides:
  - "Strict and loose regression coverage for opaque workflow detection"
  - "Append-only workflows reason at index 43 of the 44-member reason tuple"
  - "Accurate classifier, install, catalog, and release documentation"
affects: [plugin-install, plugin-discovery, resolver, notification-catalog]

actuals:
  tokens: 11217
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Treat workflow declarations as opaque typed unsupported kinds"
    - "Append new notification reasons after all inherited members"

key-files:
  created: []
  modified:
    - tests/domain/resolver-strict.test.ts
    - tests/domain/resolver-loose.test.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/discover.test.ts
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
    - docs/output-catalog.md
    - CHANGELOG.md

key-decisions:
  - "Keep workflow contents opaque and outside parsing, staging, discovery results, registration, and execution."
  - "Keep the 43 inherited reason indexes and append workflows as member 44."
  - "Classify workflows through typed unsupported kinds, not resolver notes."

patterns-established:
  - "Presence checks treat every defined workflow declaration, including null and false, as present."
  - "Convention probes require a literal workflows directory and ignore a same-named file."

requirements-completed: [WDET-01, WDET-02, WDET-03, WDET-04, WDET-05, WDET-06]

coverage:
  - id: D1
    description: "Defined workflow declarations classify once through entry and plugin-manifest routes."
    requirement: WDET-01
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#WDET-02 strict workflow signal matrix"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver-loose.test.ts#WDET-02 loose workflow signal matrix"
        status: pass
    human_judgment: false
  - id: D2
    description: "A same-named regular file does not trigger the workflow convention."
    requirement: WDET-02
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#workflows regular file"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver-loose.test.ts#workflows regular file"
        status: pass
    human_judgment: false
  - id: D3
    description: "Strict and loose modes return the same workflow kind and note."
    requirement: WDET-03
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#workflow signal matrix"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver-loose.test.ts#workflow signal matrix"
        status: pass
    human_judgment: false
  - id: D4
    description: "Workflows is the final member of the 44-member reason tuple."
    requirement: WDET-04
    verification:
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#REASONS exact order"
        status: pass
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts#44-entry reason set"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/cross-surface-reason-parity.test.ts#WDET-04"
        status: pass
    human_judgment: false
  - id: D5
    description: "Partial install preserves workflow bytes without materializing or executing them."
    requirement: WDET-05
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/install.test.ts#WDET-06 opaque workflow bytes"
        status: pass
    human_judgment: false
  - id: D6
    description: "Reload discovery ignores malformed and command-bearing workflow decoys."
    requirement: WDET-06
    verification:
      - kind: integration
        ref: "tests/orchestrators/discover.test.ts#deterministic resources discovery"
        status: pass
    human_judgment: false

duration: 82min
completed: 2026-08-29
status: complete
---

# Quick Task 260829-pyv: PR #154 Review Remediation Summary

**Opaque workflow detection now has falsey, filesystem, install, discovery, and append-only notification regression coverage.**

## Performance

- **Duration:** 82 min
- **Started:** 2026-08-29T22:54:24Z
- **Completed:** 2026-08-30T00:16:09Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments

- Added strict and loose coverage for falsey declarations and regular-file convention negatives.
- Proved that malformed and command-bearing workflow bytes are not materialized or executed.
- Preserved all inherited reason indexes and appended `workflows` as the final reason.
- Corrected classifier-axis, partial-install, catalog, and changelog wording.
- Corrected resolver-state and component-enumeration descriptions after the follow-up review.

## Task Commits

Each task was committed atomically:

1. **Task 1: Prove opaque workflow handling** - `24745ae6` (test)
2. **Task 2: Restore the append-only reason tail** - `6e9aeffc` (fix)
3. **Task 3: Correct classifier and release wording** - `097a43a0` (docs)
4. **Review follow-up: Correct resolver-state descriptions** - `8505dc7f` (docs)
5. **Review follow-up: Clarify component enumeration** - `082b4205` (docs)

The orchestrator committed the planning artifacts after the three planned tasks.

## Files Created/Modified

- `tests/domain/resolver-strict.test.ts` and `tests/domain/resolver-loose.test.ts` - Cover falsey declarations and regular-file negatives.
- `tests/orchestrators/plugin/install.test.ts` - Proves opaque bytes do not block partial install or execute commands.
- `tests/orchestrators/discover.test.ts` - Proves reload discovery ignores workflow decoys.
- `extensions/pi-claude-marketplace/shared/notify.ts` - Appends the workflow reason after all inherited members.
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` - Corrects the closed-set count history.
- `tests/architecture/notify-closed-set-locks.test.ts` and `tests/architecture/compat-01-no-expansion.test.ts` - Lock the 44-member count and order.
- `docs/output-catalog.md` - Documents the reason order and normal-versus-partial behavior.
- `extensions/pi-claude-marketplace/domain/components/plugin.ts` and `extensions/pi-claude-marketplace/domain/resolver.ts` - Correct the partial-arm contract comments.
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` - Documents the resolver-note and typed-kind axes.
- `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` - Documents typed-kind-first install classification.
- `CHANGELOG.md` - States the structural and materialization boundaries accurately.

## Decisions Made

- Followed the locked plan decisions. No new architecture or runtime behavior was introduced.

## Deviations from Plan

- The follow-up comments review found stale resolver-state and component-enumeration text.
- The two documentation commits corrected those facts. They did not change runtime behavior.

## Issues Encountered

- The sandbox blocks localhost binding. Required full checks passed after escalation without test changes.
- The first Task 2 hook run formatted the catalog. All required gates passed again after that change.

## User Setup Required

None - no external service configuration is required.

## Next Phase Readiness

- The five review-remediation commits are ready for the existing PR branch.
- No blockers, known stubs, skipped verification, or new threat surfaces remain.

## Self-Check: PASSED

- The summary and all 14 modified files exist.
- All five remediation commits exist on `features/workflows-detection`.
- The planning artifacts are tracked on the feature branch.

---

*Phase: quick-260829-pyv*
*Completed: 2026-08-29*
