---
phase: 17-spec-rewrite-catalog-uat-migration
plan: 03
subsystem: testing
tags:
  - testing
  - catalog-uat
  - byte-equality
  - notify
  - phase-17

# Dependency graph
requires:
  - phase: 15-shared-notify-type-model
    provides: NotificationMessage type model (PluginNotificationMessage discriminated union, MarketplaceNotificationMessage, MarketplaceDetails, UsageErrorMessage); PLUGIN_STATUSES / MARKETPLACE_STATUSES / DEPENDENCIES `as const` runtime tuples; Reason closed set
  - phase: 16-renderer-public-api-alongside-v1
    provides: notify(ctx, pi, message) public surface + computed severity (D-16-11) + computed reload-hint (D-16-12) + single softDepStatus(pi) probe at notify entry (D-16-14); the renderer whose byte output this UAT asserts against
  - plan: 17-01
    provides: v2.0 thin pointer style guide and Phase 17 SNM-26 flip
  - plan: 17-02
    provides: v2.0 always-marketplace-header catalog (928 lines, 50 catalog-state markers) -- the binding text this UAT now asserts byte-equality against
provides:
  - tests/architecture/catalog-uat.test.ts rewritten to drive notify() via 48 structured CatalogFixture entries keyed by (section, state); closed-loop user-contract gate via byte-equality + severity-arg shape per fixture
  - REQUIREMENTS.md SNM-19, SNM-20, SNM-31 advanced to Complete (SNM-26 was already Complete from Plan 17-01)
  - docs/output-catalog.md contingent run-as-source patches (RESEARCH.md Risk 6): 11 catalog states aligned with what notify() actually emits
affects:
  - 18 / 19 / 20 (migration waves) -- the catalog UAT now is the binding gate for any new orchestrator that constructs a NotificationMessage; byte changes in either notify() or the catalog will surface as test failures
  - 21 (final teardown) -- the V1 composer surface (presentation/*) is no longer referenced from this test; Phase 21 can delete the composers without touching the catalog UAT

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Run-as-source catalog correction: when fixture authoring surfaces byte mismatches against a catalog v2.0 block, the executor patches docs/output-catalog.md in the same commit to align the catalog with what notify() actually emits (RESEARCH.md Risk 6). The catalog is treated as drift-on-implementation; notify()'s emission is the correctness winner."
    - "Closed-loop user-contract gate via byte-equality + severity-arg shape: the FIXTURES map is keyed by (section, state) tuples; the driver loop walks parsed catalog examples, looks up each fixture, invokes notify() against a fresh mock ctx + the fixture's mock pi, asserts the call body byte-equal to the catalog block AND asserts the magic-string severity arg shape (omit-2nd-arg for info / 2-arg with literal for warning/error). Pitfall 6 mitigation."
    - "MockPi factory family for soft-dep probe testing: four factories (piWithBothLoaded / piWithSubagentsLoaded / piWithMcpLoaded / piWithNothingLoaded) drive the softDepStatus(pi) probe inside notify() to test the four soft-dep-marker emission combinations from a single per-row invocation. Inline-duplicated from tests/shared/notify-v2.test.ts:144-179 per RESEARCH.md Q1 Option 1 (avoid premature helper extraction)."

key-files:
  created: []
  modified:
    - "tests/architecture/catalog-uat.test.ts (1981 -> 1465 lines; V1 composer-driven driver replaced with notify()-driven driver; 48 CatalogFixture entries populated; parser preserved verbatim)"
    - "docs/output-catalog.md (928 -> ~928 lines after run-as-source patches; 11 catalog-state byte forms corrected to match what notify() emits)"
    - ".planning/REQUIREMENTS.md (3 status flips: SNM-19, SNM-20, SNM-31 Pending -> Complete)"
  deleted: []

key-decisions:
  - "Applied contingent run-as-source patches to docs/output-catalog.md in the same commit (RESEARCH.md Risk 6) for 11 catalog states where the Plan 17-02 authoring diverged from what notify() actually emits. The patches are bounded byte-string corrections inside existing fenced blocks pinned by their <!-- catalog-state: STATE --> markers; no structural changes (no new sections, no new state markers, no renamed states). The plan pre-declared docs/output-catalog.md in files_modified to legitimize this contingent edit path. Rationale: notify()'s emission is the correctness winner (the renderer is the binding spec landed by Phase 16); the catalog must agree with it for byte-equality to hold. Patches fall into three failure modes: (a) reload-hint trailer missing on list-surface states whose installed/updated plugin statuses trigger the trailer per D-16-12 (7 list states + bootstrap already-bootstrapped); (b) marketplace-level cause: trailer present in catalog but not emitted by notify() because the v2 type model places cause? on plugin variants only (unparseable-mp, marketplace add failure-unreachable); (c) failed plugin row with version-arrow `<from> → v<to>` in catalog but the v2 PluginFailedMessage carries only `version?` (no from/to per D-15-04 -- only the updated variant has composeVersionArrow). The corrections preserve the catalog's structural intent while making byte-equality holdable."
  - "Inline-duplicated the four MockPi factories from tests/shared/notify-v2.test.ts:144-179 rather than extracting them into a shared test helper (RESEARCH.md Q1 Option 1). Avoids premature shared-helper module creation; the cost is ~40 lines of duplication, the benefit is zero test-fixture coupling outside this test file. Phase 21 teardown can extract the shared helper if a third use site emerges."
  - "Wrote `void piWithSubagentsLoaded;` after the FIXTURES map to silence the no-unused-vars lint warning. Three of the four MockPi factories are referenced from fixtures (piWithBothLoaded, piWithMcpLoaded, piWithNothingLoaded); piWithSubagentsLoaded is currently unused. Kept as a composition primitive for future states (e.g. agent-declaring plugin with subagents loaded but mcp absent). The void-discard pattern is the minimum-impact suppression vs deleting the factory (which would force re-authoring at the next use site)."

patterns-established:
  - "Run-as-source catalog correction: when fixture authoring surfaces byte mismatches against a v2.0 catalog block, the executor patches docs/output-catalog.md in the same commit to align the catalog with what notify() actually emits. The catalog is treated as drift-on-implementation; the renderer is the correctness winner. Bounded scope: only byte-string corrections inside existing fenced blocks pinned by their <!-- catalog-state: STATE --> markers; structural changes (new sections / states / renames) require a separate follow-up plan."
  - "Closed-loop UAT gate via byte-equality + severity-arg shape: the catalog body is the binding text; the FIXTURES map is the synthesis input; notify()'s emission is the correctness winner. They MUST all agree for the test to pass. Any future byte change in either the renderer or the catalog will surface a [BYTE MISMATCH] / [SEVERITY MISMATCH] failure, structurally enforcing the v1.4 user contract."

requirements-completed:
  - SNM-19
  - SNM-20
  - SNM-31

# Metrics
duration: ~30min
completed: 2026-05-26
---

# Phase 17 Plan 03: Catalog UAT Migration Summary

**Catalog UAT (`tests/architecture/catalog-uat.test.ts`) rewritten from V1 composer fan-out (renderRow / cascadeSummary / renderManualRecovery / renderRollbackPartial / renderPluginList / renderMarketplaceList / appendReloadHint) to a single `notify(ctx, pi, message)` invocation per fixture. 48 CatalogFixture entries populate the (section, state) keyed FIXTURES map; driver loop asserts byte-equality between notify()'s output and the v2.0 catalog AND the magic-string severity arg shape per fixture. `npm run check` returns to GREEN, closing the deliberate Plan 17-02 RED window per Pitfall 2; the SNM-31 user-contract gate is now structurally enforced.**

## Performance

- **Duration:** ~30 minutes
- **Started:** 2026-05-26T12:30Z (approx)
- **Completed:** 2026-05-26T12:40Z (approx)
- **Tasks:** 3 (Task 1a skeleton + Task 1b fixtures + driver, Task 2 REQUIREMENTS, Task 3 commit -- all folded into one atomic commit per plan)
- **Files modified:** 3 (per plan `files_modified` -- the contingent catalog patch fired)

## Accomplishments

- Rewrote `tests/architecture/catalog-uat.test.ts` from 1981 lines (V1 composer-driven) to 1465 lines (notify()-driven). The reduction reflects the V1 fixture-factory map (each entry a closure constructing per-composer call args) being replaced by a structured NotificationMessage data map (each entry a flat literal).
- Authored 48 CatalogFixture entries spanning the 12 per-command H2 sections + manual-recovery-anchors fallback key (one entry per parseable catalog-state tuple). 17 of the 48 fixtures carry `expectedSeverity` (warning or error); the remaining 31 are info-severity (omit 2nd arg).
- Preserved the catalog-walking parser (loadCatalogExamples, sectionRe / stateRe, currentSection fallback) VERBATIM per D-17-05 + D-17-06. The two ancillary parser self-tests (returns no examples when catalog has no annotations; pairs each discriminator with next fenced block) are preserved verbatim and PASS.
- Driver loop asserts (a) `examples.length >= 30` (matches v1 floor; v2.0 catalog has 48 parseable states), (b) `ctx.ui.notify.mock.calls.length === 1` per fixture, (c) byte equality between `notify()`'s call body and `example.expected`, (d) severity-arg shape per Pitfall 6 (omit-2nd-arg for info; 2-arg with literal "warning" / "error" otherwise).
- Applied contingent run-as-source patches to `docs/output-catalog.md` for 11 catalog states (per RESEARCH.md Risk 6); see Deviations below for the per-state list and rationale.
- Advanced REQUIREMENTS.md SNM-19 / SNM-20 / SNM-31 from Pending to Complete. SNM-26 was already Complete from Plan 17-01.
- `npm run check` GREEN at 1351/1353 tests passing, 2 todo (from the Plan 17-01 Rule 3 gate); 0 failures. Phase 17 success criterion #5 satisfied.

## Task Commits

Tasks 1a + 1b + 2 + 3 folded into a single atomic commit per the plan:

1. **All tasks: V2 UAT rewrite + REQUIREMENTS flips + contingent catalog patches** -- `7c612f7` (test)

**Plan metadata:** This SUMMARY.md will be committed separately by the orchestrator after wave merge (worktree mode -- the executor does not commit shared .planning/ orchestrator artifacts; STATE.md / ROADMAP.md updates happen post-wave).

## Files Created/Modified

- **`tests/architecture/catalog-uat.test.ts`** (1981 -> 1465 lines) -- v2 catalog UAT. Drives `notify(ctx as never, fixture.pi as never, fixture.message)` per fixture; no V1 composer or `domain/source.ts::pathSource` imports remain. FIXTURES map carries 48 entries across 13 outer-map keys. MockCtx + MockPi + the four MockPi factories duplicated inline from tests/shared/notify-v2.test.ts:136-179 per RESEARCH.md Q1 Option 1. CatalogFixture interface + FixtureMap type defined. Header docblock rewritten to reflect v2 design (cites SNM-31 + D-17-03 + D-17-05 + D-17-06).
- **`docs/output-catalog.md`** -- 11 catalog states patched per RESEARCH.md Risk 6 run-as-source pattern. Patches fall into three buckets (see Deviations below).
- **`.planning/REQUIREMENTS.md`** -- 3 traceability-table status flips: SNM-19, SNM-20, SNM-31 Pending -> Complete. SNM-26 untouched (already Complete from Plan 17-01); per-phase distribution line untouched (already correct from Plan 17-01).

## Decisions Made

- **Run-as-source catalog correction applied for 11 states:** The Plan 17-02 catalog authoring diverged from what `notify()` actually emits for 11 catalog-state tuples. Rather than rejecting the fixture authoring or splitting into a follow-up plan, the executor applied bounded byte-string corrections to the catalog in the same commit per RESEARCH.md Risk 6's run-as-source pattern. The patches are non-structural (no new sections, no new state markers, no renamed states) -- they only edit byte forms inside existing fenced blocks pinned by their `<!-- catalog-state: STATE -->` markers. Three failure modes (see Deviations).
- **Inline-duplicated MockPi factories from tests/shared/notify-v2.test.ts:** Avoided premature helper extraction (RESEARCH.md Q1 Option 1). The duplication cost is ~40 lines; the benefit is zero test-fixture coupling outside this file. Phase 21 teardown may extract the shared helper if a third use site emerges.
- **Used `void piWithSubagentsLoaded;` to silence no-unused-vars:** Three of four MockPi factories are referenced from fixtures; piWithSubagentsLoaded is currently unused but kept as a composition primitive for future states (e.g. agent-declaring plugin with subagents loaded but mcp absent). The void-discard is the minimum-impact suppression.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Contingent run-as-source patches to docs/output-catalog.md for 11 catalog states (RESEARCH.md Risk 6 pre-sanctioned by the plan's files_modified declaration)**

- **Found during:** Task 1b fixture authoring / driver-loop activation -- the initial `npm test tests/architecture/catalog-uat.test.ts` after the FIXTURES map landed surfaced 12 [BYTE MISMATCH] failures (which dropped to 2 after applying the 11-state catalog patches + 2 fixture corrections; details below).
- **Issue:** The v2.0 catalog from Plan 17-02 had three classes of byte forms that the v2 `notify()` renderer cannot produce:
  - **Class A (8 states):** Catalog block missing the `\n\n/reload to pick up changes` trailer despite the payload containing `installed` / `updated` plugin statuses, which trigger reload-hint per D-16-12. Affected: 7 `/claude:plugin list` states (`single-mp-mixed`, `same-plugin-both-scopes`, `project-orphan-folded`, `soft-dep-on-installed`, `unparseable-mp`, `zero-plugin-mp-block`, `multiple-mps`) + 1 `/claude:plugin bootstrap` state (`already-bootstrapped`, mp.status `updated` triggers).
  - **Class B (2 states):** Catalog block contained a `cause:` line directly under a `(failed)` marketplace header, but `notify()`'s `composeMarketplaceBlock` does NOT emit a marketplace-level cause-chain trailer (the v2 type model places `cause?: Error` on plugin variants only). Affected: `/claude:plugin list state=unparseable-mp` (had a `cause: JSON parse error at line 3` line under the failed marketplace header), `/claude:plugin marketplace add state=failure-unreachable` (had a `cause: fatal: unable to access ...` line). The catalog's own surrounding prose for failure-unreachable already noted this asymmetry, but the fenced block itself still carried the cause line -- now removed.
  - **Class C (3 states):** Catalog block had `⊘ delta 1.0.0 → v1.4.0 (failed)` -- a failed plugin row with a version-arrow slot. But the v2 `PluginFailedMessage` carries only `version?` (no `from`/`to` fields per D-15-04 -- only the `updated` variant has `composeVersionArrow`). The renderer's `failed` arm uses `renderVersion` which prepends `v` to a bare version string; it cannot produce a `<from> → v<to>` arrow. Affected: `/claude:plugin update state=single-mp-mixed`, `/claude:plugin update state=bare-multi-mp`, `/claude:plugin marketplace update state=mixed-outcomes` (all three had the same failed-delta arrow-form mistake).
- **Fix:** For each affected state, the executor patched the fenced expected-output block + the surrounding prose paragraph (where the prose contradicted the new byte form). Class A: appended `\n\n/reload to pick up changes` to the fenced block. Class B: removed the `cause:` line; updated the surrounding prose to note the marketplace-level cause-trailer absence and direct orchestrators to per-plugin variants. Class C: dropped the version-arrow slot from the failed-delta row; updated the surrounding prose to clarify that `PluginFailedMessage` has no `from`/`to` fields.
- **Files modified:** `docs/output-catalog.md` (11 catalog states + surrounding prose paragraphs).
- **Verification:** `node --test tests/architecture/catalog-uat.test.ts` exits 0 (3/3 tests pass: catalog UAT GREEN, 2 parser self-tests GREEN). `npm run check` exits 0 (1351/1353 pass, 0 fail, 2 todo from Plan 17-01).
- **Committed in:** `7c612f7` (same atomic commit as the v2 UAT rewrite).
- **Plan authorization:** Pre-declared in the plan's `files_modified` frontmatter (`docs/output-catalog.md` listed with CONTINGENT annotation). RESEARCH.md Risk 6 run-as-source pattern explicitly sanctions this edit path: the catalog is treated as drift-on-implementation; `notify()`'s emission is the correctness winner.

**2. [Rule 1 - Bug] Two fixture corrections after initial catalog patches surfaced residual mismatches**

- **Found during:** Re-running the catalog UAT after the 9 Class A + Class C catalog patches landed (the 2 Class B mismatches required both a catalog patch AND a fixture correction).
- **Issue:**
  - `/claude:plugin list state=project-orphan-folded`: The fixture's user-scoped alpha row had no explicit `scope` field. The renderer omitted the `[user]` bracket because the row's scope inherited from the marketplace header. The catalog block shows BOTH alpha rows carrying explicit `[project]` and `[user]` brackets (the orphan-fold + same-scope rows are both annotated for disambiguation since the plugin name is identical). Fixture had to add `scope: "user"` to the same-scope row so the bracket renders.
  - `/claude:plugin list state=unparseable-mp`: Initial fixture had a per-plugin failed row inside the unparseable-mp marketplace carrying the cause. After the Class B catalog patch (which removed the cause-trailer line), the fixture's per-plugin failed row was still emitting an inline failed-row + cause that the catalog no longer expected. Corrected: fixture's `unparseable-mp` marketplace now uses empty `plugins: []` (bare failed header alone).
- **Fix:** Two fixture edits per above; both align with the v2 type model's structural constraints.
- **Files modified:** `tests/architecture/catalog-uat.test.ts`.
- **Verification:** Catalog UAT GREEN after the corrections.
- **Committed in:** `7c612f7` (same atomic commit).

---

**Total deviations:** 2 auto-fixed (1 Rule 3 blocking; 1 Rule 1 bug).
**Impact on plan:** The plan pre-declared the contingent catalog patch path in `files_modified`, so the Rule 3 deviation is exactly the kind RESEARCH.md Risk 6 sanctions. The Rule 1 fixture corrections are minor (2 fixture entries touched); they surfaced naturally during the iterative byte-equality alignment.

## Issues Encountered

- **Pitfall 2 RED window closed:** Plan 17-02 deliberately left the catalog UAT in a 43-byte-mismatch RED state because the still-V1 composer-based UAT byte-mismatched against the v2 catalog. This plan closes the window -- the UAT now drives `notify()` exclusively and byte-equals against the v2 catalog. `npm run check` returns to GREEN per the plan's binding gate.
- **trufflehog auto-updater failure under worktree sandbox:** Documented in CLAUDE.md and in Plans 17-01 / 17-02 SUMMARYs. The hook fails to spawn the underlying scan binary because the worktree's `.git/index` is a regular file (not a directory) and the auto-updater misinterprets it. Used `SKIP=trufflehog` for the commit per CLAUDE.md guidance.
- **mdformat post-prettier reconciliation on docs/output-catalog.md:** After `prettier --write` on the catalog, the pre-commit `mdformat` hook modified the file once (whitespace inside tables / paragraph reflow). Re-running `pre-commit run --files` was idempotent on the second cycle; catalog UAT remained GREEN. The byte forms in fenced blocks were NOT touched by mdformat (fenced text-language blocks are preserved verbatim).

## SNM Status After This Plan

- **SNM-19 (style guide v2.0):** **Complete** -- REQUIREMENTS.md status flipped on this commit.
- **SNM-20 (catalog v2.0):** **Complete** -- REQUIREMENTS.md status flipped on this commit. The contingent run-as-source patches refined the catalog to align with what `notify()` emits without altering its structural intent.
- **SNM-26 (frontmatter parity test):** **Complete** (landed in Plan 17-01; this plan did not touch the row, only re-verified the flip survived).
- **SNM-31 (catalog UAT migration):** **Complete** -- REQUIREMENTS.md status flipped on this commit. The UAT now drives `notify()` exclusively (D-17-03 pure exclusion); the V1 composer surface is no longer referenced from this test. Their coverage continues under `tests/shared/notify.test.ts` until Phase 21 deletes the composers.

All four Phase 17 SNM rows now read Complete. Phase 17 closes.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- **Phase 18 (marketplace orchestrators migration wave):** unblocked. The catalog UAT is now the binding gate for any orchestrator migrating from V1 wrappers to `notify()` -- adding a new (section, state) tuple to the catalog or modifying an existing one will surface as a byte-equality failure unless the corresponding fixture (and orchestrator behavior) align.
- **Phase 19 (plugin orchestrators migration wave):** unblocked, same gate semantics.
- **Phase 20 (edge handlers + UsageError migration wave):** unblocked.
- **Phase 21 (final teardown):** the V1 composer surface (`presentation/*`) is no longer referenced from `tests/architecture/catalog-uat.test.ts`. Phase 21 can delete the composers without touching this test file. The `tests/shared/notify.test.ts` coverage of the V1 wrappers continues until Phase 21's deletion lands.

## Self-Check: PASSED

Verifications performed (all PASS):

- `tests/architecture/catalog-uat.test.ts` v2 imports present: `notify`, `NotificationMessage` from `../../extensions/pi-claude-marketplace/shared/notify.ts`; `mock` from `node:test`.
- V1 composer imports absent (no `presentation/*` or `domain/source.ts` imports remain).
- `loadCatalogExamples` parser function present; the section/state regular expressions and the `currentSection = sectionMatch[2] ?? "manual-recovery-anchors"` fallback preserved verbatim.
- `interface MockCtx`, `interface CatalogFixture`, `function loadCatalogExamples`, `notify(ctx as never` substrings present.
- The two ancillary parser self-tests at the bottom of the file preserved verbatim.
- FIXTURES map populated with 48 entries (one per parseable catalog-state tuple); driver-loop test wired with byte-equality + severity-arg shape assertions per Pitfall 6.
- `node --test tests/architecture/catalog-uat.test.ts` exits 0 (3/3 tests pass: catalog UAT driver GREEN + 2 parser self-tests GREEN).
- `npm run check` exits 0 (1351 pass, 0 fail, 2 todo from Plan 17-01 Rule 3 gates).
- `grep -c '<!-- catalog-state:' docs/output-catalog.md` = 50 (>= 30 floor; 48 parseable + 1 usage-error in non-command section + 1 misc).
- REQUIREMENTS.md: SNM-19, SNM-20, SNM-26, SNM-31 all Complete; `grep -c 'Phase 17 | Pending' .planning/REQUIREMENTS.md` = 0.
- Commit `7c612f7` on branch `worktree-agent-a7179359989187d39` (not `main`); title matches `^test\(17\)`. Commit touches exactly `tests/architecture/catalog-uat.test.ts`, `docs/output-catalog.md`, `.planning/REQUIREMENTS.md` and no other path. Pre-commit hooks ran without `--no-verify` (only `SKIP=trufflehog` per CLAUDE.md worktree caveat; trufflehog auto-updater spawn failure is the documented sandbox issue, not a scan result).

---

*Phase: 17-spec-rewrite-catalog-uat-migration*
*Plan: 17-03*
*Completed: 2026-05-26*
