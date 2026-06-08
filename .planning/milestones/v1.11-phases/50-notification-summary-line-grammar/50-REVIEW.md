---
phase: 50-notification-summary-line-grammar
reviewed: 2026-06-08T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/notify-grammar-invariant.test.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: resolved
resolution:
  warnings_fixed: 2
  info_accepted: 2
  fix_commit: 5e671d0
---

# Phase 50: Code Review Report

**Reviewed:** 2026-06-08
**Depth:** standard
**Files Reviewed:** 2
**Status:** resolved (both warnings fixed in `5e671d0`; both info findings accepted)

## Resolution (2026-06-08)

- **WR-01 (fixed, `5e671d0`):** `getPluginInfo` now separates `(failed)` blocks
  out of the both-scopes `plugin-info-cascade` and surfaces each as its own
  standalone `plugin-info` (`error` + `1 plugin operation failed.` summary),
  mirroring `getMarketplaceInfo`. The info-severity cascade no longer carries
  failures, so `notify.ts`'s "fan-out carries no failure" invariant is upheld
  by the orchestrator — closing the surviving GRAM-04 divergence.
- **WR-02 (fixed, `5e671d0`):** Added a both-scopes-missing-plugin regression
  test in `tests/orchestrators/plugin/info.test.ts` asserting two per-scope
  `error` + summary notifications (project-first), not a silent info cascade.
- **INFO-1 (accepted):** `SUMMARY_GRAMMAR` permits subject orders the code never
  emits — harmless over-permissiveness in a test regex; left as-is.
- **INFO-2 (accepted):** pre-existing empty-description rendering nit between the
  two info renderers — outside the summary-line charter; not introduced by this
  phase. Left for a future docs/render pass if it ever surfaces.

`npm run check` green (1515) after the fix.

## Summary

The phase-50 `emitWithSummary` seam is correctly implemented as the single
summary-emission point. I traced the GRAM-04 anti-divergence guarantee and
confirmed it holds for every path that flows through `emitWithSummary`:

- Severity is computed exactly once (`computeSeverity` at line 2245) and reused
  for the `buildSummaryLine` call (line 2249) — no double-compute, no drift.
- `computeSeverity` and `buildSummaryLine` are each called from exactly one
  site, both inside `emitWithSummary`. No standalone error/warning path can
  reach `ctx.ui.notify` without first passing through the seam: `notify()`
  routes standalone kinds through `dispatchInfoMessage` → `emitWithSummary`, and
  the cascade arm calls `emitWithSummary` directly. IL-2 (exactly one
  `ctx.ui.notify` per emission) holds in both arms.
- For every shape where `computeSeverity` returns `"error"`/`"warning"`,
  `buildSummaryLine` returns a non-empty grammar-conformant summary
  (`marketplace-not-added` → hard-count-1 marketplace; failed `plugin-info` →
  hard-count-1 plugin; cascade error/warning → counts > 0 because the counting
  helpers mirror the severity ladder arms exactly). The documented 0/0 degrade
  case is genuinely unreachable. No empty-body-with-summary case exists
  (error/warning always implies a non-empty body).
- INFO-severity standalone kinds (`marketplace-info`, non-failed `plugin-info`,
  both `*-info-cascade` fan-outs) correctly emit body-only with no summary.

The one substantive defect is a **false structural invariant**: the type model
permits a `(failed)` block inside a `plugin-info-cascade` fan-out, but
`computeSeverity` and `buildSummaryLine` hard-code those fan-outs to
info/no-summary. The `plugin info` orchestrator can actually construct such a
fan-out, so the same plugin-not-in-manifest failure is surfaced LOUD at one
scope count and SILENT at two — and the new architecture test does not cover
this fixture. Details in WR-01.

## Warnings

### WR-01: `plugin-info-cascade` with a failed block routes to info/no-summary — divergence from the single-scope failed `plugin-info`

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:1582-1584` (computeSeverity), `:1732-1735` (buildSummaryLine)

**Issue:** Both `computeSeverity` and `buildSummaryLine` treat
`marketplace-info-cascade` and `plugin-info-cascade` as unconditionally
info/no-summary, justified by the comment "no failure can be expressed on a
fan-out wrapper" (lines 1566-1568, 836-837). That invariant is **false for
`plugin-info-cascade`**:

- `PluginInfoCascadeMessage.blocks` is typed `readonly [PluginInfoMessage, ...]`,
  and `PluginInfoMessage.plugin.status` may be `"failed"` (the type does not
  forbid it).
- The orchestrator `orchestrators/plugin/info.ts::getPluginInfo` (lines 571-585)
  maps `buildBlock` over BOTH scopes when the marketplace name exists in both,
  and `buildBlock` returns `plugin.status: "failed"` on a manifest read error or
  a plugin-not-in-manifest (`orchestrators/plugin/info.ts:255-267`, `275-287`).
  Those failed blocks are placed directly into the fan-out with NO failure
  separation.

Net effect: when the marketplace exists in both scopes but the plugin is missing
from one scope's manifest (independent state files / independent
`manifestPath`s make this reachable), the fan-out routes to `info` severity with
NO summary line — while the byte-identical single-scope failure
(`missing-plugin-not-in-manifest`, catalog line 1157) correctly emits
`1 plugin operation failed.` at `error` severity. A genuine failure is silently
demoted to a read-only result with no host `Error:` prefix. This is exactly the
GRAM-04 class of divergence the phase set out to eliminate, surviving on the
fan-out path because the severity logic asserts a failure can never appear
there.

Note: the sibling `marketplace info` orchestrator
(`orchestrators/marketplace/info.ts:154-182`) deliberately separates failures
out of the fan-out and emits each as its own standalone `plugin-info` (correctly
loud). `getPluginInfo` does NOT do this — that orchestrator asymmetry is the
trigger, but the reviewed file's contribution is the unenforced invariant.

**Fix (preferred — in the reviewed file):** make `computeSeverity` /
`buildSummaryLine` inspect the fan-out blocks rather than asserting they are
always info, so the severity follows the contained rows. For `plugin-info-cascade`:

```ts
// computeSeverity, plugin-info-cascade arm:
case "plugin-info-cascade":
  return message.blocks.some((b) => b.plugin.status === "failed") ? "error" : undefined;

// buildSummaryLine, plugin-info-cascade arm:
case "plugin-info-cascade": {
  const failed = message.blocks.filter((b) => b.plugin.status === "failed").length;
  return failed > 0 ? `${operationPhrase(failed, "plugin")} failed.` : "";
}
```

(Apply the same treatment to `marketplace-info-cascade` only if its orchestrator
can likewise carry failures; today `getMarketplaceInfo` cannot, so it may stay
info-only.) **Alternatively**, fix the orchestrator (`getPluginInfo`) to mirror
`getMarketplaceInfo` — pull failed blocks out of the fan-out and emit each
standalone — and tighten the cascade block type to a success-only row so the
invariant becomes compile-enforced. Either way the false comment at
notify.ts:1566-1568 and 836-837 must be corrected.

### WR-02: architecture invariant test omits the `plugin-info-cascade`-with-failed-block fixture (the exact escape WR-01 describes)

**File:** `tests/architecture/notify-grammar-invariant.test.ts:84-153`

**Issue:** The test's own header (lines 17-21) declares it the structural
anti-divergence gate for "a FUTURE standalone error/warning kind that forgets
the summary." Its `FIXTURES` cover `marketplace-not-added`, a single failed
`plugin-info`, and two cascade fixtures — but NOT a `plugin-info-cascade` whose
blocks contain a `(failed)` row. That is precisely the shape that slips through
WR-01: the fan-out is forced to `info`, so the `severity !== "error" && severity
!== "warning"` early-`continue` (lines 171-173) skips it, and the gate never
fires. The invariant test therefore cannot detect the WR-01 demotion. The byte
tests in `tests/shared/notify-v2.test.ts` also have no fan-out-with-failure case
(verified by grep: no `plugin-info-cascade` failed-block assertion exists).

**Fix:** Add a fixture exercising a both-scope fan-out where one block is a
failed `plugin-info`, and assert the intended contract. If WR-01 is fixed by
inspecting blocks, the fixture should produce an error severity + a
`N plugin operation(s) failed.` summary and pass the existing clauses. If the
team intends the fan-out to stay info, the test should assert that explicitly
(and the divergence with the single-scope path documented as accepted) — but
that contradicts the GRAM-04 charter.

## Info

### IN-01: `SUMMARY_GRAMMAR` regex is more permissive than the grammar `buildSummaryLine` actually emits

**File:** `tests/architecture/notify-grammar-invariant.test.ts:69-70`

**Issue:** The regex
`^\d+ (plugin|marketplace) operations?( and \d+ (plugin|marketplace) operations?)? (failed|skipped)\.$`
independently allows either subject on both sides, so strings
`buildSummaryLine` never produces — e.g. `"1 plugin operation and 1 plugin
operation failed."` or `"1 marketplace operation and 1 plugin operation
failed."` (the code always emits plugin-first when both are non-zero, line
1749-1750) — would pass the gate. This weakens the invariant: a future
regression that swapped the subject order or duplicated a subject would not be
caught.

**Fix:** Pin the two-subject branch to the canonical
`plugin … and … marketplace` order, e.g.
`^\d+ plugin operations?( and \d+ marketplace operations?)? (failed|skipped)\.$|^\d+ marketplace operations? (failed|skipped)\.$`
(plugin-only / both / marketplace-only), matching the three shapes
`buildSummaryLine` can return.

### IN-02: pre-existing inconsistency — empty-string description rendered differently across info renderers

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:1998-2000` vs `:2191`

**Issue:** `renderMarketplaceInfo` emits a `description:` line whenever
`message.description !== undefined` (line 1998), so a `description: ""` payload
renders a bare `description: ` line. `renderPluginInfo` (line 2191) guards
`description !== undefined && description.length > 0`, suppressing the empty
case. These are info-severity surfaces outside the summary-line logic, so the
phase-50 charter is unaffected, but the two info renderers disagree on the
empty-string edge. Not exercised by the reviewed test (no empty-description
fixture).

**Fix:** Apply the same `&& message.description.length > 0` guard in
`renderMarketplaceInfo` for parity, unless an intentional behavioral difference
is documented.

---

_Reviewed: 2026-06-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
