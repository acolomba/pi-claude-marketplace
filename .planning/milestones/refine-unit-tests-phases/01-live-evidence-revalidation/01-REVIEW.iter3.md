---
phase: 01-live-evidence-revalidation
reviewed: 2026-09-06T15:00:30Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - scripts/revalidation.mjs
  - scripts/revalidation.negative.mjs
  - tests/architecture/revalidation.test.ts
findings:
  critical: 6
  warning: 0
  info: 0
  total: 6
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-09-06T15:00:30Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

The iteration-1 fixes are present, and the existing gates are green: the architecture suite passes 116/116 when its CLI subprocesses are allowed, the standalone negative runner passes, the live ledger and 40-record scope checks pass, targeted typecheck/lint/Prettier pass, and direct coverage reports 100% branches, functions, and lines. The ordinary-output oracle is now independent, contradictory row identities are rejected, and both anchor paths are confined.

Fresh planted controls nevertheless found six independent fail-open paths. Each one returns status 0 and `Scope impact valid: 40 records.` for a contract or ledger that violates the advertised scope round trip. Two are residual bypasses of the previous exact-row and full-clause fixes; four concern structural states that the current tests do not exercise.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Commented-out Markdown still counts as a live contract

**File:** `scripts/revalidation.mjs:1878-1979`
**Issue:** All three parsers scan raw lines with regular expressions and do not track HTML comments or fenced code blocks. Moving the exact `AUTH-01` traceability row inside `<!-- ... -->` still leaves it in `requirements.dispositions`; likewise, wrapping the complete PDEF-01 definition in an HTML comment still satisfies both the location and signature parsers. In both probes `scope-impact --check` returned the 40-record success result even though the rendered Markdown no longer contains a live row or definition. This is a direct residual bypass of exact live-row validation and also affects roadmap phase parsing.
**Fix:** Tokenize the two Markdown contracts into visible block structure before extracting headings, list items, and table rows. At minimum, use one shared state machine that excludes HTML comments and fenced code blocks, then run every requirement, signature, disposition, and phase parser over only visible tokens. Add public-CLI controls that comment out or fence an otherwise byte-identical definition, traceability row, phase heading, and requirements declaration.

### CR-02: A blank requirement clause bypasses its signature

**File:** `scripts/revalidation.mjs:1961-1974,2039-2048`
**Issue:** The location parser accepts `- [ ] **PDEF-01**:` with no clause text, but `definitionPattern` requires a space and captured body after the colon. The signature map therefore has no PDEF-01 entry. `validateRequirementChange` compares signatures only when `clauseSignature !== undefined`, so the missing signature is treated as success. Replacing the complete PDEF-01 clause with that empty bullet still exits zero and reports 40 valid records. The full-clause binding remains fail-open for truncation to an empty clause.
**Fix:** Make clause parsing produce one explicit result per located definition/history record and reject a missing or blank normalized body. In validation, treat `clauseSignature === undefined` as a `missing-requirement-clause` violation; only compare hashes after the required clause exists. Add empty active and empty evidence/history clause controls through the public CLI.

### CR-03: Evidence-only IDs can simultaneously become active definitions

**File:** `scripts/revalidation.mjs:2007-2037,2065-2123`
**Issue:** `validateRequiredRequirementRows` checks only the location selected by the ledger action: a `move-to-evidence` row must exist in `history`, but it is never forbidden from also existing in `definitions`. The later union at line 2111 erases that overlap. Adding a new active `GGAT-02` requirement bullet while retaining its evidence/history record and traceability disposition still passes. Because the historical signature overwrites the active signature in the combined map, even unrelated new active prose is invisible. This silently re-authorizes work that D-19/D-21 moved out of active scope.
**Fix:** Require the active-definition and evidence/history ID sets to be disjoint. For every row, enforce exactly one location: `move-to-evidence` must have history and no active definition; every other action must have an active definition and no evidence/history record. Keep signatures keyed by location until this partition check completes so one record cannot overwrite the other.

### CR-04: Check mode accepts structurally invalid ledger actions

**File:** `scripts/revalidation.mjs:2010-2013,2172-2196`
**Issue:** `scope-impact --check` does not run the scope-row schema checks used by `validateLedger`. Its planning pass validates row identity and anchors but never checks `SCOPE_ACTIONS`. Changing PDEF-01's action from `keep` to `invent` still succeeds because every action other than `move-to-evidence` is treated as an active requirement. The plan's threat model explicitly treats the canonical ledger as untrusted structured input, so a malformed action cannot be assumed to have passed a separate command first.
**Fix:** Reuse a single structural scope-row validator in both `validateLedger` and `validatePlanningContracts`. Before interpreting an action, require a known row kind, exact key/field identity, an action in `SCOPE_ACTIONS`, the required signature on requirement rows, and valid anchors. Add one public check-mode offender for each invalid structural field rather than relying on a prior `validate` invocation.

### CR-05: Traceability routes outside the phase grammar are ignored

**File:** `scripts/revalidation.mjs:1916-1929,2015-2037,2150-2158`
**Issue:** Requirement dispositions are parsed as arbitrary strings. Phase 2-9 routes participate in roadmap membership comparison, but Phase 1 routes and evidence/history route labels receive no validation; `validateRequirementChange` looks only at whether status equals `Evidence only`. Changing `RVAL-01` from `Phase 1` to `Nowhere` while leaving its status and clause intact still reports 40 valid records. The checker therefore does not round-trip the complete traceability table and can silently detach current-phase requirements from their declared route.
**Fix:** Validate every traceability route against a closed grammar and its expected row disposition. Parse Phase 1 as well as Phase 2-9 membership, or otherwise require the four RVAL rows to retain `Phase 1`; require moved rows to use the canonical evidence/history route and active rows to map to exactly one numbered phase. Plant an arbitrary-route control for both an active and evidence-only row.

### CR-06: Duplicate roadmap requirement declarations are accepted

**File:** `scripts/revalidation.mjs:1994-2001`
**Issue:** Each roadmap phase body uses `body.match`, so only the first `**Requirements:**` declaration is considered. Adding a second conflicting declaration under Phase 7 leaves the first correct declaration in place and the checker returns success. The resulting planning contract has two contradictory active-requirement sets, but the gate reports it as unambiguous and valid.
**Fix:** Collect all requirements declarations within each visible phase body and require exactly one. Emit deterministic missing and duplicate declaration violations before comparing its normalized, duplicate-free member set with traceability. Add a public-CLI case with one correct and one conflicting declaration in the same phase.

---

_Reviewed: 2026-09-06T15:00:30Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
