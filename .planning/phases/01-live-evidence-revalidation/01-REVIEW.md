---
phase: 01-live-evidence-revalidation
reviewed: 2026-09-06T02:50:52Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - scripts/revalidation.mjs
  - scripts/revalidation.negative.mjs
  - tests/architecture/revalidation.test.ts
findings:
  critical: 3
  warning: 1
  info: 0
  total: 4
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-09-06T02:50:52Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

The second fix pass closes its seven reported findings, but the current implementation still has three blocking correctness or test-reliability defects. A validly shaped but false recovery journal can delete both canonical artifacts before a replacement publish begins. Non-object records in several JSON collections also crash the validator instead of producing structural violations. Three filesystem cleanup tests do not observe the cleanup named in their titles, so regressions can retain 100% direct coverage.

The focused suite passed all 68 cases, and direct coverage reached 100% lines, branches, and functions. TypeScript compilation, exact-file ESLint, exact-file Prettier, and the standalone negative controls passed. The full `npm run check` failed on an in-scope fallow health violation: `validateShard` has cognitive complexity 16. The pre-existing untracked `.mcp.json` formatting issue was not reached and is not counted.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: A false destination-state flag can delete both canonical artifacts

**Classification:** BLOCKER
**File:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/scripts/revalidation.mjs:1401-1468`
**Issue:** `validatePublishJournal` requires `hadDestination` to be a boolean but never proves that it agrees with the filesystem state. `rollbackPublish` treats `false` as authority to unlink the canonical destination whenever no backup exists. An executable probe supplied an otherwise valid `staged` journal for the exact JSON and Markdown destinations, set both flags to `false`, and injected a failure at the first stage of the replacement publish. Recovery deleted both existing canonical files before that injected failure, leaving both paths missing. The closed path grammar prevents deletion of arbitrary files, but it does not protect the two authoritative Phase 1 artifacts from an untrusted or corrupted journal.
**Fix:** Derive recovery actions from the observed destination, stage, and backup states before mutating any path. Reject every ambiguous or impossible state without changing files; do not unlink an existing destination merely because `hadDestination` is `false`. Add a regression that writes existing canonical bytes, plants this exact journal, fails the next publish immediately after recovery, and compares both complete destination byte sequences.

### CR-02: Non-object collection records crash both validators

**Classification:** BLOCKER
**File:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/scripts/revalidation.mjs:357-438`
**Also affected:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/scripts/revalidation.mjs:534-537,883-985,1021-1080`
**Issue:** The top-level array guard does not validate each record before later passes dereference it. Executable probes with `files: [null]`, `decisions: [null]`, or `scopeChanges: [null]` each threw `TypeError: Cannot read properties of null`; a shard with `files: [null]` failed the same way. Claims and findings already handle non-object records as structural violations, so the remaining collections expose inconsistent behavior at the untrusted-JSON boundary and prevent callers from receiving the promised violation list.
**Fix:** Validate and collect file, decision, scope-change, and shard-file records before reading any property. Emit a dedicated structural violation and skip the malformed record, as `collectClaims` and `collectFindings` already do. Add cases for `null`, arrays, strings, and numbers in every record collection, and assert the exact violation records without an unexpected throw.

### CR-03: Filesystem cleanup tests do not observe the promised cleanup

**Classification:** BLOCKER
**File:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/tests/architecture/revalidation.test.ts:1743-1772`
**Also affected:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/tests/architecture/revalidation.test.ts:1862-1917`
**Issue:** The staging-failure case asserts only that the injected error is thrown; it never checks that the first staged file was removed. The atomic-journal case never checks that its `.tmp-*` file disappeared. The recovery and rollback cases likewise assert final destination bytes or `AggregateError` without asserting removal or retention of the journal, stage, and backup artifacts named in their titles. Implementations that delete `finishPublish`, leave the atomic temporary file, or remove the recovery journal after rollback failure still satisfy these cases. The direct coverage gate remains at 100% because it measures execution, not these missing postconditions.
**Fix:** After each failure or recovery, enumerate the phase directory and compare the complete artifact set. Assert that stage, backup, lock, and journal files are absent after successful cleanup, and assert that the journal remains after rollback failure. Keep each failure point in its own test so one earlier assertion cannot hide a later cleanup contract.

## Warnings

### WR-01: The repository gate rejects `validateShard` complexity

**Classification:** WARNING
**File:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/scripts/revalidation.mjs:1021-1101`
**Issue:** `npm run check` fails in `fallow health --fail-on-issues`: `validateShard` spans 81 lines and has cognitive complexity 16, above the configured threshold. The second fix pass added several independent ownership and link checks to this one function, so the repository cannot pass its required quality gate even though compilation, linting, formatting, and focused tests pass.
**Fix:** Extract focused helpers for assignment and owner checks, file-to-claim links, and claim-to-finding links. Keep `validateShard` as a short coordinator that appends each helper's violations, then rerun the full repository gate.

---

_Reviewed: 2026-09-06T02:50:52Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
