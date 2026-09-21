---
milestone: workflows-detection
milestone_name: Workflow Detection
audited: 2026-08-29T21:23:58Z
status: passed
scores:
  requirements: 6/6
  phases: 1/1
  integration: 5/5 wired
  flows: 4/4 complete
gaps:
  requirements: []
  integration: []
  flows: []
tech_debt: []
nyquist:
  compliant_phases: [106]
  partial_phases: []
  not_validated_phases: []
  missing_phases: []
  overall: compliant
security:
  verified_phases: [106]
  threats_open: 0
ui:
  reviewed_phases: [106]
  score: 24/24
---

# Milestone Audit: workflows-detection - Workflow Detection

**Audited:** 2026-08-29
**Status:** `passed`

## Definition of Done

A user can identify a plugin that contains unsupported workflows. A normal
install rejects the plugin and names `{workflows}`. An install with `--partial`
installs supported components only. No workflow file enters Pi resources or an
execution path.

**Met.** The schemas accept opaque declarations. The resolver also detects the
fixed `workflows/` directory. Both inputs produce one typed unsupported kind.
The normal gate rejects that kind. The partial gate admits the supported
components. The install ledger has no workflow phase. State stores the kind in
compatibility metadata only. Reload discovery returns supported Pi resources
only.

## Requirements Coverage

The audit cross-checked the requirements register, all four summary files, and
the Phase 106 verification report. All six requirements are satisfied. No
requirement is orphaned.

| ID | Phase | VERIFICATION | SUMMARY frontmatter | REQUIREMENTS | Final |
|----|-------|--------------|---------------------|--------------|-------|
| WDET-01 | 106 | passed | 106-02 | `[x]` | satisfied |
| WDET-02 | 106 | passed | 106-01, 106-02 | `[x]` | satisfied |
| WDET-03 | 106 | passed | 106-01, 106-02 | `[x]` | satisfied |
| WDET-04 | 106 | passed | 106-01, 106-04 | `[x]` | satisfied |
| WDET-05 | 106 | passed | 106-01, 106-03 | `[x]` | satisfied |
| WDET-06 | 106 | passed | 106-01, 106-03 | `[x]` | satisfied |

## Phase Verification

| Phase | Name | Plans | Verification | Behavior unverified |
|-------|------|-------|--------------|---------------------|
| 106 | Workflow Detection and Partial Install | 4/4 | passed | 0 |

The verifier scored all eight observable truths as verified. It found no
implementation, wiring, data-flow, or human-verification gap.

## Integration Check

This milestone has one phase, so there is no phase-to-phase handoff. The audit
traced the cross-module seams that form the user workflow.

### Wiring Summary

**Connected:** 5 expected connections
**Orphaned:** 0 exports
**Missing:** 0 connections

| Connection | Integration path | Status |
|------------|------------------|--------|
| Declaration admission | Marketplace or plugin manifest -> shared TypeBox field -> compiled validators -> resolver input | WIRED |
| Directory detection | Resolved plugin root -> fixed `workflows/` stat -> shared unsupported collector -> partial resolution | WIRED |
| User-visible reason | Typed unsupported list -> `narrowUnsupportedKinds` -> closed `REASONS` token -> terminal renderer | WIRED |
| Install consent | Resolver result -> normal or partial gate -> supported-only ledger -> compatibility state | WIRED |
| Reload boundary | Persisted supported resources -> discovery -> `skillPaths` and `promptPaths`; workflow source remains excluded | WIRED |

### API and Authentication Coverage

This phase adds no API route, network operation, identity check, or credential
path. API-consumer and authentication-protection checks do not apply.

### End-to-End Flows

| Flow | Steps | Status |
|------|-------|--------|
| Inventory | declaration or directory -> resolver -> partial state -> `{workflows}` row | COMPLETE |
| Normal install | partial resolution -> strict gate rejection -> error summary and `--partial` hint -> no mutation | COMPLETE |
| Partial install | explicit consent -> supported ledger phases -> compatibility record -> success row and reload hint | COMPLETE |
| Failure and retry | staged supported component -> induced failure -> rollback -> blocker removal -> clean retry | COMPLETE |

### Requirements Integration Map

| Requirement | Integration path | Status | Issue |
|-------------|------------------|--------|-------|
| WDET-01 | Schema field -> both compiled validators -> resolver input | WIRED | - |
| WDET-02 | Plugin root -> fixed directory convention -> strict and loose resolver drivers | WIRED | - |
| WDET-03 | Shared collector -> three-way decision -> typed partial arm | WIRED | - |
| WDET-04 | Typed kind -> shared classifier -> every reason-bearing consumer -> renderer | WIRED | - |
| WDET-05 | Resolver arm -> strict or partial gate -> install ledger and notification | WIRED | - |
| WDET-06 | Supported-only phase array -> five-key resource record -> two-key reload discovery | WIRED | - |

All six requirements belong to one phase. None requires a cross-phase export.
Each requirement still crosses at least one production module boundary.

## Nyquist Coverage

| Phase | VALIDATION.md | Status | Classification |
|-------|---------------|--------|----------------|
| 106 | exists | validated / compliant | COMPLIANT |

**Overall:** 1 compliant, 0 partial, 0 not validated, 0 missing.

All eight planned tasks have green automated checks. No task depends on manual
verification.

## Security

Phase 106 has a plan-time threat register. All nine threats are closed. The two
accepted low risks have explicit rationale. `threats_open` is zero at the
configured high-severity blocking threshold.

## Terminal UI Review

The terminal contract scored 24/24 after re-audit. During the audit, the draft
rejection example was corrected to the versionless early-rejection form. This
matches other unsupported components and the executable catalog. Shared reason
parity covers update and autoupdate consumers without command-specific workflow
branches.

## Quality Gate

The final `npm run check` exited 0 after all implementation and review fixes:

- TypeScript typecheck passed.
- ESLint, Fallow, and Prettier passed.
- Unit tests: 3,649 passed, 0 failed, 1 intentional platform skip.
- Integration tests: 21 passed, 0 failed.
- The Phase 106 execution gate also passed all 14 end-to-end tests.
- Filesystem secret scans found 0 verified and 0 unverified secrets.

## Verdict

The milestone meets its definition of done. All requirements are satisfied.
All integration paths and end-to-end flows are complete. Nyquist and security
checks pass. No blocking gap or deferred tech debt remains.
