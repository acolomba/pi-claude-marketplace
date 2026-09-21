---
phase: 106-workflow-detection-and-partial-install
plan: 02
subsystem: resolver
tags: [typescript, typebox, workflows, resolver, node-test]

requires:
  - phase: 106-01
    provides: The typed workflows kind, fixed directory convention, and shared reason mapping
provides:
  - One opaque workflows field shared by marketplace entries and plugin manifests
  - Strict and loose resolver parity for every workflow signal route
  - Local named-layout, concurrency, deduplication, and structural-precedence coverage
affects: [106-03, 106-04, manifest-schema, resolver]

actuals:
  tokens: 2899
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - Shared opaque TypeBox field for unsupported declarations
    - Identical strict and loose classification matrices

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/components/plugin.ts
    - tests/domain/manifest.test.ts
    - tests/domain/resolver-strict.test.ts
    - tests/domain/resolver-loose.test.ts

key-decisions:
  - "Keep workflow declaration values opaque and use only their defined top-level presence."
  - "Use synthetic local plugin roots and a failing clone resolver to prove that path classification does not use the network seam."

patterns-established:
  - "Schema admission: define an unsupported field once in UNSUPPORTED_COMPONENT_FIELDS so both schemas use the same contract."
  - "Resolver parity: apply the same signal matrix to strict and loose modes and assert exact ordered output."

requirements-completed: [WDET-01, WDET-02, WDET-03]

coverage:
  - id: D1
    description: Marketplace entries and plugin manifests accept opaque workflow declarations without mutation.
    requirement: WDET-01
    verification:
      - kind: unit
        ref: "tests/domain/manifest.test.ts#WDET-01 plugin schemas admit opaque workflow declarations without mutation"
        status: pass
    human_judgment: false
  - id: D2
    description: Both resolver modes find the literal workflows directory in named local layouts.
    requirement: WDET-02
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#WDET-02 strict named local workflow layouts"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver-loose.test.ts#WDET-02 loose named local workflow layouts"
        status: pass
    human_judgment: false
  - id: D3
    description: Every workflow signal produces one ordered unsupported kind while structural errors remain unavailable.
    requirement: WDET-03
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#WDET-02 strict every workflow signal"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver-loose.test.ts#WDET-02 loose every workflow signal"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#D-106-06 strict structural precedence"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver-loose.test.ts#D-106-06 loose structural precedence"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-08-29
status: complete
---

# Phase 106 Plan 02: Workflow schema and resolver parity summary

**Both schemas admit opaque workflow declarations, and both resolver modes classify every local workflow signal identically.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-08-29T19:22:31Z
- **Completed:** 2026-08-29T19:44:51Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added one shared `Type.Optional(Type.Unknown())` workflow field to both plugin declaration schemas.
- Proved stable validation of frozen object and numeric declarations across concurrent checks.
- Proved exact strict and loose classification for declarations, directories, combined signals, named layouts, and structural errors.

## Task commits

Each task was committed atomically:

1. **Task 1 RED: Add the failing workflow schema contract** - `1ec9b925` (test)
2. **Task 1 GREEN: Accept workflow declarations** - `d2cc2b0e` (feat)
3. **Task 2: Cover workflow resolver modes** - `813d74c8` (test)

## Files created or modified

- `extensions/pi-claude-marketplace/domain/components/plugin.ts` adds the shared opaque workflow field.
- `tests/domain/manifest.test.ts` covers named schema admission, frozen input, and concurrent validation.
- `tests/domain/resolver-strict.test.ts` covers every strict workflow signal and fixed directory case.
- `tests/domain/resolver-loose.test.ts` mirrors the strict matrix and structural boundary.

## Decisions made

- Workflow values remain opaque. The resolver reads only their defined top-level presence.
- Named layout tests use local path sources. A failing clone resolver proves that no network seam runs.

## Deviations from plan

None. The plan was executed as written.

## Issues encountered

None.

## TDD gate compliance

- RED commit `1ec9b925` failed because the named shared workflow field was absent.
- GREEN commit `d2cc2b0e` added only the shared opaque field and passed the contract.

## Validation results

- Combined manifest, strict resolver, and loose resolver suites: 3 files passed.
- Task secret scans: 0 verified and 0 unverified secrets.
- Task pre-commit hooks: pass with TruffleHog skipped only after each filesystem scan.
- Typecheck, lint, formatting, and repository health hooks: pass.
- Stub scan: no new stub, placeholder, skipped test, or unrun verification.
- Threat scan: no new endpoint, file reader, network call, materialization path, or execution path.

## User setup required

None. This plan uses no external service.

## Next phase readiness

- Plan 106-03 can test install persistence and the no-materialization boundary with the schema routes in place.
- Plan 106-04 can use the complete resolver matrix for cross-surface parity and catalog gates.
- No blocker remains from this plan.

## Self-check: PASSED

- The summary and all four listed implementation and test files exist.
- Commits `1ec9b925`, `d2cc2b0e`, and `813d74c8` exist in git history.
- The coverage classifier accepts all three deliverables as automated evidence.

---

*Phase: 106-workflow-detection-and-partial-install*
*Completed: 2026-08-29*
