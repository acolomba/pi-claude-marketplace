---
phase: 98-lifecycle-regression-and-contract-documentation
fixed_at: 2026-08-10T06:45:00Z
review_path: .planning/phases/98-lifecycle-regression-and-contract-documentation/98-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 98: Code Review Fix Report

**Fixed at:** 2026-08-10T06:45:00Z
**Source review:** `.planning/phases/98-lifecycle-regression-and-contract-documentation/98-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 9 (CR-01 + WR-01..WR-08; the review recorded no info findings)
- Fixed: 9
- Skipped: 0
- Carrier todos created: 0

**Verification:** `PI_SUBAGENTS_ROOT=… npm run check` -> `CHECK_EXIT=0` (typecheck + ESLint +
Prettier + 3381 passing unit/integration tests, 0 failures, 1 pre-existing skip; plus the 18-test
e2e suite). Run in the phase worktree `.worktrees/manifest-independent-plugin-info`, which is the
same tree the commits below land in — the numbers reproduce from a plain checkout of that branch.
Log: `/tmp/claude-1000/-home-acolomba-pi-claude-marketplace/d4af6d08-e357-4f4d-bf0a-f953c0bf6cae/scratchpad/98-fix-check.log`.

## Fixed Issues

### CR-01: The stale-gate enable failure named a flag `enable` rejects

**Files modified:** `extensions/pi-claude-marketplace/shared/notify.ts`, `docs/output-catalog.md`,
`docs/messaging-style-guide.md`, `tests/architecture/catalog-uat.test.ts`,
`tests/orchestrators/plugin/enable-disable.test.ts`,
`tests/edge/handlers/plugin/enable-disable.test.ts`
**Commit:** `f8575e3d`
**Applied fix:** Minted `STALE_GATE_UPDATE_HINT_TRAILER` ("Run update --partial on this plugin,
then enable it again.") and split the renderer gate so `failed` + `partialHint` selects it while
`partially-upgradable` keeps the frozen XSURF-03 literal. The trailer NAMES `update`, which is what
the catalog prose at the same state already said correctly.

The remedy still carries `--partial`: after WR-01 the stale-gate record is a CLEAN disabled record,
which plain `update` declines. So `update --partial` — not bare `update` — is what re-pins it. The
review's compounding note ("plain `update` alone now re-pins it") was true only under the
over-broad gate WR-01 narrows.

Repinned in the same commit: the `enable-failed-stale-gate` catalog block and its prose, the style
guide's frozen-trailer inventory, and both byte assertions. Added an edge test asserting `enable
… --partial` yields `Unknown flag: "--partial".` — the fact the trailer has to respect.

### WR-01: The partial gate admitted a consent-free degradation of a clean disabled record

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`,
`tests/orchestrators/plugin/update.test.ts`
**Commit:** `d1287a30`
**Applied fix:** Replaced the bare `isRecordedButDisabled(record)` disjunct with
`widensPartialGate(record)` = disabled AND already degraded. The ENBL-05 predicate is still the
single reader of the disabled marker (the drift-twin gate stays green); the availability axis is
read beside it, not folded into it. A clean disabled record whose candidate would newly degrade
keeps the XSURF-03 decline row and an unchanged record until an explicit `--partial` consents.

Added the two missing cases the review named: clean + disabled + newly-degrading candidate ->
decline row, record untouched; and the same record with `--partial` -> consented re-pin.

### WR-02: The disabled-record refresh claimed `{up-to-date}` over a moved pin

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`,
`tests/orchestrators/plugin/update.test.ts`, `tests/architecture/catalog-uat.test.ts`,
`docs/output-catalog.md`
**Commit:** `d105651f`
**Applied fix:** The arm now returns the `skipped` partition with the inherited idempotent reason
`already disabled` instead of `unchanged` + `up-to-date`. No token was minted; `already disabled`
is in `IDEMPOTENT_REASONS`, so the row keeps its info severity and emits no summary line.

Two findings while implementing, both recorded in the code comment: (1) the arm is reachable ONLY
when the version moved — `preflightUpdate` short-circuits to `unchanged` on
`toVersion === fromVersion` before the disabled branch — so the false claim rendered every time,
and a "did anything change?" conditional would be dead code; (2) the version slot is left empty
rather than showing `fromVersion`, which the record no longer holds.

The review's suggested `partition: "updated"` was NOT taken: `updated` is a reload-trigger status,
so a disabled record that materialized nothing would emit `/reload to pick up changes`.

The idempotency test now asserts the two calls render DIFFERENTLY (first re-pins ->
`{already disabled}`; second is a true no-op -> `{up-to-date}`), which is the honest version of the
equality it previously asserted.

### WR-03: `InstallPluginOutcome` advertised signals it never populated

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`,
`tests/orchestrators/plugin/install.test.ts` (+ prose follow-up in `f805bea1`)
**Commit:** `8e00b806`
**Applied fix:** The `installed` arm now intersects the shared shape MINUS the two staged-count
verdicts, and every remaining field is populated: the dropped-component kind list is written from
the ledger's own resolution when it came back partially-available. This closes the latent
contradiction the review flagged (one `partial: true` at a call site away from a bare `(installed)`
row over a record that lists as `(partially-installed)`).

`stagedAgents` / `stagedMcpServers` were removed rather than populated: they duplicate the REQUIRED
`declaresAgents` / `declaresMcp` predicates that existing consumers already read, so removing them
eliminates the duplicate vocabulary the review flagged without touching a consumer.

Expressed as `Omit<…, "stagedAgents" | "stagedMcpServers">` rather than a `Pick`: the D-75-01
partial-vocabulary gate forbids the quoted retired status literal anywhere in the tree, and a `Pick`
key would have spelled it. Same contract, different spelling (see `f805bea1`).

### WR-04: The `plugin-backfilled` arm dropped both ledger signals

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/types.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`,
`extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts`,
`extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`,
`extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts`,
`tests/orchestrators/reconcile/notify.test.ts`, `tests/orchestrators/plugin/reinstall.test.ts`
**Commit:** `06773b3f`
**Applied fix:** Both `PluginBackfilledOutcome` and `PluginInstalledOutcome` now INHERIT
`orphanRewake` + `degradedKinds` from the one shared shape (the review's second note: previously
only the enable arm did), so all three ledger-driven arms read one vocabulary. The backfill push
site threads the orphan-rewake fact from its own offline resolution and the malformed kinds from
the reinstall outcome.

`ReinstallReinstalledOutcome` gained the degraded-kinds signal, derived in `successOutcome` from
the prepared handles the bridges return — reinstall tracked no degradation at all before, which is
why the signal had nowhere to come from.

The backfill row moved into `backfilledRowFromOutcome`, mirroring `enabledRowFromOutcome`: emits in
install's order (orphan rewake, malformed kinds, dropped kinds) and takes the WARN-01 warning raise
for a malformed component while a still-degraded promotion stays info per SEV-03.

The dropped-kind list is deliberately NOT inherited on the backfill arm — it already carries the
re-resolved kind list from its own resolution.

### WR-05: `staleGateDropped` could erase the narrowed base reasons via `??`

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`,
`tests/orchestrators/plugin/enable-disable.test.ts`
**Commit:** `d3f4735f`
**Applied fix:** An empty narrowing returns `undefined` (names no fact -> not a match), so the
helper's documented "leave the row exactly as it was" contract is enforced rather than assumed.
Added a `__test_staleGateDropped` seam (mirroring install.ts's `__test_` exports) because the case
is unreachable through the public verb — which is precisely why it needed pinning.

### WR-06: `assertNoForbiddenSurface` silently skipped a missing target

**Files modified:** `tests/helpers/source-scan.ts`, `tests/helpers/source-scan.test.ts` (new),
`tests/architecture/compat-01-no-expansion.test.ts`
**Commit:** `793449a2`
**Applied fix:** A missing target now fails with a message naming the uncovering, and a gate
authored ahead of its file uses an explicit `opts.allowMissing` waiver. Both consuming gates
inherit it, including the COMPAT-01 delegation clause the review flagged.

Added `tests/helpers/source-scan.test.ts` — gate-the-gate coverage. Both consumers assert an
ABSENCE, so a scan that inspects nothing passes exactly like one that inspects everything; the new
cases pin the difference, including that an existing target is really read.

### WR-07: The eighth-glyph clause missed a declaration form

**Files modified:** `tests/architecture/compat-01-no-expansion.test.ts`
**Commit:** `15aa4deb`
**Applied fix:** Widened to `\bexport const ICON_[A-Z_]+\b`, per the review's fallback ("if the
source scan must stay"). Verified against a patched copy of `notify.ts` carrying a typed eighth
glyph: the old pattern counted 7 (miss), the new one counts 8 (catch).

Added a clause pinning what the pattern must see — all three spellings including the two that used
to slip past — and what it must not (a glyph USE is not a declaration). The counting clause asserts
an absence, so a pattern matching nothing would have passed it just as quietly.

The review's preferred remedy (a frozen exported `ICONS` record) was not taken: adding an export to
the byte-frozen renderer module is a larger change than the finding, and the pattern-level fix was
the guidance's stated option.

### WR-08: The catalog's glyph names for `◉` and `◍` were wrong and swapped

**Files modified:** `docs/output-catalog.md`, `tests/architecture/compat-01-no-expansion.test.ts`
**Commit:** `7952c086`
**Applied fix:** `◉` (U+25C9) is now "fisheye (a filled circle inside a ring)" and `◍` (U+25CD) is
"circle with vertical fill", matching the COMPAT-01 code-point pins. Added a gate gating the
pairing for all seven glyphs, so renaming one in either document without the other now fails —
the self-inconsistency class the finding describes cannot recur silently.

## Follow-up commit

`f805bea1` — the WR-03 subset type and two WR-03/WR-04 comments tripped the D-75-01
partial-vocabulary guard (quoted retired status literal as a `Pick` key; bare backtick verdict
without its array-or-kind qualifier). Re-expressed as an `Omit` and qualified the prose. Same
contract; committed separately because it spans two findings' files.

## Notes for the verifier

- Two rendered-byte contracts changed, each repinned with its catalog block, its catalog prose and
  its byte assertions in the same commit: the `enable-failed-stale-gate` trailer (CR-01) and the
  `disabled-record-refresh` row (WR-02). No closed set gained or lost a member — every token used
  is inherited (`already disabled` from `IDEMPOTENT_REASONS`, `skipped` from `PLUGIN_STATUSES`).
  The one new frozen literal is a trailer, which is not a closed-set member (the two existing
  trailer literals already establish that they coexist).
- WR-01 and WR-02 interact by design: WR-01 narrows WHICH records reach the refresh arm, WR-02
  fixes what that arm RENDERS. CR-01's wording depends on WR-01's outcome, as noted above.
- WR-02 changes bulk-cascade behavior: the refresh row is now `skipped`, not `unchanged`, so the
  UGRM-01 bulk suppression no longer hides it. That is intended — a re-pin is a fact worth a row —
  and it fires only when a pin actually moved, not on the steady state.
- No deferrals, so no carrier todos were created in `.planning/todos/pending/`.

---

_Fixed: 2026-08-10T06:45:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
