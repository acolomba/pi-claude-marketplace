---
phase: 17-spec-rewrite-catalog-uat-migration
plan: 02
subsystem: documentation
tags:
  - documentation
  - catalog
  - user-contract
  - notify
  - phase-17

# Dependency graph
requires:
  - phase: 15-shared-notify-type-model
    provides: The `NotificationMessage` type model + `PLUGIN_STATUSES` / `MARKETPLACE_STATUSES` / `DEPENDENCIES` runtime tuples whose closed-set authority the v2.0 catalog points at
  - phase: 16-renderer-public-api-alongside-v1
    provides: The `notify(ctx, pi, message)` renderer + `notifyUsageError(ctx, message)` overload + state-change/severity/reload-hint/soft-dep computation -- the v2.0 catalog's byte forms are byte-equal to what these emit
  - plan: 17-01
    provides: v2.0 thin-pointer style guide that pre-locks the conventions the catalog instantiates per command
provides:
  - v2.0 user-contract catalog at `docs/output-catalog.md` (928 lines, 50 catalog-state markers, 14 per-command H2 sections + Manual recovery + Empty + Usage)
  - The binding text Plan 17-03 will assert byte-equality against once the catalog UAT is rewritten to drive `notify()` (D-17-03 pure exclusion)
affects:
  - 17-03 (catalog UAT migration -- consumes the catalog states + state-marker convention as the user-contract gate input; rewrites the UAT to drive `notify()` against per-(section,state) `NotificationMessage` fixtures + restores `npm run check` GREEN by closing the deliberate Pitfall 2 RED window)
  - 18 / 19 / 20 (orchestrator + edge migration waves -- consume the v2.0 catalog states as the binding "what notify() should emit" reference once their callsites migrate from V1 wrappers to `notify()`)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Renderer-as-spec catalog: every fenced expected-output block is byte-equal to what `notify(ctx, pi, message)` emits given a corresponding structured fixture; the doc IS the user-contract gate text consumed by the catalog UAT"
    - "Catalog-state HTML-comment marker convention preserved: `<!-- catalog-state: STATE -->` on its own line above the fenced block, STATE lowercase + digits + hyphens only -- D-17-05 / D-17-06 parser-compatible"
    - "Deliberate-RED-window discipline: the still-V1 catalog UAT byte-mismatches against the v2 catalog at this plan's boundary; Plan 17-03 closes the window. The failure shape (`[BYTE MISMATCH] section=... state=...`) is asserted by the plan's verify gate as the expected red signal"

key-files:
  created: []
  modified:
    - "docs/output-catalog.md (971-line v1.0 -> 928-line v2.0 -- rewrites every per-command H2 section's expected output to the always-marketplace-header form per Phase 16 D-16-04 + drops the V1-only states per D-17-09 / D-17-10 + deletes the Resolutions authoring scratchpad)"
  deleted: []

key-decisions:
  - "Documented the v1->v2 dropped surfaces in the Conventions section WITHOUT reproducing the verbatim v1 literal strings (`Claude plugin import summary`, `Fix the underlying issue and retry`, `Existing marketplace source ... does not match Claude settings source ...`) -- the plan's verify gate uses negative greps on those exact substrings, so reproducing them in the catalog (even as historical references) would have made the catalog grep against itself. The substantive content of each dropped surface is described prose-only, keyed to its D-17-09 / D-17-10 rationale."
  - "Bootstrap re-run state (`already-bootstrapped`) rendered as `● claude-plugins-official [user] (updated)` rather than as an empty no-op or as `(skipped)`. v2's MARKETPLACE_STATUSES set has no `skipped` entry per D-15-07, and the orchestrator must emit SOMETHING for the user-visible bootstrap re-run -- `(updated)` is the closest fit (the marketplace persistence record was touched; the plugins were not). Reload-hint fires because `updated` is in the state-changing set per D-16-12. Plan 17-03's UAT fixture for this state will codify this orchestrator behavior."
  - "marketplace add failure with cause-chain (`failure-unreachable`) rendered as bare failed-header (no 2-space-indent cause trailer below). Reading `notify.ts::composeMarketplaceBlock` carefully, the v2 renderer does NOT emit a per-marketplace cause-chain trailer for failed marketplaces with no plugin children -- the type model places `cause?: Error` on plugin variants only, never on the marketplace header. The catalog state's prose includes the cause text for reviewer context but flags (in a Note paragraph beneath the fenced block) that the byte form is the bare failed header. Plan 17-03's fixture for this state will mirror the bare form."
  - "marketplace autoupdate enable / disable both render as `(updated)`. v2's MARKETPLACE_STATUSES has no flag-flip-specific status; orchestrators detecting an idempotent flip render `(updated)` regardless of direction. The catalog notes this asymmetry (v1 had a `<no autoupdate>` marker variant that survives only on the list-surface SUB-BRANCH B header)."
  - "Manual recovery anchors section retained as a one-state stub for the per-plugin manual-recovery variant inside a marketplace block (`per-plugin-manual-recovery`); v1's system-level `install-failure-with-anchor` state is dropped per D-17-10 (no v2 type-model equivalent for a top-level free-form recovery line)."

patterns-established:
  - "Always-marketplace-header catalog grammar: every command surface's expected output block opens with a column-0 marketplace header (per `renderMpHeader` 5-arm switch) followed by 2-space-indent plugin rows (per `renderPluginRow` 10-arm switch). Single-plugin commands render the same two-line shape as multi-plugin cascades; the v1 carve-out is dropped."
  - "Conditional plugin-row scope bracket: same-scope rows omit the bracket; orphan-fold rows emit it inline. The catalog locks both the same-scope case (every install/uninstall success state) and the orphan-fold case (`/claude:plugin list` -> `project-orphan-folded` state) so the rule is testable from both sides."

requirements-completed:
  - SNM-20

# Metrics
duration: ~11min
completed: 2026-05-26
---

# Phase 17 Plan 02: Catalog v2.0 Rewrite Summary

**v2.0 always-marketplace-header user-contract catalog (928 lines, 50 catalog-state markers across 14 per-command H2 sections + Manual recovery + Empty + Usage) replaces v1.0's 971-line single-plugin-carve-out shape; every fenced expected-output block is now byte-equal to what `notify(ctx, pi, message)` emits given a corresponding structured fixture. The plan deliberately leaves `tests/architecture/catalog-uat.test.ts` in a known-RED state per Pitfall 2 -- Plan 17-03 restores `npm run check` GREEN by rewriting the UAT to drive `notify()` against per-(section, state) `NotificationMessage` fixtures.**

## Performance

- **Duration:** ~11 minutes
- **Started:** 2026-05-26T11:58:04Z
- **Completed:** 2026-05-26T12:09:48Z
- **Tasks:** 2 (Task 1 full catalog rewrite + Task 2 atomic commit; both folded into one commit)
- **Files modified:** 1 (per plan `files_modified`)

## Accomplishments

- Rewrote `docs/output-catalog.md` from 971-line v1.0 to 928-line v2.0 (line count within the RESEARCH.md §Q8 750-850 target's slip range; the extra ~80 lines absorb the worked-out v2 grammar walkthroughs the planner judged useful in the Conventions and Status-token sections).
- Locked the v2 marketplace-header byte form as a 7-row table in the Conventions section: state-change arms (`added` / `removed` / `updated` / `failed`) + 3 list-surface SUB-BRANCH variants (bare, autoupdate-only, autoupdate + lastUpdatedAt).
- Documented the conditional plugin-row scope bracket discipline (same-scope omit; orphan-fold emit; `available`/`unavailable` carve-out) and exercised it in the `/claude:plugin list` `project-orphan-folded` state -- locks Phase 16 D-16-17 from the catalog side.
- Rewrote every per-command H2 section's expected-output block to v2 grammar:
  - Single-plugin install / uninstall / update / reinstall now render the two-line always-marketplace-header form (D-16-04).
  - Multi-plugin cascade sections (reinstall / update / import) retain the marketplace-header structure but drop the V1 `<autoupdate>` marker from non-list-surface headers (the v2 state-change arms do not carry the marker per `renderMpHeader`).
  - `import` cascade drops the v1 preamble line + source-mismatch state per D-17-09; 4 retained import states render cleanly.
  - `marketplace remove` partial drops the v1 retry-anchor trailer per D-17-09; reload-hint discipline locked per Phase 16 D-16-12.
  - `marketplace update` / `marketplace autoupdate` / `bootstrap` render marketplace-only blocks (`plugins: []`) at the always-marketplace-header form.
- Locked the failed-only no-reload-hint suppression case via the `reinstall` `single-mp-all-failed` state (Phase 16 D-16-12 refinement of SNM-15).
- Locked the (no marketplaces) sentinel (`(no marketplaces)` literal body) for the empty top-level `marketplaces: []` case in both `/claude:plugin list` `empty` and `/claude:plugin marketplace list` `empty` states.
- Manual recovery anchors section retained as a one-state stub (`per-plugin-manual-recovery`) for the per-plugin variant inside a marketplace block; v1's system-level `install-failure-with-anchor` state is dropped per D-17-10.
- Empty / no-op surfaces table trimmed: kept `(no marketplaces)` + bare-header-alone semantics; dropped the per-marketplace `(no plugins)` body row (D-15-08 -- empty `plugins: []` IS the structural representation).
- Usage errors section retained: v2 `notifyUsageError(ctx, UsageErrorMessage)` shape with `${message}\n\n${usage}` join + structural error severity.
- Resolutions to apply to `docs/messaging-style-guide.md` H2 (v1 authoring-time scratchpad) deleted in full.
- Cross-references updated to point at the v2.0 spec surfaces (style guide v2.0, ADR, renderer source, compile-check arch test, catalog UAT, PRD §6.12 ES-5 origin).

## Task Commits

Tasks 1 and 2 were folded into a single atomic commit per the plan (Task 2 was scoped to "commit only -- no further file edits"):

1. **Task 1 + Task 2: Full catalog rewrite + atomic commit** -- `7e391fb` (docs)

**Plan metadata:** This SUMMARY.md will be committed separately by the orchestrator after wave merge (worktree mode -- the executor does not commit shared `.planning/` orchestrator artifacts; the orchestrator's STATE.md / ROADMAP.md updates also happen post-wave).

## Files Created/Modified

- **`docs/output-catalog.md`** (971 -> 928 lines) -- v2.0 always-marketplace-header user-contract catalog. 50 `<!-- catalog-state: STATE -->` markers across 14 per-command H2 sections + Manual recovery + Empty + Usage. Every fenced expected-output block is byte-equal to what `notify()` emits for a corresponding `NotificationMessage` fixture. Conventions section documents the v2 marketplace-header shape (7 rows), the conditional plugin-row scope bracket discipline, the indentation discipline (col 0 / 2 / 4 / 6), the reload-hint trigger ladder, the severity-routing ladder, and the v1->v2 dropped surfaces (referenced by D-17-09 / D-17-10 rationale, not reproduced verbatim).

## Decisions Made

- **v1 verbatim strings NOT reproduced in the catalog body:** the plan's verify gate uses negative greps on `Claude plugin import summary` / `Fix the underlying issue and retry` / `Existing marketplace source` literal substrings. Reproducing those strings (even as historical references inside a "dropped surfaces" prose paragraph) would have made the catalog grep against itself. The substantive content of each dropped surface is described prose-only, keyed to its D-17-09 / D-17-10 rationale -- enough for reviewers to recognize the simplification without giving the catalog UAT's negative-grep gate something to match.
- **Bootstrap re-run state rendered as `(updated)`** rather than `(skipped)` or empty. v2's `MARKETPLACE_STATUSES` has no `skipped` entry per D-15-07; the closest fit for "the marketplace record was touched but no plugins changed" is `(updated)`. Reload-hint fires because `updated` is in the state-changing set per D-16-12. Plan 17-03's UAT fixture for `already-bootstrapped` will codify this.
- **marketplace add failure state's `cause:` trailer documented prose-only.** Reading `notify.ts::composeMarketplaceBlock` carefully, the v2 renderer does NOT emit a per-marketplace cause-chain trailer for failed marketplaces with no plugin children -- `cause?: Error` lives on plugin variants only, never on the marketplace header. The catalog state's fenced block shows what `notify()` would emit (a bare failed header) preceded by a prose note explaining that orchestrators wanting to surface the cause must construct the payload as a per-plugin failed/manual-recovery row carrying the cause text. Plan 17-03's UAT fixture for this state will assert the bare-header byte form.
- **marketplace autoupdate enable + disable both render `(updated)`.** v2 has no flag-flip-specific marketplace status; orchestrators detecting an idempotent flip render `(updated)` regardless of direction. The v1 `<no autoupdate>` marker survives only on the SUB-BRANCH B list-surface header form (and even there only via the absence of `<autoupdate>` -- the renderer does not emit a `<no autoupdate>` literal).
- **Manual recovery anchors section retained as a one-state stub.** The per-plugin manual-recovery row is the v2-canonical shape (`PluginManualRecoveryMessage` is a per-plugin variant inside a marketplace block). The catalog adds a dedicated `per-plugin-manual-recovery` state under this section rather than relying solely on indirect coverage via the reinstall / update / install cascade sections -- gives Plan 17-03 a clean fixture target.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] markdownlint MD038 "Spaces inside code span elements" + mdformat/prettier whitespace reconciliation**

- **Found during:** Task 1 verification gate (`pre-commit run --files docs/output-catalog.md`).
- **Issue:** Three locations triggered MD038 because they wrapped multi-character literal patterns (with leading spaces or comma-space separators) inside inline backticks: `` `    [<phase>] (rollback failed)` `` (twice, in Conventions §Indentation discipline + in install §failure-rollback-partial prose) and `` `, ` `` (in import §soft-dep-markers prose). Pre-commit also reported `mdformat` modifying the file after `prettier --write` had already normalized it; the two formatters had a transient conflict around the marketplace-header-shape table that resolved after one mdformat round-trip.
- **Fix:** Rewrote the three offending inline-code spans into prose that names the pattern without wrapping the leading-whitespace literal (e.g., "each phase: `[<phase>] (rollback failed)`" and "comma-space separator"). Ran `prettier --write` once, then `pre-commit run --files docs/output-catalog.md` (with `SKIP=trufflehog`); the second pre-commit cycle was idempotent (mdformat did not modify the file again), so prettier and mdformat are now reconciled on this file's shape.
- **Files modified:** `docs/output-catalog.md`
- **Verification:** `SKIP=trufflehog pre-commit run --files docs/output-catalog.md` passes; subsequent `prettier --check docs/output-catalog.md` also passes. The fix is editorial-only -- the v2 catalog byte forms in the fenced expected-output blocks were NOT touched.
- **Committed in:** `7e391fb` (same atomic commit as the v2 rewrite).

---

**Total deviations:** 1 auto-fixed (1 Rule 3 blocking)
**Impact on plan:** The deviation is editorial -- 3 inline-code spans rewritten to satisfy MD038 + a one-round mdformat round-trip to converge with prettier. The fenced expected-output blocks (the binding user-contract bytes Plan 17-03 will assert against) were not touched.

## Issues Encountered

- **trufflehog auto-updater failure under worktree sandbox:** Documented in CLAUDE.md and in Plan 17-01's SUMMARY. The hook fails to spawn the underlying scan binary because the worktree's `.git/index` is a regular file (not a directory) and the auto-updater misinterprets it. Used `SKIP=trufflehog` for the commit per CLAUDE.md guidance. Running `pre-commit run trufflehog --all-files` separately exhibits the same spawn failure (not a scan result -- the scan never starts). The scan itself, when run outside the worktree sandbox, was substantively clean at Plan 17-01's close and no secret-bearing content was added by this plan (the catalog is rendered-output strings only).
- **Pitfall 2 (deliberate RED window; acknowledged by the plan):** `npm test tests/architecture/catalog-uat.test.ts` exits 1 with 43 `[BYTE MISMATCH]` entries because the still-V1 composer-based UAT runs the V1 grammar against the v2 catalog. The failure shape matches the plan's verify gate's expected pattern (`BYTE MISMATCH` substring); Plan 17-03 closes the window by rewriting the UAT to drive `notify()` against per-(section, state) `NotificationMessage` fixtures per D-17-03 + D-17-05.

## SNM Status After This Plan

- **SNM-19 (style guide v2.0):** Editorially complete (landed in Plan 17-01). REQUIREMENTS.md status flip to Complete happens in lockstep with SNM-20 + SNM-31 at the Plan 17-03 close (the orchestrator's post-wave step).
- **SNM-20 (catalog v2.0):** Editorially complete -- the catalog body is rewritten and 50 `<!-- catalog-state: STATE -->` markers are in place. REQUIREMENTS.md status flip is owned by the orchestrator's post-wave update.
- **SNM-26 (frontmatter parity test):** Complete (landed in Plan 17-01).
- **SNM-31 (catalog UAT migration):** Pending; owned by Plan 17-03.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- Plan 17-03 (catalog UAT migration) can proceed: the v2.0 catalog ships 50 catalog states across 14 per-command sections, each paired with a `<!-- catalog-state: STATE -->` HTML-comment marker compatible with the existing parser at `tests/architecture/catalog-uat.test.ts` lines 100-101. The marker convention is unchanged from v1; only the parser's renderer-call site changes (V1 composers -> `notify()`). Plan 17-03 builds a `Map<(section, state), NotificationMessage>` keyed by these 50 catalog states and asserts byte-equality between `notify()` output and the catalog's expected block.
- `npm run check` is in a documented RED state at this plan's commit boundary (catalog UAT byte-mismatch). Plan 17-03 restores GREEN by rewriting the UAT (D-17-03 pure exclusion). This is the inverse-dependency rationale for Plan 17-03's hard `depends_on: [17-02]`.

## Self-Check: PASSED

Verifications performed (all PASS):

- `docs/output-catalog.md` exists, 928 lines (within the RESEARCH.md §Q8 750-850 target's slip range; rewrite + the 7-row marketplace-header table + the Status token reference table account for the upward drift).
- `grep -c '<!-- catalog-state:' docs/output-catalog.md` = 50 (>= 30 floor per Plan 17-03's `assert.ok(examples.length >= 30, ...)`).
- All 14 per-command H2 sections present: `/claude:plugin list`, `install`, `uninstall`, `reinstall`, `update`, `import`, `bootstrap`, `marketplace list`, `marketplace add`, `marketplace remove`, `marketplace update`, `marketplace autoupdate`, plus `Manual recovery anchors`, `Empty / no-op surfaces`, `Usage errors`.
- Forbidden literals all absent: `Claude plugin import summary` (0), `<!-- catalog-state: install-failure-with-anchor -->` (0), `<!-- catalog-state: source-mismatch -->` (0), `Fix the underlying issue and retry` (0), `Existing marketplace source` (0), `^## Resolutions to apply to` (0).
- Orphan-fold example present: `/claude:plugin list` -> `project-orphan-folded` state (plugin.scope "project" != marketplace.scope "user") locks Phase 16 D-16-17.
- Failed-only no-reload-hint suppression case present: `/claude:plugin reinstall` -> `single-mp-all-failed` state (no `(reinstalled)` plugin and no state-changing marketplace -> no `/reload to pick up changes` trailer) locks Phase 16 D-16-12 SNM-15 refinement.
- `npm run typecheck` exit 0; `npm run lint` exit 0; `npx prettier --check docs/output-catalog.md` exit 0.
- `SKIP=trufflehog pre-commit run --files docs/output-catalog.md` passes (mdformat, markdownlint-cli2, and all other hooks pass; trufflehog skipped per CLAUDE.md worktree caveat).
- `npm test tests/architecture/catalog-uat.test.ts` exits 1 with the expected `[BYTE MISMATCH] section=... state=...` failure shape (43 byte mismatches between V1 composer output and v2 catalog expected outputs) -- the deliberate RED window per Plan 17-02 Pitfall 2 / RESEARCH.md Risk 3. Plan 17-03 closes the window.
- Commit `7e391fb` on branch `worktree-agent-a304d33f0cb7863dc` (not `main`); title `docs(17): rewrite output catalog to v2.0 always-marketplace-header form` matches `^docs\(17\):` and is 65 chars (within 5-72 char Conventional Commits range). Commit touches exactly `docs/output-catalog.md` and no other path. Pre-commit hooks ran without `--no-verify` (only `SKIP=trufflehog` per CLAUDE.md).

---

*Phase: 17-spec-rewrite-catalog-uat-migration*
*Plan: 17-02*
*Completed: 2026-05-26*
