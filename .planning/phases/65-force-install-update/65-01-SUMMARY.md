---
phase: 65-force-install-update
plan: 01
subsystem: api
tags: [typescript, discriminated-union, edge-handler, force-install, resolver]

# Dependency graph
requires:
  - phase: 64-resolver-three-way-state
    provides: "three-way ResolvedPlugin state union (installable/unsupported/unavailable), pluginRoot on installable+unsupported, requireForceInstallable gate"
provides:
  - "MaterializablePlugin = ResolvedPluginInstallable | ResolvedPluginUnsupported union alias (NFR-7, excludes unavailable), re-exported from domain/index.ts"
  - "Widened shared holders: the two orchestrators/plugin/shared.ts adapters and the five bridge resolved params accept MaterializablePlugin"
  - "--force recognition in the shared edge positional parser (parsePositionalsWithFlags), with a force boolean on ParsedPositionalsResult and ParsedMapModelArgs"
affects: [65-02-install, 65-03-update]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Force-materializable union alias (MaterializablePlugin) as the single NFR-7-safe widened type for force holders"
    - "Boolean flag arm placed BEFORE the unknown-flag rejection in the shared positional scanner"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/resolver.ts
    - extensions/pi-claude-marketplace/domain/index.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - extensions/pi-claude-marketplace/bridges/agents/types.ts
    - extensions/pi-claude-marketplace/bridges/commands/types.ts
    - extensions/pi-claude-marketplace/bridges/commands/discover.ts
    - extensions/pi-claude-marketplace/bridges/skills/types.ts
    - extensions/pi-claude-marketplace/bridges/skills/discover.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
    - tests/domain/resolver.types.test.ts

key-decisions:
  - "MaterializablePlugin is exactly installable | unsupported and excludes unavailable so widened holders can never read pluginRoot off a structurally-broken plugin (NFR-7)"
  - "The --force scanner arm sits before the unknown-flag rejection (D-65-05) because install/update route through the shared scanner, not reinstall's inline loop"
  - "Did NOT widen InstallCtx.resolved or PluginPreflight.installable here; those belong to 65-02/65-03"

patterns-established:
  - "MaterializablePlugin: the canonical force-materializable type for holders the force path flows through"
  - "Force flag parse seam: a single --force boolean threaded through ParsedPositionalsResult and ParsedMapModelArgs"

requirements-completed: [FORCE-01, FORCE-02, FORCE-05]

# Metrics
duration: ~15min
completed: 2026-06-27
---

# Phase 65 Plan 01: Force Install & Update Foundation Summary

**MaterializablePlugin union alias (installable | unsupported, NFR-7-safe) plus
--force recognition in the shared edge positional parser, widening the seven
shared force-path holders without any behavior change.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-06-27
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Introduced `MaterializablePlugin = ResolvedPluginInstallable | ResolvedPluginUnsupported`
  in `domain/resolver.ts` (excludes `unavailable`, NFR-7 compile-enforced) and
  re-exported it from `domain/index.ts`.
- Widened the two `orchestrators/plugin/shared.ts` adapters (`resolvePluginVersion`,
  `pickAgentsSourceDir`) and the five bridge `resolved` params to the union;
  bodies unchanged (none read `.state`).
- Taught `parsePositionalsWithFlags` to recognize `--force`, returning a `force`
  boolean on `ParsedPositionalsResult` and `ParsedMapModelArgs`.
- Added NFR-7/FORCE-05 type assertions proving `MaterializablePlugin` admits
  `installable` + `unsupported` and rejects `unavailable`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add MaterializablePlugin alias and widen shared bridge/adapter holders** - `5903b3ee` (feat)
2. **Task 2: Teach the shared edge positional parser to recognize --force** - `2b82e2dc` (feat)

## Files Created/Modified
- `extensions/pi-claude-marketplace/domain/resolver.ts` - Added `MaterializablePlugin` union alias with NFR-7 doc comment.
- `extensions/pi-claude-marketplace/domain/index.ts` - Re-export `MaterializablePlugin`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` - Widened `resolvePluginVersion` + `pickAgentsSourceDir` params to the union.
- `extensions/pi-claude-marketplace/bridges/agents/types.ts` - Widened `StageAgentsInput.resolved`.
- `extensions/pi-claude-marketplace/bridges/commands/types.ts` - Widened `StageCommandsInput.resolved`.
- `extensions/pi-claude-marketplace/bridges/commands/discover.ts` - Widened `discoverPluginCommands` input `resolved`.
- `extensions/pi-claude-marketplace/bridges/skills/types.ts` - Widened `StageSkillsInput.resolved`.
- `extensions/pi-claude-marketplace/bridges/skills/discover.ts` - Widened `discoverPluginSkills` input `resolved`.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts` - Added `force` field + `--force` scanner arm + aggregator threading.
- `tests/domain/resolver.types.test.ts` - Added NFR-7/FORCE-05 MaterializablePlugin assertions.

## Decisions Made
- None beyond the locked CONTEXT decisions (D-65-03/05). The union is exactly
  the two `pluginRoot`-bearing arms; the `--force` arm precedes the unknown-flag
  rejection per D-65-05.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The pre-commit `trufflehog` hook fails inside the worktree sandbox (`.git` is a
  file, not a directory, so it cannot read the index). Per project CLAUDE.md this
  is expected; commits were made with `SKIP=trufflehog` after confirming all other
  hooks pass. The underlying scan limitation is environmental, not a content issue.

## Next Phase Readiness
- 65-02 (install) and 65-03 (update) can now consume `MaterializablePlugin` and the
  `force` parse field without touching shared files, enabling parallel execution.
- This plan delivers no command behavior on its own; full suite is green
  (2359 pass, 0 fail) confirming no regression from the widening.

## Self-Check: PASSED

- SUMMARY.md present at `.planning/phases/65-force-install-update/65-01-SUMMARY.md`.
- Commits `5903b3ee`, `2b82e2dc`, `49611a3a` exist in history.
- `MaterializablePlugin` alias + re-export present; zero remaining
  `ResolvedPluginInstallable` param positions in the seven widened holders.
- Typecheck green; full suite 2359 pass / 0 fail.

---
*Phase: 65-force-install-update*
*Completed: 2026-06-27*
