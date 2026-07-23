---
phase: 04-concern-module-extraction-open-closed-proof
plan: 02
subsystem: shared
tags: [typescript, notify, concerns, hooks, refactor, import-fence]

requires:
  - phase: 04-concern-module-extraction-open-closed-proof
    provides: 04-01 soft-dep concern (both plans modify notify.ts; file-ownership sequencing)
provides:
  - shared/concerns/hooks.ts owning appendHooksBlock + ClaudeHookEvent/HookSummaryEntry/HookSummary
  - notify.ts info renderer calling appendHooksBlock from the concern
affects: [04-03, open-closed-proof]

tech-stack:
  added: []
  patterns:
    - "Concern owns its types entirely (imports nothing from notify.ts) -- strongest no-cycle position"
    - "shared/->domain/ import-fence preservation: hook types stay shared-side for domain satisfies-pins"

key-files:
  created:
    - extensions/pi-claude-marketplace/shared/concerns/hooks.ts
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/domain/components/hook-events.ts
    - tests/shared/notify-v2.test.ts

key-decisions:
  - "Cleaner A1 cut: only appendHooksBlock + the four hook types move; COMPONENT_KINDS + appendResolvedComponentLines stay in notify.ts (moving COMPONENT_KINDS would drag PluginInfoComponentsResolved into the concern)"
  - "Fence-rationale comment travels with the types into hooks.ts; the domain satisfies-pin now imports downward from concerns/hooks.ts"

patterns-established:
  - "Hooks concern as a leaf the info renderer calls into; the call-site appendHooksBlock(lines, components.hooks) is byte-identical"

requirements-completed: [MOD-04]

duration: 1
completed: 2026-06-24
---

# Phase 4 / Plan 02: Hooks concern extraction

**Hooks-summary renderer and its types lifted out of notify.ts into a standalone `shared/concerns/hooks.ts`; the info renderer's call-site stays byte-identical and the shared/->domain/ fence is preserved.**

## Performance

- **Tasks:** 1
- **Files modified:** 5 (1 created, 4 modified)
- **Completed:** 2026-06-24

## Accomplishments

- Created `shared/concerns/hooks.ts` owning `appendHooksBlock` (lifted verbatim), `ClaudeHookEvent`, the file-private `_ToolEvent`, `HookSummaryEntry`, `HookSummary`, plus the import-fence rationale comment.
- Deleted those symbols + the fence comment from notify.ts; added a value import (`appendHooksBlock`) and a type import (`HookSummaryEntry`, still used by `PluginInfoComponentsResolved.hooks?`).
- Kept `COMPONENT_KINDS` + `appendResolvedComponentLines` in notify.ts (A1 cut); the `appendHooksBlock(lines, components.hooks)` call-site is byte-identical.
- Repointed the 3 hook-type importers: `orchestrators/plugin/info.ts` (ClaudeHookEvent + HookSummaryEntry split out), `domain/components/hook-events.ts` (downward import source changed, fence preserved), `tests/shared/notify-v2.test.ts` (HookSummaryEntry split out).

## Task Commits

1. **Task 1: Extract hooks concern and repoint hook-type importers** - `8dbd78fc` (refactor)

## Files Created/Modified

- `shared/concerns/hooks.ts` - New concern: appendHooksBlock + the four hook types + fence rationale
- `shared/notify.ts` - Removed moved symbols; info renderer imports appendHooksBlock + HookSummaryEntry from concern
- `orchestrators/plugin/info.ts` - ClaudeHookEvent + HookSummaryEntry repointed to concern
- `domain/components/hook-events.ts` - ClaudeHookEvent import source repointed (still domain->shared)
- `tests/shared/notify-v2.test.ts` - HookSummaryEntry import repointed to concern

## Decisions Made

- Followed RESEARCH A1: moved only `appendHooksBlock` + the hook types, leaving `COMPONENT_KINDS` + `appendResolvedComponentLines` central. `tests/orchestrators/plugin/info.test.ts` references `HookSummaryEntry` only in a prose comment (not an import), so it needed no edit.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Both cross-cutting concerns (soft-dep + hooks) are out of notify.ts. notify.ts is now 3315 lines (from the 3431 pre-Phase-4 baseline).
- Ready for 04-03 (open-closed proof doc + GATE-03).
- Verification at commit `8dbd78fc`: catalog-uat 4/4 green, `git diff --exit-code docs/output-catalog.md` empty, `npm run typecheck` + `npm run lint` exit 0, 550 shared/info/domain tests pass.

---
*Phase: 04-concern-module-extraction-open-closed-proof*
*Completed: 2026-06-24*
