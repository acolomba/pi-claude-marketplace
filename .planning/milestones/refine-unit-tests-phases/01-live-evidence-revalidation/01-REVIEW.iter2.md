---
phase: 01-live-evidence-revalidation
reviewed: 2026-09-06T13:38:35Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - scripts/revalidation.mjs
  - scripts/revalidation.negative.mjs
  - tests/architecture/revalidation.test.ts
findings:
  critical: 5
  warning: 0
  info: 0
  total: 5
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-09-06T13:38:35Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

The current happy-path gates are green: the architecture suite passes 108/108 when its child CLI processes are allowed, the standalone negative runner passes, the live check reports 40 records, and direct coverage reports 100% branches, functions, and lines. Those gates do not expose five fail-open defects in the planning-contract implementation and its compatibility test.

`npm run check` passed typecheck, repository-scoped ESLint, and all Fallow gates before stopping on the pre-existing untracked `.mcp.json` formatting warning. All three reviewed files pass targeted Prettier. A direct `npx eslint . --max-warnings=0` invocation also reaches the tool-owned `.codex/` tree and fails while loading a typed rule there; the repository's scoped lint command passes.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Removing a live traceability row is accepted

**File:** `scripts/revalidation.mjs:1902-1912`
**Issue:** `validateRequirementContracts` iterates only the requirement IDs that remain in `requirements.dispositions`. It never compares that parsed set with the 32 `SCOPE-REQ-*` rows in the ledger. As a result, deleting the `GGAT-02` evidence/history row from REQUIREMENTS.md still exits zero and prints `Scope impact valid: 40 records.` The fixed total at lines 1972-1975 counts ledger rows, so it cannot detect a contract row removed from Markdown. This violates the required exact 32-row round trip and lets requirements disappear silently.
**Fix:** Build the expected requirement-ID set from the ledger's canonical `SCOPE-REQ-*` rows, require exactly 32 unique IDs, and compare it bidirectionally with both parsed definitions/history records and traceability rows. Emit deterministic missing/extra violations before validating each row.

### CR-02: Requirement clause rewrites with the same ID and section are invisible

**File:** `scripts/revalidation.mjs:1790-1826`
**Issue:** `parseRequirementsContract` stores only `requirementId -> section` for a definition. It discards the requirement's clause text. Replacing the PDEF-01 clause with unrelated prose while retaining its ID and section still passes `scope-impact --check`. The checker therefore cannot detect the “structurally drifted requirement clauses” it claims to enforce and does not actually resolve the third component of an `afterAnchor` to live contract content.
**Fix:** Parse a deterministic normalized representation of each complete requirement clause and compare it with an exact, machine-verifiable locator/signature carried by the corresponding scope row. Reject duplicate, truncated, extra, or changed clause bodies instead of treating matching ID and section as sufficient.

### CR-03: Scope-row IDs and `requirementId` fields can contradict each other

**File:** `scripts/revalidation.mjs:1858-1912`
**Issue:** Rows are selected by `change.id`, but neither `validateRequirementChange` nor `validateRequirementContracts` requires `change.requirementId` to equal the ID encoded in that key. Changing `SCOPE-REQ-AUTH-01.requirementId` from `AUTH-01` to `PDEF-01` leaves the command green because validation continues with the map key and the old `afterAnchor`. The same missing invariant applies to route rows. This breaks stable identity enforcement on untrusted ledger data.
**Fix:** Before contract comparison, require every requirement row to satisfy `change.id === 'SCOPE-REQ-' + change.requirementId` and every route row to satisfy both `change.id === 'SCOPE-ROUTE-' + change.requirementId` and `change.requirementId === PHASE-NN`. Reject rows whose key, field, or anchor identity differs.

### CR-04: `beforeAnchor` path confinement is not enforced

**File:** `scripts/revalidation.mjs:935-965`
**Issue:** Generic anchor validation checks only three nonblank parts and a substring match; it does not validate the locator path. More importantly, the `scope-impact --check` path at lines 1992-1997 never calls this validation and only inspects `afterAnchor`. Replacing an AUTH-01 `beforeAnchor` path with `../outside.md` still reports success. The gate therefore accepts traversal-shaped and path-mismatched provenance despite the plan's fail-closed path/anchor contract.
**Fix:** Validate both anchors inside the planning-contract checker. Require fixed normalized repository-relative paths by row kind (`.planning/REQUIREMENTS.md` for requirement rows and `.planning/ROADMAP.md` for route rows), exact stable identity, three nonblank parts, and distinct before/after values. Reuse one strict locator parser so `validateLedger` and `scope-impact --check` cannot drift.

### CR-05: The ordinary-output regression test uses production code as its oracle

**File:** `tests/architecture/revalidation.test.ts:842-855`
**Issue:** The test named “preserves ordinary JSON output” computes its expected bytes by calling `deriveScopeImpact`, the same production function used by `handleScopeImpact`. A regression in sorting, projection fields, or serialization can change both actual and expected values and leave the test green. This is a self-fulfilling assertion and does not protect the promised byte-compatible branch.
**Fix:** Exercise ordinary mode with a short explicit ledger and compare stdout with an independently written complete JSON string (including order, indentation, omitted anchors, and trailing newline), or compare with a reviewed golden file that is not generated by production code.

---

_Reviewed: 2026-09-06T13:38:35Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
