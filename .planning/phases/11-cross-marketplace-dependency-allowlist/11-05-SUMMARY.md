---
phase: 11-cross-marketplace-dependency-allowlist
plan: "05"
subsystem: dependency-install
tags: [dependencies, marketplace, allowlist, regression-tests]
requires:
  - phase: 11-cross-marketplace-dependency-allowlist
    provides: root install policy and structured refusal from plan 11-04
provides:
  - real three-marketplace install proof for transitive root authority and fail-clean refusal
  - closure and cascade regression cases for exact matching, recorded exemptions, and guard order
  - failure projection and reason classification assertions
affects: [dependency-closure, install-cascade, install-flow, notification-reasons]
tech-stack:
  added: []
  patterns: [real-file transitive install tracer, strict pre-materialization refusal assertion]
key-files:
  created: []
  modified:
    - tests/domain/dependency-closure.test.ts
    - tests/orchestrators/plugin/install-cascade.test.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/orchestrators/plugin/install-cascade.messaging.test.ts
    - tests/shared/notify-reasons.test.ts
key-decisions:
  - "The 11-04 production contract already satisfies the new cases, so this plan adds behavioral tests without changing production code."
  - "Keep cross-marketplace a cascade-specific Reason, outside the shared FailureReason group."
requirements-completed: [XMKT-01, XMKT-02]
actuals:
  tokens: 4665
  tasks: 2
  commits: 1
commits: 1
plan_head_before: 0ce8a3aa4152668ca8ac0bf5b6e2b0624f39605a
duration: 20min
completed: 2026-09-23
status: complete
coverage:
  - id: D1
    description: The original root allowlist governs a real three-marketplace direct install and refusal leaves state, configuration, and files unchanged.
    requirement: XMKT-01
    verification:
      - kind: integration
        ref: tests/orchestrators/plugin/install-flow.test.ts#XMKT-01 direct install refuses a transitive foreign marketplace using the original root policy
        status: pass
      - kind: integration
        ref: tests/orchestrators/plugin/install-flow.test.ts#XMKT-01 direct install allows a transitive foreign marketplace using the original root policy
        status: pass
    human_judgment: false
  - id: D2
    description: Installed records keep their range and permission exemptions while a disabled record's new foreign child remains subject to root policy.
    requirement: XMKT-02
    verification:
      - kind: unit
        ref: tests/domain/dependency-closure.test.ts#XMKT-02 recorded foreign edges retain every range before the installed check
        status: pass
      - kind: integration
        ref: tests/orchestrators/plugin/install-cascade.test.ts#XMKT-02 a recorded disabled foreign member cannot grant its new child permission
        status: pass
    human_judgment: false
  - id: D3
    description: A policy refusal names the declarer and policy root in the thrown cause and rendered row, with both remedies and no reload hint.
    requirement: XMKT-01
    verification:
      - kind: unit
        ref: tests/orchestrators/plugin/install-cascade.messaging.test.ts#XMKT-01 carries the transitive declarer and original policy root into the thrown cause
        status: pass
      - kind: unit
        ref: tests/architecture/dependency-doc-agreement.test.ts#RESV-06 the failure table names every reason the cascade stamps, and no others
        status: pass
    human_judgment: false
---

# Phase 11 Plan 05: Cross-marketplace install regression summary

Real direct installs now prove that A@alpha controls both B@beta and C@gamma: beta allowing gamma cannot authorize C when alpha allows only beta. Adding gamma to alpha's list installs all three. The refusal leaves the scope state bytes, configuration, and full file inventory unchanged.

## Accomplishments

- Added exact-match, unknown-marketplace precedence, transitive return-to-root, and installed range-merging cases to the pure closure tests.
- Proved a recorded disabled foreign plugin can be read through, while its new unlisted child fails before any ledger call or state mutation. Existing enable and reload wall tests still pass.
- Checked the production refusal through both composer exports. The cause identifies the immediate declarer and original policy root; the same-root projection has one row. The `cross-marketplace` token remains an actionable skip reason and is not a shared `FailureReason`.

## Task Commit

- `d42c4a3a` — `test: cover root marketplace dependency policy` (both test-only tasks).

## Verification

- The install-flow, closure, cascade, enable-disable, notify-reasons, failure-composer, documentation-agreement, and catalog-contract test commands passed.
- Direct coverage passed for dependency-closure (62/62 branches), install-cascade (137/137), install-flow (186/186), and install-cascade.messaging (58/58).
- `npm run typecheck` and the positive type-member gate passed. The escalated negative controls passed 7/7 after sandbox child-process EPERM on the first attempt.
- Fallow's five-file base audit found no introduced issues. Its JSON agent gate returned `warn`, not `fail`. The stable five-file pre-commit run passed every applicable hook.

## Deviations from Plan

- The direct-coverage CLI accepts one source path per call. Each of the four requested source pairs was verified separately.
- The new tests passed against the 11-04 production implementation after a fixture skill-name collision was corrected. No production edit or type-member coordinate update was needed. Both test-only tasks were committed together after the complete gate.

## Known Stubs

None.

## Self-Check: PASSED

The five changed test files and this summary exist, commit `d42c4a3a` is present, and the measured plan commit count is one.
