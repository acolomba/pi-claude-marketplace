---
phase: 17-spec-rewrite-catalog-uat-migration
plan: 01
subsystem: documentation
tags:
  - documentation
  - style-guide
  - traceability
  - notify
  - phase-17

# Dependency graph
requires:
  - phase: 15-shared-notify-type-model
    provides: The `NotificationMessage` type model + `PLUGIN_STATUSES` / `MARKETPLACE_STATUSES` / `DEPENDENCIES` runtime tuples that the v2.0 style guide points at as the binding contract
  - phase: 16-renderer-public-api-alongside-v1
    provides: The `notify()` / `notifyUsageError()` public surface + the renderer's single grammar switch (SNM-17) + computed severity / reload-hint / soft-dep probe (D-16-11..15) that v2.0's Output Grammar Summary describes
provides:
  - v2.0 thin pointer style guide at `docs/messaging-style-guide.md` (150 lines, no YAML frontmatter)
  - REQUIREMENTS.md SNM-26 advanced from Phase 21 to Phase 17 / Complete (D-17-02 forced consequence)
  - ADR Accepted-status block carries a one-line Phase 17 cross-reference
  - `tests/architecture/grammar-frontmatter.test.ts` deleted (atomically with the frontmatter removal)
affects:
  - 17-02 (catalog rewrite -- consumes v2.0 grammar invariants documented in the style guide)
  - 17-03 (catalog UAT migration -- closes the SNM-19/SNM-20/SNM-31 trio after both spec rewrites land)
  - 21-* (Phase 21 teardown -- SNM-24/SNM-25 will delete `tests/lint-rules/` + `msg-rule-registry.test.ts`; this plan gated two of the registry test's assertions via `t.todo()` so the deletion runs against a green test, not a red one)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Thin pointer doc: spec-pointer style guide that points at TypeScript const tuples as the binding closed-set contract instead of duplicating enumeration in YAML frontmatter (no existing project precedent before v2.0)"
    - "Atomic spec+test deletion: YAML frontmatter and its sole loader-importer test deleted in the same commit (Pitfall 1 -- splitting them across commits crashes `npm run check`)"
    - "ADR Accepted-status cross-reference: one-line `landed via Phase N` annotation in the Accepted-status block (no existing precedent before this plan)"

key-files:
  created: []
  modified:
    - "docs/messaging-style-guide.md (954-line v1.0 enumeration spec -> 150-line v2.0 thin pointer doc)"
    - ".planning/REQUIREMENTS.md (SNM-26 row Phase 21->17 / Pending->Complete; per-phase distribution updated)"
    - "docs/adr/v2-001-structured-notify.md (Accepted-status block gains Phase 17 cross-ref)"
    - "tests/architecture/msg-rule-registry.test.ts (Rule 3 auto-fix -- two assertions gated via t.todo() because v2.0 has 6 MSG-* IDs vs the test's EXPECTED_RULE_COUNT=34)"
  deleted:
    - "tests/architecture/grammar-frontmatter.test.ts (D-17-02; the 91-line frontmatter parity test whose module-load chain crashes the moment YAML keys are gone)"

key-decisions:
  - "Used Option A for the ADR cross-ref (`Accepted (Phase 15, 2026-05-25); landed via Phase 17 -- spec + catalog UAT migration (2026-05-26)`) -- single-line append, lowest churn vs the separate-bullet form"
  - "Gated two assertions in `tests/architecture/msg-rule-registry.test.ts` via `t.todo()` instead of deleting the file -- preserves it for Phase 21 SNM-25 cleanup and follows the existing in-file precedent at line 142 (the eslint.config.js gate). Deletion would have been a scope expansion beyond the plan's 4-file `files_modified` field"
  - "Embedded a small `PluginNotificationMessage` discriminated-union TS snippet in §Type Model Reference (planner discretion per the plan) -- mirrors the ADR's public-surface excerpt and gives reviewers compile-time intuition without re-enumerating the 10 statuses in prose (D-17-01 forbids that)"

patterns-established:
  - "Spec-pointer style guide: the v2.0 file describes the type model in shared/notify.ts and points readers at the source for closed-set membership rather than duplicating it. Establishes the 'thin pointer doc' shape for this project."
  - "ADR Accepted-status cross-reference: future phases that 'land' an ADR can append `landed via Phase N -- <summary> (YYYY-MM-DD)` to the Accepted bullet rather than creating a new status line."

requirements-completed:
  - SNM-26

# Metrics
duration: ~30min
completed: 2026-05-26
---

# Phase 17 Plan 01: Style Guide v2.0 Rewrite + Frontmatter Test Deletion Summary

**v2.0 thin pointer style guide (150 lines, no YAML frontmatter) replaces v1.0's 954-line enumeration spec; closed-set authority moves from frontmatter keys to `as const` tuples in `shared/notify.ts`. Dead frontmatter parity test deleted atomically with the YAML removal. SNM-26 advanced Phase 21 -> Phase 17 / Complete as a forced consequence.**

## Performance

- **Duration:** ~30 minutes
- **Started:** 2026-05-26T11:20Z (approx)
- **Completed:** 2026-05-26T11:49:31Z
- **Tasks:** 2 (Task 1 atomic edits + Task 2 commit)
- **Files modified:** 4 (per plan `files_modified`) + 1 Rule 3 auto-fix (`msg-rule-registry.test.ts`)

## Accomplishments

- Rewrote `docs/messaging-style-guide.md` from 954-line v1.0 frontmatter-driven enumeration to 150-line v2.0 thin pointer doc with 6 H2 sections (Overview, Type Model Reference, Output Grammar Summary, Severity Routing, ES-5 Supersession Table, Cross-References).
- Preserved the ES-5 Supersession Table VERBATIM from v1.0 §15 lines 525-537 (D-17-08) and added the one-line `fully retired Phase 21` annotation beneath it.
- Deleted `tests/architecture/grammar-frontmatter.test.ts` (D-17-02) atomically with the YAML frontmatter removal -- Pitfall 1: splitting these into separate commits crashes `npm run check` because `tests/lint-rules/lib/frontmatter.js`'s `parseStyleGuideFrontmatter` throws "no YAML frontmatter found" at module load.
- Advanced SNM-26 in `.planning/REQUIREMENTS.md` from `Phase 21 / Pending` to `Phase 17 / Complete` and recomputed the per-phase distribution line: Phase 17 (4 items: SNM-19, SNM-20, SNM-26, SNM-31), Phase 21 (7 items: SNM-22, SNM-24, SNM-25, SNM-27, SNM-28, SNM-29, SNM-32).
- Added a one-line Phase 17 cross-reference to the ADR Accepted-status block at `docs/adr/v2-001-structured-notify.md:3`.
- `npm run check` GREEN (1281 tests pass, 0 fail, 2 todo from the Rule 3 gate -- see Deviations below).

## Task Commits

Each task was committed atomically per the plan (one atomic commit for both tasks per CLAUDE.md):

1. **Task 1+2: Atomic spec rewrite + dead-test deletion + traceability + ADR + Rule 3 gate** - `0109aa2` (docs)

**Plan metadata:** This SUMMARY.md will be committed separately by the orchestrator after wave merge (worktree mode -- the executor does not commit shared `.planning/` orchestrator artifacts).

## Files Created/Modified

- **`docs/messaging-style-guide.md`** (954 -> 150 lines) -- v2.0 thin pointer doc. First line is `# Messaging Style Guide` (the H1). 6 H2 sections. ES-5 Supersession Table preserved verbatim with `fully retired Phase 21` annotation. Type Model Reference points at `shared/notify.ts::PLUGIN_STATUSES` / `MARKETPLACE_STATUSES` / `DEPENDENCIES` and `shared/grammar/reasons.ts::REASONS` instead of re-enumerating the closed sets in prose. Cross-References section links out to the catalog, the ADR, the renderer source, the compile-check arch test, the catalog UAT, and the PRD §6.12 ES-5 origin.
- **`tests/architecture/grammar-frontmatter.test.ts`** (deleted, 91 lines) -- dead at module load the moment YAML frontmatter is gone.
- **`.planning/REQUIREMENTS.md`** -- SNM-26 row `Phase 21 / Pending` -> `Phase 17 / Complete`; per-phase distribution line updated (Phase 17 4 items, Phase 21 7 items).
- **`docs/adr/v2-001-structured-notify.md`** -- Accepted-status block line 3: appended `; landed via Phase 17 -- spec + catalog UAT migration (2026-05-26)`.
- **`tests/architecture/msg-rule-registry.test.ts`** (Rule 3 auto-fix) -- two `assert.deepEqual` / `assert.equal` assertions gated via `t.todo()` when the style guide has fewer MSG-* IDs than the lint plugin has rules. Precedent at the existing `t.todo()` gate at line 142.

## Decisions Made

- **Cross-ref form chosen:** Option A (single-line append `; landed via Phase 17 -- spec + catalog UAT migration (2026-05-26)`) over Option B (separate `Landed via:` bullet). Lowest churn vs the existing Accepted-status block.
- **TS snippets embedded in Type Model Reference:** Per planner discretion, embedded the two-line public-surface signature block and the 10-variant discriminated union shape as TS code blocks. Gives reviewers compile-time intuition without re-enumerating the 10 statuses in prose (which D-17-01 forbids).
- **`msg-rule-registry.test.ts` gated, not deleted:** SNM-25 (Phase 21) owns the deletion. Gating via `t.todo()` follows the in-file precedent and keeps the file in place for Phase 21's full `tests/lint-rules/` teardown.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Gated two v1.0-style-guide-shape-dependent assertions in `tests/architecture/msg-rule-registry.test.ts` via `t.todo()`**

- **Found during:** Task 1 (`npm run check` verification gate after the v2 rewrite landed in the working tree)
- **Issue:** Two tests in `msg-rule-registry.test.ts` (line 111 "every rule name corresponds to a style-guide MSG-* anchor" + line 164 "rule count is 34 matches style-guide MSG-* ID count") read the style-guide MD file at module load and assert against `EXPECTED_RULE_COUNT = 34`. The v2.0 style guide has 6 MSG-* IDs (only the ES-5 table cross-refs survive). Both assertions fail. 17-RESEARCH.md A5 noted the risk as "low" because the test reads the body not the frontmatter, but the body's MSG-* enumeration is exactly what v2.0 retires per D-17-01.
- **Fix:** Added an early-return `t.todo()` gate in each failing test that fires when the style-guide MSG-* ID set is smaller than the lint plugin's `RULE_NAMES.length` (resp. `EXPECTED_RULE_COUNT`). Follows the existing in-file precedent at line 142 (the eslint.config.js detection gate added by D-14-03). The whole file is slated for deletion in Phase 21 (SNM-25) alongside the `tests/lint-rules/` directory (SNM-24); gating preserves it for that cleanup.
- **Files modified:** `tests/architecture/msg-rule-registry.test.ts`
- **Verification:** `npm run check` exits 0 (1281 pass, 0 fail, 2 todo). The two gated tests report as TODO in TAP output, not FAIL.
- **Committed in:** `0109aa2` (same atomic commit as the v2 rewrite)

---

**Total deviations:** 1 auto-fixed (1 Rule 3 blocking)
**Impact on plan:** The deviation is exactly the kind Rule 3 sanctions -- a test broken by the current task's documented intent. `t.todo()` is the minimum-impact patch (no scope creep into Phase 21's `tests/lint-rules/` cleanup); the test file survives intact for SNM-25 to delete cleanly. The plan's `files_modified` field listed 4 files; this deviation adds 1 file, documented here.

## Issues Encountered

- **Pitfall 1 (anticipated by the plan; avoided):** Deleting the YAML frontmatter without also deleting `tests/architecture/grammar-frontmatter.test.ts` crashes `npm run check` because `tests/lint-rules/lib/frontmatter.js`'s `parseStyleGuideFrontmatter` throws at module load. Avoided by performing both deletions in a single atomic commit per the plan instruction.
- **trufflehog auto-updater failure under worktree sandbox:** Documented in CLAUDE.md. Used `SKIP=trufflehog` for the commit and ran `pre-commit run trufflehog --all-files` separately to confirm the scan substantively passes (the failure mode is the auto-updater spawn, not the scan itself).

## SNM Status After This Plan

- **SNM-19 (style guide v2.0):** Editorially complete -- the body is rewritten and `npm run check` is GREEN. Plan 17-03 (or the phase-completion summary step) will flip the REQUIREMENTS.md status from Pending to Complete in lockstep with SNM-20 (catalog v2.0, Plan 17-02) and SNM-31 (catalog UAT migration, Plan 17-03) once the full 3-plan wave is GREEN.
- **SNM-20 (catalog v2.0):** Still Pending; owned by Plan 17-02.
- **SNM-26 (frontmatter parity test):** **Complete** per D-17-02 forced consequence -- the test is deleted and the REQUIREMENTS.md row reads `| SNM-26 | Phase 17 | Complete |`. Phase 17 absorbed this item from Phase 21 because the YAML frontmatter deletion makes the test impossible to keep loading.
- **SNM-31 (catalog UAT migration):** Still Pending; owned by Plan 17-03.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 17-02 (catalog rewrite) can proceed: the v2.0 style guide is the input contract describing the always-marketplace-header grammar, computed severity ladder, and computed reload-hint trailer that the catalog must reflect.
- Plan 17-03 (catalog UAT migration) waits on Plan 17-02 to land first per Pitfall 2 (rewriting only one side of the closed UAT loop is a guaranteed byte-mismatch).
- Phase 21 SNM-25 cleanup (`msg-rule-registry.test.ts` deletion) is unblocked: the gated test file is GREEN under v2.0 and will be a no-op delete at that point.

## Self-Check: PASSED

Verifications performed (all PASS):

- `docs/messaging-style-guide.md` exists, 150 lines (within 150-250 budget), first line is `# Messaging Style Guide`
- `tests/architecture/grammar-frontmatter.test.ts` absent (`test ! -f` returns 0)
- `.planning/REQUIREMENTS.md` contains literal `| SNM-26 | Phase 17 | Complete |`
- `.planning/REQUIREMENTS.md` contains `Phase 17 (4: SNM-19, SNM-20, SNM-26, SNM-31)` and `Phase 21 (7: SNM-22, SNM-24, SNM-25, SNM-27, SNM-28, SNM-29, SNM-32)`
- `docs/adr/v2-001-structured-notify.md` line 3 contains `Phase 17`
- ES-5 Supersession Table preserved verbatim with `fully retired alongside V1 wrapper deletion in Phase 21` annotation
- `npm run check` exit 0 (1281 pass, 0 fail, 2 todo)
- Commit `0109aa2` on branch `worktree-agent-a3d0cb1f432a6e6da` (not `main`); title matches `^docs\(17\):`
- Pre-commit hooks ran (SKIP=trufflehog per CLAUDE.md worktree caveat); trufflehog scan substantively clean when run separately (auto-updater spawn failure is the sandbox issue, not a scan failure)

---

*Phase: 17-spec-rewrite-catalog-uat-migration*
*Plan: 17-01*
*Completed: 2026-05-26*
