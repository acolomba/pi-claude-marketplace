---
phase: 13-conformance-refactor-es-5-supersession
plan: 03-01
subsystem: testing
tags:
  [
    catalog-uat,
    byte-equality,
    discriminator,
    reasons-extension,
    msg-gr,
    msg-sd,
    msg-rh,
    msg-cc,
    msg-mr,
    msg-rp,
    msg-pl,
    msg-er,
    CMC-22,
    CMC-23,
    CMC-24,
    CMC-25,
    CMC-26,
    CMC-27,
    CMC-28,
    CMC-29,
    CMC-30,
    CMC-31,
    CMC-32,
    CMC-33,
    CMC-34,
  ]

# Dependency graph
requires:
  - phase: 13-conformance-refactor-es-5-supersession
    provides: |
      Wave 1 keystone primitives + Wave 2 sub-waves 2a / 2b / 2c / 2d
      production patterns:
      - RowSpec discriminated union (9 variants) + renderRow grammar
        composer (presentation/compact-line.ts) with MSG-GR-1 token
        order, MSG-GR-2 @marketplace carve-out, MSG-GR-5 marker slot,
        MSG-IC-1..3 icon dispatch, MSG-PL-6 scope-bracket carve-out,
        and MSG-SD-1..3 per-row soft-dep injection.
      - cascadeSummary({marketplace, rows, probe}) -> {message,
        severity} (presentation/cascade-summary.ts) with 2-arm
        severity (success | warning, MSG-SR-6 forbids error on
        cascade summaries).
      - renderManualRecovery + renderRollbackPartial composers for
        MSG-MR-1..2 and MSG-RP-1 surfaces.
      - renderPluginList (presentation/plugin-list.ts) + payload
        contract for marketplace-headed list rendering with
        orphan-fold + per-marketplace empty block.
      - renderMarketplaceList (presentation/marketplace-list.ts) +
        MarketplaceListEntry shape.
      - appendReloadHint (presentation/reload-hint.ts) MSG-RH-1
        single-trailer composer.
      - compareByNameThenScope (presentation/sort.ts) for MSG-GR-3
        sort.
      - REASONS 25-entry closed set extended to 28 entries by this
        plan (`permission denied`, `source missing`, `network
        unreachable`); STATUS_TOKENS 15-entry closed set unchanged.
      - All 12 per-command orchestrator surfaces emit via the Wave 1
        primitives (sub-waves 2a / 2b / 2c / 2d).

provides:
  - "tests/architecture/catalog-uat.test.ts: byte-equality runner for
    every annotated catalog example. Reads docs/output-catalog.md at
    runtime, walks per-command H2 sections, pairs `(section, STATE)`
    tuples with programmatic fixtures, asserts byte equality against
    the renderer output. 31 examples covered across 13 H2 sections."

  - "docs/output-catalog.md: 45 `<!-- catalog-state: STATE -->`
    discriminator annotations added before every fenced renderer-output
    block in per-command sections. Grammar templates in non-command
    sections (Conventions, Severity routing, Status token reference,
    Empty / no-op surfaces, Usage errors, Resolutions, Cross-references)
    intentionally carry no annotation; the parser skips them. Two
    catalog body corrections rolled in: (a) `/claude:plugin list`
    unparseable-mp example: row order corrected so `other-mp` precedes
    `unparseable-mp` alphabetically (the prose already said
    'alphabetically among the other marketplaces'); (b) `/claude:plugin
    reinstall single-mp-all-failed` reason `{manifest unreadable}`
    corrected to `{unreadable manifest}` to match the closed REASONS
    set entry. (c) `/claude:plugin marketplace list` mixed-scopes
    example: removed the `(added)` status token from every row (list
    rows are pure label rows per CMC-29 / the locked sub-wave 2c
    renderer; the catalog drifted)."

  - "extensions/pi-claude-marketplace/shared/grammar/reasons.ts:
    closed REASONS set extended from 25 to 28 entries by adding
    `permission denied`, `source missing`, and `network unreachable`.
    Required because the catalog binds these reasons on uninstall
    failure, marketplace-remove partial child, reinstall failure, and
    update / marketplace-update network-failure rows -- the renderer's
    `Reason` literal union rejects any string outside the closed set,
    so without the extension the catalog UAT fixtures cannot
    construct the catalog's compact-line shape. File-header comment
    extended to document the Plan 13-03-01 entries alongside the
    sub-wave 2c entries (D-13-20 precedent)."

  - "docs/messaging-style-guide.md: frontmatter `reasons:` list
    extended with the 3 new entries (byte-equal to the closed REASONS
    array per the Phase 12 D-CMC-04 grammar-frontmatter drift test).
    §4 reasons table extended with the 3 new rows documenting each
    new reason's purpose + citing surface."

affects:
  - "13-03-02 (Wave 3 plan #2: ES-5 atomic three-file commit) -- this
    plan's catalog UAT is the PRE-COMMIT GATE per D-13-04. If any
    byte-equality assertion fails, Wave 3 plan #2 DOES NOT RUN. The
    catalog UAT is the binding verification for every per-command
    requirement (CMC-22..34) and the primary tool for catching
    regressions across the entire mechanical refactor."

  - "Phase 14 (frontmatter drift-guard suite) -- the closed REASONS
    set extension may surface in Phase 14's MSG-* rule assertions when
    they iterate the closed set. The 3 new entries follow the existing
    bare-string + 1-3-word convention so no schema work is required."

# Tech tracking
tech-stack:
  added: [] # No new dependencies.
  patterns:
    - "Catalog UAT byte-equality runner with discriminator pairing:
      the catalog (docs/output-catalog.md) is the SOLE source of truth
      for the rendered examples (D-30). The test reads the .md at
      runtime; it does NOT duplicate the rendered examples into test
      code. Fixtures construct the renderer-input state and let the
      renderer produce the comparison string. The
      `<!-- catalog-state: STATE -->` HTML-comment discriminator is the
      pairing key (RESEARCH.md Pitfall 7 binding parsing approach)."

    - "Pre-commit verification gate via byte-equality test: D-13-04
      sequences Wave 3 as (plan #1: catalog UAT must pass) -> (plan
      #2: ES-5 atomic commit). The byte-equality test catches every
      regression in the renderer + every drift in the catalog before
      the legacy marker exports are deleted. Mirrors the
      grammar-frontmatter drift test (Phase 12) which gates closed-set
      drift at the YAML-frontmatter boundary."

    - "Closed REASONS set extension via mirrored
      code-frontmatter-table-comment update (sub-wave 2c / D-13-20
      precedent): when the catalog binds a reason not yet in the
      closed set, extend the closed set rather than amend the
      catalog. Update (a) the `as const` array in
      shared/grammar/reasons.ts, (b) the `reasons:` block in
      docs/messaging-style-guide.md frontmatter, (c) the §4 reasons
      table in docs/messaging-style-guide.md, and (d) the file-header
      comment, all in a single atomic commit so the
      grammar-frontmatter drift test stays green."

    - "Catalog drift correction priorities under D-30: when the
      catalog and the renderer diverge, fix whichever side drifted
      from the LOCKED truth in docs/messaging-style-guide.md. Sort
      order and grammar slot constraints are renderer-locked (the
      catalog drifted). Reason wording is closed-set-locked (the
      catalog drifted if it uses a different word order). Reasons
      not in the closed set are catalog-binding (extend the closed
      set per the previous pattern)."

    - "Section-anchored fenced-block extraction with H2-header
      tracking: anchors extraction to the per-command H2 boundaries
      (`/^## /` lines whose heading text matches either a backtick-
      wrapped `/claude:plugin <verb>` token or the
      `Manual recovery anchors` plain heading). Non-command H2
      sections reset `currentSection` to `null`, suppressing any
      fenced block inside them. The discriminator + the next fenced
      block form the example pair; templates in non-command sections
      lack discriminators and are skipped."

key-files:
  created:
    - "tests/architecture/catalog-uat.test.ts (the catalog UAT
      byte-equality runner: 1 loadCatalogExamples helper, 1
      FIXTURES map covering 13 per-command sections x 31 (section,
      state) tuples, 1 top-level byte-equality test, 2 parser-shape
      unit tests; runs in ~2.5s within the <=5s VALIDATION.md
      sampling-rate target)"

  modified:
    - "docs/output-catalog.md (45 catalog-state discriminator
      annotations added before every fenced renderer-output block in
      per-command sections; 3 catalog drift fixes rolled in: list
      unparseable-mp row order, reinstall single-mp-all-failed
      reason wording, marketplace list mixed-scopes status-token
      removal)"
    - "docs/messaging-style-guide.md (frontmatter `reasons:` list +
      §4 reasons table extended with the 3 new closed-set entries:
      `permission denied`, `source missing`, `network unreachable`)"
    - "extensions/pi-claude-marketplace/shared/grammar/reasons.ts
      (REASONS array extended from 25 to 28 entries; file-header
      comment extended to document Plan 13-03-01 alongside sub-wave
      2c)"

key-decisions:
  - "Catalog UAT runner location: tests/architecture/ (per RESEARCH.md
    -- the catalog UAT is a cross-cutting architectural assertion
    alongside grammar-frontmatter.test.ts, no-legacy-markers.test.ts,
    markers-snapshot.test.ts; tests/architecture/ is the standing
    home for these)."
  - "FIXTURES map keyed by `[section][STATE]` with `() => string`
    factories: deferred construction lets the test report missing
    fixtures and byte mismatches in a single pass with one error
    bundle per run (rather than failing on the first mismatch)."
  - "Discriminator pattern: HTML comments before each fenced block
    (`<!-- catalog-state: STATE -->`). Chosen over: per-block ```text
    info-string parameters (would require an HTML-comment fallback
    anyway because triple-backtick info-strings are not preserved by
    all markdown parsers), per-section markers (would lose
    block-level pairing precision), and frontmatter-only state lists
    (would diverge from the rendered example block content)."
  - "Catalog drift fixes resolved in this plan rather than deferred
    to follow-up: (a) list unparseable-mp row order, (b) reinstall
    single-mp-all-failed reason wording, (c) marketplace list
    mixed-scopes status-token removal. Each is a single-line fix
    that aligns the catalog with the locked renderer (D-30); the
    parallel_execution guidance explicitly authorises catalog
    corrections of this scope."
  - "Closed REASONS set extension over catalog amendment: the catalog
    binds `permission denied`, `source missing`, `network unreachable`
    on multiple per-command rows (uninstall, mp remove partial,
    reinstall failures, update / mp update network failures); the
    operator-mental-model value of each reason justifies its place
    in the closed set. Amending the catalog to use a different
    reason would lose observability of WHY each failure occurred.
    Sub-wave 2c D-13-20 set this precedent (extended STATUS_TOKENS
    from 14 to 15 to add `reinstalled` rather than amending the
    catalog to `(installed)`)."
  - "EntityErrorRow `reasons: []` for the manual-recovery anchor
    example's install-failure head row: the catalog renders the
    failure row WITHOUT a reasons block; the variant requires a
    reasons array (it is a non-optional field on EntityErrorRow),
    so the fixture passes an empty array and relies on
    `composeReasons` returning `\"\"` for an empty composed list per
    MSG-GR-4 (which forbids emitting `{}`)."

patterns-established:
  - "Pattern: Catalog UAT discriminator annotation. HTML-comment
    `<!-- catalog-state: STATE -->` immediately before each fenced
    renderer-output block in a per-command H2 section. Templates in
    non-command sections carry no annotation; the parser skips them.
    STATE is a deterministic kebab-case label naming the rendered
    state. Pairing is keyed by `(section, STATE)` so two different
    sections may share the same STATE name."
  - "Pattern: Byte-equality test driver with bundled-failures report.
    A single top-level test() walks every catalog example, collects
    every missing-fixture or byte-mismatch failure into a Failure[]
    array, and at the end asserts the array is empty via
    `assert.fail` with a per-failure formatted error message. This
    surfaces ALL failures in one run rather than failing on the
    first mismatch; the diff format includes the section + state +
    expected + actual strings so the executor can diagnose at a
    glance."
  - "Pattern: Renderer-locked truth boundary for catalog
    corrections. When the catalog and the renderer diverge, the
    LOCKED truth is whichever side aligns with
    docs/messaging-style-guide.md (the v1.0 user-contract authority
    per D-30). Three classes of fix surface in this pattern: (1)
    sort order / grammar slot constraints are renderer-locked --
    align the catalog body; (2) reason wording is closed-set-locked
    -- align the catalog text or rename in both places consistently;
    (3) reasons absent from the closed set are catalog-binding --
    extend the closed REASONS array + frontmatter + §4 table + code
    comment in a single atomic commit."
  - "Pattern: Markdown fenced-block parser anchored to H2 boundaries
    with non-command H2 reset. Walks lines; on `## ` prefix tests
    against the per-command H2 regex and sets `currentSection` (or
    resets to `null` for non-command H2 like `## Conventions`).
    Pending discriminators are cleared on every section transition.
    Fenced blocks inside `currentSection === null` are entered
    (so the closing fence is recognised) but no example is emitted
    on close."
  - "Pattern: Pre-commit verification gate via byte-equality test.
    Wave 3 plan #1 (this plan's catalog UAT) gates Wave 3 plan #2
    (the ES-5 atomic three-file commit) per D-13-04. The catalog
    UAT must exit 0 before the legacy marker exports are deleted
    from shared/markers.ts. Mirrors the grammar-frontmatter drift
    test (Phase 12) which gates closed-set drift at the
    YAML-frontmatter boundary."

requirements-completed:
  - CMC-22
  - CMC-23
  - CMC-24
  - CMC-25
  - CMC-26
  - CMC-27
  - CMC-28
  - CMC-29
  - CMC-30
  - CMC-31
  - CMC-32
  - CMC-33
  - CMC-34

# Metrics
duration: 35min
completed: 2026-05-23
---

# Phase 13 Plan 03-01: Wave 3 Catalog UAT -- Byte-Equality Verification Gate Summary

**The catalog UAT runner at `tests/architecture/catalog-uat.test.ts` reads `docs/output-catalog.md` at test time, walks every `<!-- catalog-state: STATE -->` discriminator inside a per-command H2 section, pairs the `(section, STATE)` tuple with a programmatic fixture, and asserts byte equality against the renderer output composed via the Wave 1 + Wave 2 presentation primitives. The closed REASONS set is extended from 25 to 28 entries to accommodate `permission denied`, `source missing`, and `network unreachable` per the catalog binding (sub-wave 2c D-13-20 precedent). Three catalog drift fixes land in the same commits to align the catalog with the locked renderer truth. The test is the PRE-COMMIT GATE for the Wave 3 ES-5 atomic three-file commit (plan #2): if any byte-equality assertion fails, plan #2 DOES NOT RUN.**

## Performance

- **Duration:** ~35 minutes
- **Started:** 2026-05-23T21:21:00Z
- **Completed:** 2026-05-23T21:56:00Z
- **Tasks:** 2 / 2
- **Files modified / created:** 1 created (`tests/architecture/catalog-uat.test.ts`) + 3 modified (`docs/output-catalog.md`, `docs/messaging-style-guide.md`, `extensions/pi-claude-marketplace/shared/grammar/reasons.ts`)
- **Tests:** 1125 / 1125 passing (was 1122 before the plan -- net +3 reflects the 3 new catalog-UAT tests; the closed REASONS extension touched no existing tests)

## Accomplishments

- **Catalog UAT runner shipped (Task 2).** `tests/architecture/catalog-uat.test.ts` reads `docs/output-catalog.md` at runtime, parses 31 `<!-- catalog-state: STATE -->` discriminator pairs across 13 per-command H2 sections, and asserts byte equality against the renderer output composed via `renderRow`, `cascadeSummary`, `renderPluginList`, `renderMarketplaceList`, `renderManualRecovery`, and `appendReloadHint`. The runner exits 0 in ~2.5s (well under the 5s VALIDATION.md sampling-rate target).

- **45 catalog-state discriminator annotations added (Task 1).** Every per-command H2 section in `docs/output-catalog.md` now carries `<!-- catalog-state: STATE -->` comments before each fenced renderer-output block. Templates in non-command sections (Conventions, Severity routing, Status token reference, Empty / no-op surfaces, Usage errors, Resolutions, Cross-references) intentionally carry no annotation; the parser skips them. STATE labels are deterministic kebab-case, descriptive of the rendered state, unique within a section.

- **Catalog drift fixes (3 corrections):**
  - `/claude:plugin list` `unparseable-mp` example: row order reversed so the catalog matches the locked alphabetical-by-name renderer sort (`other-mp` before `unparseable-mp`). The prose at the bottom of the section already said "alphabetically among the other marketplaces" -- the example body had the wrong order.
  - `/claude:plugin reinstall` `single-mp-all-failed` example: reason `{manifest unreadable}` corrected to `{unreadable manifest}` to match the closed REASONS set entry (style guide §4 since Phase 12).
  - `/claude:plugin marketplace list` `mixed-scopes` example: removed the `(added)` status token from every row. List rows are pure label rows per CMC-29 / the locked sub-wave 2c `presentation/marketplace-list.ts` renderer; the catalog drifted.

- **Closed REASONS set extended from 25 to 28 entries.** Added `permission denied`, `source missing`, and `network unreachable`. The catalog binds these reasons on uninstall failure, marketplace-remove partial child, reinstall failure, and update / marketplace-update network-failure rows. The renderer's `Reason` literal union rejects any string outside the closed set, so without the extension the catalog UAT fixtures cannot construct the catalog's compact-line shape. The style-guide frontmatter `reasons:` list + §4 reasons table + the reasons.ts file-header comment all land in the same commit so the Phase 12 grammar-frontmatter drift test stays green (sub-wave 2c D-13-20 precedent).

- **CMC-22..34 all verified byte-equal.** Every per-command requirement is exercised by at least one fixture: list (8), install (5), uninstall (3), reinstall (6), update (4), import (3), bootstrap (2), marketplace list (2), marketplace add (3), marketplace remove (2 -- clean + partial), marketplace update (3 -- autoupdate-off + autoupdate-on + mp-failure), marketplace autoupdate (3 -- enable-mixed + disable-mixed + failure-not-found), manual-recovery anchor (1).

- **D-13-04 gate sequence locked.** Wave 3 plan #2 (the ES-5 atomic three-file commit at `extensions/pi-claude-marketplace/shared/markers.ts` + `tests/architecture/markers-snapshot.test.ts` + `docs/prd/pi-claude-marketplace-prd.md` §6.12) is now blocked on this test's exit code: it must exit 0 before the legacy marker exports are deleted.

## Task Commits

Each task was committed atomically:

1. **Task 1: Annotate `docs/output-catalog.md` with HTML-comment state discriminators (+ 1 catalog drift fix)** -- `e391de4` (docs) -- also folds in the `marketplace list` mixed-scopes `(added)` removal because the parallel_execution guidance authorises catalog corrections when the locked truth surfaces a drift.

2. **Task 2: Create `tests/architecture/catalog-uat.test.ts` + extend closed REASONS set + 2 catalog drift fixes** -- `575bba4` (test) -- landed the test, the 3-entry REASONS extension, and the 2 remaining catalog drift fixes (list `unparseable-mp` row order, reinstall `single-mp-all-failed` reason wording) in a single commit because the test surfaces both kinds of fix at the same time.

## Files Created/Modified

### Created

- `tests/architecture/catalog-uat.test.ts` -- the catalog UAT byte-equality runner. ~1600 lines covering: a 50-line `loadCatalogExamples` helper (H2-anchored fenced-block parser with discriminator pairing), a 1400-line `FIXTURES` map keyed by `[section][STATE]` with `() => string` factories (13 per-command sections x 31 fixture entries), a top-level byte-equality test that bundles all failures into a single error report, and 2 parser-shape unit tests for the extraction helper.

### Modified

- `docs/output-catalog.md` -- 45 discriminator annotations + 3 catalog drift fixes (see Decisions).
- `docs/messaging-style-guide.md` -- frontmatter `reasons:` list + §4 reasons table extended with the 3 new closed-set entries.
- `extensions/pi-claude-marketplace/shared/grammar/reasons.ts` -- REASONS array extended from 25 to 28 entries; file-header comment extended to document the Plan 13-03-01 extension alongside the sub-wave 2c entries.

## Decisions Made

See the `key-decisions:` block in the frontmatter (6 entries documenting the test-shape and catalog-drift-resolution choices made during execution). Briefest summary:

1. Catalog UAT runner location: `tests/architecture/` (cross-cutting architectural assertion home).
2. FIXTURES map with `() => string` factories: deferred construction enables single-pass error bundling.
3. Discriminator pattern: HTML comments (`<!-- catalog-state: STATE -->`) over fenced info-strings / per-section markers / frontmatter-only state lists.
4. Catalog drift fixes resolved in this plan rather than deferred: each is a single-line fix authorised by the parallel_execution guidance.
5. Closed REASONS set extension over catalog amendment: preserves operator-mental-model observability per sub-wave 2c D-13-20 precedent.
6. `EntityErrorRow reasons: []` for the manual-recovery install-failure head: the catalog renders no `{}` block; `composeReasons` returns `""` for an empty composed list per MSG-GR-4.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Catalog `/claude:plugin list` unparseable-mp example row order wrong**

- **Found during:** Task 2 (test run #1 -- the byte-equality assertion failed with a clear diff)
- **Issue:** The catalog body had `unparseable-mp` BEFORE `other-mp` even though `o` < `u` alphabetically. The renderer's `compareByNameThenScope` comparator sorts marketplace blocks alphabetically (MSG-GR-3); the locked sub-wave 2d behavior places `other-mp` first. The prose at the bottom of the catalog section already said "alphabetically among the other marketplaces" -- the example body contradicted its own prose.
- **Fix:** Reordered the example body so `other-mp` precedes `unparseable-mp`. Catalog drift, not renderer drift -- D-30 keeps the renderer + style-guide MSG-GR-3 as the locked truth.
- **Files modified:** `docs/output-catalog.md`.
- **Verification:** Catalog UAT passes for the `unparseable-mp` fixture; `npm run check` exits 0.
- **Committed in:** `575bba4` (Task 2 commit).

**2. [Rule 1 - Bug] Catalog `/claude:plugin reinstall` single-mp-all-failed reason wording diverged from closed set**

- **Found during:** Task 2 (typecheck failure -- `"manifest unreadable"` is not assignable to `Reason`)
- **Issue:** The catalog used `{manifest unreadable}` for a reinstall failure reason. The closed REASONS set has `{unreadable manifest}` (word order reversed) since Phase 12 -- the locked truth at `docs/messaging-style-guide.md` §4 documents the closed-set entry as "A marketplace manifest could not be read during `list` rendering (PL-6 surface)". The catalog drifted from the closed set wording.
- **Fix:** Corrected the catalog body from `{manifest unreadable}` to `{unreadable manifest}`. The test fixture also uses `unreadable manifest`. Catalog drift, not closed-set drift.
- **Files modified:** `docs/output-catalog.md`.
- **Verification:** Catalog UAT passes for the `single-mp-all-failed` fixture; `npm run check` exits 0.
- **Committed in:** `575bba4` (Task 2 commit).

**3. [Rule 1 - Bug] Catalog `/claude:plugin marketplace list` mixed-scopes example carried a `(added)` status token on every row**

- **Found during:** Task 1 (manual inspection while annotating the example; cross-referenced against `tests/presentation/marketplace-list.test.ts`)
- **Issue:** The catalog rendered each marketplace-list row with a `(added)` status token, but the locked sub-wave 2c `presentation/marketplace-list.ts` renderer emits list rows as PURE LABEL ROWS without any status token (per CMC-29 / the renderer's `MarketplaceRow` factory which intentionally omits `status` / `reasons`). The sub-wave 2c SUMMARY documents this: "status and reasons intentionally omitted -- list rows are pure label rows (CMC-29)." The catalog drifted from the locked renderer contract.
- **Fix:** Removed the `(added)` status from every row in the `mixed-scopes` example body. Added a new bullet to the explanatory notes documenting the pure-label-row semantics ("List rows are pure label rows -- no status token. The marketplace's outcome on `add` is announced by `marketplace add`; the list surface just enumerates what is configured.").
- **Files modified:** `docs/output-catalog.md`.
- **Verification:** Catalog UAT passes for the `mixed-scopes` fixture; `tests/presentation/marketplace-list.test.ts` (locked from sub-wave 2c) continues to pass unchanged.
- **Committed in:** `e391de4` (Task 1 commit, folded in because the drift surfaced during annotation rather than test execution).

**4. [Rule 2 - Missing critical primitive] Closed REASONS set missing 3 catalog-bound reasons**

- **Found during:** Task 2 (typecheck failures on `"permission denied"`, `"source missing"`, `"network unreachable"`)
- **Issue:** The catalog binds three additional reasons not yet in the Phase 12 closed REASONS set (which was at 25 entries after sub-wave 2c's `already enabled` / `already disabled` extension): `permission denied` (uninstall failure, mp remove partial child), `source missing` (reinstall failures), `network unreachable` (update + mp update network failures). The renderer's `Reason` literal union derives from the closed set; without these entries the catalog UAT fixtures cannot construct the catalog's compact-line shape.
- **Fix:** Extended the closed REASONS set from 25 to 28 entries by adding the 3 new reasons. Updated the style-guide frontmatter `reasons:` list AND the §4 reasons table in the same commit so the Phase 12 `tests/architecture/grammar-frontmatter.test.ts` byte-equality assertion stays green. Extended the file-header comment in `shared/grammar/reasons.ts` to document Plan 13-03-01 alongside the sub-wave 2c entries.
- **Files modified:** `extensions/pi-claude-marketplace/shared/grammar/reasons.ts`, `docs/messaging-style-guide.md`.
- **Verification:** Catalog UAT passes for every fixture that uses the new reasons; `npm run check` exits 0 (typecheck + grammar-frontmatter drift test both green).
- **Committed in:** `575bba4` (Task 2 commit).
- **Precedent:** Sub-wave 2c D-13-20 extended STATUS_TOKENS from 14 to 15 to add `reinstalled` for the same reason (catalog-binding token not in the closed set; extending the closed set wins over amending the catalog because it preserves operator-mental-model observability).

**5. [Rule 3 - Tooling] ESLint + Prettier auto-fixes on the new test file**

- **Found during:** Task 2 (pre-commit / `npm run check` post-test-pass)
- **Issue:** ESLint flagged `prefer-string-starts-ends-with` (regex `^```` should be `startsWith("```")`), `no-meaningless-void-operator` on bottom-of-file `void renderRollbackPartial;` etc., `padding-line-between-statements` style issues; Prettier flagged minor formatting.
- **Fix:** Ran `npx eslint --fix tests/architecture/catalog-uat.test.ts` (autofixed the regex-to-startsWith pattern + spacing), then dropped the unused `renderRollbackPartial` value import and the `RollbackChild` / `PluginListRow` / `PluginListPayload` type-only references (they weren't actually used in any fixture), then ran `npx prettier --write tests/architecture/catalog-uat.test.ts`. No semantic changes.
- **Files modified:** `tests/architecture/catalog-uat.test.ts`.
- **Verification:** `npm run check` exits 0; the catalog UAT continues to pass with the cleaned-up imports.
- **Committed in:** `575bba4` (Task 2 commit; cleanups landed in the same commit as the test).

---

**Total deviations:** 5 auto-fixed (3 catalog drift fixes per Rule 1, 1 closed-set extension per Rule 2, 1 lint-format batch per Rule 3).

**Impact on plan:** All deviations were required for the test to pass `npm run check`. No scope creep -- each fix aligns the catalog with the locked truth in `docs/messaging-style-guide.md` (D-30) or extends a closed set per a Phase 13 precedent (sub-wave 2c D-13-20). The pattern of "fix whichever side drifted from the locked truth" was applied consistently per the parallel_execution guidance.

### Authentication Gates

None. All operations were filesystem-local typecheck / test / lint flows; no network or auth surface was touched.

## Issues Encountered

- **Pre-commit `trufflehog` hook fails inside the worktree sandbox.** Known per project CLAUDE.md and the parent execute-plan agent's guidance. Worked around by prefixing each commit with `SKIP=trufflehog`. Both commits also skipped `mdformat` + `markdownlint-cli2` for the messaging-style-guide.md frontmatter (the same documented gap Plan 13-01-01 / Plan 13-02c-01 worked around: mdformat lacks the `mdformat-frontmatter` plugin so it would corrupt the YAML frontmatter as a horizontal rule). The other changed files (`docs/output-catalog.md`, `extensions/pi-claude-marketplace/shared/grammar/reasons.ts`, `tests/architecture/catalog-uat.test.ts`) were run through the full pre-commit pipeline without skips.

## TDD Gate Compliance

Task 2 is marked `tdd="true"` in the plan frontmatter. Per the plan-level TDD gate semantics for `type: execute` plans, the test file was written first, run, and observed to fail on the catalog drift (the `unparseable-mp` row order mismatch) -- this is the RED gate. The fix landed in the same commit as the test (the catalog correction), making the test green -- the GREEN gate. No REFACTOR pass was needed (the test ran in budget at ~2.5s and the fixture map shape is the binding contract for Wave 3 plan #2 to consume).

The catalog UAT itself IS the test-first contract for the entire Wave 2 mechanical refactor: every Wave 2 sub-wave landed a per-command renderer that this test now verifies byte-equal against the catalog binding.

## Threat Surface Scan

The plan's `<threat_model>` register identified 2 dispositions:

- **T-13-18 (Tampering -- catalog UAT pairing):** mitigated structurally. Every annotated catalog block MUST have a fixture entry; missing entries surface as `[MISSING FIXTURE]` failures in the bundled-failures report, not silent passes. The discriminator's kebab-case format + the per-section keying make accidental collisions visible (a duplicate STATE within a section would be a parser-observed pairing error during catalog authoring).
- **T-13-19 (Information Disclosure):** n/a. The test only reads the local catalog file + runs renderers; no network or PII surface is touched.

No new security-relevant surface introduced. No `threat_flag:` entries to record.

## Known Stubs

None. Every annotated catalog block has a corresponding fixture entry; every fixture produces byte-equal output against the catalog. The 3 catalog drift fixes resolved the divergences in-place; no "to fix later" comments or placeholder branches were introduced. The `EntityErrorRow reasons: []` form for the manual-recovery install-failure head row is documented as intentional (the variant requires a reasons array; `composeReasons` returns `""` for empty input per MSG-GR-4) -- not a stub, just an idiom for the no-reasons-block emission case.

## Self-Check: PASSED

**Files verified to exist:**

- FOUND: tests/architecture/catalog-uat.test.ts
- FOUND: docs/output-catalog.md (modified)
- FOUND: docs/messaging-style-guide.md (modified)
- FOUND: extensions/pi-claude-marketplace/shared/grammar/reasons.ts (modified)
- FOUND: .planning/phases/13-conformance-refactor-es-5-supersession/13-03-01-SUMMARY.md (this file)

**Commits verified to exist:**

- FOUND: e391de4 (Task 1 catalog annotations + marketplace list status-token removal)
- FOUND: 575bba4 (Task 2 catalog UAT test + REASONS extension + remaining catalog drift fixes)

**Overall verification:**

- FOUND: `node --test tests/architecture/catalog-uat.test.ts` exits 0 (3/3 pass in ~2.5s)
- FOUND: `npm run check` exits 0 (1125/1125 tests pass; typecheck + lint + format clean)
- FOUND: `grep -c 'catalog-state:' docs/output-catalog.md` returns 45 (>= 30 required)
- FOUND: `grep -c 'output-catalog.md' tests/architecture/catalog-uat.test.ts` returns >= 1 (catalog read at runtime per D-30)
- FOUND: `grep -c 'renderRow\|cascadeSummary\|renderManualRecovery\|renderRollbackPartial\|renderPluginList\|renderMarketplaceList' tests/architecture/catalog-uat.test.ts` returns >= 5 (every per-command composer is imported and used by at least one fixture)
- FOUND: `grep -c 'catalog-state:' tests/architecture/catalog-uat.test.ts` returns >= 1 (parser uses the discriminator)
- FOUND: `grep -c 'FIXTURES' tests/architecture/catalog-uat.test.ts` returns >= 1 (the fixture map)
- FOUND: `grep -c 'assert.equal\|assert.deepEqual\|assert.fail' tests/architecture/catalog-uat.test.ts` returns >= 1 (byte-equality assertion via assert.fail with bundled diff)
- FOUND: Test runtime is ~2.5s (<= 5s VALIDATION.md sampling-rate target)
- FOUND: The test is the GATE for Wave 3 plan #2 (D-13-04) -- it exits 0 before the ES-5 atomic commit runs

______________________________________________________________________

_Phase: 13-conformance-refactor-es-5-supersession_
_Plan: 03-01_
_Completed: 2026-05-23_
