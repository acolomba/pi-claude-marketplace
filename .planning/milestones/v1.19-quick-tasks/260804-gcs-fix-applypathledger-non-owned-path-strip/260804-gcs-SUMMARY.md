---
phase: quick-260804-gcs
plan: 01
subsystem: infra
tags: [path-ledger, session-env, plugin-root, PENV-01, typescript]

requires:
  - phase: 90
    provides: PENV-01 plugin-PATH recompute + PI_CLAUDE_MARKETPLACE_PATH ledger
provides:
  - applyPathLedger preserves non-owned empty PATH segments byte-identical
  - asAbsolutePluginRoot rejects a root containing path.delimiter
affects: [plugin-path, session-env, hooks-hydrate]

actuals:
  tokens: 945
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Split-asymmetry: empty-filter the ledger, empty-preserve the live PATH"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/session-env.ts
    - extensions/pi-claude-marketplace/domain/plugin-root.ts
    - tests/shared/plugin-path.test.ts
    - tests/domain/plugin-root.test.ts

key-decisions:
  - "Preserve non-owned PATH content byte-identical rather than sanitize; only ledger-owned entries are removed (PENV-01 non-interference)."
  - "Reject delimiter-bearing roots at the single asAbsolutePluginRoot choke point; both callers already catch-and-drop, so no caller changes needed."

patterns-established:
  - "Split-asymmetry: the ledger is empty-filtered (only records absolute non-empty dirs) while the live PATH is split empty-preserving, with a whole-PATH empty string treated as zero entries."

requirements-completed: [PENV-01]

coverage:
  - id: D1
    description: "applyPathLedger preserves non-owned empty PATH segments byte-identical and treats a whole-PATH empty string as zero entries"
    requirement: "PENV-01"
    verification:
      - kind: unit
        ref: "tests/shared/plugin-path.test.ts#applyPathLedger: zero-plugin round-trip preserves a `::` empty segment byte-identical (PENV-01 non-interference)"
        status: pass
      - kind: unit
        ref: "tests/shared/plugin-path.test.ts#applyPathLedger: an empty PATH string is zero entries, so append never introduces a leading empty segment"
        status: pass
    human_judgment: false
  - id: D2
    description: "asAbsolutePluginRoot rejects a root containing path.delimiter, closing the ledger round-trip leak"
    requirement: "PENV-01"
    verification:
      - kind: unit
        ref: "tests/domain/plugin-root.test.ts#asAbsolutePluginRoot: throws when the input contains the PATH delimiter"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-04
status: complete
---

# Quick 260804-gcs: applyPathLedger non-owned PATH-strip fix Summary

**applyPathLedger now preserves non-owned empty PATH segments byte-identical, and asAbsolutePluginRoot rejects delimiter-bearing roots so they can never corrupt the delimiter-joined PATH ledger.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-08-04
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Fixed the primary defect: `applyPathLedger`'s `split` helper filtered out every empty PATH segment (leading `:`, trailing `:`, `::`), silently mutating non-owned user content on every `resources_discover`. It now splits `currentPath` empty-preserving and keeps the empty-filter only for the ledger; a whole-PATH empty string is treated as zero entries so appending never adds a spurious leading segment.
- Fixed the secondary defect: `asAbsolutePluginRoot` now rejects a root containing `path.delimiter`, placed between the null-byte and isAbsolute checks. A delimiter-bearing `resolvedSource` can no longer round-trip the ledger join/split and leak a stale fragment; both callers (`collectBinDirs`, hooks hydrate) already catch-and-drop the throw.
- Pinned both contracts with tests co-located with the existing suites (6 new applyPathLedger cases, 1 new asAbsolutePluginRoot case).

## Task Commits

1. **Task 1: Preserve non-owned empty PATH segments in applyPathLedger** - `f1d4c265` (fix; TDD test+impl in one commit)
2. **Task 2: Reject path.delimiter in asAbsolutePluginRoot** - `aeef0882` (fix; TDD test+impl in one commit)

_TDD note: RED verified per task before writing the fix (5 failing then 1 failing), then GREEN; each task's test + implementation were committed together as one atomic fix commit._

## Files Created/Modified
- `extensions/pi-claude-marketplace/shared/session-env.ts` - `applyPathLedger` split asymmetry + doc comment on empty-segment preservation
- `extensions/pi-claude-marketplace/domain/plugin-root.ts` - delimiter rejection + doc comment on the new reason
- `tests/shared/plugin-path.test.ts` - 6 empty-segment preservation cases
- `tests/domain/plugin-root.test.ts` - delimiter-rejection case + `delimiter` import

## Decisions Made
None beyond the plan — followed the plan's chosen direction exactly (preserve non-owned content byte-identical; reject at the single validation choke point).

## Deviations from Plan
None - plan executed exactly as written.

## TDD Gate Compliance
Both tasks are `tdd="true"`. RED was verified before GREEN for each: Task 1 showed 5 failing new cases pre-fix (one case, the empty-PATH append, already passed by chance), Task 2 showed 1 failing case pre-fix. Test and implementation were committed together per task as a single atomic `fix(...)` commit rather than separate `test(...)`/`feat(...)` commits — appropriate for a two-line surgical bug fix where a separate red-only commit would leave the tree failing with no functional value.

## Issues Encountered
- `pre-commit run trufflehog` errors under the worktree layout (`.git/index: not a directory`) — the documented worktree sandbox issue. Committed with `SKIP=trufflehog` per project policy; the scan itself is not the failure.

## Verification
- `node --test tests/shared/plugin-path.test.ts` — 18/18 pass.
- `node --test tests/domain/plugin-root.test.ts` — 6/6 pass.
- `npm run check` — typecheck, lint (eslint), format:check (prettier) all pass; main test suite **3241/3241 pass, 0 fail**.
- `npm run test:integration` — 16/18 pass. The 2 failures (`provenance-invisibility`, `skill-path-resolution`) are the documented pre-existing environment issue: they resolve the pi-subagents peer from `npm root -g` and fail on a stale global version. Both are unrelated to this change (they exercise provenance/skill-path resolution, not the PATH seam) and fail identically independent of these edits.

## Next Phase Readiness
- PENV-01 non-interference contract is now honored and pinned; no blockers.

## Self-Check: PASSED

All modified source/test files and the SUMMARY exist; both task commits (`f1d4c265`, `aeef0882`) are present in git history.

---
*Quick task: 260804-gcs*
*Completed: 2026-08-04*
