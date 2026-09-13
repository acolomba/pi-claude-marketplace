---
phase: 01-live-evidence-revalidation
reviewed: 2026-09-06T15:32:04Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - scripts/revalidation.mjs
  - scripts/revalidation.negative.mjs
  - tests/architecture/revalidation.test.ts
findings:
  critical: 3
  warning: 0
  info: 0
  total: 3
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-09-06T15:32:04Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

All three fresh adversarial candidates reproduced as public-check false passes. The current suite is green—131/131 architecture cases, standalone negative controls, live ledger, live 40-record scope check, typecheck, scoped ESLint/Prettier, and 100% direct branch/function/line coverage—but it does not discriminate these failures. The aggregate format check still stops only on the unrelated pre-existing `.mcp.json` warning.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: The exact 32 stable requirement identities are derived from the untrusted ledger

**File:** `scripts/revalidation.mjs:2314-2340`
**Issue:** `validateRequirementSets` enforces a count of 32, then constructs `expectedIds` from the submitted `SCOPE-REQ-*` row keys themselves. It never compares those keys with the milestone's closed stable-ID set. In a case-owned fixture, renaming `AUTH-01` to `EVIL-99` consistently in the ledger row/key/anchors, requirement definition and traceability row, and Phase 4 declaration returned status 0 with `Scope impact valid: 40 records.` The clause signature did not help because it signs only the clause body, not its stable identity. This violates the plan's exact-32-ID and anti-spoofing contracts.
**Fix:** Define or derive an independent closed set of the 32 stable IDs from sealed evidence, compare the ledger requirement-row keys and `requirementId` values against that set before parsing the documents, and bind each signature to the stable ID as well as its clause. Add a public-CLI control that performs a coordinated rename across all three inputs and requires a deterministic stable-ID violation.

### CR-02: Requirement-to-phase routing is compared only between two mutable documents

**File:** `scripts/revalidation.mjs:2156-2207,2356-2389`
**Issue:** The requirement validator checks only broad route grammar/status, while the phase validator derives each expected membership from the same REQUIREMENTS.md dispositions it is meant to verify. Neither is bound to the evidence-backed ledger row. Two independent case-owned mutations returned status 0 and the 40-record success message: moving `PDEF-01` from Phase 3 to Phase 4 in both REQUIREMENTS.md and ROADMAP.md, and changing `GGAT-02` from `formerly Phase 7` to `formerly Phase 8`. The two planning contracts can therefore drift together while the canonical evidence crosswalk remains unchanged.
**Fix:** Persist the exact route/status for every requirement row and the exact member set for every phase route in the canonical crosswalk (or in signatures over those values). Validate each document independently against that ledger-backed expectation, then perform the cross-document consistency check. Add public-CLI controls for coordinated active reassignment and evidence-history former-phase drift.

### CR-03: A four-space-indented fence marker is incorrectly treated as a closing fence

**File:** `scripts/revalidation.mjs:1947-1968`
**Issue:** `closesFence` calls `trim()`, so it accepts closing markers with any indentation. CommonMark permits at most three leading spaces on a closing fence; a four-space marker remains code content. A case-owned fixture removed the live `AUTH-01` traceability row and placed the same row after a four-space-indented pseudo-closer inside a fenced block. The parser exposed the hidden row and `scope-impact --check` returned status 0 with 40 valid records even though rendered Markdown still treats the row as code.
**Fix:** Parse closing fences with the same 0-3-leading-space bound as opening fences, require only the matching marker at least as wide as the opener plus optional trailing spaces, and do not `trim()` arbitrary indentation. Add a public-CLI control with an indented pseudo-closer and a hidden requirement row.

---

_Reviewed: 2026-09-06T15:32:04Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
