---
phase: 71-partial-hook-force-install
plan: 03
subsystem: api
tags: [hooks, info, reason-rendering, narrowUnsupportedKinds, force-degrade, typescript]

# Dependency graph
requires:
  - phase: 71-partial-hook-force-install
    plan: 01
    provides: "partitionHooks + parseHooksConfig filtered subset + dropped enumeration"
  - phase: 71-partial-hook-force-install
    plan: 02
    provides: "applyHooksConfig verdict split: hooks kind on partial.unsupported + droppedHooks; ResolvedPlugin arms carry droppedHooks"
  - phase: 64-resolver-three-way-state
    provides: "narrowUnsupportedKinds render-time per-kind marker family + three-way state"
provides:
  - "narrowUnsupportedKinds third case: kind 'hooks' -> the existing 'unsupported hooks' REASONS member (closed set stays 32, no new literal)"
  - "Single aggregate {unsupported hooks} list marker rendered byte-identically across list, info, and the install per-kind surface"
  - "HookSummaryEntry lenient arm carries an optional matcher; appendHooksBlock renders dropped entries at matcher-group granularity (event(matcher) (unsupported) / event (unsupported))"
  - "info strict reader (readHookSummaryEntries) merges the partition's supported projection with a deduped dropped enumeration from the same pure parse (lenient->strict reader flip resolved)"
affects: [force-install staging (Plan 04), catalog-uat partial-hook rows (Plan 04)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single shared per-kind reason helper (narrowUnsupportedKinds) maps the hooks kind uniformly across every surface, so the install note path and the typed-list path agree by construction"
    - "Strict info reader re-derives the dropped enumeration from its own pure re-parse (parsed.dropped) rather than threading a second source of truth"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
    - extensions/pi-claude-marketplace/shared/concerns/hooks.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - tests/shared/probe-classifiers.test.ts
    - tests/orchestrators/plugin/cross-surface-reason-parity.test.ts
    - tests/orchestrators/plugin/info.test.ts
    - tests/shared/notify-v2.test.ts
    - tests/orchestrators/plugin/install.test.ts

key-decisions:
  - "The strict info reader sources the dropped enumeration from its own parsed.dropped (the reader already re-parses) instead of threading resolved.droppedHooks; the partition is pure and deterministic so this is authoritative with zero extra plumbing"
  - "Dropped handler entries are deduped at matcher-group granularity (event + matcher key) so multiple non-command handler drops in one group render a single event(matcher) (unsupported) line, mirroring the supported block's one-line-per-group convention"
  - "The hooks kind maps to 'unsupported hooks' uniformly via the single shared helper, so the dead/synthetic 'contains hooks' note path now also renders 'unsupported hooks'; this supersedes the D-58-02 dead-carve-out and improves cross-surface parity"

requirements-completed: [PHOOK-05]

# Metrics
duration: 16min
completed: 2026-06-28
---

# Phase 71 Plan 03: Dropped-hooks reason + info enumeration Summary

**The `hooks` kind now renders the single aggregate `{unsupported hooks}` list marker through the shared `narrowUnsupportedKinds` helper (closed set stays 32), and `/claude:plugin info` enumerates each dropped handler as `event(matcher) (unsupported)` on the strict reader path, resolving the lenient->strict reader flip for now-resolving partial-hook plugins.**

## Performance

- **Duration:** ~16 min
- **Completed:** 2026-06-28
- **Tasks:** 2
- **Files modified:** 8 (3 source, 5 test)

## Accomplishments
- `narrowUnsupportedKinds` gained a third arm mapping kind `"hooks"` to the pre-existing `"unsupported hooks"` REASONS member, so the compact `list` row carries ONE aggregate marker regardless of how many events/matchers dropped (first-wins dedup). No new REASONS literal, no tripwire change (D-71-04 / closed set 32).
- `HookSummaryEntry`'s lenient arm now carries an optional `matcher`; `appendHooksBlock` renders dropped entries at matcher-group granularity (`event(matcher) (unsupported)` when a matcher is present, `event (unsupported)` when not).
- The info STRICT reader (`readHookSummaryEntries`) merges the supported projection with a deduped dropped enumeration derived from the SAME pure `parseHooksConfig` call, so a partial-hook plugin that now records `hooksConfigPath` still surfaces `Stop (unsupported)` / `PreToolUse(.*) (unsupported)` detail (Pitfall 1 guarded).
- Cross-surface parity pinned: list and info derive the `{unsupported hooks}` aggregate byte-identically from the typed `unsupported[]` list.
- `npm run check` is fully green (typecheck + lint + format + unit + integration), including catalog-uat (no Plan 04 handoff breakage materialized).

## Task Commits

Each task was committed atomically:

1. **Task 1: narrowUnsupportedKinds third case + cross-surface parity** - `173f37b5` (feat)
2. **Task 2: info strict-path dropped-handler enumeration + appendHooksBlock matcher arm** - `804eeeb1` (feat)

## Files Created/Modified
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` - `narrowUnsupportedKinds` third case (`hooks` -> `unsupported hooks`); widened return union; extracted flat `kindToReason` helper.
- `extensions/pi-claude-marketplace/shared/concerns/hooks.ts` - `HookSummaryEntry` lenient arm gains optional `matcher`; `appendHooksBlock` renders the matcher-bearing dropped arm; doc-comments updated.
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` - import `DroppedHook`; new `projectDroppedHookEntries` (matcher-group dedup); `readHookSummaryEntries` merges supported + dropped from the same parse.
- `tests/shared/probe-classifiers.test.ts` - `narrowUnsupportedKinds` hooks/mixed/repeated mapping cases.
- `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` - partial-hook `{unsupported hooks}` list/info byte-parity; structural-vs-degradable guard comment corrected.
- `tests/orchestrators/plugin/info.test.ts` - migrated the mixed `PostToolUse(Bash)` + `Stop (unsupported)` case onto the strict path; added the intra-event `PreToolUse(.*) (unsupported)` case; clarified the Stop-only lenient/empty-subset comment.
- `tests/shared/notify-v2.test.ts` - migrated the `HookSummaryEntry` discriminator pin (the lenient arm's optional matcher loosens the union-level excess check for non-tool literals).
- `tests/orchestrators/plugin/install.test.ts` - migrated two `narrowResolverReasons` hooks cases to the new `unsupported hooks` mapping.

## Decisions Made
- **Strict reader uses its own `parsed.dropped`, not threaded `resolved.droppedHooks`.** The plan offered either; the reader already re-parses to project supported entries, so `parsed.dropped` from the SAME pure partition is free and authoritative. Threading would be redundant work for an identical result.
- **Matcher-group dedup for dropped entries.** Multiple non-command handler drops (P6) in one group collapse to a single `event(matcher) (unsupported)` line via an `event + matcher` seen-set, matching the supported block's one-line-per-group granularity.
- **Uniform `hooks` -> `unsupported hooks` mapping.** Routing the `hooks` kind through the single shared helper means the (dead/synthetic) `contains hooks` note path also renders `unsupported hooks`. This supersedes the D-58-02 dead-carve-out and is strictly more consistent across surfaces.

## Deviations from Plan

The plan's `files_modified` listed three source files plus three test files. Two ADDITIONAL test files required migration because the intended type/helper changes cascaded to compile-time and behavioral pins in adjacent tests. No source-of-truth behavior was altered beyond the plan; these are test-pin migrations.

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migrated the `HookSummaryEntry` discriminator pin in notify-v2.test.ts**
- **Found during:** Task 2 (HookSummaryEntry matcher arm)
- **Issue:** Adding an optional `matcher` to the lenient arm makes `matcher` a known property of the union, so TypeScript no longer flags it as excess on the untagged non-tool arm. A `@ts-expect-error` asserting "non-tool events forbid matcher" became unused, breaking `tsc --noEmit`.
- **Fix:** Reframed the test to keep the still-valid "tool events REQUIRE matcher" pin and replaced the now-invalid negative pin with a positive assertion that the lenient arm accepts an optional matcher (the dropped-group enumeration shape). The untagged non-tool arm still declares no matcher field.
- **Files modified:** tests/shared/notify-v2.test.ts
- **Verification:** `npm run typecheck` green; notify-v2 140/140.
- **Committed in:** `804eeeb1` (Task 2 commit)

**2. [Rule 1 - Bug] Migrated two `narrowResolverReasons` hooks cases in install.test.ts**
- **Found during:** Task 1 (narrowUnsupportedKinds third case), surfaced by the full suite during Task 2 verification
- **Issue:** Two tests pinned the superseded D-58-02 behavior where a synthetic `contains hooks` note fell through to the generic `unsupported source`. The shared helper now maps the `hooks` kind to `unsupported hooks`, so `narrowResolverReasons(["contains hooks"])` returns `["unsupported hooks"]` and the mixed `contains hooks` + `contains lspServers` case returns `["unsupported hooks", "lsp"]`.
- **Fix:** Updated both expectations and comments to the Phase 71 reality (`hooks` is a force-degradable per-kind marker; `hooks` is not in `UNSUPPORTED_COMPONENT_KINDS`, so the input stays synthetic but the shared-helper mapping is now correct and cross-surface-consistent).
- **Files modified:** tests/orchestrators/plugin/install.test.ts
- **Verification:** install 75/75; full suite 0 fail.
- **Committed in:** `804eeeb1` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking compile pin, 1 behavioral test-pin). Both are direct, necessary consequences of the plan's intended union widening (Task 1) and matcher-bearing arm (Task 2). No source behavior beyond the plan; no scope creep.

## Issues Encountered
- The catalog-uat byte fixtures flagged as a possible Plan 04 hand-off stayed GREEN -- `npm run check` passes in full. No catalog-uat reconciliation was needed here; any new partial-hook catalog rows remain additive work for Plan 04.

## Next Phase Readiness
- The `{unsupported hooks}` aggregate and the enumerated `info` dropped detail render correctly across surfaces; Plan 04 can stage the byte-exact filtered `hooks.json` and add the partial-hook catalog-uat rows on top of a green suite.
- No blockers.

## Self-Check: PASSED

- Files: `probe-classifiers.ts`, `concerns/hooks.ts`, `info.ts`, and `71-03-SUMMARY.md` all present.
- Commits `173f37b5`, `804eeeb1` present on `features/force-install`.
- `npm run check` green (typecheck + lint + format + unit 2485 pass / 0 fail + integration 16/16). The 2 prior INFO-05 failures now pass.

---
*Phase: 71-partial-hook-force-install*
*Completed: 2026-06-28*
