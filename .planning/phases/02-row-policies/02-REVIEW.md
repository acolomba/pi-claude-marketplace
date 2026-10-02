---
phase: 02-row-policies
reviewed: 2026-10-02T00:59:12Z
depth: standard
files_reviewed: 53
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/list.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-resolve.ts
  - extensions/pi-claude-marketplace/shared/notification-summary.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notify-context.ts
  - scripts/check-unused-type-members.contracts.json
  - scripts/check-unused-type-members.exceptions.json
  - tests/architecture/catalog-uat/fixtures/plugin-pending.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/soft-dep-marker-policy.test.ts
  - tests/orchestrators/import/execute.messaging.test.ts
  - tests/orchestrators/marketplace/add.messaging.test.ts
  - tests/orchestrators/marketplace/autoupdate.messaging.test.ts
  - tests/orchestrators/marketplace/list.messaging.test.ts
  - tests/orchestrators/marketplace/remove.messaging.test.ts
  - tests/orchestrators/marketplace/update.messaging.test.ts
  - tests/orchestrators/plugin/enable-disable.messaging.test.ts
  - tests/orchestrators/plugin/fetch.messaging.test.ts
  - tests/orchestrators/plugin/info.messaging.test.ts
  - tests/orchestrators/plugin/install.messaging.test.ts
  - tests/orchestrators/plugin/list.messaging.test.ts
  - tests/orchestrators/plugin/reinstall.messaging.test.ts
  - tests/orchestrators/plugin/shared.test.ts
  - tests/orchestrators/plugin/uninstall.messaging.test.ts
  - tests/orchestrators/plugin/update.messaging.test.ts
  - tests/orchestrators/reconcile/pending.test.ts
  - tests/orchestrators/reconcile/reconcile.messaging.test.ts
  - tests/shared/notification-dispatch.test.ts
  - tests/shared/notification-grammar.test.ts
  - tests/shared/notification-resolve.test.ts
  - tests/shared/notification-summary.test.ts
  - tests/shared/notification-types.test.ts
  - tests/shared/notify-context.test.ts
findings:
  critical: 1
  warning: 1
  info: 0
  total: 2
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-10-02T00:59:12Z
**Depth:** standard
**Files Reviewed:** 53
**Status:** issues_found
**Source revision:** `e793eeeda35c9a4a26885bb9760439dde5a81da3`
**Diff base:** `1c363b91e0fb401daec19fa33c2aff1c50161291`

## Summary

The policy migration preserves the reviewed production routing and reason-selection differences. Two protections were weakened while migrating the tests and formatter API: the marketplace-miss owner test no longer checks its produced reasons, and the surviving row formatter no longer rejects an unresolved partial-install producer. Both findings have focused, reproducible evidence below.

The existing successful full check was inspected; it was not rerun. Review covered all 18 command contexts, the central policy, missing-policy severity and frozen-row handling, retained staging observations on both pending branches, changed type-member records, and the revised test assertions and lint suppressions. The approved 28 synthetic corpus substitutions are accepted and are not findings.

## Structural Findings (fallow)

The supplied normalized analysis reports 14 duplicate groups, zero unused exports, zero unused files, and zero circular dependencies. The scoped orientation narrows these to four groups:

| Source location | Related location | Disposition |
| --- | --- | --- |
| `orchestrators/plugin/shared.ts:291-309` | same file, `868-885` | Existing dependency projection; unchanged implementation |
| `orchestrators/marketplace/update.messaging.ts:170-197` | same file, `217-235` | Existing outcome reason narrowing; unchanged implementation |
| `orchestrators/plugin/shared.ts:309-325` | same file, `885-897` | Existing dependency projection; unchanged implementation |
| `orchestrators/plugin/reinstall.messaging.ts:317-331` | `orchestrators/reconcile/apply-outcomes.ts:445-459` | Existing dependency projection; unchanged implementation |

Paths in this table are relative to `extensions/pi-claude-marketplace/`. The other ten raw groups are outside the changed implementation. These analyzer leads do not establish introduced defects and are not included in the narrative counts.

## Narrative Findings (AI reviewer)

### Critical Issues

### CR-01: Marketplace-miss test suppresses the reasons it must verify

**Classification:** BLOCKER — weakened assertion; test reliability
**File:** `/home/acolomba/src/pi-claude-marketplace-json/tests/orchestrators/plugin/shared.test.ts:1807`
**Related lines:** 1823-1835
**Production seam:** `/home/acolomba/src/pi-claude-marketplace-json/extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:1354`

**Issue:** The migrated `emitMarketplaceNotAddedSignal` test sets `contentReasons: false`. It also removes the former assertion that the produced row carries `["not installed", "marketplace in user scope"]`, replacing it with an assertion of the policy literal created by the test itself. The expected notification now hides all produced reasons. Removing the reasons from the implementation, or using the wrong scope qualifier, therefore passes this owner test even though real update and reinstall contexts enable content reasons and would show incorrect output. The callback interface changed; the producer's reason contract did not. The unit-testing review skill classifies weakened assertions that admit an incorrect implementation as BLOCKER.

**Evidence:** A read-only Node load hook replaced only `reasons: absentTargetReasons(err.notInstalledAt),` with `reasons: [],` in memory. Running the exact owner test produced **1 test, 1 pass, 0 failures**. No source file was edited. The removed assertion in the base revision would distinguish these rows.

**Fix:** Restore an independently asserted observation of the produced reasons through this public owner entry point. A content-enabled context and exact expected notification including `{not installed, marketplace in user scope}` provide that observation. Retain the severity, cardinality, name, and scope assertions. Coordinate any additional corpus occurrence or replacement with the existing explicit corpus exception; do not silently expand the approved 28 substitutions.

### Warnings

### WR-01: The surviving formatter accepts unresolved partial-install rows

**Classification:** WARNING — lost type protection at a presentation boundary
**File:** `/home/acolomba/src/pi-claude-marketplace-json/extensions/pi-claude-marketplace/shared/notification-grammar.ts:903`
**Related file:** `/home/acolomba/src/pi-claude-marketplace-json/tests/shared/notification-grammar.test.ts:63-65`

**Issue:** The deleted row helpers explicitly rejected `dependencies` with `dependencies?: never`. Their replacement accepts `ResolvedRow`, whose `Omit<..., "dependencies">` removes the declared member but does not reject a structurally assignable producer object that still carries it. `PluginPartiallyInstalledMessage` already has required `reasons`, so it satisfies the new formatter input without running `resolveRows`. The migration deletes the negative type assertion for that exact producer and retains only the installed-row negative, which fails for a different reason: its `reasons` field is optional. The remaining test comment still claims unresolved producer rows are refused.

**Evidence:** A virtual TypeScript source checked with the repository's compiler options compiled this call with **zero diagnostics**:

```typescript
const row: PluginPartiallyInstalledMessage = {
  status: "partially-installed",
  name: "alpha",
  dependencies: ["agents"],
  reasons: ["lsp"],
};
composePluginLines(row, "user");
```

At runtime it produces `  ◉ alpha (partially-installed) {lsp}` without resolving the dependency. All reviewed production dispatch callers currently resolve rows first, so this is a lost guard against future marker omissions, not a demonstrated incorrect current command emission.

**Fix:** Preserve the refusal on the surviving formatter input, for example `ResolvedRow & { readonly dependencies?: never }`, or enforce it on the shared resolved-row type. Restore the negative type assertion for `PluginPartiallyInstalledMessage` alongside the positive resolved-row check. Keep reason composition in `resolveRows`.

---

_Reviewed: 2026-10-02T00:59:12Z_
_Reviewer: gsd-code-reviewer_
_Depth: standard_
