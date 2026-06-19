---
phase: quick-260618-tzl
plan: 01
status: complete
requirements_satisfied:
  - D-54-01
  - ENBL-04
  - UAT-03
  - DIFF-02
files_modified:
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/notify-grammar-invariant.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/list.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/shared/notify-v2.test.ts
  - docs/output-catalog.md
commits:
  - a0011dd
branch: features/v1.13-hook-bridge
---

# 260618-tzl — Use `◌` glyph for disabled plugin rows

## Outcome

The deliberate, user-requested disabled-class plugin rows (`(disabled)`
and `(will disable)`) now render with the dedicated `◌` (U+25CC DOTTED
CIRCLE) glyph via a new `ICON_DISABLED` module-private constant. They no
longer share the `⊘` (U+2298 CIRCLED DIVISION SLASH) glyph that marks the
error / blocked-state rows (`(unavailable)`, `(failed)`,
`(skipped) {already disabled}`, `(manual recovery)`).

The split mirrors the existing realized + pending-tense precedent
already in the grammar:

- `●` for `(installed)` and `(will add)`
- `○` for `(available)` and `(will remove)`
- `◌` for `(disabled)` and `(will disable)` (new)
- `⊘` reserved for the four error / blocked-state rows

## Source change

`extensions/pi-claude-marketplace/shared/notify.ts`:

- Added `ICON_DISABLED = "◌"` immediately below `ICON_UNINSTALLABLE` (line
  ~1326) with a jsdoc anchor to `D-54-01` / `ENBL-04` describing the
  closed-set role and the contrast with `⊘`.
- Flipped the `case "disabled":` render arm from `ICON_UNINSTALLABLE` to
  `ICON_DISABLED`. Comment rewritten to reference the dedicated glyph; the
  surviving anchor is `D-54-01 / ENBL-04`. Subject-first grammar and
  no-reasons clauses retained.
- Flipped the `case "will disable":` render arm from `ICON_UNINSTALLABLE`
  to `ICON_DISABLED`. Comment rewritten to drop the false
  "prohibited-symbol semantics" rationale and instead cite the realized
  + pending-tense precedent. `DIFF-02` anchor retained.
- Updated the `PluginDisabledMessage` jsdoc at line ~653 to say the
  renderer arm "uses `ICON_DISABLED` (`◌`)" instead of "reuses
  `ICON_UNINSTALLABLE` (`⊘`)".
- `ICON_UNINSTALLABLE` remains declared and still backs the `(failed)`,
  `(skipped)`, `(unavailable)`, `(manual recovery)`, and marketplace
  `(failed)` arms.

## Test changes

Five test files received surgical `⊘` → `◌` byte-form flips on every
`(disabled)` and `(will disable)` site. `(skipped) {already disabled}`
rows in `tests/shared/notify-v2.test.ts` were deliberately NOT flipped —
they are skipped-class rows, not disabled-class.

- `tests/architecture/notify-grammar-invariant.test.ts`:
  - `DISABLED_TOKEN_RE` regex literal now matches `^◌ ...` instead of
    `^⊘ ...`.
  - The comment and test title describing the `(disabled)` byte form
    updated to `◌`.
  - The `WILL_TOKEN_RE` character class extended from `[●○⊘]` to
    `[●○⊘◌]` so the realigned `(will disable)` rows pass the
    subject-first invariant. This was caught only when `npm run check`
    surfaced a failure on the DIFF-02 invariant test — the plan had not
    listed this regex; it was a Rule 3 auto-fix.
- `tests/orchestrators/plugin/enable-disable.test.ts`: 2 byte-form
  assertions flipped.
- `tests/orchestrators/plugin/list.test.ts`: 3 regex assertions flipped
  plus the explanatory comment.
- `tests/orchestrators/plugin/info.test.ts`: 2 assertions flipped (one
  string literal, one regex literal — the regex on line 1308 was a
  straggler beyond the plan's enumerated list, caught by the grep
  sweep).
- `tests/shared/notify-v2.test.ts`: 6 byte-form assertions flipped at
  lines 3702, 3793, 3811, 3829, 3847, 3877. Lines 3906 and 3961
  (`(skipped) {already disabled}`) deliberately preserved on `⊘`.

## Doc changes

`docs/output-catalog.md`:

- **Legend (line 11):** removed `(will disable)` from the `⊘` bullet's
  enumeration; added a new `◌` bullet covering `(disabled)` and
  `(will disable)`.
- **Icon legend (line 36):** added `◌` alongside `●` / `○` / `⊘`.
- **Row map (line 144):** flipped the `(will disable)` Icon column from
  `⊘` to `◌`; added a new `(disabled)` row with `◌`.
- **Disabled-inventory rendered example (line 311) + paragraph (line
  314):** flipped the byte form to `◌`; replaced the
  `RESEARCH Pattern 5` reference in the explanatory text with a
  phrasing that names the realized/pending-tense precedent directly
  (per the comment policy spirit, which discourages per-phase RESEARCH
  references even in user-visible docs).
- **`Enable / disable transitions` section (line 1279):** dropped the
  `(Phase 54 hand-off shape)` parenthetical from the heading; rewrote
  the paragraph to drop the `Phase 53` / `Phase 54` / `Pitfall 53-4`
  GSD planning history; flipped the byte form on line 1288 to `◌`.
- **`disable-fresh` rendered example (line 1648):** flipped the byte
  form to `◌`.
- **`disable-idempotent` example (line 1661):** deliberately
  preserved on `⊘` — it is a `(skipped)` row, not `(disabled)`.

mdformat realigned the status-token reference table column widths to
accommodate the new wider `(disabled)` row description. This is a
deterministic formatter-driven change, not a content edit.

## Deviations from plan

All Rule 3 (auto-fix blocking issues), no Rule 4 architectural
deviations:

1. **`WILL_TOKEN_RE` character class extension** — not listed in the
   plan. Adding `◌` to the existing `[●○⊘]` character class was
   necessary because `(will disable)` rows now render with `◌` and the
   pre-existing subject-first invariant test (`DIFF-02`) would
   otherwise fail. Surgical one-character addition.
2. **Extra regex flip in `tests/orchestrators/plugin/info.test.ts`
   line 1308** — listed in the plan as a straggler-grep concession; no
   real deviation.

No architectural changes. No new files. No deferred items.

## Verification results

- Source-level invariant
  `⊘[^⊘]*\((disabled|will disable)\)` across `extensions/`, `tests/`,
  `docs/`: **0 hits** (target: 0).
- New-glyph presence
  `◌[^◌]*\((disabled|will disable)\)` across `extensions/`, `tests/`,
  `docs/`: **17 hits** (estimate: 18+; the gap is because the row-map
  entries on lines 145/146 have column-aligned spaces and pipe
  characters between `◌` and `(disabled|will disable)` that the strict
  `[^◌]*` regex doesn't span as a single line-segment — both rows are
  present and correct under a plain `◌` grep).
- Negative invariant
  `⊘[^⊘]*\((skipped|failed|unavailable|manual recovery)\)` across
  `tests/` and `docs/`: **213 hits** — preserved (no collateral
  flips).
- `npm run check`: **2317 / 2319 pass, 1 fail, 1 skip**. The single
  failure is the pre-existing `tests/docs/hooks-doc.test.ts`
  ("docs/hooks.md ships all 6 worked-example sections"), caused by the
  unstaged user edit in `docs/hooks.md` that is out of scope for this
  dispatch.
- `pre-commit run --files <touched>`: green after one mdformat pass
  (it normalized table column widths in `output-catalog.md`).

## Commit

- `a0011dd` `feat(notify): split (disabled) glyph from ⊘ to ◌`
  - Branch: `features/v1.13-hook-bridge`
  - 7 files changed, 73 insertions(+), 56 deletions(-)
  - Files: shared/notify.ts, 5 test files, docs/output-catalog.md
  - NOT staged: README.md, docs/hooks.md (unstaged user edits unrelated
    to this dispatch).

## Self-Check: PASSED

- `git log -1 --format=%H` → `a0011dd` reachable on `HEAD`.
- All seven listed files appear in `git show --stat a0011dd`.
- Zero straggler `⊘.*\((disabled|will disable)\)` matches outside
  `.planning/` and `CHANGELOG.md`.
