---
phase: 01-live-evidence-revalidation
reviewed: 2026-09-06T01:29:09Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - scripts/revalidation.mjs
  - scripts/revalidation.negative.mjs
  - tests/architecture/revalidation.test.ts
findings:
  critical: 11
  warning: 1
  info: 0
  total: 12
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-09-06T01:29:09Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

The review found eleven blockers and one warning. The validator accepts several ledgers that violate the declared schema and the locked Phase 1 invariants. The publish path can also write outside the repository or leave the two canonical artifacts inconsistent.

The compiler and project-scoped linter passed. The focused suite passed all 30 cases outside the restricted sandbox. Native direct coverage reached only 81.95% lines, 77.78% branches, and 87.18% functions. `npm run check` stopped on an unrelated, untracked `.mcp.json` formatting failure before it reached the test stage.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Unknown schema modes bypass every live-ledger invariant

**Classification:** BLOCKER
**File:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/scripts/revalidation.mjs:179-263`
**Issue:** `version` is never checked, and all locked live checks are conditional on the exact string `inventoryMode === "live"`. A ledger with `version: 999` and `inventoryMode: "typo"` returned no violations in a probe. A typo or hostile edit can therefore bypass the 110-file, 45/58/7 category, and 2897/2437 evidence requirements.
**Fix:** Define the supported versions and modes before any mode-dependent branch. Reject unknown values, and require `inventoryMode: "live"` when the CLI validates or publishes the canonical ledger.

```javascript
if (ledger.version !== 1) {
  violations.push(violation("invalid-version", "version", String(ledger.version)));
}
if (!new Set(["live", "fixture"]).has(ledger.inventoryMode)) {
  violations.push(
    violation("invalid-inventory-mode", "inventoryMode", String(ledger.inventoryMode)),
  );
}
```

### CR-02: The decision gate accepts missing and contradictory dossiers

**Classification:** BLOCKER
**File:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/scripts/revalidation.mjs:469-559`
**Issue:** The exact nine decision IDs are checked only when `allowPendingDecisions` is enabled, and that check considers only pending records. A synthetic live ledger with all required file and evidence counts but `decisions: []` returned no violations. A resolved decision also passed with a `selectedOption` absent from `options` and a `rejectedOptions` entry absent from `options`. This permits the phase to lose required decisions or record an impossible operator choice.
**Fix:** Require exactly `MF-DEC-01` through `MF-DEC-09` for every live ledger, regardless of status. For each resolved decision, require unique options, require the selection to be one option, and require rejected alternatives to be unique unselected options.

```javascript
const decisionIds = ledger.decisions.map((decision) => decision.id).sort();
if (
  ledger.inventoryMode === "live" &&
  JSON.stringify(decisionIds) !== JSON.stringify(PENDING_DECISION_IDS)
) {
  violations.push(violation("decision-set", "decisions", "expected MF-DEC-01 through MF-DEC-09"));
}
```

### CR-03: Claim-to-finding links do not have to agree in both directions

**Classification:** BLOCKER
**File:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/scripts/revalidation.mjs:265-377`
**Issue:** The validator checks that each claim's `findingId` exists and that each ID in `finding.claimIds` names some claim. It never checks that those two links point back to each other. A finding with `claimIds: []` passed even though a source claim pointed to that finding. A finding can also claim a source claim that points to another finding. This corrupts evidence ownership while validation reports success.
**Fix:** Build the expected claim IDs for each finding from `sourceClaims`, compare the complete sorted arrays, and reject every reverse link whose claim names another finding.

```javascript
const expectedClaimIds = [...claims.values()]
  .filter((claim) => claim.findingId === finding.id)
  .map((claim) => claim.id)
  .sort();
const declaredClaimIds = Array.isArray(finding.claimIds) ? [...finding.claimIds].sort() : [];
if (JSON.stringify(expectedClaimIds) !== JSON.stringify(declaredClaimIds)) {
  violations.push(violation("finding-claim-links", finding.id, "claimIds do not match sourceClaims"));
}
```

### CR-04: A duplicate premise is treated as terminal when its target is inconclusive

**Classification:** BLOCKER
**File:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/scripts/revalidation.mjs:172-174`
**Issue:** `terminalFinding` only checks the immediate record's status. A `duplicate` finding that points to an `inconclusive` canonical finding is treated as terminal. With `allowInconclusive` enabled, a resolved decision using that duplicate premise returned no violations. The operator decision can therefore resolve before its canonical evidence is terminal.
**Fix:** Resolve every duplicate chain to its non-duplicate target. Treat the premise as terminal only when that target exists, the chain is acyclic, and the target status is not `inconclusive`. Use the same resolver in `validateLedger` and `buildDecisionDossier`.

### CR-05: Per-file category and plan provenance are not validated

**Classification:** BLOCKER
**File:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/scripts/revalidation.mjs:316-350`
**Issue:** Live validation checks only category totals, and it never checks `assignedPlan`. The real ledger still returned no violations after a probe swapped the categories of `META-FINDINGS.md` and `architecture-boundary-gates.md`. Any `assignedPlan` value also passes. The CLI handles `validate` before it reads the assignment table, so post-merge tampering cannot be detected.
**Fix:** Pass parsed assignment rows into canonical validation. Compare every file's plan with its assignment row, derive its expected category from the same path rules used by `inventory`, and compare each category rather than only the totals.

### CR-06: Valid Phase 10 through Phase 19 routes are rejected

**Classification:** BLOCKER
**File:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/scripts/revalidation.mjs:168-170`
**Issue:** `/^Phase [2-9]\d*$/` accepts phases whose first digit is 2 through 9. It rejects valid routes such as `Phase 10`, even though the schema permits `Phase N`. The same expression accepts `Phase 20`, which shows that this is a numeric-boundary bug rather than an intentional single-digit limit.
**Fix:** Parse the numeric suffix and require an integer of at least 2.

```javascript
function routeIsValid(route) {
  if (ROUTES.has(route)) {
    return true;
  }
  if (typeof route !== "string") {
    return false;
  }
  const match = /^Phase (\d+)$/.exec(route);
  return match !== null && Number(match[1]) >= 2;
}
```

### CR-07: The redaction check misses JSON-shaped credentials

**Classification:** BLOCKER
**File:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/scripts/revalidation.mjs:38`
**Issue:** `SECRET_PATTERN` expects the sensitive word to be directly followed by `:` or `=`. JSON places a quote between the key and colon. A static-proof observation containing `{"token":"sample-value"}` returned no violations. The path check also recognizes only `/home/`, so other Unix and Windows home paths can enter the committed evidence ledger.
**Fix:** Validate the permitted fields and recursively inspect string content. Detect quoted key/value syntax, authorization headers, and platform-specific absolute home paths. Add negative cases for JSON, shell, header, Windows, macOS, `/root`, and `/home` forms.

### CR-08: Output symlinks can redirect writes outside the repository

**Classification:** BLOCKER
**File:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/scripts/revalidation.mjs:52-83`
**Issue:** `assertSafeRelativePath(..., { mustExist: false })` returns before it resolves either the destination or its parent. Both `render` and `merge-shards` use that mode for writes. In a temporary-root probe, replacing `01-REVALIDATION.md` with a symlink to an outside file made `render` exit successfully and overwrite the outside file. A symlinked parent directory has the same escape.
**Fix:** Resolve the nearest existing parent and require it to remain under the real project root. Reject an existing destination symlink with `lstatSync`, and use a no-follow or directory-handle-based write strategy where the platform supports it.

### CR-09: Publishing can replace JSON and then fail before replacing Markdown

**Classification:** BLOCKER
**File:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/scripts/revalidation.mjs:937-948`
**Issue:** The two calls to `writeAtomically` are individually atomic but not atomic as a pair. A probe made the Markdown destination unwritable. The command failed after it had already replaced the JSON ledger, leaving the old Markdown paired with new JSON. This violates the canonical byte-for-byte relationship and creates a data-loss window during an interrupted publish.
**Fix:** Stage and flush both outputs before changing either destination. Publish under a lock with a transaction journal and rollback backups, or atomically switch a single snapshot pointer that contains both files. Add failure injection after each publish step and assert that both original destination byte sequences remain intact.

### CR-10: Validated ledger fields can inject raw Markdown and HTML

**Classification:** BLOCKER
**File:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/scripts/revalidation.mjs:704-753`
**Issue:** The renderer interpolates file paths, finding IDs, decision IDs, requirement IDs, actions, statuses, and routes without escaping. Most of those fields lack a safe identity grammar. A finding ID containing a closing backtick, newlines, and a raw `<script>` tag passed `validateLedger`, and `renderRevalidation` emitted the tag unchanged. This permits generated-document corruption and cross-site scripting in Markdown consumers that allow raw HTML.
**Fix:** Give every identity and action field a closed grammar. Reject control characters and newlines, then escape Markdown metacharacters and raw HTML before interpolation. Tests must compare the complete rendered bytes for hostile values.

### CR-11: Required negative paths are not covered by reliable tests

**Classification:** BLOCKER
**File:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/tests/architecture/revalidation.test.ts:252-941`
**Also affected:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/scripts/revalidation.negative.mjs:49-50`
**Issue:** Native focused coverage reports 81.95% lines, 77.78% branches, and 87.18% functions for `revalidation.mjs`, below the project's required 100% direct coverage. The direct-coverage command also rejects `scripts/revalidation.mjs` as an unsupported pair. Specific weak cases explain the gap: the test titled “symlink-escaping” never creates a symlink (lines 354-385), the negative script only proves that a string differs after text is appended, and the public merge case computes expected Markdown with the production renderer itself (line 657). Mutations that remove Markdown-drift rejection, omit decision rendering, or permit write-target symlinks can survive.
**Fix:** Register this script/test pair with the direct-coverage gate or add a dedicated equivalent gate. Add independent cases for every uncovered branch, use literal expected bytes, invoke the CLI against actually tampered Markdown, create real read and write symlink escapes, and inject a failure between the two publish steps. Require 100% line, branch, and function coverage for this pair.

## Warnings

### WR-01: Whole-file complexity suppression hides two monolithic control functions

**Classification:** WARNING
**File:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/scripts/revalidation.mjs:14`
**Issue:** The file disables `sonarjs/cognitive-complexity` globally without the project-required reason. `validateLedger` spans lines 179-613, and `main` spans lines 819-966. Fallow reports cognitive complexity 165 and 39 for these functions and names this file as a high-confidence refactoring target. The broad suppression can hide further branching errors in future changes.
**Fix:** Split validation into schema, file, claim, finding, decision, scope, and cross-link passes. Split CLI verbs into small handlers, remove the file-wide disable, and keep only narrowly justified line-level suppressions where a remaining function cannot be simplified.

---

_Reviewed: 2026-09-06T01:29:09Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
