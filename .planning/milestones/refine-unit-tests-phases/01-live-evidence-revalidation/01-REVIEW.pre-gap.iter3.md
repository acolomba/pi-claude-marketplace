---
phase: 01-live-evidence-revalidation
reviewed: 2026-09-06T02:20:53Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - scripts/revalidation.mjs
  - scripts/revalidation.negative.mjs
  - tests/architecture/revalidation.test.ts
findings:
  critical: 6
  warning: 1
  info: 0
  total: 7
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-09-06T02:20:53Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

The first fix pass closes the twelve previously reported findings, but the current implementation still has six blocking correctness or security defects and one test-robustness warning. In executable probes, a crafted recovery journal deleted an unrelated repository file, a shard-directory symlink was read from outside the repository, cross-plan evidence ownership passed both shard and merged-ledger validation, and structurally incomplete evidence, scope, and decision records returned no violations. The standalone negative gate still contains a vacuous Markdown assertion.

The focused suite passed all 60 cases outside the restricted sandbox, and direct coverage reached 100% lines, branches, and functions. `npx tsc --noEmit`, repository-scoped ESLint, exact-file Prettier, the canonical ledger validator, and the standalone negative script passed. The full `npm run check` reached formatting and stopped only on the pre-existing untracked `.mcp.json`; that external failure is not counted as an in-scope defect.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: A crafted recovery journal can delete arbitrary repository files

**Classification:** BLOCKER
**File:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/scripts/revalidation.mjs:1237-1285`
**Issue:** `recoverPublish` trusts every `status`, `destination`, `staged`, `backup`, and `hadDestination` value parsed from `.publish-journal.json`. `rollbackPublish` and `finishPublish` then unlink or rename those repository-relative paths without proving that they describe this command's two canonical outputs and transaction suffix. A probe supplied a `staged` journal whose `destination` was `victim.txt` and `hadDestination` was false; the next `publishRevalidation` call deleted `victim.txt` and continued successfully. Because the journal is repository text and is not ignored, this is a data-loss path across the plan's declared untrusted-JSON boundary.
**Fix:** Validate the complete journal before any mutation. Require `status` to be exactly `staged` or `published`; require exactly the JSON and Markdown destination records; require stage and backup names to be derived from those destinations and one shared, closed-grammar transaction ID; require boolean `hadDestination`; reject duplicates and every unexpected field or path. On any validation failure, abort without unlinking or renaming anything.

### CR-02: Shard enumeration follows member symlinks outside the repository

**Classification:** BLOCKER
**File:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/scripts/revalidation.mjs:1439-1445`
**Issue:** `readShards` containment-checks only the shard directory. It then reads every name ending in `.json` with `readFileSync(path.join(absoluteRoot, name))`, which follows a member symlink. A probe placed `shards/01-02.json` as a symlink to JSON outside the project root; `merge-shards --check` read it and reported `Shard merge valid.` This bypasses the same symlink-escape rule enforced for ledger, assignment, and corpus paths.
**Fix:** Enumerate shard entries as `Dirent` values and reject anything that is not a regular file, including symlinks. Resolve each repository-relative member through `assertSafeRelativePath(..., { mustExist: true })` immediately before reading it, and add a real outside-root shard symlink negative case.

### CR-03: Shards can smuggle evidence owned by another plan

**Classification:** BLOCKER
**File:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/scripts/revalidation.mjs:955-1013`
**Issue:** `validateShard` verifies only the shard's `files` array and each file's `assignedPlan`. It never verifies that `sourceClaims` refer only to those files or that `findings` are exactly the findings reachable from those claims. A probe put plan 01-03's claim and finding in plan 01-02's shard, left only the claiming file in 01-03's shard, and then observed zero violations from both shard validators and the merged ledger. This defeats the required plan-owned shard isolation and makes review provenance untrustworthy.
**Fix:** Build the shard's assigned-path set, reject every claim whose `filePath` is outside it, require each shard file's `claimIds` to match the shard-local claims, and require shard findings to be exactly the findings referenced by those claims (with an explicit rule for duplicate targets if cross-shard duplicates are allowed). Test the misplaced-claim and misplaced-finding cases before merge.

### CR-04: Structurally empty records can satisfy completion validation

**Classification:** BLOCKER
**File:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/scripts/revalidation.mjs:508,597-637,882-893`
**Issue:** Several required fields are checked only by fallback or primitive type. A zero-claim file with `claimIds: ""` is normalized to an empty array and passes. Behavioral evidence with `command: ""` and `observed: ""` passes because both are strings. A scope change with `rationale: ""` also passes. Executable probes for all three inputs returned an empty violation list, allowing malformed structure and evidence-free completion in the strict ledger.
**Fix:** Validate every record's collection fields with `Array.isArray` before comparison. Require method-specific evidence strings and scope rationale to be non-empty after trimming, validate the exit-code domain, and emit dedicated structural violations instead of silently normalizing invalid types.

### CR-05: Resolved decisions allow blank and undisposed options

**Classification:** BLOCKER
**File:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/scripts/revalidation.mjs:704-785`
**Issue:** Decision validation checks array presence, uniqueness, and membership but not option element shape or complete disposition. A resolved decision with `options: ["remove", ""]`, `selectedOption: "remove"`, and `rejectedOptions: [""]` returned no violations. So did a three-option decision that selected one option, rejected only one, and silently omitted the third. These records do not contain meaningful options and rejected alternatives as required by the decision dossier contract.
**Fix:** Require every option and rejected option to be a non-empty string, then compare `rejectedOptions` as an exact set against every option except `selectedOption`. Reject missing, extra, duplicated, blank, and non-string alternatives with deterministic violations.

### CR-06: The standalone Markdown negative control is vacuous

**Classification:** BLOCKER
**File:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/scripts/revalidation.negative.mjs:49-50`
**Issue:** `assert.notStrictEqual(`${canonical}tampered\n`, canonical)` proves only that appending text changes a JavaScript string. It never writes tampered Markdown, invokes `validate` or `main`, or asserts a `markdown-drift` violation. An implementation that entirely removes Markdown-drift detection still passes this required negative gate. The 100% coverage suite also lacks the crafted-journal, shard-member-symlink, cross-plan shard-evidence, and empty-required-field cases above, demonstrating that path coverage is not semantic coverage.
**Fix:** Build a complete temporary CLI fixture, write canonical JSON and deliberately tampered Markdown, invoke the public CLI boundary, and assert the exact nonzero result and `markdown-drift` violation. Add independent planted-invalid cases for CR-01 through CR-05 and require each to fail for the named reason.

## Warnings

### WR-01: The CLI test helper discards child-process launch errors

**Classification:** WARNING
**File:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/tests/architecture/revalidation.test.ts:237-248`
**Issue:** `runCli` returns only `status`, `stdout`, and `stderr` from `spawnSync` and ignores `execution.error` and `execution.signal`. In the restricted runner, child launch returned `EPERM` with empty streams; the suite reported thirteen misleading CLI assertion failures rather than the launch error. On runtimes where `spawnSync` supplies a status alongside an error, a status-only assertion can also misclassify a command that never ran.
**Fix:** Throw `execution.error` immediately, fail explicitly on a non-null signal, and only then return the completed child's status and streams. This keeps infrastructure failures distinct from product behavior.

---

_Reviewed: 2026-09-06T02:20:53Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
