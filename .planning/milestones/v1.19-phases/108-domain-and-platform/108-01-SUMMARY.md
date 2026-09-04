---
phase: 108-domain-and-platform
plan: 01
subsystem: testing
tags: [node-test, direct-coverage, authentication, provider-registry]

requires: []
provides:
  - Canonical mirrored owner for the authentication provider registry
  - Whole-value GitHub and GitLab descriptor contract coverage
  - Strict host equality coverage for empty, case-changed, and lookalike inputs
affects: [108-domain-and-platform, auth-registry, unit-test-refactor]

actuals:
  tokens: 1420
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns: [lowercase AAA phases, whole-value descriptor observations, source-paired direct coverage]

key-files:
  created:
    - .planning/phases/108-domain-and-platform/108-01-SUMMARY.md
  modified:
    - tests/domain/auth-registry.test.ts

key-decisions:
  - "Use public token environment names as controlled credentialFrom inputs; do not add fields to the production descriptor."
  - "Exercise rejection boundaries through findProviderForHost so the public registry result proves strict host equality."

patterns-established:
  - "Complete descriptor observation: compare scalar fields, host behavior, and credential mappings as one independent value."
  - "Equality boundary table: give each unknown host its own lowercase arrange, act, and assert case."

requirements-completed: [MOD-01]

coverage:
  - id: D1
    description: "The canonical owner preserves the complete GitHub provider descriptor and exact github.com lookup."
    requirement: MOD-01
    verification:
      - kind: unit
        ref: "tests/domain/auth-registry.test.ts#exposes the complete GitHub descriptor"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/auth-registry.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The canonical owner preserves the GitLab descriptor and rejects empty, case-changed, and lookalike hosts."
    requirement: MOD-01
    verification:
      - kind: unit
        ref: "tests/domain/auth-registry.test.ts#exposes the complete GitLab descriptor"
        status: pass
      - kind: unit
        ref: "tests/domain/auth-registry.test.ts#returns undefined for unknown host"
        status: pass
      - kind: other
        ref: "npm run check"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-08-29
status: complete
---

# Phase 108 Plan 01: Authentication registry owner summary

**Whole-value provider contracts and strict host equality now protect the authentication registry at 100 percent direct coverage.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-29T04:42:37Z
- **Completed:** 2026-08-29T04:52:02Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- The GitHub case compares metadata, `github.com` matching, and `GH_TOKEN` and `GITHUB_TOKEN` credential mappings as one value.
- The GitLab case compares metadata, `gitlab.com` matching, and the `GITLAB_TOKEN` credential mapping as one value.
- Registry cases prove exact known-host identity and reject empty, case-changed, and one-character lookalike hosts.

## Task commits

Each task was committed atomically:

1. **Task 1: Prove the GitHub provider path from source contract through direct coverage** - `b0f299f3` (test)
2. **Task 2: Lock GitLab, unknown-host, and exact-equality boundaries** - `3714a89f` (test)

**Plan metadata:** committed after this summary was written.

## Files created or modified

- `tests/domain/auth-registry.test.ts` - Owns complete provider descriptors and strict lookup boundaries.
- `.planning/phases/108-domain-and-platform/108-01-SUMMARY.md` - Records plan results and coverage evidence.

## Decisions made

- The test passes public environment-variable names into `credentialFrom`. It does not read credentials or add production fields.
- Unknown-host cases use the public registry lookup. This proves that neither provider claims an unsafe host.

## Deviations from plan

None. The plan ran within the single owner-test pair.

## Issues encountered

The first sandboxed `npm run check` could not run three Git transport suites. The approved unrestricted rerun passed the full unit and integration gates.

## User setup required

None. The tests use no live authentication, credential values, or external services.

## Next phase readiness

The Phase 108 tracer is green. Plan 108-02 can use this owner structure for the next domain pair.

## Self-Check: PASSED

The owner test, summary, and both task commits exist in the isolated worktree.

---

*Phase: 108-domain-and-platform*
*Completed: 2026-08-29*
