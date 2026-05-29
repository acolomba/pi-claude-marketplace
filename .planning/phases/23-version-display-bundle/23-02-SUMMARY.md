---
phase: 23-version-display-bundle
plan: 02
subsystem: renderer / user-contract
tags: [SNM-35, hash-version, display, notify, catalog-uat, byte-equality]
requires:
  - "23-01 (serialized after SNM-34 per the v1.4.1 shared/notify.ts convergence constraint D-23-07; no code dependency)"
provides:
  - "looksLikeHashVersion + formatHashVersionForDisplay renderer helpers in shared/notify.ts"
  - "renderVersion + composeVersionArrow route version tokens through the hash-display transform"
  - "v#<7hex> byte fixtures + hash-version catalog states locked by byte-equality"
affects:
  - "every version surface (list rows, install/update/reinstall/uninstall cascade rows, the from → to arrow)"
tech-stack:
  added: []
  patterns:
    - "Pattern A: two-and-only-two version-render chokepoints (renderVersion, composeVersionArrow) -- the transform plugs into exactly these two, never per-arm"
    - "Pattern B: persistence/display separation -- PI-7 hash-<12hex> persists; v#<7hex> is renderer-only"
    - "Pattern E: catalog + fixture + test lockstep in one byte-equality gate"
key-files:
  created: []
  modified:
    - "extensions/pi-claude-marketplace/shared/notify.ts"
    - "tests/shared/notify-v2.test.ts"
    - "docs/output-catalog.md"
    - "tests/architecture/catalog-uat.test.ts"
decisions:
  - "D-23-04: anchored-exact predicate /^hash-[0-9a-f]{12}$/; formatHashVersionForDisplay returns #<7hex> WITHOUT the v (downstream prepends it)"
  - "D-23-05: route BOTH composeVersionArrow sides through the transform, preserving the asymmetric v (bare from, v-prefixed to)"
  - "D-23-06: added catalog states hash-version-list (list) + hash-version-arrow (update) with matching FIXTURES in lockstep"
  - "Helpers placed adjacent to renderVersion (Claude's Discretion); transform invoked inline in each chokepoint (minimal edit)"
metrics:
  duration: "~10 min"
  tasks: 3
  files: 4
  completed: 2026-05-29
---

# Phase 23 Plan 02: Version Display (SNM-35) Summary

Renderer-only transform that displays a persisted PI-7 hash-version
(`hash-<12hex>`) to the user as a git-style short SHA `v#<7hex>` instead of the
verbose `vhash-<12hex>`, plugged into the two-and-only-two version-render
chokepoints so all 9 single-version arms plus the update arrow are covered by a
single edit each; persistence stays `hash-<12hex>` (PI-7 intact, no migration).

## What Was Built

**Task 1 (`feat`, `31a456b`) -- `shared/notify.ts` helpers + chokepoint routing:**

- `looksLikeHashVersion(v)` -- anchored-exact predicate backed by the
  module-level regex literal `/^hash-[0-9a-f]{12}$/`. Rejects uppercase hex,
  wrong length, and `hash-` followed by non-hex (T-23-06 spoofing mitigation:
  a malformed pseudo-hash is never silently rewritten into a misleading short
  SHA).
- `formatHashVersionForDisplay(v)` -- strips the `hash-` prefix and returns
  `#` + the first 7 hex chars (`hash-2ea95f85703d` -> `#2ea95f8`); a non-hash
  string (SemVer) passes through unchanged. Returns WITHOUT the `v` -- the `v`
  is prepended downstream.
- `renderVersion` now returns `` `v${formatHashVersionForDisplay(version)}` ``
  (undefined/empty short-circuit preserved). One edit covers all 9 arms that
  call `renderVersion` (installed/reinstalled/uninstalled/available/unavailable/
  upgradable/present/skipped/failed/manual-recovery) -- the per-arm switch cases
  were NOT touched (Pattern A).
- `composeVersionArrow` routes BOTH `from` and `to` through the transform,
  preserving the asymmetric `v` (bare `from`, `v`-prefixed `to`). Two hashes
  render `#2ea95f8 → v#1c3d9a0`; SemVer pairs stay `0.5.0 → v1.0.0`.

**Task 2 (`test`, `f63935b`) -- `tests/shared/notify-v2.test.ts` byte fixtures:**

- Single-version arm: `installed` row with `version: "hash-2ea95f85703d"`
  asserts the token `v#2ea95f8`.
- Update-arrow arm: `updated` row with `from: "hash-2ea95f85703d"`,
  `to: "hash-1c3d9a0bbef1"` asserts `#2ea95f8 → v#1c3d9a0`.
- SemVer pass-through guard: `version: "1.0.0"` still renders `v1.0.0`.
- Reused the existing `makeCtx()` / `piWith*Loaded()` factories; no new factory.
- Test count 48 -> 51, all GREEN.

**Task 3 (`docs`, `225dd86`) -- catalog rules + states + FIXTURES (lockstep):**

- Amended the version-token rule (`output-catalog.md`): persisted
  `hash-<12hex>` renders `v#<7hex>`; persistence unchanged. Cites SNM-35 /
  D-23-04 / D-23-05.
- Amended the update-arrow asymmetry note: a hash side renders `#<7hex>` (bare
  `from`) / `v#<7hex>` (prefixed `to`).
- Added catalog-state `hash-version-list` under `## /claude:plugin list`
  (single-version inventory row `● hashed-plugin v#2ea95f8 (installed)`, no
  `/reload` trailer since `present` is an inventory discriminator).
- Added catalog-state `hash-version-arrow` under `## /claude:plugin update`
  (arrow `● hashed-plugin #2ea95f8 → v#1c3d9a0 (updated)` with `/reload`).
- Added matching `FIXTURES[section][state]` entries in `catalog-uat.test.ts`;
  the catalog-uat runner drives both through `notify()` and asserts
  byte-equality. Catalog-state count rose to 53 (>= 30 guard holds).

## Verification

- `node --test tests/shared/notify-v2.test.ts` GREEN (51/51): v#<7hex>
  single-version + arrow + SemVer pass-through.
- `node --test tests/architecture/catalog-uat.test.ts` GREEN (3/3);
  `examples.length` = 53 (>= 30 holds).
- `node --test tests/domain/version.test.ts` GREEN (5/5) and UNCHANGED (SC#3 --
  persistence stays `hash-<12hex>`).
- `npm run check` exits 0 (typecheck + ESLint + Prettier + 1132 tests) --
  catalog + fixtures + renderer in lockstep, byte-equality GREEN (NFR-6, SC#4).
- No `vhash-` literal appears in any rendered byte string across catalog or
  fixtures (0 occurrences in both files).
- `extensions/pi-claude-marketplace/domain/version.ts` and
  `tests/domain/version.test.ts` confirmed unmodified (`git status --short`
  reports nothing for either).

## Success Criteria

- SC#2 (a `hash-<12hex>` renders `v#<7hex>` in every surface): MET -- the
  transform sits in both sole chokepoints, covering all 9 single-version arms +
  the arrow.
- SC#3 (state.json byte form stays `hash-<12hex>`; version.ts +
  version.test.ts unchanged): MET -- renderer-only; both files untouched and
  version.test.ts GREEN.
- SC#4 (catalog examples use `v#<7hex>`; catalog-uat + notify-v2 byte fixtures
  updated in lockstep and GREEN): MET -- two new states + matching FIXTURES;
  `npm run check` 0.

## Deviations from Plan

None - plan executed exactly as written.

The plan's `<verify>` blocks hardcode `cd /home/acolomba/pi-claude-marketplace`
(the MAIN repo). Per the worktree execution directive, all verification was run
from the worktree cwd instead so it exercised the changes in this branch, not
stale main-repo copies. This is the prescribed worktree behavior, not a
deviation from plan intent.

## Authentication Gates

None.

## Known Stubs

None. All four files carry live data flow; no hardcoded empty values,
placeholders, or unwired components were introduced.

## Notes

- `pre-commit` was run on changed files before each commit. The `trufflehog`
  hook fails in the worktree sandbox with
  `failed to read index file: open .../.git/index: not a directory` -- the
  documented worktree limitation (`.git` is a file, not a directory, in a
  linked worktree). Per CLAUDE.md, commits used the `SKIP=trufflehog` prefix;
  all other hooks (prettier, eslint, typecheck, mdformat, markdownlint, secret
  detectors) passed. The diffs contain no credentials -- only a regex literal,
  template strings, test fixtures, and doc prose.

## Self-Check: PASSED

All four modified files exist; SUMMARY.md exists; all four task/summary commits
(`31a456b`, `f63935b`, `225dd86`, `2062225`) are reachable in git history.
Working tree clean; HEAD on `worktree-agent-ae72e06d042477ec5`.
