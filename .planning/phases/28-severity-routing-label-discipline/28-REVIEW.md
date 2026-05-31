---
phase: 28-severity-routing-label-discipline
reviewed: 2026-05-31T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/shared/notify-v2.test.ts
  - tests/shared/snm-uxg03-label-color-spike.test.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/orchestrators/marketplace/autoupdate.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/update.test.ts
  - tests/orchestrators/plugin/bootstrap.test.ts
  - tests/orchestrators/import/execute.test.ts
  - docs/adr/v2-001-structured-notify.md
  - docs/messaging-style-guide.md
  - docs/output-catalog.md
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 28: Code Review Report

**Reviewed:** 2026-05-31
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 28 rewrote `computeSeverity` in `shared/notify.ts` from a 3-arm "any skipped ->
warning" ladder into a 5-arm benign-softening ladder (`BENIGN_REASONS` closed set +
`allBenign()` predicate). The new logic was traced arm-by-arm against the diff
(`24d7643..HEAD`), the per-arm unit tests, the catalog UAT fixtures, the orchestrator
suites, and the three synced docs (ADR, style guide, catalog).

**The core ladder logic is correct.** First-match ordering (error > manual-recovery >
plugin-skip > mp-skip > info) is sound; `allBenign(undefined | [])` returning `false`
correctly implements the D-28-08 safe default; the plugin-required vs mp-optional
`reasons` distinction is handled correctly (arm 3 reads `p.reasons` on the
required-reasons `skipped` variant; arm 4 reads `mp.reasons?` on the optional-reasons mp
status). First-match poisoning in a mixed cascade behaves as documented. No rendered-byte
changes were introduced -- the change is severity-arg-only, confirmed by the unchanged
catalog UAT expected blocks and the byte-equality assertions in the orchestrator suites.

The findings below are drift defects, not logic bugs: two stale test titles that
contradict their own (correct) assertions, plus four documentation/consistency nits. None
block ship, but the two stale titles are misleading enough to warrant WARNING (a future
maintainer reading the title would believe benign idempotent flips route to `warning`,
which is exactly the behavior this phase reversed).

## Warnings

### WR-01: Two autoupdate test titles assert "severity warning" but the bodies assert info (stale-title drift)

**File:** `tests/orchestrators/marketplace/autoupdate.test.ts:124` and `:143`

**Issue:** Both test titles end with "**at severity warning**":

- Line 124: `"MAU-3 / UXG-04: idempotent -- already-true + enable=true emits V2 `<autoupdate> {already autoupdate}` at severity warning"`
- Line 143: `"MAU-3 / UXG-04: idempotent -- already-false + enable=false emits V2 `<no autoupdate> {already no autoupdate}` at severity warning"`

But the bodies assert the opposite -- info severity (no 2nd arg):

```js
// line 139
assert.equal(notifications[0]!.severity, undefined);
// line 159
assert.equal(notifications[0]!.severity, undefined);
```

The body comments correctly explain "the benign idempotent flip reason `already
autoupdate` is in BENIGN_REASONS -> info (no severity arg)". The titles are stale carry-over
from the pre-Phase-28 ladder where `already autoupdate` / `already no autoupdate` routed to
`warning`. This is exactly the routing this phase reversed (D-28-07), so the titles now
describe the old, removed behavior. The assertions are correct and the tests pass; only the
human-facing titles lie. This is a documentation/maintainability defect with real
risk: a maintainer triaging a future regression by reading test titles would conclude that
benign idempotent flips are supposed to warn, and could "fix" the implementation back to the
pre-Phase-28 behavior to make the title "true."

**Fix:** Replace "at severity warning" with "at severity info (benign per UXG-02 / D-28-07)"
in both titles:

```js
test("MAU-3 / UXG-04: idempotent -- already-true + enable=true emits V2 `<autoupdate> {already autoupdate}` at severity info (benign per UXG-02 / D-28-07)", async () => {
// ...
test("MAU-3 / UXG-04: idempotent -- already-false + enable=false emits V2 `<no autoupdate> {already no autoupdate}` at severity info (benign per UXG-02 / D-28-07)", async () => {
```

### WR-02: No direct unit test pins the empty-`reasons` plugin-skip -> warning case (arm-3 boundary gap)

**File:** `tests/shared/notify-v2.test.ts` (coverage gap; relevant code `extensions/pi-claude-marketplace/shared/notify.ts:122-124,1155-1160`)

**Issue:** `allBenign([])` returns `false` (the `reasons.length > 0` guard), so a plugin
`skipped` row carrying an *empty* `reasons: []` routes to `warning` via arm 3 -- distinct
from the missing-`reasons` mp case (arm 4, test at notify-v2.test.ts:1995) and the
populated-actionable-reason case (`["not installed"]`, test at :1940). The plugin variant
`PluginSkippedMessage.reasons` is REQUIRED, so `[]` is a structurally reachable input (the
update orchestrator's notes-fallback narrow can produce `["unreadable manifest"]` from `[]`,
but a producer that emits a literal empty `reasons: []` on a `skipped` plugin would land
here). The `update.test.ts` fixtures exercise empty-`reasons` only through
`__test_outcomeToCascadePluginMessage`, which always rewrites `[]` into a populated reason
before it reaches `computeSeverity` -- so the empty-array branch of `allBenign` on the
plugin-skip arm is never directly asserted at the `notify()` boundary.

The behavior is correct (empty reasons cannot be proven benign -> warning, matching the
D-28-08 safe-default intent). The gap is that the boundary is untested, so a future
refactor that drops the `reasons.length > 0` guard (making `[].every(...)` vacuously
`true` -> info) would not be caught by any test in scope.

**Fix:** Add a unit test mirroring the `:1995` mp-omitted-reasons test but for a plugin
skip with an empty array:

```js
test("UXG-02 (D-28-06): plugin skip with empty reasons:[] computes warning (allBenign guard on length)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [{ status: "skipped", name: "alpha", version: "1.0.0", reasons: [] }],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 2);
  assert.equal(args[1], "warning");
});
```

## Info

### IN-01: `BENIGN_REASONS` is a runtime `Set` but is not asserted against `REASONS` membership

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:108-113`

**Issue:** `BENIGN_REASONS` is typed `ReadonlySet<Reason>`, so the four literals are
compile-time-checked to be members of the `REASONS` tuple -- good. But there is no
companion assertion that every `BENIGN_REASONS` member is *still present* in `REASONS` at
runtime, nor a test iterating `BENIGN_REASONS` against `REASONS`. If a future edit removed
`"already installed"` from the `REASONS` tuple, the `BENIGN_REASONS` literal would become a
type error (caught) -- so this is low-risk -- but the closed-set discipline used elsewhere in
the file (`notify-types.test.ts` membership proof) is not extended to this new closed
sub-set. The four entries are also not referenced from `notify-types.test.ts` (not in scope
here, but worth noting the membership-proof pattern was not extended).

**Fix:** Optional -- add `BENIGN_REASONS` to the closed-set membership proof in
`notify-types.test.ts` (out of scope for this phase's file list), or add an inline
`for (const r of BENIGN_REASONS) assert(REASONS.includes(r))` arch assertion.

### IN-02: ADR and style-guide prose still say "10-variant" / "10 literal strings" while the union has 11 variants

**File:** `docs/adr/v2-001-structured-notify.md:33-34,93,110,119` and `docs/messaging-style-guide.md:25-26,33`

**Issue:** Both docs describe `PluginNotificationMessage` as a "10-variant discriminated
union" and `PluginStatus` as "10 literal strings." The actual union in `notify.ts:535-546`
has **11** variants (the `present` inventory token added for UAT gap G-21-01, see
`notify.ts:466` and `PLUGIN_STATUSES` at `notify.ts:241-253` which lists 11 entries). The
catalog (`output-catalog.md`) correctly reflects `present` as a distinct discriminator.
This is pre-existing drift, not introduced by Phase 28, but Phase 28 touched these files as
"prose syncs" and left the stale count. Since the docs are billed as the binding contract
description, the count mismatch undermines that claim.

**Fix:** Update "10-variant" -> "11-variant" and "10 literal strings" -> "11 literal strings"
in both docs, and add the `present` row to the union enumeration comment blocks.

### IN-03: ADR `MarketplaceDetails` line and "Public types" block omit `reasons?` (Phase 17.1 amendment not folded into Decision body)

**File:** `docs/adr/v2-001-structured-notify.md:32,85-91`

**Issue:** The Decision-section type sketch for `MarketplaceNotificationMessage` lists only
`{ name; scope; status?; details?; plugins }` and omits the `reasons?: readonly Reason[]`
field that the Phase 17.1 amendment (documented lower in the same ADR at line 199-201) and
the actual `notify.ts:566-573` both carry. The `reasons?` field is load-bearing for the
entire Phase 28 mp-skip benign-softening (arm 4 reads `mp.reasons`), so the Decision body's
type sketch is now materially incomplete for a reader trying to understand the severity
ladder. The amendment note explains the addition but the primary sketch was never updated
(ADR explicitly defers refresh per D-17.1-08, so this is a known-accepted gap rather than an
oversight -- flagged for completeness).

**Fix:** No action required if the D-17.1-08 "amendment-not-folded" convention holds;
otherwise add `reasons?` to the line-32 and line-85-91 sketches with a Phase-17.1 marginal
note.

### IN-04: `MARKETPLACE_STATUSES`/`MarketplaceStatus` documented as "7 entries / 7 literal strings" consistently -- verify no off-by-one on the doc-count claims that DO match

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:264-272` vs `docs/messaging-style-guide.md:27,52`

**Issue:** Cross-checked for completeness: `MARKETPLACE_STATUSES` has exactly 7 entries and
both docs say "7" -- no drift here. `DEPENDENCIES` has 2, docs say 2 -- no drift. Recording
this as an explicit "checked, consistent" note so the IN-02 plugin-count drift is not
mistaken for a blanket count problem; the mp-status and dependency counts are correct. No
fix needed.

---

_Reviewed: 2026-05-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
