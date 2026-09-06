---
phase: 01-live-evidence-revalidation
verified: 2026-09-06T16:04:42Z
status: gaps_found
score: 9/10 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 9/10
  gaps_closed:
    - "The original no-op is closed: scope-impact --check now reads both fixed planning files, rejects a missing contract, and detects the previously named ID, clause, route, row-identity, and anchor drift controls."
  gaps_remaining:
    - "The checker still accepts coordinated changes to unsealed scope semantics, including a roadmap phase title plus its ledger afterAnchor and a narrow/split action changed to keep."
    - "The final Phase 1 repository gate is not green after the capped review fixes because Fallow rejects validateScopeChangeStructure at cyclomatic complexity 22."
  regressions:
    - "npm run check now stops at Fallow health on an in-scope function before it reaches the known unrelated .mcp.json formatting condition."
decision_coverage:
  honored: 23
  total: 23
  not_honored: []
gaps:
  - truth: "Final REQUIREMENTS.md and ROADMAP.md pass a complete evidence-backed scope-impact round-trip before later-phase planning."
    status: failed
    reason: "The check now reads both contracts and seals requirement IDs, clauses, routes, and statuses, but it does not seal every scope semantic that it claims to protect. Two independent disposable-root probes returned exit 0: one changed Phase 8's title in ROADMAP.md and changed the matching ledger afterAnchor; the other changed PDEF-01's canonical action from narrow/split to keep without changing either planning document."
    artifacts:
      - path: "scripts/revalidation.mjs"
        issue: "SEALED_REQUIREMENT_SIGNATURES and SEALED_REQUIREMENT_ROUTES are independent, but phase titles and exact per-row actions are accepted from the mutable ledger. validatePhaseAfterAnchor compares one mutable input with another, and validateRequirementDisposition distinguishes only active versus evidence-only actions."
      - path: "tests/architecture/revalidation.test.ts"
        issue: "The suite rejects one-sided phase-title drift and invalid action strings, but it has no public-CLI control for a coordinated title/afterAnchor change or a valid narrow/split-to-keep action change."
      - path: "scripts/revalidation.negative.mjs"
        issue: "The standalone controls cover the last three review findings but do not plant either surviving coordinated semantic drift."
    missing:
      - "Seal the exact Phase 2-9 titles and exact action for each of the 40 stable scope rows outside the mutable ledger, then compare both inputs with those contracts before printing success."
      - "Add public-CLI and standalone negative controls for coordinated phase-title/afterAnchor drift and valid-but-wrong scope action drift."
  - truth: "The final Phase 1 quality gate remains green after gap closure and review fixes."
    status: failed
    reason: "npm run check exits 1 at the configured Fallow health gate. The sole above-threshold function is scripts/revalidation.mjs:1124 validateScopeChangeStructure with cyclomatic complexity 22 and 69 lines."
    artifacts:
      - path: "scripts/revalidation.mjs"
        issue: "The third capped fix pass expanded validateScopeChangeStructure beyond the repository's enforced complexity threshold."
      - path: ".planning/phases/01-live-evidence-revalidation/01-VALIDATION.md"
        issue: "The final hard-gate record still claims npm run check is green and describes the pre-gap 30-test/Plan 01-69 state; it does not record Plan 01-70 or the current failure."
    missing:
      - "Split validateScopeChangeStructure without weakening its public behavior, rerun direct coverage, then rerun the complete quality gate in a clean tracked snapshot."
      - "Refresh 01-VALIDATION.md with the Plan 01-70 and post-review command evidence."
---

# Phase 1: Live Evidence Revalidation Verification Report

**Phase Goal:** Establish the complete reproducible scope before changing code.
**Verified:** 2026-09-06T16:04:42Z
**Status:** gaps_found
**Re-verification:** Yes — after one gap-closure plan and a capped three-pass review/fix loop

## Goal Achievement

### Observable Truths

The repeated shard must-haves from Plans 01-02 through 01-54 are grouped by invariant. All 70 plan and summary pairs exist; every plan has must-haves, and every summary reports `status: complete`.

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | The authoritative corpus is exactly 110 files: 45 first-pass, 58 adversarial, and 7 controls. | ✓ VERIFIED | Fresh `inventory` output reports exactly 110 with 45/58/7. An independent ledger census found 110 unique file paths with the same category counts. |
| 2 | All 53 review shards exclusively cover their assigned corpus files and preserve complete claim/finding evidence. | ✓ VERIFIED | A fresh loop ran the public `validate-shard` command for every shard: 53/53 passed. The assignment has 110 unique paths and exactly matches the canonical ledger path set. |
| 3 | Every corpus file, claim, and finding has a terminal current disposition with traceable source/test/reproduction evidence. | ✓ VERIFIED | Fresh strict validation passes. Independent counts are 2,897 unique claims and 2,437 unique terminal findings: 1,789 confirmed, 501 duplicate, 114 stale, 33 superseded, and zero inconclusive. Evidence methods total 190 behavioral, 267 mutation, and 1,980 static. |
| 4 | The merged ledger is substantive, schema-valid, and canonicalizes duplicate chains without orphaned IDs. | ✓ VERIFIED | `node scripts/revalidation.mjs validate` exits 0. The 136-case behavioral suite also passes duplicate-chain, dangling-link, malformed-record, schema, and live-assignment cases. |
| 5 | The generated Markdown and publish/recovery path reproduce the canonical ledger without destructive cleanup. | ✓ VERIFIED | Strict validation proves the generated view matches the ledger. The focused suite passes all publish rollback, recovery, symlink, staged-file, and journal controls. |
| 6 | All nine operator decisions are resolved only after their live premises and affected findings are terminal. | ✓ VERIFIED | The ledger contains exactly `MF-DEC-01` through `MF-DEC-09`, all with `status: resolved`; strict validation and the dossier tests pass. |
| 7 | The scope crosswalk has one evidence-backed record for every requirement clause and every Phase 2-9 route. | ✓ VERIFIED | The live ledger has 40 unique scope rows: 32 requirement rows and eight route rows. Strict validation proves each links existing findings and valid decisions. |
| 8 | REQUIREMENTS.md and ROADMAP.md contain the evidence-derived scope before Phase 2 planning. | ✓ VERIFIED | The contracts contain 30 active/completed IDs and two evidence-only IDs, preserve Phase 2-9 numbers, and map later-phase membership as 3/5/4/3/3/3/3/2. The recorded Phase 1 rewrite predates Phase 2 planning. |
| 9 | Final requirements and roadmap pass a complete evidence-backed scope-impact round-trip. | ✗ FAILED | The live contract and the named negative cases pass, but independent coordinated drift probes still false-pass. Exact phase titles and exact `keep` versus `narrow/split` actions are not sealed outside the mutable ledger. |
| 10 | The evidence tooling, negative controls, and current review fixes are executable and directly tested. | ✓ VERIFIED | The unrestricted focused suite passes 136/136, the standalone negative runner passes, and direct coverage is 100%: 789/789 branches, 202/202 functions, and 2,657/2,657 lines. The separate repository quality gate regression is listed as a blocking anti-pattern below. |

**Score:** 9/10 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `.planning/phases/01-live-evidence-revalidation/01-CORPUS-ASSIGNMENT.md` | Exact immutable 110-file assignment | ✓ VERIFIED | 110 unique rows across 53 plan owners; sorted path set equals the ledger. |
| `.planning/phases/01-live-evidence-revalidation/shards/01-02.json` through `01-54.json` | Exclusive per-plan evidence shards | ✓ VERIFIED | 53 files exist and all 53 pass their public shard validation command. |
| `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json` | Canonical evidence, decision, and scope ledger | ✓ VERIFIED | Substantive canonical data; strict validation and independent cardinality checks pass. |
| `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.md` | Deterministic generated view | ✓ VERIFIED | Strict validation reports no renderer drift. |
| `.planning/REQUIREMENTS.md` | Evidence-derived requirement contract | ✓ VERIFIED | 32 stable IDs: 30 active/completed and two evidence/history entries. |
| `.planning/ROADMAP.md` | Evidence-derived stable Phase 2-9 routes | ✓ VERIFIED | Phase numbers and sealed requirement memberships match the live checker. |
| `scripts/revalidation.mjs` | Strict fail-closed evidence and planning-contract gate | ✗ PARTIAL | Reads both contracts and closes the original no-op, but accepts coordinated unsealed action/title drift and fails the configured Fallow health gate. |
| `scripts/revalidation.negative.mjs` | Independent planted validator failures | ⚠️ PARTIAL | Current controls pass but omit the two surviving false-pass classes. |
| `tests/architecture/revalidation.test.ts` | Direct public behavioral evidence | ⚠️ PARTIAL | 136 active tests and 100% direct coverage, but no test discriminates the two surviving plausible wrong contracts. |
| `.planning/phases/01-live-evidence-revalidation/01-VALIDATION.md` | Current final command and status map | ⚠️ PARTIAL | Still records the Plan 01-69, 30-test green seal and does not reflect the current Plan 01-70/capped-fix gate failure. |

**Artifacts:** 6/10 fully verified; 4 partial/failed

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Review corpus | `01-CORPUS-ASSIGNMENT.md` | Recursive inventory and byte/path rows | ✓ WIRED | Live command and independent set equality prove all 110 paths. |
| Assignment manifest | 53 shard files | Exact plan ownership | ✓ WIRED | All public shard checks pass. |
| Shards | `01-REVALIDATION.json` | Deterministic merge and strict validation | ✓ WIRED | Canonical ledger validates with all terminal records. |
| Ledger | `01-REVALIDATION.md` | `renderRevalidation` plus drift check | ✓ WIRED | Current bytes pass strict validation. |
| Ledger requirement rows | REQUIREMENTS.md | Fixed-path parse, stable ID, clause signature, route/status, and locator checks | ⚠️ PARTIAL | IDs, prose, active/evidence state, and route/status are sealed; exact `keep` versus `narrow/split` action is not. |
| Ledger route rows | ROADMAP.md | Fixed-path phase parse, sealed membership, and locator checks | ⚠️ PARTIAL | Phase numbers and membership are sealed; a phase title can drift with the mutable ledger afterAnchor. |
| Test/negative harness | Public CLI | Child-process execution against case-owned roots | ✓ WIRED | Whole CLI results are asserted, but the two current false-pass combinations are absent. |

**Wiring:** 5/7 complete; 2/7 partial

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| Assignment | paths and bytes | Live review-corpus enumeration | Yes | ✓ FLOWING |
| Shards | files, claims, findings | Assigned reports plus live evidence | Yes | ✓ FLOWING |
| Canonical ledger | merged evidence graph | 53 validated shards | Yes | ✓ FLOWING |
| Generated Markdown | rendered ledger view | Canonical JSON | Yes | ✓ FLOWING |
| Requirements check | IDs, clauses, dispositions, sections | Canonical ledger plus live REQUIREMENTS.md | Partly | ⚠️ HOLLOW — exact active action is not independently bound |
| Roadmap check | phase IDs, titles, memberships | Canonical ledger plus live ROADMAP.md | Partly | ⚠️ HOLLOW — title is compared only between two mutable inputs |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Exact inventory | `node scripts/revalidation.mjs inventory` | `110 total (45 first-pass, 58 adversarial, 7 control)` | ✓ PASS |
| Strict ledger and generated-view validation | `node scripts/revalidation.mjs validate` | `Revalidation ledger valid.` | ✓ PASS |
| Live planning-contract check | `node scripts/revalidation.mjs scope-impact --check` | `Scope impact valid: 40 records.` | ✓ PASS |
| Ordinary projection | `node scripts/revalidation.mjs scope-impact` | 40 sorted JSON records; independent fixture test uses literal expected bytes | ✓ PASS |
| Focused architecture behavior | `node --test tests/architecture/revalidation.test.ts` | 136 pass, 0 fail/skip/todo when run with required local-process permissions | ✓ PASS |
| Standalone negative witnesses | `node scripts/revalidation.negative.mjs` | `Revalidation negative controls passed.` | ✓ PASS |
| Direct source coverage | `npm run test:coverage:direct -- scripts/revalidation.mjs` | 100% branches/functions/lines | ✓ PASS |
| Coordinated Phase 8 title and route-afterAnchor drift | Disposable root; mutate both inputs; run `scope-impact --check` | Incorrect exit 0 and 40-record success | ✗ FAIL |
| Valid-but-wrong PDEF-01 action drift | Disposable root; change `narrow/split` to `keep`; run `scope-impact --check` | Incorrect exit 0 and 40-record success | ✗ FAIL |
| Repository gate | `npm run check` | Typecheck, ESLint, and dead-code pass; Fallow health exits 1 on complexity 22 | ✗ FAIL |

The first sandboxed focused and direct-coverage runs produced only Node worker-wrapper failures. The identical commands passed with permission for their local child processes and temporary directories. This is an execution-environment restriction, not a product failure.

### Probe Execution

| Probe | Command | Result | Status |
|---|---|---|---|
| Revalidation negative probe | `node scripts/revalidation.negative.mjs` | All planted fixtures reject as expected | PASS |
| Coordinated phase-title probe | Case-owned copied ledger/contracts with Phase 8 title and afterAnchor changed together | Check incorrectly exits 0 | FAILED |
| Exact action probe | Case-owned copied ledger/contracts with PDEF-01 action changed from `narrow/split` to `keep` | Check incorrectly exits 0 | FAILED |

No `scripts/**/tests/probe-*.sh` file is declared for this phase.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| RVAL-01 | 01-01 through 01-57; regression in 01-70 | Inspect the exact 110-file corpus | ✓ SATISFIED | Live 45/58/7 inventory, 110 unique assignment/ledger paths, and 53/53 valid shards. |
| RVAL-02 | 01-01 through 01-57; regression in 01-70 | Complete current-evidence manifest | ✓ SATISFIED | Strict validator, 2,897 unique claims, 2,437 terminal findings, zero inconclusive, and active negative controls. |
| RVAL-03 | 01-58 through 01-66; regression in 01-70 | Resolve nine decisions after premise revalidation | ✓ SATISFIED | Exactly nine resolved stable decision IDs; validator and dossier behavior pass. |
| RVAL-04 | 01-67 through 01-70 | Move unsupported scope to evidence and rewrite planning contracts before later planning | ✗ BLOCKED | Live contracts are coherent, but the promised complete reproducible gate still accepts coordinated action/title drift and the final hard gate is red. |

No Phase 1 requirement is orphaned. RVAL-01 through RVAL-04 appear in plan frontmatter and in the REQUIREMENTS.md traceability table.

### Decision Coverage

| Source | Trackable | Honored | Status |
|---|---:|---:|---|
| `01-CONTEXT.md` | 23 | 23 | ✓ PASS |

`check.decision-coverage-verify` reports: “All trackable CONTEXT.md decisions are honored by shipped artifacts.” This gate is advisory.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|---|---|---:|---:|---:|---|---|
| `tests/architecture/revalidation.test.ts` | RVAL-01..04 | 136 | 0 | 0 | Behavioral, whole structured outcomes | ⚠️ PARTIAL — strong existing cases, but two plausible wrong contracts still pass |
| `scripts/revalidation.negative.mjs` | RVAL-02, RVAL-04 | standalone runner | 0 | 0 | Exact structured outcomes | ⚠️ PARTIAL — independent expectations, incomplete offender set |

**Disabled tests on requirements:** 0  
**Circular patterns detected:** 0 — filesystem writes create case-owned inputs; the ordinary-output oracle is a literal independent expected string.  
**Insufficient assertions:** 0 among existing cases; the problem is missing cases, not weak assertions.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| `scripts/revalidation.mjs` | 1124 | `validateScopeChangeStructure` exceeds the enforced Fallow complexity threshold | 🛑 Blocker | `npm run check` exits 1 after typecheck, lint, and dead-code pass. |
| `scripts/revalidation.mjs` | 2229-2607 | Mutable ledger fields are used as their own title/action authority | 🛑 Blocker | Coordinated semantic drift returns a false success. |
| Phase implementation files | — | No unreferenced TBD/FIXME/XXX debt marker and no disabled test | ℹ️ Info | No separate marker blocker. |
| `.mcp.json` | — | Pre-existing untracked formatting condition | ℹ️ Out of scope | The current aggregate run stops at Fallow before reaching it; scoped formatting for all three Phase 01-70 files passes. |

The post-gap review loop reached its three-fix-pass cap. `01-REVIEW-FIX.md` records all three final review findings as fixed, but workflow policy provides no fourth peer review. This verifier did not accept that report as evidence: it reran the public suite, coverage, negative controls, live commands, and two new disposable-root attacks. Those attacks expose the blocker above.

### Human Verification Required

None. This is repository-local evidence tooling with deterministic public commands. The remaining failures are machine-reproducible and require no visual or external-service judgment.

### Gaps Summary

Two blockers remain after the single closure attempt. The original no-op is fixed, but the planning checker is not a complete independent seal: valid-but-wrong action drift and coordinated phase-title drift still pass. The final hard gate also regressed because the last capped fix pass left one in-scope function above the enforced Fallow threshold. No later roadmap phase explicitly owns these Phase 1 gate repairs, so neither item is deferred.

## Recommended Fix Plan

### 01-71-PLAN.md: Seal Remaining Scope Semantics and Restore the Hard Gate

**Objective:** Make the Phase 1 planning seal independent of every mutable input and restore the configured repository gate.

1. Add immutable expected phase titles and exact actions for all 40 stable scope rows, then reject both coordinated probe classes through the public CLI.
2. Split `validateScopeChangeStructure` below the Fallow threshold without changing diagnostics or coverage.
3. Extend standalone negative controls, rerun direct coverage and the clean tracked repository gate, and refresh `01-VALIDATION.md` with current Plan 01-70/71 results.

## Verification Metadata

**Verification approach:** Goal-backward re-verification with full checks on the prior RVAL-04 gap and regression checks on prior passes  
**Must-haves source:** Previous 01-VERIFICATION.md plus non-reducing ROADMAP criteria and Plan 01-70 contract details  
**Automated checks:** 9 truth-level passes, 2 independent false-pass probes, and 1 configured quality-gate failure  
**Human checks required:** 0  
**Review-loop state:** Three fixer passes consumed; no fourth peer review by workflow design

---

_Verified: 2026-09-06T16:04:42Z_
_Verifier: the agent (gsd-verifier)_
