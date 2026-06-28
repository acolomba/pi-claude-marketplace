---
milestone: force-install
audited: 2026-06-28T18:10:00-04:00
status: passed
status_note: "Re-audit returned tech_debt; all actionable items were then resolved (see Post-Audit Resolution below) -- flipped to passed 2026-06-28."
scope_note: "Re-audit covering all 9 phases (64, 65, 65.1, 66, 67, 68, 69, 70, 71) and all 35 requirements. Supersedes the prior 8-phase / 30-requirement audit (which found tech_debt, all 30 satisfied, since-resolved); Phase 71 (Partial Hook Force-Install, PHOOK-01..05) is now folded in."
scores:
  requirements: 35/35
  phases: 9/9
  integration: 31/31
  flows: 4/4
gaps:
  requirements: []
  integration: []
  flows: []
tech_debt:
  - phase: 71-partial-hook-force-install
    items:
      - "Nyquist VALIDATION incomplete: 71-VALIDATION.md is status: draft / nyquist_compliant: false / wave_0_complete: false with all PHOOK-01..05 rows still pending. Unlike phases 64-70 + 65.1 (all swept to nyquist_compliant: true post prior-audit), Phase 71's validation contract was authored but never carried to sign-off. Discovery-only -- does NOT force gaps_found; requirement-level test coverage exists (npm run check GREEN: 2489 unit + 16 integration, PHOOK rows VERIFIED in 71-VERIFICATION). Run /gsd-validate-phase 71 if Nyquist sign-off is required before archive."
      - "IN-02 (cosmetic, documented-deferred): a no-force install FAILURE row renders {unsupported source} instead of {unsupported hooks} because the failure composer reads the structural partial.notes path rather than the typed partial.unsupported list. Logged in .planning/phases/71-partial-hook-force-install/deferred-items.md. PHOOK-05 only requires {unsupported hooks} parity across list and info (both VERIFIED); SEV-02 block + --force hint is satisfied. Closing it requires threading typed unsupported[] into requireInstallable's thrown reasons -- a resolver-gate change beyond Phase 71."
  - phase: doc-hygiene (non-blocking)
    items:
      - "REQUIREMENTS.md coverage footer is stale: lines 144-152 still read 'Requirements: 30 total / Mapped to phases: 30 (Phases 64-70) / 30/30' but the traceability table now lists 35 REQ-IDs through Phase 71 (PHOOK-01..05 added, all [x] Complete). Counts only; the table itself is correct and complete. Update footer to 35 total / Phases 64-71."
      - "SUMMARY frontmatter omission (carried from prior audit): 65.1-01/02 and 70-03 carry empty requirements_completed; WILL-01..04 and DOC-03 are nonetheless VERIFIED/SATISFIED in their phase VERIFICATION requirement tables and [x] in the traceability table. Phase 71 summaries are clean (PHOOK-01..05 all listed)."
  - phase: cross-milestone (pre-existing, NOT force-install)
    items:
      - "Intermittent tmpdir ENOTEMPTY teardown race under PARALLEL test runs in hooks-async-rewake. The main races were FIXED test-only in commit a5c48f65; one occasional ENOTEMPTY flake still appears under parallel execution but passes serialized / in isolation. Predates force-install (Phase 62 / v0.6.0 hooks bridge). Not milestone-attributable, not a code defect."
nyquist:
  compliant_phases: [64, 65, 65.1, 66, 67, 68, 69, 70]
  partial_phases: [71]
  missing_phases: []
  overall: "8 compliant / 1 partial / 0 missing"
---

# Milestone Audit: force-install (Phases 64-71, incl. inserted 65.1)

**Audited:** 2026-06-28 (re-audit)
**Status:** tech_debt -- all 35 requirements satisfied, every cross-phase seam wired, all E2E flows complete, no critical blockers; one fresh actionable item (Phase 71 Nyquist validation still in draft) plus minor doc-hygiene warrant review before archive.

## Post-Audit Resolution (2026-06-28)

All actionable tech-debt items from this re-audit have been resolved on
`features/force-install`; status flipped to **passed**:

1. **Phase 71 Nyquist** -- `gsd-validate-phase 71` ran; `71-VALIDATION.md` is now
   `nyquist_compliant: true` (PHOOK-01..05 all covered by green tests; 0 gaps).
   Commit `893be5f3`. Milestone Nyquist is now 9/9 compliant.
2. **REQUIREMENTS.md coverage footer** -- updated to 35 total / Phases 64-71.
   Commit `142bd2df`.
3. **Phase 71 IN-02** -- FIXED (was deferred): the no-`--force` install failure
   row now renders the typed unsupported-kind marker (`{unsupported hooks}`,
   `{lsp}`, ...) via the shared `narrowUnsupportedKinds` path, byte-identical
   across the failure row, `list`, and `info`; structural `unavailable` rows
   unchanged; REASONS stays 32. Commit `46bc0757` (+ regression tests).
4. **Pre-existing parallel-run flake** -- the remaining `hooks-async-rewake`
   `ENOTEMPTY` teardown race fixed test-only (`maxRetries` on the shared temp-dir
   cleanup); confirmed green across 3 parallel `npm run check` runs. Commit
   `a961a3f8`.

Remaining (non-actionable, cosmetic): empty `requirements_completed` frontmatter
on the 65.1/70-03 SUMMARYs (the requirements are VERIFIED in those phases'
VERIFICATION tables and `[x]` in traceability). `npm run check` GREEN
(2495 unit/arch/orchestrator + 16 integration, 0 fail, 0 ENOTEMPTY).

## What Changed Since the Prior Audit

The earlier audit (recorded at this same path) covered **8 phases / 30 requirements** and returned `tech_debt` with all 30 satisfied. Its two actionable debt items were then **resolved**: the Nyquist validation sweep flipped phases 64-70 + 65.1 to `nyquist_compliant: true`, doc-hygiene was annotated, and the pre-existing parallel-run test races were fixed test-only (commit a5c48f65).

This re-audit folds in the newly added **Phase 71 (Partial Hook Force-Install)** -- requirements **PHOOK-01..05** -- bringing scope to **9 phases / 35 requirements**. Phase 71 carries a passed VERIFICATION, a clean REVIEW, and a passing test suite, but its VALIDATION.md is still a draft (nyquist_compliant: false), which is the one new tech-debt item.

## Milestone Goal

Let a Pi user `install` / `update --force` a *partially*-supported Claude plugin -- install the supported components, degrade the unsupported ones, never block -- built on a **derived** force-state (no persisted flag, no migration) and the **desired-state** severity model, with consistent status, list, completion, and load-time-backfill behaviour. Phase 71 extends `--force` degradation to **hooks**: a parseable-but-unsupportable `hooks.json` becomes force-degradable (install the supportable handlers, drop the rest) instead of a structural failure.

## Verdict

| Dimension | Result |
|-----------|--------|
| Requirements satisfied | 35 / 35 |
| Phases verified (VERIFICATION.md = passed) | 9 / 9 |
| Cross-phase seams wired | 31 / 31 (26 prior + 5 new Phase 71; 0 orphaned, 0 missing) |
| E2E flows complete | 4 / 4 (3 prior + 1 new partial-hook flow; 0 broken) |
| `npm run check` | GREEN -- 2489 unit + 16 integration; typecheck/lint/prettier clean |
| Critical blockers | 0 |
| Nyquist | 8 compliant / 1 partial (Phase 71) / 0 missing |

## Requirements Coverage (3-source cross-reference)

All 35 REQ-IDs cross-referenced across VERIFICATION.md status, SUMMARY.md `requirements_completed` frontmatter, and the REQUIREMENTS.md traceability table.

| Family | REQ-IDs | Phase | VERIFICATION | SUMMARY frontmatter | Traceability | Final |
|--------|---------|-------|--------------|---------------------|--------------|-------|
| RSTATE | 01-05 | 64 | passed | listed | [x] | satisfied |
| FORCE | 01-05 | 65 | passed | listed | [x] | satisfied |
| WILL | 01-04 | 65.1 | passed | **empty** | [x] | satisfied (verified manually in 65.1-VERIFICATION requirement table) |
| FSTAT | 01-07 | 66 | passed | listed | [x] | satisfied |
| LIST/RINST | LIST-01,02 / RINST-01 | 67 | passed | listed | [x] | satisfied |
| BFILL | 01-02 | 68 | passed | listed | [x] | satisfied |
| SEV | 01-05 | 69 | passed | listed | [x] | satisfied |
| DOC | 01-03 | 70 | passed | DOC-01,02 listed; **DOC-03 empty** | [x] | satisfied (DOC-03 SATISFIED in 70-VERIFICATION requirement table) |
| PHOOK | 01-05 | 71 | passed | listed (all five) | [x] | satisfied |

**Orphan detection:** None. Every REQ-ID in the traceability table appears in its phase VERIFICATION requirement table.

**Frontmatter note:** WILL-01..04 (65.1-01/02 summaries) and DOC-03 (70-03 summary) have empty `requirements_completed`. Per the status matrix this is "passed + missing frontmatter -> partial (verify manually)." Manual inspection of both phase VERIFICATION.md requirement tables confirms all five are VERIFIED/SATISFIED with codebase evidence -> **satisfied**. A frontmatter-hygiene issue, not a coverage gap. Phase 71's summaries are clean -- PHOOK-01..05 are all present in frontmatter and all SATISFIED in 71-VERIFICATION.

## Cross-Phase Integration

The prior integration check verified the 64 -> 70 seam chain: **26/26 seams wired, 3/3 E2E flows, 0 orphans**. This re-audit's integration checker (gsd-integration-checker) trusted that baseline, spot-checked for regressions (none), and verified the **5 new Phase 71 seams**:

- **partitionHooks -> parseHooksConfig**: `partitionHooks` (hooks.ts) produces `HooksPartition` (`supported` + `DroppedHook[]`); consumed in the `parseHooksConfig` success arm after `HOOKS_VALIDATOR.Check`. `HooksTableDesyncError` routes to `{ok:false}` preserving structural precedence. WIRED. (PHOOK-01, PHOOK-03)
- **applyHooksConfig -> partial.unsupported**: pushes `"hooks"` and sets `partial.droppedHooks` when `dropped.length > 0`; the existing `decideResolution` `partial.unsupported.length > 0` branch routes to `unsupported()` with no change. Structural `!ok` arm unchanged -> still `unavailable`. WIRED. (PHOOK-02, PHOOK-03)
- **narrowUnsupportedKinds third arm**: maps `"hooks"` -> `"unsupported hooks"`; REASONS count stays 32 (OUT-08 passes). WIRED. (PHOOK-05)
- **info.ts strict reader -> appendHooksBlock**: merges `[...supported, ...droppedHooks]` via `projectDroppedHookEntries`; `appendHooksBlock` renders `event(matcher) (unsupported)`. WIRED. (PHOOK-05, FSTAT-07)
- **install --force hooks bridge**: stages `parseHooksConfig.value` (the filtered subset only); the Q2 `hooksConfigPath` gate prevents staging when the subset is empty (Stop-only edge). WIRED. (PHOOK-04, FORCE-01/03/05)

**E2E flows traced complete (4/4):**
1. `install --force <plugin>@<marketplace>` -> force-installed state with `◉` glyph + reasons brace.
2. `/reload` backfill promotion (force-installed -> installed) gated on `lastReconciledExtensionVersion`.
3. `update --force` / autoupdate force cascade with SEV-01/03/04 severity stamping.
4. **(new)** `install --force <plugin-with-partial-hooks>` -> `unsupported` resolution -> force-installed row with `{unsupported hooks}`, a FILTERED `hooks.json` staged (dropped handlers absent from disk), and `info` enumerating the dropped `event(matcher) (unsupported)` handlers. No-force path blocks at `error` with the `--force` hint (SEV-02).

0 orphaned exports, 0 missing connections, 0 broken flows, 0 regressions to the prior three flows.

## Nyquist Compliance

| Phase | VALIDATION.md | nyquist_compliant | Status |
|-------|---------------|-------------------|--------|
| 64 | exists | true | COMPLIANT |
| 65 | exists | true | COMPLIANT |
| 65.1 | exists | true | COMPLIANT |
| 66 | exists | true | COMPLIANT |
| 67 | exists | true | COMPLIANT |
| 68 | exists | true | COMPLIANT |
| 69 | exists | true | COMPLIANT |
| 70 | exists | true | COMPLIANT |
| 71 | exists | **false (draft)** | **PARTIAL** |

**Overall:** 8 compliant / 1 partial / 0 missing. Phases 64-70 + 65.1 were carried to `nyquist_compliant: true` in the post-prior-audit validation sweep. Phase 71's VALIDATION.md was authored (full per-task verification map for PHOOK-01..05, Wave 0 fixtures contract) but never flipped to sign-off -- all rows remain `pending` and `wave_0_complete: false`. Discovery-only; this does **not** force `gaps_found`. Requirement-level coverage is nonetheless present (npm run check GREEN; PHOOK rows VERIFIED in 71-VERIFICATION with named test files). To close: run `/gsd-validate-phase 71`.

## Tech Debt Summary

| Source | Item | Severity | Disposition |
|--------|------|----------|-------------|
| Phase 71 | Nyquist VALIDATION.md still draft (nyquist_compliant: false, all PHOOK rows pending) | Non-blocking | Fresh actionable item. Coverage exists (suite GREEN); run `/gsd-validate-phase 71` for sign-off before archive. |
| Phase 71 | IN-02: no-force failure row renders `{unsupported source}` not `{unsupported hooks}` | Cosmetic | Documented-deferred (deferred-items.md). PHOOK-05 list/info parity holds; SEV-02 block + hint holds. Resolver-gate change deferred post-71. |
| Doc hygiene | REQUIREMENTS.md coverage footer stale (says 30 / Phases 64-70; table is 35 / through Phase 71) | Non-blocking | Counts only; traceability table is correct and complete. Update footer to 35 / Phases 64-71. |
| Doc hygiene | Empty `requirements_completed` frontmatter on 65.1-01/02 + 70-03 | Non-blocking | Carried from prior audit; WILL-01..04 + DOC-03 verified in VERIFICATION tables. |
| Cross-milestone (pre-existing) | Intermittent ENOTEMPTY tmpdir teardown flake under PARALLEL runs in hooks-async-rewake | Non-blocking | Main races fixed test-only (a5c48f65); residual flake passes serialized / in isolation. Predates force-install (Phase 62 / v0.6.0). Not milestone-attributable. |

## Conclusion

The force-install milestone, now complete across all **9 phases** and **35 requirements**, delivered its definition of done: all 35 requirements are satisfied with codebase evidence, every cross-phase seam (including the 5 new Phase 71 partial-hook seams) is wired, and all four E2E flows complete end-to-end. There are **no critical blockers** and **no unsatisfied requirements**, so the FAIL gate is not triggered.

Status is **tech_debt** (not `passed`) because of accumulated non-blocking items worth a review before archive -- principally the **Phase 71 Nyquist validation still in draft** (the one fresh actionable item; phases 64-70 + 65.1 are all compliant), plus minor doc-hygiene (stale REQUIREMENTS.md footer, empty frontmatter on three summaries) and two documented non-blocking items (Phase 71 IN-02 cosmetic token deviation; pre-existing parallel-run test flake). None of these block completion.
