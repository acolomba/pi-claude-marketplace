---
phase: 28-severity-routing-label-discipline
fixed_at: 2026-05-31T13:10:59Z
review_path: .planning/phases/28-severity-routing-label-discipline/28-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 1
skipped: 5
status: partial
---

# Phase 28: Code Review Fix Report

**Fixed at:** 2026-05-31T13:10:59Z
**Source review:** .planning/phases/28-severity-routing-label-discipline/28-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 6 (fix_scope: all -- Critical + Warning + Info)
- Fixed: 1 (IN-02)
- Skipped: 5 (WR-01 + WR-02 already-resolved in a prior pass; IN-01 skipped
  by design; IN-03 + IN-04 no-action-required)

This pass ran with `fix_scope: all`. WR-01 and WR-02 were already fixed in a
prior `critical_warning` pass (commits `59042ea` and `5911a1e`); they were
re-verified on disk and recorded as already-resolved, not re-applied. IN-02
is the only newly-actionable finding and was applied. IN-01, IN-03, and IN-04
were skipped with rationale (see below).

**Verification:** `npm run check` GREEN -- `tsc --noEmit` clean, `eslint .`
clean, `prettier --check` "All matched files use Prettier code style!",
1157 tests pass / 0 fail. Pre-commit hooks (mdformat + markdownlint) passed
on both doc files with no reflow. The five pre-existing working-tree
modifications (`.claude/settings.json`, `.mdformat.toml`,
`.pre-commit-config.yaml`, `CHANGELOG.md`, `CLAUDE.md`) were left untouched
and unstaged.

## Fixed Issues

### IN-02: ADR and style-guide prose said "10-variant" / "10 literal strings" while the union has 11 variants

**Files modified:** `docs/adr/v2-001-structured-notify.md`,
`docs/messaging-style-guide.md`
**Commit:** `23e0c76`
**Applied fix:**

Verified the live count first: `PLUGIN_STATUSES` in
`extensions/pi-claude-marketplace/shared/notify.ts:241-253` lists 11 entries
and the `PluginNotificationMessage` union at `notify.ts:535-546` has 11
variants (the `present` inventory token added in G-21-01,
`PluginPresentMessage` at `notify.ts:466`). Only the count the source
actually has (11) was written.

Changes (prose / enumeration comments only -- no rendered/fenced output
bytes altered):

- `docs/adr/v2-001-structured-notify.md`: "10-variant" -> "11-variant" and
  "10 literal strings" -> "11 literal strings" in the Public-types summary
  block (lines 33-34); `PLUGIN_STATUSES; // 10 entries` -> `// 11 entries`
  (line 41); "The 10-variant `PluginNotificationMessage`" ->
  "The 11-variant ..." (line 110); added the `PluginPresentMessage` row to
  the union enumeration comment block (between `PluginUpgradableMessage` and
  `PluginFailedMessage`, matching source order).
- `docs/messaging-style-guide.md`: "10-variant" -> "11-variant" and
  "10 literal strings" -> "11 literal strings" (lines 25-26); prose
  "has ten variants" -> "has eleven variants" (line 33); added the
  `PluginPresentMessage` row to the union enumeration comment block in source
  order; "closed set of 10 plugin status discriminators" -> "11" (line 51,
  kept internally consistent with the corrected counts above).

**Deliberately NOT changed:** The ADR Phase-15 migration-log entry (line 192)
retains its "10-variant" wording. That is a historical record of what Phase
15 originally landed -- the union genuinely had 10 variants until G-21-01
added `present` -- so the entry is accurate for that phase and changing it
would falsify the migration log (consistent with the D-17.1-08
amendment-not-folded convention). The per-variant field carve-out counts in
both docs ("the other 5 variants" / "the other 7 variants") were not touched:
they are a separate drift not identified by the review and outside the
authorized IN-02 scope (count-phrase + `present`-enumeration only).

## Skipped Issues

### WR-01: Two autoupdate test titles assert "severity warning" but bodies assert info

**File:** `tests/orchestrators/marketplace/autoupdate.test.ts:124,143`
**Reason:** Already resolved in a prior pass (commit `59042ea`). Verified on
disk: both titles now read "... at severity info (benign per UXG-02 /
D-28-07)" (lines 124 and 143) and the bodies assert
`notifications[0]!.severity, undefined`. No re-application; left as-is.

### WR-02: No direct unit test pins the empty-`reasons` plugin-skip -> warning case

**File:** `tests/shared/notify-v2.test.ts`
**Reason:** Already resolved in a prior pass (commit `5911a1e`). Verified on
disk: the test "UXG-02 (D-28-06): plugin skip with empty reasons:[] computes
warning (allBenign guard on length)" exists at `notify-v2.test.ts:1995` and
asserts `args[1] === "warning"`. No re-application; left as-is.

### IN-01: `BENIGN_REASONS` is a runtime `Set` but is not asserted against `REASONS` membership

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:108-113`
**Reason:** Skipped by design. The review marks this optional and low-risk:
`BENIGN_REASONS` is typed `ReadonlySet<Reason>`, so any `BENIGN_REASONS`
literal removed from the `REASONS` tuple is already a hard compile-time type
error caught by `tsc --noEmit` in `npm run check`. The two proposed homes were
both rejected: (1) the arch-test membership proof at
`tests/architecture/notify-types.test.ts` is out of the reviewed file set, so
editing it would expand scope beyond what was reviewed; (2) an inline
`for (const r of BENIGN_REASONS) assert(REASONS.includes(r))` would add a
runtime side-effect to production `notify.ts` hot-path code, which the task
guidance explicitly discourages. There is no net-positive gain over the
existing compile-time guarantee that justifies expanding scope.
**Original issue:** No companion assertion / test that every `BENIGN_REASONS`
member is still present in `REASONS` at runtime (the closed-set
membership-proof pattern used elsewhere was not extended to this sub-set).

### IN-03: ADR Decision-section type sketch omits `reasons?` (Phase 17.1 amendment not folded)

**File:** `docs/adr/v2-001-structured-notify.md:32,85-91`
**Reason:** Intentionally skipped -- known-accepted gap. The ADR explicitly
defers refreshing the Decision-section type sketch per D-17.1-08
("amendment-not-folded" convention); the review itself states "No action
required if the D-17.1-08 amendment-not-folded convention holds." The
convention holds: the `reasons?` addition is documented in the Amendment:
Phase 17.1 section (line 200+) rather than folded back into the primary
Decision sketch. The ADR Decision sketch was left unedited.
**Original issue:** The Decision-section `MarketplaceNotificationMessage`
sketch lists `{ name; scope; status?; details?; plugins }` and omits the
`reasons?: readonly Reason[]` field that the Phase 17.1 amendment and the live
`notify.ts:566-573` both carry.

### IN-04: `MARKETPLACE_STATUSES`/`MarketplaceStatus` doc-count claims -- verify no off-by-one

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:264-272` vs
`docs/messaging-style-guide.md:27,52`
**Reason:** No fix needed -- the review records this as an explicit "checked,
consistent" note, not a defect. Independently re-verified against the live
source: `MARKETPLACE_STATUSES` has exactly 7 entries (`notify.ts:264-272`) and
both docs say "7"; `DEPENDENCIES` has exactly 2 entries and both docs say "2".
No drift. The note exists so the IN-02 plugin-count drift is not mistaken for
a blanket count problem; the mp-status and dependency counts are correct.
**Original issue:** Cross-check (completeness) -- confirmed no off-by-one on the
mp-status (7) and dependency (2) doc-count claims.

---

_Fixed: 2026-05-31T13:10:59Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
