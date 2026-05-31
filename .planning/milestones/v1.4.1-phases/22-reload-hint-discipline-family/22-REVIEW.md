---
phase: 22-reload-hint-discipline-family
reviewed: 2026-05-28T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/edge/handlers/plugin/bootstrap.test.ts
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/marketplace/autoupdate.test.ts
  - tests/orchestrators/marketplace/remove.test.ts
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

# Phase 22: Code Review Report

**Reviewed:** 2026-05-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

This phase ("reload-hint discipline") narrows `shouldEmitReloadHint()` in
`shared/notify.ts` to be **plugin-row-driven only** (the four state-change tokens
`installed | updated | reinstalled | uninstalled`), removing the prior
marketplace-status arm (`added`/`removed`/`updated`/autoupdate flips). The
matching change in `orchestrators/marketplace/remove.ts` makes both the clean and
partial branches emit one `PluginUninstalledMessage` per unstaged plugin so that a
non-empty `marketplace remove` still surfaces a `/reload` trailer through the
`uninstalled` token, while an empty remove stays header-only. The catalog and the
unit/UAT suites were updated to match.

The core runtime logic is correct: I traced `shouldEmitReloadHint`,
`computeSeverity`, the `renderPluginRow` switch (including the `present` arm), and
the remove orchestrator's single-pass cascade + post-state cleanup, and found no
behavioral defects. The reload-hint semantics, severity routing, and orphan-fold
bracket handling all agree with the catalog and the per-status unit tests.

The findings below are correctness-of-documentation and contract-fidelity issues,
not runtime crashes. The most material one (WR-01) is a genuine
catalog-vs-implementation divergence in the `marketplace remove` **partial** state
that no test catches because the UAT drives a hand-built fixture instead of the
orchestrator's real output.

## Warnings

### WR-01: Catalog `marketplace remove` partial state documents a version the orchestrator never emits

**File:** `docs/output-catalog.md:763` (and orchestrator `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:308-314`)
**Issue:** The phase updated the **clean** remove state to a name-only row and added
the explicit rationale at `docs/output-catalog.md:755`: *"The name-only row has no
`v<version>` token because the `successfullyUnstaged` accumulator is a `string[]`
of plugin names."* The orchestrator honors this in **both** branches -- the partial
branch (`remove.ts:308-314`) maps `successfullyUnstaged` to
`{ status: "uninstalled", name }` with **no version**, identical to the clean
branch (`remove.ts:342-347`). Yet the **partial** catalog state still documents the
successful row with a version:

```text
⊘ local-mp [user] (failed)
  ○ helper v1.0.0 (uninstalled)     <-- orchestrator emits "○ helper (uninstalled)"
```

The orchestrator's real partial output is `○ helper (uninstalled)` (no `v1.0.0`).
The two `(uninstalled)` rows in the catalog (clean = name-only, partial =
versioned) are mutually inconsistent given that they originate from the same
`string[]` accumulator. The catalog UAT (`tests/architecture/catalog-uat.test.ts:1179`)
does not catch this because its `partial` fixture is hand-authored data
(`{ status: "uninstalled", name: "helper", version: "1.0.0" }`) rather than the
orchestrator's output, and no test in `tests/orchestrators/marketplace/remove.test.ts`
asserts the partial byte form (MR-4 checks only `notifications.length` and
`severity`).
**Fix:** Remove the version from the partial catalog state so it matches the clean
state and the orchestrator:
```text
⊘ local-mp [user] (failed)
  ○ helper (uninstalled)
  ⊘ tool (failed) {permission denied}
    cause: EACCES: permission denied
```
and drop `version: "1.0.0"` from the `partial` UAT fixture at
`tests/architecture/catalog-uat.test.ts:1179`. Optionally add an orchestrator-level
byte assertion in `remove.test.ts` MR-4 so the real partial output is gated.

### WR-02: Stale reload-hint mini-spec comment contradicts the new implementation

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:1054-1056`
**Issue:** The file-header "V2 grammar mini-spec" block still documents the OLD
reload-hint trigger that this phase removed:
```
// Reload-hint trigger (D-16-12, refined SNM-15):
//   - Any plugin.status in {"installed", "updated", "reinstalled", "uninstalled"}, OR
//   - Any mp.status in {"added", "removed", "updated"}        (state-changing; NOT "failed")
```
This directly contradicts both the new `shouldEmitReloadHint` implementation
(`notify.ts:1126-1141`, which has no marketplace-status arm) and that function's own
updated docstring (`notify.ts:1101-1125`, SNM-33 / D-22-01: *"No marketplace-status
arm remains"*). A maintainer reading the mini-spec will believe `marketplace add`
emits a `/reload` trailer, which is now false. Misleading dead documentation in the
single source-of-truth grammar file.
**Fix:** Update the mini-spec to match D-22-01:
```
// Reload-hint trigger (SNM-33 / D-22-01, supersedes D-16-12 mp-status arm):
//   - Any plugin.status in {"installed", "updated", "reinstalled", "uninstalled"}.
//   - No marketplace-status arm: marketplace records are bookkeeping, not Pi-visible.
```

### WR-03: `narrowCascadeFailure` has an unreachable `default` branch / duplicated fallback return

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:167-171`
**Issue:** The textual-fallback ladder ends with:
```ts
if (text.includes("not in manifest")) {
  return "not in manifest";
}

return "not in manifest";   // <-- same value as the branch above
```
The `text.includes("not in manifest")` check is pointless: both the matched arm and
the unconditional final `return` yield the identical `"not in manifest"` Reason, so
the conditional can never change the outcome. It reads as if the author intended a
distinct mapping. Combined with the comment block (lines 152-157, 169-171) admitting
the whole textual fallback "may be dead code," this is accumulated dead/redundant
logic in a security-adjacent classifier.
**Fix:** Delete the redundant `"not in manifest"` substring check (lines 167-169);
the final `return "not in manifest"` already covers it. Tracked regression guards in
`remove.test.ts:646-648` continue to pass.

### WR-04: Partial-failure output regroups plugin rows, deviating from D-16-06 caller-order

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:298-326`
**Issue:** The orchestrator's single cascade loop (`remove.ts:226-238`) iterates
`Object.entries(record.plugins)` once and bins each plugin into either
`successfullyUnstaged` or `failedPlugins`. The partial-failure notify then
concatenates `...successfullyUnstaged` **then** `...failedPlugins`
(`remove.ts:309-322`). The inline comment claims *"Caller-order honored end-to-end
... (D-16-06)"*, but in fact the original interleaving of successes and failures is
**regrouped** (all successes first, all failures second), not preserved. For a
manifest ordered `[fail, ok, fail]`, the rendered rows become `[ok, fail, fail]`.
This is a deliberate design choice (the comment also says "successfullyUnstaged
first, failed second"), but the simultaneous appeal to D-16-06 "no internal sort /
caller-order preserved" is contradictory and could mislead a reviewer comparing this
surface to the genuinely order-preserving cascades (update/import/reinstall).
**Fix:** Either reword the comment to drop the D-16-06 claim and state plainly that
rows are grouped (successes then failures), or build the `plugins[]` array in a
single pass during the cascade loop so the original caller order is preserved end to
end.

## Info

### IN-01: `STATUS_TOKENS` carries `"no plugins"` though no renderer path emits a `(no plugins)` line

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:124`
**Issue:** `STATUS_TOKENS` includes `"no plugins"`, but per the catalog
(`docs/output-catalog.md:87`, `:231`, `:898`) and the renderer, an empty
`plugins: []` renders as the bare marketplace header alone -- the `(no plugins)`
body line is explicitly never emitted. The token is a documentation/closed-set
carrier only, not a live render path, which can confuse a reader scanning for where
`(no plugins)` is produced.
**Fix:** Add a one-line note on the tuple member (or in the comment at lines
102-108) clarifying that `"no plugins"` is a closed-set membership carrier with no
runtime emission path; the empty `plugins: []` shape is the structural
representation.

### IN-02: Project CLAUDE.md peer-dependency name is stale (`@mariozechner` vs `@earendil-works`)

**File:** project `CLAUDE.md` (constraints + tech-stack table) vs `package.json:15,56`
**Issue:** CLAUDE.md repeatedly names the peer dependency
`@mariozechner/pi-coding-agent`, but `package.json` and all 30 source/test imports
use `@earendil-works/pi-coding-agent` (`^0.75.3`; floor `>=0.74.0`). Not a defect in
the reviewed code (the tests import the correct package), but the project guidance is
out of date and could cause a contributor to add an import under the wrong scope.
**Fix:** Update CLAUDE.md's peer-dependency references and version table to
`@earendil-works/pi-coding-agent`.

### IN-03: `remove.ts` doc-block line reference may drift (`add.ts:160-169`)

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:283`
**Issue:** The construction-recipe comment hard-codes a line-range pointer
(*"mirrors the Wave 1 pilot at orchestrators/marketplace/add.ts:160-169"*) and the
catalog-UAT fixture pointer (*"tests/architecture/catalog-uat.test.ts:1154-1183"*,
`remove.ts:296-297`). Line-number references in comments rot silently as the
referenced files change. Low severity but worth converting to symbol/section
references.
**Fix:** Replace the numeric line ranges with stable references (function name /
fixture section key, e.g. `the "/claude:plugin marketplace remove <name>" fixtures`).

---

_Reviewed: 2026-05-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
