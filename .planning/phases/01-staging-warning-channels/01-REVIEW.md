---
phase: 01-staging-warning-channels
reviewed: 2026-10-27T08:04:11Z
depth: standard
files_reviewed: 62
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
  - extensions/pi-claude-marketplace/bridges/agents/types.ts
  - extensions/pi-claude-marketplace/bridges/commands/stage.ts
  - extensions/pi-claude-marketplace/bridges/commands/types.ts
  - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
  - extensions/pi-claude-marketplace/bridges/mcp/types.ts
  - extensions/pi-claude-marketplace/bridges/skills/stage.ts
  - extensions/pi-claude-marketplace/bridges/skills/types.ts
  - extensions/pi-claude-marketplace/bridges/workflows/stage.ts
  - extensions/pi-claude-marketplace/bridges/workflows/types.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/shared/staging-warnings.ts
  - features/plugin/staging-warnings.feature
  - features/step_definitions/plugin/publishing.steps.ts
  - test/architecture/workflows-marker-coverage.test.ts
  - test/bridges/agents/stage.test.ts
  - test/bridges/agents/types.test.ts
  - test/bridges/commands/stage.test.ts
  - test/bridges/commands/types.test.ts
  - test/bridges/mcp/stage.test.ts
  - test/bridges/mcp/types.test.ts
  - test/bridges/skills/stage.test.ts
  - test/bridges/skills/types.test.ts
  - test/bridges/workflows/stage.test.ts
  - test/bridges/workflows/types.test.ts
  - test/integration/plugin-layer-verbs.test.ts
  - test/orchestrators/marketplace/update.messaging.test.ts
  - test/orchestrators/marketplace/update.test.ts
  - test/orchestrators/plugin/dependency-settle.test.ts
  - test/orchestrators/plugin/enable-disable.test.ts
  - test/orchestrators/plugin/install-flow.test.ts
  - test/orchestrators/plugin/install-outcome.test.ts
  - test/orchestrators/plugin/materialize-latest.test.ts
  - test/orchestrators/plugin/operations.test.ts
  - test/orchestrators/plugin/reinstall-flow.test.ts
  - test/orchestrators/plugin/reinstall-record.test.ts
  - test/orchestrators/plugin/reinstall.messaging.test.ts
  - test/orchestrators/plugin/shared.test.ts
  - test/orchestrators/plugin/update-cascade.test.ts
  - test/orchestrators/plugin/update-flow.test.ts
  - test/orchestrators/plugin/update-row.test.ts
  - test/orchestrators/plugin/update-swap.test.ts
  - test/orchestrators/reconcile/apply-outcomes.test.ts
  - test/orchestrators/reconcile/apply.test.ts
  - test/orchestrators/reconcile/notify.test.ts
  - test/orchestrators/types.test.ts
  - test/shared/staging-warnings.test.ts
findings:
  critical: 0
  warning: 2
  info: 7
  total: 9
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-10-27T08:04:11Z
**Depth:** standard
**Files Reviewed:** 62
**Status:** issues_found

## Summary

Scope: `git diff d98660a7..HEAD -- extensions test features`, planning files excluded. I checked the code against D-PL1-01..24 in `01-CONTEXT.md`. I did not report decided behavior as a bug.

I traced every staging verb and cascade from the bridge that produces a warning to the renderer that shows it:

- install: success, standalone failure, and cascade-member failure
- enable: standalone, orchestrated, and the merged cascade
- direct update: success, a thrown failure, a phase-3a failure, and a failure kept in the batch
- the marketplace update and autoupdate cascade
- apply: moves, backfills, and enables
- reinstall: success, a thrown failure, and a run that returns a failed outcome

Results of the trace:

- No warning is shown twice. I checked the report holder against the outcome carrier on every failure route. No dependency move inherits the root's `onStagingWarnings`, because `moveArgs` builds a fresh argument object.
- Hygiene warnings never reach a standalone diagnostic. `surfaceStagingDiagnostics` partitions before it calls `surfaceDiscoveryWarnings`, and the `DiscoveryWarning[]` parameter type would reject an unpartitioned array.
- NREG-01 holds at every carrier I traced. Each optional key is spread only when it is non-empty.
- Rendered lines are still redacted, and the header holds no path.
- Diagnostics come after the rows and before the MCP config notices on every path.

Two issues need attention:

1. Diagnostic order does not match row order across marketplace blocks (D-PL1-07). The test pins the wrong order.
2. A new import edge from a marketplace module into the `plugin/shared.ts` hub goes against the documented marketplace-to-plugin import surface.

The remaining items are stale comments, latent inconsistencies, and one dropped-notice path that no CONTEXT entry records as deferred.

## Warnings

### WR-01: Staging diagnostics render in outcome order, not row order, across marketplace blocks (D-PL1-07)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:489-494`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1915`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts:896`

**Issue:** D-PL1-07 says each plugin's diagnostic renders "in row order". Neither row renderer keeps outcome order across blocks:

- `update-cascade.ts:184` (`composeUpdateCascade`) groups rows into `(scope, marketplace)` blocks, then sorts the blocks by `compareByNameThenScope`, which compares the marketplace name first.
- `reconcile/notify.ts:1470` sorts apply's blocks the same way.

Both diagnostic paths map `outcomes` in iteration order:

- The bare `update` iterates project first, then marketplaces in `state.json` insertion order (`enumerateScopeTargets`).
- `apply` iterates in step order: enable before converge.

Examples:

- **Bare `update`:** project marketplace `zeta` and user marketplace `alpha` each update a plugin with notes. The rows show the `alpha [user]` block first, but the diagnostics show zeta's plugin first.
- **`apply`:** an enable in marketplace `zeta` and a catalog move in marketplace `alpha` render rows alpha then zeta, but diagnostics zeta then alpha.

The unit test `test/orchestrators/reconcile/apply-outcomes.test.ts:1320` pins "outcome order", not row order. Its fixture puts a `user`-scope enable ahead of `project`-scope moves in one marketplace, and the renderer would place those rows in the opposite order. Reinstall is not affected, because `reinstall-targets.ts::sortTargets` sorts the targets with the same comparator.

**Fix:** Order the diagnostics by the key the row composer uses before rendering. For example, carry `marketplace` on `StagingDiagnostic` (or sort the source outcomes) and stable-sort:

```ts
// update-flow.ts
const ordered = [...outcomes].sort((a, b) =>
  compareByNameThenScope(
    { name: a.target.marketplace, scope: a.target.scope },
    { name: b.target.marketplace, scope: b.target.scope },
  ),
);
surfaceStagingDiagnostics(ctx, run, ordered.flatMap(updateStagingDiagnostic));

// apply-outcomes.ts::stagingDiagnosticsOf -- same stable sort on
// { name: outcome.marketplace, scope: outcome.scope } before flatMap
```

Then re-pin the `stagingDiagnosticsOf` test to row order with outcomes from two marketplaces, and add a direct-update case with two marketplaces whose insertion order is not alphabetical.

### WR-02: `marketplace/update.messaging.ts` now imports the `plugin/shared.ts` hub

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts:10`, `:23`

**Issue:** ARCHITECTURE.md (Circular imports, BLOCK C) says a marketplace file reaches plugin code only through:

- the leaf composers (`plugin/update-row.ts`, `clone-cache.ts`, `clone-gc.ts`)
- the shared types in `orchestrators/types.ts`
- the injected `pluginUpdate` seam

At the base commit no `orchestrators/marketplace/` file imported `plugin/shared.ts`. Only `reconcile/` files did. This phase adds `import { surfaceStagingDiagnostics } from "../plugin/shared.ts"` to the messaging module of the marketplace ledger `update.ts`.

`plugin/shared.ts` is a hub of about 1,800 lines. It imports `../marketplace/shared.ts` and many plugin modules. The new edge `marketplace/update.ts` -> `update.messaging.ts` -> `plugin/shared.ts` -> `marketplace/shared.ts` puts the whole hub graph under a marketplace ledger. BLOCK C and fallow catch a cycle only after it closes, so the first edge lands green. A later import from that hub graph back toward `marketplace/update.ts` would close the cycle.

**Fix:** Move the renderer to a leaf module that both sides may import, for example `orchestrators/plugin/staging-diagnostics.ts`. It holds `StagingDiagnostic`, `surfaceStagingDiagnostics`, and `surfaceDiscoveryWarnings`, and imports only `shared/notification-dispatch.ts`, `shared/redact-absolute-paths.ts`, and `shared/staging-warnings.ts`. Re-export it from `plugin/shared.ts` if needed, and have `update.messaging.ts` import the leaf. Otherwise, record the new edge as a decision and update ARCHITECTURE.md.

## Info

### IN-01: Comments the change made false

**File:**

- `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts:1377-1381`
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts:349-353`
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts:26-32`
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts:330-333`

**Issue:**

- `install-outcome.ts` (WR-04 block) still says the warnings "are lost on the failure path wherever they are collected". D-PL1-13's `captureStagingWarnings` now keeps them on the capture.
- `prepareUpdateHandles` (`update-swap.ts`) still says the warnings are read "once the swap succeeds ... not here, because a prepare that later fails has no row to hang a warning off". Its own catch now calls `reportStagingWarnings`.
- The `reinstall-flow.ts` header says the self-rendering arm's "outcomes also leave `discoveryWarnings` undefined". Failed outcomes now carry the member on both arms (`failReinstall`, `reinstallOutcomeFromRun`).
- `reinstall-flow.ts:330-333` still lists the "cache drop" as a side effect of reinstall maintenance. D-PL1-17 moved that drop into the swap.

**Fix:** Rewrite each comment to match the new behavior, or delete it.

### IN-02: The self-rendering reinstall arm shows no `reinstall failed` diagnostic

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts:298-306`, `:494-499`

**Issue:** With `render !== "none"`, a failed reinstall renders its row and its MCP config notices. It shows no `reinstall failed` diagnostic, even though the outcome now carries `discoveryWarnings`. This breaks the D-PL1-07 placement rule for that arm. No production caller reaches the arm (per its own header), so nobody sees the gap today.

**Fix:** Call `surfaceStagingDiagnostics` with the `reinstall failed` entry between the row and `notifyMcpConfigNotices` on both self-rendering failure sites. Otherwise, document the arm as diagnostic-free for every partition.

### IN-03: `captureStagingWarnings` does not clear a stale value, unlike its sibling fields

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts:955-963`, `:1561-1565`

**Issue:** A failed ledger always overwrites `capture.rollbackPartials` and `capture.version`, but sets `capture.stagingWarnings` only when the context has warnings. Cascade members share one capture (D-PL1-24). If two ledgers failed against the same capture, the second failure would keep the first one's warnings, and `handleInstallThrow` would render them under the root. Today only one ledger fails per command, so this cannot happen yet. A retry or a second failing phase added later would expose it.

**Fix:** Assign the field on every failure, as the sibling fields are assigned:

```ts
const warnings = [...context.discoveryWarnings, ...context.bridgeWarnings];
if (warnings.length > 0) {
  capture.stagingWarnings = warnings;
} else {
  delete capture.stagingWarnings;
}
```

### IN-04: An install whose plan moves dependencies drops the MCP notices of the slices it installs

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:3570-3581`

**Issue:** `saveRootClosure` now puts the members' `mcpConfigNotices` on the `installed` arm, and `runDependencySteps` collects them. `installAfterMoves` reads neither `ran.mcpConfigNotices` on success nor on the `!ran.ok` failure path. An install whose plan has an intermediate materialize slice that adds a dependency with an MCP server (and rewrites `mcp-adapter.json`) therefore shows no AFILE-04 notice. This was true before the phase too. RESEARCH says "it can ignore the new member", but CONTEXT's Deferred list does not record it, so no later phase owns it.

**Fix:** Pass `ran.mcpConfigNotices` into `installPluginWithTransaction` and onto `failedMoveOutcome`. Or add the gap to the CONTEXT Deferred list or BACKLOG under Phase 4, which owns `installAfterMoves`.

### IN-05: D-PL1-15 matches rows by `generatedName` but deletes each row's own `targetPath`

**File:** `extensions/pi-claude-marketplace/bridges/agents/stage.ts:306-318`

**Issue:** Under `force`, a foreign-preserved row joins `replaced` when its `generatedName` matches a staged name. The commit then removes `entry.targetPath`, the row's own path, not the target of the new entry. In a hand-edited index, a row can carry a staged `generatedName` and a `targetPath` that points to a different user file inside `agents/`. The containment check passes, and the commit deletes that file, even though this staging does not produce it.

This matches D-PL1-15 to the letter, and it is strictly safer than the old force behavior, which deleted every foreign-preserved row. Matching on both fields would close the remaining case.

**Fix:** Build the staged set from targets as well as names:

```ts
const stagedTargets = new Set(prepared.newEntries.map((e) => e.targetPath));
const isStaged = (e: AgentsIndexEntry): boolean =>
  stagedNames.has(e.generatedName) && stagedTargets.has(e.targetPath);
```

### IN-06: Carrier names no longer describe what they carry

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:235-238`, `extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts:41-44`

**Issue:** `McpConfigNoticeSink` now also carries `stagingWarnings`. `CandidateReport` (and `recordCandidate`) now also carries the swap's staging warnings, which are not about the candidate. Both names now hide part of what they hold.

**Fix:** Rename them, for example `EnableReportSink` and `UpdateRunReport`, or add a short type comment at each declaration.

### IN-07: `materializeLatestVersion` relies on an unstated rule that a settle with no rows has no notices

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts:128-130`

**Issue:** When `settled.rows.length === 0`, the function calls `swapPluginUpdate` directly and never reads `settled.mcpConfigNotices`. Today every slice that raises a notice also adds a row, so nothing is lost. The rule is not written anywhere, and the types do not enforce it. A settle that one day reports notices without rows would drop them silently.

**Fix:** Branch on `settled.rows.length === 0 && (settled.mcpConfigNotices ?? []).length === 0`, or route every settled case through `swapAfterSettle`.

---

_Reviewed: 2026-10-27T08:04:11Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
