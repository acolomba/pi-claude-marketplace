---
phase: 24-grammar-consistency
plan: 01
subsystem: ui
tags: [notify, reasons, closed-set, catalog-uat, grammar, lspServers, lsp]

# Dependency graph
requires:
  - phase: 23-version-display-bundle
    provides: "shared/notify.ts as the single source of truth for closed-set REASONS + the catalog-uat byte-equality lockstep discipline (persistence-vs-display separation precedent)"
provides:
  - "REASONS closed-set member renamed lspServers -> lsp (shared/notify.ts:79); type Reason re-derives"
  - "Detection-vs-emission seam (D-24-04): list.ts + install.ts detect camelCase lspServers, emit lsp"
  - "MANIFEST_FIELD_TO_REASON emission map in install.ts replacing the `as Reason` cast (D-24-05)"
  - "Catalog/fixture/doc byte forms read {hooks, lsp} in lockstep with the EMIT rename (D-24-07)"
  - "6 stale shared/grammar/reasons.ts pointers re-pointed to shared/notify.ts::REASONS (D-24-08)"
  - "Spec/record docs (ROADMAP/REQUIREMENTS/UAT/PROJECT) spell the rendered token lsp (D-24-03)"
affects: [25-runtime-publish-verification, 26-green-gate-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Detection-vs-emission seam: the same manifest-derived token serves a DETECTION role (stays camelCase, matches resolver notes) and an EMITTED role (closed-set Reason, renders lsp). Mirrors Phase 23's persistence-vs-display split."
    - "Shared MANIFEST_FIELD_TO_REASON lookup translates a detected camelCase manifest token to its closed-set Reason at the seam, removing the `as Reason` cast."

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - docs/output-catalog.md
    - docs/messaging-style-guide.md
    - tests/architecture/catalog-uat.test.ts
    - tests/orchestrators/plugin/install.test.ts
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - .planning/v1.4-MILESTONE-UAT.md
    - .planning/PROJECT.md

key-decisions:
  - "D-24-04 honored: detection substrings stay camelCase lspServers; only the emitted Reason becomes lsp. NOT a blanket find/replace."
  - "D-24-05 mechanism: shared MANIFEST_FIELD_TO_REASON map + camelCase MANIFEST_FIELD_REASONS detection gate (set retained, not dead-coded) at the install.ts seam."
  - "D-24-07 honored: EMIT rename + catalog/fixture/doc byte forms landed in ONE atomic commit; no intermediate RED state."

patterns-established:
  - "Detection-vs-emission seam separating manifest-key matching (camelCase) from user-rendered closed-set Reason (lsp)."

requirements-completed: [SNM-36]

# Metrics
duration: 19min
completed: 2026-05-29
---

# Phase 24 Plan 01: Grammar Consistency Summary

**Renamed the lone camelCase REASONS member `lspServers` -> `lsp` so unsupported-LSP plugin rows render `{lsp}` instead of `{lspServers}`, propagated through two detection-vs-emission seams via a typed `MANIFEST_FIELD_TO_REASON` map, with catalog/fixture/doc byte forms and spec wording amended in lockstep. SC#4 manifest surface untouched.**

## Performance

- **Duration:** ~19 min
- **Started:** 2026-05-29T14:07:52Z (phase execution start)
- **Completed:** 2026-05-29T14:26:04Z
- **Tasks:** 3 (executed sequentially, single atomic commit per D-24-07)
- **Files modified:** 12 (substantive commit)

## Accomplishments

- Renamed `REASONS` member `"lspServers"` -> `"lsp"` at `shared/notify.ts:79` (the single source-of-truth edit; `type Reason` re-derives).
- Rewired both detection-vs-emission seams per D-24-04: `list.ts::narrowResolverNotes` keeps `note.includes("lspServers")` detection and emits `"lsp"` (with the `seen` dedup key flipped to `"lsp"` for parallelism, Pitfall 4); `install.ts::manifestFieldTokenFromNote` gates on the camelCase `MANIFEST_FIELD_REASONS` set then maps through `MANIFEST_FIELD_TO_REASON`, removing the `return token as Reason` cast (D-24-05).
- Updated catalog/fixture/doc byte forms in lockstep (`{hooks, lsp}` × 2 in `output-catalog.md`; both catalog-uat fixtures; install.test EMIT expectations) while keeping the detection INPUTs (`"contains lspServers"`) camelCase (D-24-06 / D-24-07).
- Re-pointed all 6 stale `shared/grammar/reasons.ts` pointers to `shared/notify.ts::REASONS` (D-24-08): 2 in install.ts, 1 in uninstall.ts, 2 in messaging-style-guide.md, 1 in output-catalog.md.
- Amended spec/record docs (`ROADMAP.md` ledger/goal/SC#1/SC#2/SC#3/Phase-26-SC#2, `REQUIREMENTS.md` SNM-36, `v1.4-MILESTONE-UAT.md:497` truth oracle, `PROJECT.md:30`) from `"lsp servers"` -> `"lsp"` and reframed the imprecise "13 consumer call-sites" framing to the seam/cascade reality (D-24-03).
- `npm run check` GREEN: typecheck + ESLint + Prettier + 1132/1132 tests (NFR-6); catalog-UAT byte-equality GREEN.

## Task Commits

This plan used ONE atomic commit covering all three tasks (D-24-07 mandate: the EMIT rename and the catalog/fixture byte-form updates cannot be split across commits without leaving the suite RED). The spec/record amendments (Task 3) joined the same commit.

1. **Task 1 (EMIT rename + both seams) + Task 2 (byte-form lockstep) + Task 3 (spec/record amendments)** - `1ce67f1` (fix)

**Plan metadata:** committed separately (SUMMARY + STATE + ROADMAP plan-progress; sequential/main-tree mode).

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notify.ts` - REASONS member `"lspServers"` -> `"lsp"` (single source-of-truth edit).
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` - `narrowResolverNotes` emits `"lsp"`, `seen` key `"lsp"`, `ListReason`/return/accumulator types updated, emit-describing JSDoc renamed; detection substring `note.includes("lspServers")` and detection-describing JSDoc (`:310`/`:393`) kept camelCase.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` - added `MANIFEST_FIELD_TO_REASON` emission map; `manifestFieldTokenFromNote` gates on the retained camelCase `MANIFEST_FIELD_REASONS` set then maps (no cast); re-pointed 2 grammar pointers; detection-describing comments kept camelCase.
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` - re-pointed grammar pointer at `:99`.
- `docs/output-catalog.md` - byte forms `{hooks, lsp}` (×2), carve-out prose `{lsp}` (×2), grammar pointer re-pointed.
- `docs/messaging-style-guide.md` - 2 grammar pointers re-pointed to `shared/notify.ts::REASONS`.
- `tests/architecture/catalog-uat.test.ts` - both fixtures `["hooks", "lsp"]`.
- `tests/orchestrators/plugin/install.test.ts` - EMIT expectations `["hooks", "lsp"]` / `["lsp"]`; detection INPUTs (`["contains hooks", "contains lspServers"]`, `["contains lspServers"]`) kept camelCase; one test title + comment prose updated.
- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/v1.4-MILESTONE-UAT.md`, `.planning/PROJECT.md` - spec/record wording `"lsp servers"` -> `"lsp"`; call-site framing reframed.

## Decisions Made

- None beyond the locked plan decisions. The plan's D-24-05 discretion was resolved exactly as the RESEARCH recommended: shared `MANIFEST_FIELD_TO_REASON` map. The detection gate (`MANIFEST_FIELD_REASONS.has(token)`) was retained in the function body so the set stays a live reference (satisfies the "set unchanged" acceptance criterion AND avoids an ESLint unused-var error after the cast was removed).

## Deviations from Plan

None - plan executed exactly as written. The single-atomic-commit instruction (D-24-07) was followed; no per-task commits.

A formatting note (not a deviation): the `mdformat` pre-commit hook re-padded one table-cell column in `docs/output-catalog.md:118` because the `{lspServers}` -> `{lsp}` edit shortened the cell and misaligned the column. The hook's realignment was restaged and the commit proceeded cleanly per the project pre-commit protocol.

## Issues Encountered

- After the D-24-05 map rewrite, `MANIFEST_FIELD_REASONS` would have become dead code (the function no longer referenced it), which both ESLint would flag AND would contradict the plan's "set unchanged" acceptance criterion. Resolved by keeping the camelCase set as the DETECTION gate inside `manifestFieldTokenFromNote` (gate on the set, then map to the emitted Reason) -- consistent with the plan action step 2 ("must still gate on the camelCase token").

## Known Stubs

None. No hardcoded empty values, placeholders, or unwired data introduced. This was a display-token rename plus doc/comment hygiene.

## Next Phase Readiness

- SNM-36 / G-MIL-04 closed. The grammar leak is eliminated; `{lsp}` renders end to end (proven by the self-checking catalog-UAT byte-equality test).
- Phase 25 (Runtime Publish & Verification) is unblocked. The "no `lspServers` leak" smoke check it references (ROADMAP Phase 25 SC#1 / :476) now passes against this tree; that reference is a manifest-key smoke assertion and was intentionally left camelCase.
- SC#4 manifest surface (`domain/components/plugin.ts:31`, `domain/resolver.ts:142,160`) confirmed byte-unchanged; manifest parsing is unaffected.

## Self-Check: PASSED

- `24-01-SUMMARY.md` exists at `.planning/phases/24-grammar-consistency/`.
- Substantive commit `1ce67f1` exists in git history.
- All key modified files present (`shared/notify.ts`, `install.ts`, `list.ts`, `docs/output-catalog.md`, etc.).

---
*Phase: 24-grammar-consistency*
*Completed: 2026-05-29*
