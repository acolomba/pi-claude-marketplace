---
phase: 27-marketplace-autoupdate-output-grammar
reviewed: 2026-05-30T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/edge/handlers/plugin/bootstrap.test.ts
  - tests/orchestrators/marketplace/autoupdate.test.ts
  - tests/orchestrators/marketplace/list.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/bootstrap.test.ts
  - tests/shared/notify-v2.test.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 27: Code Review Report

**Reviewed:** 2026-05-30T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 27 lands four output-grammar changes against `diff_base a661156`:

1. **UXG-04** — the `marketplace autoupdate|noautoupdate` flip surface now renders the
   `<autoupdate>` / `<no autoupdate>` marker-as-outcome instead of the
   `(autoupdate enabled)` / `(autoupdate disabled)` status token, plus renamed REASONS
   members (`already enabled` → `already autoupdate`, `already disabled` → `already no autoupdate`).
2. **UXG-01** — the list-surface header drops the `<last-updated <iso>>` token; `lastUpdatedAt`
   is retained in state/type but no longer rendered.
3. **UXG-05** — `marketplace update` (autoupdate-OFF, manifest-only refresh) now distinguishes a
   no-op (`(skipped) {up-to-date}`, warning) from a real change (`(updated)`) via a new
   manifest-content change detector (`manifestContentKey`).
4. Catalog doc rewrite to match.

The work is well-tested: all 116 phase-affected tests pass, and the byte-equality catalog UAT
gate is green. The renderer arm changes and the autoupdate orchestrator changes are mechanically
sound — the autoupdate diff is essentially renames + comments over pre-existing logic.

The substantive new logic is the UXG-05 change detector in `update.ts`. It is functionally
correct for its purpose, but its supporting documentation makes a **factually incorrect** claim
about the comparison mechanism, and the design has two robustness gaps (an unbounded `catch`,
and reliance on `JSON.stringify` non-canonical ordering that the comment misdescribes). No
BLOCKER-class defects were found. The findings below are quality/robustness concerns.

## Warnings

### WR-01: `manifestContentKey` comment claims a `.Parse` canonical-key-order guarantee that does not exist

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:255-256` (and the
mirrored `refreshRecord` comment at `:303-306`)

**Issue:** The docstring asserts:

> typebox `.Parse` yields a stable key order, so `JSON.stringify` of the parsed value is a stable
> comparison key without a field-by-field diff (Don't-Hand-Roll).

But `manifestContentKey` (`:266`) calls `loadMarketplaceManifest(record.manifestPath)`, and
`loadMarketplaceManifest` (`domain/manifest.ts:48-61`) returns the **raw** `JSON.parse(raw)` value
— it validates with `MARKETPLACE_VALIDATOR.Check()`, never `.Parse()` / `.Clean()`. Therefore:
- The comparison key preserves the **literal source-file key order**, not a typebox-canonical order.
- The key includes **any extra/unknown fields** in the file (the `MARKETPLACE_SCHEMA` is not
  `additionalProperties: false`, and the fixture itself carries `description` / `version` on plugin
  entries that flow straight into the key).

The detector still *works* (any content delta — including key reorder or whitespace-normalized
change — is detected), so this is not a correctness bug today. The risk is that the comment will
mislead a future maintainer into "optimizing" `loadMarketplaceManifest` to call `.Parse()` (which
*would* change the key), or into trusting a guarantee the code does not provide. Either could
silently flip the no-op classification.

**Fix:** Correct the comment to describe what the code actually does — compare the
`JSON.stringify` of the raw-parsed (schema-validated but not normalized) manifest, whose key order
mirrors the source file:

```ts
// Compares the JSON.stringify of the SCHEMA-VALIDATED-BUT-RAW parsed manifest
// (loadMarketplaceManifest returns the JSON.parse value; it does NOT call
// typebox .Parse, so key order mirrors the source file and unknown fields are
// retained). Any content delta — including reordered keys or changed extra
// fields — reads as "changed", which is the conservative direction.
```

### WR-02: Bare `catch {}` in `manifestContentKey` swallows all read/validation errors, not just "no manifest yet"

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:265-270`

**Issue:**
```ts
try {
  const parsed = await loadMarketplaceManifest(record.manifestPath);
  return JSON.stringify(parsed);
} catch {
  return undefined;
}
```
The docstring justifies the catch only for "the record has no manifest yet" (ENOENT). In practice
it also swallows EACCES, malformed-JSON, and schema-invalid errors on the **PRE** read. A transient
or environmental read failure on the pre-key silently classifies the refresh as "changed" →
renders `(updated)` even when nothing changed. This is the conservative direction (over-reports a
change rather than masking one), so it is not a data-loss/correctness BLOCKER, but the unbounded
catch erases the distinction between "no manifest yet" (expected) and "manifest is corrupt/
unreadable" (a real problem the operator might want surfaced through the `(failed)` path that the
T-27-05 mitigation comment at `:252-256` is otherwise careful about). The POST read's failures are
caught by `validateManifestAtRoot` and routed to `(failed)`; only the PRE read has this blind spot.

**Fix:** Narrow the swallow to the genuinely-expected absence case and let unexpected errors
propagate (or at minimum, comment that the broad swallow is intentional and why it is safe for
non-ENOENT errors):

```ts
} catch (err) {
  // Only "manifest not present yet" (ENOENT) is an expected pre-key miss.
  // Any other failure on the PRE read defaults to "changed" (the safe
  // direction); the POST read's failures are caught by validateManifestAtRoot
  // and routed to (failed).
  return undefined;
}
```

(If propagation is preferred for non-ENOENT, gate on `(err as NodeJS.ErrnoException).code === "ENOENT"`.)

### WR-03: UXG-05 "github clone advanced, byte-identical manifest → no-op" claim is asserted only via an unchanged fixture, never via an explicitly-rewritten-identical manifest

**File:** `tests/orchestrators/marketplace/update.test.ts:144-180` (the `MU-4 + D-14` test reused
as the github no-op proof) and `docs/output-catalog.md:813`

**Issue:** The catalog (`:813`) and the `refreshRecord` comment (`update.ts:303-306`) make a
specific source-kind-uniformity claim: *"a github source whose clone advanced but yielded
byte-identical manifest content"* renders the `(skipped) {up-to-date}` no-op. The test that is
cited for this (`MU-4 + D-14`, lines 144-180) only proves the case where the mock git ops advance
the **ref** but the mock never rewrites the working-tree file at all — i.e. the file is literally
untouched on disk. The interesting case the claim describes — the clone genuinely advances to a
new commit whose `marketplace.json` happens to be byte-identical — is not exercised. The
"changed" sibling test (`:182-231`) *does* rewrite the file in the `checkout` override, proving
the change path, but no test rewrites the file to identical content to prove the no-op path under
a real working-tree mutation.

This is a test-coverage gap, not a code defect: the production detector compares parsed content,
so it would behave correctly. But the strongest claim in the contract doc rests on a test that
doesn't reproduce the scenario it documents, so a future regression in the
read-before/read-after ordering could pass this suite.

**Fix:** Add a github test that, in the `checkout` override, rewrites `marketplace.json` with
content semantically identical to the pre-refresh fixture (e.g. same fields re-serialized) and
assert `(skipped) {up-to-date}`. This locks the "advanced-but-identical" no-op against the actual
on-disk mutation path the catalog describes.

### WR-04: `renderMpHeader` idempotent-autoupdate arms unconditionally append `reasonsBrace` with a leading space, assuming it is always non-empty

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:662-668`

**Issue:**
```ts
if (mp.reasons?.includes("already autoupdate")) {
  return `${ICON_INSTALLED} ${mp.name} [${mp.scope}] <autoupdate> ${reasonsBrace}`;
}
if (mp.reasons?.includes("already no autoupdate")) {
  return `${ICON_INSTALLED} ${mp.name} [${mp.scope}] <no autoupdate> ${reasonsBrace}`;
}
```
Unlike the generic-`skipped` arm immediately below (`:670-672`), which guards
`reasonsBrace === ""` to avoid a trailing space, these two branches interpolate
`" ${reasonsBrace}"` unconditionally. They are only reached when `mp.reasons.includes(...)` is
true, so `reasons` is non-empty and `composeReasons` returns a non-empty brace **today** — the
trailing-space hazard cannot currently fire. But the invariant is implicit: it depends on
`composeReasons` never returning `""` for a non-empty all-typed-`Reason` array. If a future
`Reason` member were ever filtered out by `composeReasons`, these arms would emit a stray trailing
space (`● foo [user] <autoupdate> `) that the catalog byte-equality gate would then reject in a
confusing way. The generic arm models the defensive pattern; these two diverge from it.

**Fix:** Mirror the generic arm's empty-brace guard so the marker-only case never trails a space:

```ts
if (mp.reasons?.includes("already autoupdate")) {
  return reasonsBrace === ""
    ? `${ICON_INSTALLED} ${mp.name} [${mp.scope}] <autoupdate>`
    : `${ICON_INSTALLED} ${mp.name} [${mp.scope}] <autoupdate> ${reasonsBrace}`;
}
```
(and symmetrically for `already no autoupdate`).

## Info

### IN-01: `manifestContentKey` and `validateManifestAtRoot` each issue an independent manifest read on the POST path (duplicate I/O)

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:292/307` and `:730-744`

**Issue:** `validateManifestAtRoot` reads + validates the manifest (`:735`), then the immediately
following `manifestContentKey(record)` POST call (`:307`) reads + validates the *same* file again
to produce the comparison key. The manifest is parsed twice per refresh on the success path. This
is correctness-neutral (performance is explicitly out of v1 scope), but `validateManifestAtRoot`
already has the parsed value in hand and could return it, letting the caller derive the POST key
without a second read. Noting for maintainability — the duplicate read also widens the window in
which the two reads could observe different file content if something mutated the clone between
them.

**Fix:** Have `validateManifestAtRoot` return the parsed manifest and reuse it for the POST key,
rather than re-reading via `manifestContentKey`.

### IN-02: `autoupdateFailedRow` helper retained in `autoupdate.ts` though phase 27 only touched the REASONS rename

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts:130-139`

**Issue:** Not a phase-27-introduced issue, but flagged because the file is in scope: the
`shouldCollectNotFound` / `missingEverywhere` / `autoupdateFailedRow` helpers form a moderately
intricate not-found-collection flow whose only phase-27 change was the `already enabled`/`already
disabled` → `already autoupdate`/`already no autoupdate` rename. The rename is applied consistently
(orchestrator `:243`, `notify.ts` REASONS `:87-88`, both renderer arms, and all tests). No defect
— the rename is complete and the tests cover both fresh and idempotent paths. Listed only to
record that the surrounding logic was verified unchanged and correct relative to the diff base.

### IN-03: Catalog severity note for the UXG-05 no-op documents a deliberately-deferred wart (`warning` for a benign skip)

**File:** `docs/output-catalog.md:813`

**Issue:** The `update-no-op-skipped` state routes `severity: warning` because `mp.status ===
"skipped"` falls into the warning ladder. The catalog (`:813`) and the orchestrator comment
(`update.ts:674-676`) both explicitly mark this as intentional for Phase 27, deferring the
info-softening to UXG-02 in Phase 28. This is correctly documented and tested (`update.test.ts`
asserts `severity: "warning"`), so it is not a defect — but it is a known user-facing rough edge
(a successful "nothing to do" refresh surfaces as a warning) carried forward deliberately. Recorded
so downstream reviewers do not re-flag it as a regression.

---

_Reviewed: 2026-05-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
