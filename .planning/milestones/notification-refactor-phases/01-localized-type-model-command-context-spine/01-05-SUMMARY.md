---
phase: 01-localized-type-model-command-context-spine
plan: 05
subsystem: notifications
tags: [typescript, command-context, notify, cutover-cleanup, output-neutral, dead-code-analysis]

# Dependency graph
requires:
  - phase: 01-01
    provides: CommandContext spine + notifyWithContext / notifyReconcileAppliedWithContext adapters + emitContextCascade / emitReconcileAppliedContextCascade seams + exported shared vocabulary + closed REASONS set
  - phase: 01-02
    provides: plugin-family command-local render maps (standalone info-kinds + empty-targets sentinels left central)
  - phase: 01-03
    provides: marketplace-family command-local render maps (renderMpHeader + marketplace-not-added / marketplace-info left central)
  - phase: 01-04
    provides: import + reconcile cascade producers routed through command-local render maps (reconcile-applied envelope seam left central)
provides:
  - notify-types.test.ts removed (D-03) — the bidirectional set-equality / tuple-length / field-presence proofs no longer guard a live rendering contract
  - Verified cutover state recorded on the central renderPluginRow seam: no command's cascade rows dispatch through it anymore (D-02/D-10 intent met)
affects: [Phase 4 ≤3-central-files / 0-notify.ts-edits open-closed proof — clean command-local baseline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Static-reference dead-code analysis: tsc noUnusedLocals + eslint as the authoritative removable-symbol oracle (per the plan's own conservative-removal constraint)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
  deleted:
    - tests/architecture/notify-types.test.ts

key-decisions:
  - "D-03 deletion executed in full: notify-types.test.ts (1409 lines) removed. No external module imports its _Assert_*/_V* aliases (verified by grep). Its imported tuples (PLUGIN_STATUSES/MARKETPLACE_STATUSES/STATUS_TOKENS/DEPENDENCIES/REASONS) all retain LIVE external consumers, so none became dead — the file was self-contained and runtime-inert."
  - "Field-presence @ts-expect-error guards were NOT relocated: they assert against the CENTRAL message interfaces (PluginNotificationMessage variant arms) which stayed central in notify.ts (per 01-02/01-03/01-04). Per-command render maps now structurally enforce field access (accessing .cause on a status that lacks it is a local compile error in the render arm), and catalog-uat + notify-v2 prove the bytes — so the coverage is preserved structurally, not lost."
  - "Task 2 removals (legacy notify(), renderPluginRow, renderMpHeader, status tuples) were NOT performed — they are provably still statically referenced and serve deferred-central surfaces. tsc (noUnusedLocals) + eslint report ZERO dead code. The plan's premise (all surfaces migrated → switches dead) is contradicted by the Wave 2 SUMMARYs and the phase non-negotiables, which deferred standalone info-kinds, the empty-targets sentinel, the mp-header, and the reconcile-applied envelope to stay central. Removing any would break the dispatchInfoMessage StandaloneKind exhaustiveness switch or the live legacy envelope, regressing rendered bytes."

patterns-established:
  - "Conservative cutover cleanup: remove a symbol ONLY when the toolchain proves it unreferenced; when the plan's removal premise conflicts with live static references + byte gates, byte-identity + the phase non-negotiables win."

requirements-completed: [MOD-02, MOD-03, OUT-08]

# Metrics
duration: ~35min
completed: 2026-06-24
---

# Phase 1 Plan 05: Cutover cleanup — delete the bidirectional proofs; verify the central-switch cutover Summary

**Deleted `notify-types.test.ts` (D-03) — its set-equality / tuple-length / field-presence proofs no longer guard a live contract now that per-command render maps make status drift a local compile error — and verified (tsc `noUnusedLocals` + eslint: zero dead code) that the legacy `notify()` envelope, `renderPluginRow`/`renderMpHeader`, the status tuples, and the closed `REASONS` set remain statically referenced live seams serving the standalone/empty surfaces Wave 2 deliberately left central; recorded that cutover state on the seam. No central symbol was removable. Output byte-identical (114 catalog-uat fixtures + notify-v2 + notify-grammar-invariant unchanged; `git diff docs/output-catalog.md` empty).**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-06-24
- **Tasks:** 2
- **Files modified:** 2 (1 modified, 1 deleted)

## Accomplishments
- **D-03 executed in full:** removed `tests/architecture/notify-types.test.ts` (1409 lines). Pre-deletion verification confirmed: (a) no module imports the file or its `_Assert_*`/`_VInstalled`/… aliases; (b) the five tuples it imported (`PLUGIN_STATUSES`, `MARKETPLACE_STATUSES`, `STATUS_TOKENS`, `DEPENDENCIES`, `REASONS`) all retain live external consumers, so the deletion orphaned nothing.
- Cleaned up the three now-stale `notify.ts` comment references to the deleted test file's "type-length lock," restating the SNM-03 exhaustiveness anchor as the per-command render-map compile error (D-10).
- **Verified the central-switch cutover** via the toolchain (the plan's mandated conservative-removal oracle): per-row dispatch for every command — plugin family (01-02), marketplace family (01-03), import + reconcile (01-04) — already routes through `notifyWithContext` / `notifyReconcileAppliedWithContext` and the command's own `context.render[status]` map. The D-02 / MOD-03 intent (no central render-switch fallback for migrated rows) is fully met.
- Recorded that cutover state on the `renderPluginRow` section header so the central seam's current (residual) role is documented for Phase 4.

## Task Commits

1. **Task 1: Delete notify-types.test.ts (D-03)** — `565d42d3` (test) + `59c5c890` (docs, the orphaned-comment cleanup that the pre-commit hook excluded from the first commit; committed separately because amending a pushed/clean commit is forbidden by project CLAUDE.md)
2. **Task 2: Verify + record the central renderPluginRow cutover state (no removal — see Deviations)** — `e5b5977b` (docs)

## Files Created/Modified
- `tests/architecture/notify-types.test.ts` (deleted) — the bidirectional set-equality / tuple-length / per-variant field-presence `@ts-expect-error` proofs (D-03). Runtime-inert, self-contained, no external importer.
- `extensions/pi-claude-marketplace/shared/notify.ts` (modified) — dropped three orphaned comment refs to the deleted test; restated the `renderPluginRow` section header to record the verified cutover state (the switch is no longer any command's per-row dispatch path; it survives only as a statically-referenced seam on the legacy envelope's empty-sentinel arm + the `composeReconcileAppliedBody` StandaloneKind exhaustiveness arm). Byte-neutral comment-only edits.

## Central symbols: removed vs kept (Task 2 inventory)

**Removed:** none. tsc (`noUnusedLocals: true`) and eslint both report ZERO unused-symbol / dead-code errors in `notify.ts`. Every symbol the plan named for removal is still statically referenced.

| Symbol | Plan said | Reality (verified) | Disposition |
|--------|-----------|--------------------|-------------|
| `export function notify(ctx, pi, message)` | remove (all callers migrated) | **22+ live callers** across orchestrators/edge: `marketplace-not-added`, `marketplace-info`/`-cascade`, `plugin-info`/`-cascade`, the `{ marketplaces: [] }` empty-targets sentinels (update/reinstall), `reconcile-pending-empty`, autoupdate standalone failures | **KEEP** (serves deferred-central standalone + empty surfaces) |
| `renderPluginRow` switch | remove (orphaned) | statically referenced via `composePluginLines` ← `composeMarketplaceBlock` ← legacy `notify()` cascade arm + `composeReconcileAppliedBody`. Reachable per-row body only for empty sentinels (loop never runs) but NOT statically dead | **KEEP** (removal breaks the live legacy envelope / exhaustiveness) |
| `renderMpHeader` switch | remove | **explicitly central** per phase non-negotiable + 01-03; called by all three cascade seams (`composeMarketplaceBlock` at notify.ts ~2928, `emitContextCascade` ~3134, `emitReconcileAppliedContextCascade` ~3180) — every migrated command relies on it for marketplace headers. Relocation deferred | **KEEP** (D-11; Wave 2 deferred mp-header relocation) |
| `PLUGIN_STATUSES` / `MARKETPLACE_STATUSES` / `STATUS_TOKENS` / `DEPENDENCIES` | remove (central tuples) | each is the `as const` source of a derived union (`PluginStatus`, `MarketplaceStatus`, `StatusToken`, `Dependency`) used in live notify.ts message interfaces AND imported by orchestrators (install, reconcile, import) | **KEEP** (live type sources) |
| `REASONS` | (OUT-08 explicitly preserve) | 18 external consumers; byte-source closed set | **KEEP** (OUT-08) |

**Confirmation the switches were "already unreferenced" (plan's framing):** PARTIALLY true and PARTIALLY false. They are no longer the per-row dispatch path for any *migrated command's rows* (context.render owns that since 01-01) — that half of the plan's premise holds. But they are NOT statically unreferenced: the legacy `notify()` envelope and the `composeReconcileAppliedBody` StandaloneKind arm keep them reachable for the deferred-central standalone/empty surfaces. The plan conflated "no command's cascade rows flow through them" (true) with "no live path references them" (false).

**Redaction seam survived (T-01-09 / NFR-9):** `redactAbsolutePaths` and `renderIndentedCauseChain` were not touched and remain on the STAYS-central list; `no-credential-leak` + `npm run check` green.

**Closed REASONS set survived (OUT-08):** `REASONS` tuple unchanged; the SURF-05 / scope-fences-63 / catalog-uat consumers stay green.

## notify.ts line-count delta (informational baseline for Phase 4)

- Before: 3304 lines
- After: 3321 lines (+17)
- Delta is +17 from the cutover-state documentation comments. No code was removed because no central symbol is removable (see inventory). Phase 4's ≤3-central-files / 0-notify.ts-edits open-closed proof gets a clean *command-local* baseline (every command owns its statuses/reasons/render map); the residual central seams documented here are the surfaces Phase 4's concern-module extraction will relocate.

## Deviations from Plan

### Rule 4 — Architectural: Task 2 removals not performed (plan premise contradicted by codebase + non-negotiables)

**Found during:** Task 2 pre-removal analysis (reading the Wave 2 SUMMARYs + grepping live references before touching any symbol).

**Issue:** Task 2 instructs removing the legacy `notify()` entry point, its adapter, the `renderPluginRow`/`renderMpHeader` central switches, and the status tuples, on the stated premise that "all 18 commands + reconcile/import route through `notifyWithContext`" so these are dead. That premise is factually incorrect for this codebase:
- The legacy `notify()` has **22+ live call sites** serving standalone info-kinds (`marketplace-not-added`, `marketplace-info`/`-cascade`, `plugin-info`/`-cascade`), the `{ marketplaces: [] }` empty-targets sentinels, `reconcile-pending-empty`, and autoupdate standalone failures.
- `renderMpHeader` is the central marketplace-header seam every migrated command relies on (called by all three cascade seams) — the phase non-negotiables and 01-03 explicitly DEFER its relocation and keep it central.
- `renderPluginRow` / `composeMarketplaceBlock` / `composePluginLines` are statically referenced by the legacy `notify()` cascade arm and the `composeReconcileAppliedBody` StandaloneKind exhaustiveness arm.
- The status tuples are the `as const` sources of live derived unions; `REASONS` is the OUT-08 byte-source.

`tsc` (`noUnusedLocals: true`) and `eslint` both report ZERO dead code — the authoritative removable-symbol oracle the plan itself mandates ("remove a symbol ONLY when typecheck/lint confirms it is unreferenced"). The phase non-negotiables are explicit: "leave those central unless your plan explicitly and byte-safely removes them. Wave 2 deferred the mp-header relocation and several standalone surfaces to remain central."

**Resolution:** Honored the plan's own conservative-removal constraint and the phase non-negotiables: removed nothing (zero dead code exists), preserved every central seam, and recorded the verified cutover state on the `renderPluginRow` section header (byte-neutral). The D-02/D-10 INTENT (no central render-switch fallback for any *migrated command's rows*) is fully achieved by Wave 2 and verified here. The residual central seams serve the standalone/empty surfaces that Wave 2 and the phase non-negotiables deliberately defer to a later phase. Removing them would break the `dispatchInfoMessage` exhaustiveness switch or the live legacy envelope, regressing rendered output — forbidden by the phase non-negotiable "If something goes red, restore byte-identity — do NOT alter rendered output."

**Files modified:** `extensions/pi-claude-marketplace/shared/notify.ts` (comment-only).
**Commit:** `e5b5977b`.

### Process: Task 1 comment cleanup landed in a second commit

The pre-commit hook excluded my staged `notify.ts` comment edits from Task 1's first commit (it stashed/restored working-tree state around the formatter hooks). Since amending a completed commit is forbidden by project CLAUDE.md, the orphaned-comment cleanup (part of the same D-03 deletion mess) was committed separately as `59c5c890`. Both commits belong to Task 1.

## Issues Encountered
- **Worktree base correction:** the worktree spawned at base `7be455eb` but the expected Wave 2 base was `32d5f146` (which contains the 01-01..01-04 work). After the HEAD-namespace assertion passed, `git reset --hard 32d5f146` brought the worktree to the correct base.
- **Worktree trufflehog hook structural failure:** the pre-commit `trufflehog` hook fails inside a linked worktree (`.git` is a file, not a directory — `failed to read index file: ... not a directory`). Documented limitation, not a secret finding. Each commit's staged file was scanned independently with `trufflehog filesystem` (0 verified / 0 unverified secrets, exit 0) before committing with the sanctioned `SKIP=trufflehog` prefix per project CLAUDE.md.

## User Setup Required
None.

## Next Phase Readiness
- `npm run check` exit 0 (2322 unit pass / 0 fail / 2 pre-existing skips + 16 integration pass; typecheck + lint + format clean); `catalog-uat` (114 fixtures) + `notify-v2` + `notify-grammar-invariant` (143 byte-gate tests) all green and byte-identical; `git diff docs/output-catalog.md` empty.
- All 18 commands own their notification vocabulary locally (statuses + reasons + render map); `notify-types.test.ts` is gone (D-03). Phase 4's open-closed proof gets a clean command-local baseline.
- **Carry-forward for a future phase:** the central `notify()` envelope + `renderPluginRow`/`renderMpHeader` switches + status tuples remain LIVE seams for the deferred-central standalone info-kinds, the empty-targets sentinel, and the marketplace-header rendering. The D-02 "no central render switch fallback" end-state for those surfaces requires migrating the standalone surfaces + relocating the mp-header first (Wave 2 + this plan deliberately left them central). They cannot be byte-safely removed until then.

## Self-Check: PASSED

- `tests/architecture/notify-types.test.ts` deleted (`test ! -f` succeeds).
- Task commits present: `565d42d3`, `59c5c890`, `e5b5977b`.
- `npm run check` exit 0; byte gates green and byte-identical; `git diff docs/output-catalog.md` empty.
- STATE.md / ROADMAP.md untouched (orchestrator owns those writes).

---
*Phase: 01-localized-type-model-command-context-spine*
*Completed: 2026-06-24*
