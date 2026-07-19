---
phase: 64-resolver-three-way-state
plan: 02
subsystem: ui
tags: [typescript, resolver, render-markers, reasons, probe-classifiers, rstate-05]

# Dependency graph
requires:
  - phase: 64-01
    provides: three-way ResolvedPlugin union (installable | unsupported | unavailable), unsupported arm carrying the typed unsupported[] component-kind list, migrated list/info/edge-deps consumers
provides:
  - Single shared render-time per-kind unsupported-marker helper (narrowUnsupportedKinds) mapping the typed unsupported[] kind list to the closed REASON set
  - list / info / install all derive per-kind unsupported markers through the one shared helper (cross-surface parity by construction)
  - Structural reasons stay on the notes path (narrowResolverNotes) for the unavailable arm; per-kind markers never re-route through the list helper
  - Cross-surface per-kind marker parity test + structural-stays-on-notes regression guard
affects: [force-install, resolver-render-markers, list-filters, force-state-glyphs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Render-time per-kind marker derivation from the typed unsupported[] list (D-64-02), distinct from the structural-reason notes path"
    - "One shared closed-set classifier consumed by list/info/install to guarantee cross-surface token parity by construction (no drift-prone copies)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - tests/orchestrators/plugin/cross-surface-reason-parity.test.ts

key-decisions:
  - "Per-kind markers derive from the typed unsupported[] list (lspServers -> lsp, else unsupported source) with first-wins dedup matching narrowResolverNotes (WR-01); the unavailable arm keeps narrowResolverNotes(notes) for structural reasons (D-64-02, D-64-07)"
  - "Marker-family scope (resolving research A2 / Open Question #2): unsupported hooks is STRUCTURAL and stays on the notes path; the new list helper covers only the force-degradable per-kind markers (lsp + future kinds)"
  - "install collapses its standalone per-kind mapping table (MANIFEST_FIELD_TO_REASON) into the shared helper; the detection gate and the structural hooks-prefix narrowing stay on install's own path"

patterns-established:
  - "Pattern: single shared render helper drives every surface's per-kind markers; cross-surface parity test is the drift safety net"

requirements-completed: [RSTATE-05]

# Metrics
duration: ~20min
completed: 2026-06-27
---

# Phase 64 Plan 02: Render-Time Per-Kind Unsupported Markers Summary

**Introduced the single shared render-time helper `narrowUnsupportedKinds` that derives per-kind unsupported markers from the resolver's typed `unsupported[]` component-kind list (lspServers -> lsp, else unsupported source), and routed `list`, `info`, and the `install` error surface through it so a given unsupported plugin renders byte-identical markers across all three surfaces by construction (D-64-02, RSTATE-05), while structural reasons stay on the `narrowResolverNotes` notes path for the `unavailable` arm.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-06-27
- **Tasks:** 2
- **Files modified:** 5 (4 production, 1 test)

## Accomplishments
- Added `narrowUnsupportedKinds(unsupported: string[])` in `shared/probe-classifiers.ts` — the D-64-02 marker family helper. Maps the typed kind list to the closed `lsp | unsupported source` set with first-wins dedup (WR-01). Structural hooks reasons are deliberately NOT in this family.
- Routed `list.ts` and `info.ts` to derive per-kind markers from the `unsupported` arm's list via the shared helper; the `unavailable` arm still renders structural reasons via `narrowResolverNotes(resolved.notes)` (D-64-07). Byte forms unchanged against `docs/output-catalog.md`.
- Collapsed the third duplicate in `install.ts`: removed the standalone `MANIFEST_FIELD_TO_REASON` per-kind mapping table and routed `manifestFieldTokenFromNote` through the shared helper. The detection gate (`MANIFEST_FIELD_REASONS`) and the structural hooks-prefix narrowing remain on install's own path.
- Extended `cross-surface-reason-parity.test.ts` with per-kind marker parity across `list`/`info`/`install` (lspServers, monitors, themes) plus a regression guard that the structural `unsupported hooks` marker is reachable only via the notes path, never the list helper.

## Task Commits

1. **Task 1: Shared per-kind helper + route list/info/install** - `e97234b2` (feat)
2. **Task 2: Cross-surface per-kind marker parity test** - `428a817f` (test)

**Plan metadata:** committed separately (this SUMMARY + STATE/ROADMAP/REQUIREMENTS).

## Files Created/Modified
- `shared/probe-classifiers.ts` - Added `narrowUnsupportedKinds`, the single shared render-time per-kind marker helper (D-64-02).
- `orchestrators/plugin/list.ts` - `unsupported` arm derives markers via `narrowUnsupportedKinds(resolved.unsupported)`; `unavailable` arm keeps `narrowResolverNotes(notes)`.
- `orchestrators/plugin/info.ts` - `buildNotInstallablePathRowFields` now takes `resolverReasons` as a parameter; `buildNonInstallableRowFields` supplies `narrowUnsupportedKinds(resolved.unsupported)` for the `unsupported` arm and `narrowResolverNotes(notes)` for `unavailable`.
- `orchestrators/plugin/install.ts` - Removed the standalone `MANIFEST_FIELD_TO_REASON` table; `manifestFieldTokenFromNote` emits via the shared helper.
- `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` - Added per-kind marker parity cases (RSTATE-05 / SURF-01) + structural-stays-on-notes regression guard (D-64-07).

## Decisions Made
- **Marker-family scope (research A2 / Open Question #2 resolved):** `unsupported hooks` is a structural reason — a malformed/unsupported `hooks.json` routes to the `unavailable` arm (D-64-07), so its reason stays on the `narrowResolverNotes` notes path. The new list-based helper covers only the force-degradable per-kind markers carried on the `unsupported` arm's `unsupported[]` list (`lsp` and future kinds). Byte parity confirmed: on the `unsupported` arm `notes` only ever carries `contains <kind>` entries (hooks are structural and never reach this arm), so deriving from the typed list yields the same tokens as the old notes path. The `{unsupported hooks, lsp}` combined row remains reachable on the `unavailable` arm via the notes path.
- **install collapse approach:** kept `MANIFEST_FIELD_REASONS` as the detection gate (camelCase token recognition) and only removed the per-kind REASON mapping table, delegating the token→marker emission to `narrowUnsupportedKinds([token])[0]`. This satisfies "no standalone per-kind list→REASON mapping" while leaving install's structural hooks-prefix narrowing on its own path, preserving the existing closed `Reason` output bytes.

## Deviations from Plan

None - plan executed exactly as written. The `buildNotInstallablePathRowFields` signature change (reasons passed as a parameter rather than computed from `notes` internally) is the natural realization of routing the two arms to different reason sources, not an unplanned deviation.

## Issues Encountered
- Prettier reflowed one long string literal in the new test file; applied `prettier --write` and re-ran `npm run check` green. No `--amend` needed (caught before commit).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The single shared per-kind marker helper is the render-time foundation Phase 66 (force-state glyphs / will-force preview tokens) builds on: per-kind markers are guaranteed identical across `list`, `info`, `install`, and (future) force states by construction.
- Phase 64 is complete (both plans landed): the three-way resolver state (64-01) plus the render-time per-kind marker consolidation (64-02). RSTATE-01..05 all closed.

---
*Phase: 64-resolver-three-way-state*
*Completed: 2026-06-27*

## Self-Check: PASSED

- All listed created/modified files exist on disk.
- Commits `e97234b2` (feat) and `428a817f` (test) present in git history.
- Artifact `contains` checks pass: `narrowUnsupportedKinds` exports `lsp`; the parity test contains per-kind and structural-guard cases.
