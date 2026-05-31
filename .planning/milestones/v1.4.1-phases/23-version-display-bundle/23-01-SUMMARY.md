---
phase: 23-version-display-bundle
plan: 01
subsystem: api
tags: [version-resolution, plugin-json, pi-7, resolver, install]

# Dependency graph
requires:
  - phase: 22-reload-hint-discipline-family
    provides: clean v1.4.1 baseline (npm run check GREEN at 1128 tests)
provides:
  - 3-tier resolvePluginVersion (plugin.json version -> marketplace entry.version -> PI-7 hash)
  - in-place plugin.json re-read in resolvePluginVersion (no ResolvedPluginInstallable widening)
  - seedPathMarketplaceWithPlugin pluginJsonVersion knob (controls plugin.json version independently of entry.version)
  - SNM-34 plugin.json-tier install test + repaired PI-7 (a)/(b)
  - SNM-34 + ROADMAP SC#1 wording amended to plugin.json-first, non-empty-string acceptance
affects: [23-02, version-display, SNM-35, reinstall, update]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-parse-fall-through version tier: re-read plugin.json in place, never throw, never widen the NFR-7 discriminated union"
    - "Non-empty-string version gate reused verbatim across all declared-version tiers (no SemVer enforcement)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - tests/orchestrators/plugin/install.test.ts
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md

key-decisions:
  - "D-23-01: resolvePluginVersion precedence reordered to plugin.json version -> entry.version -> PI-7 hash (plugin.json wins, per PRD §11 PI-7 and Claude Code upstream)"
  - "D-23-02: re-read <pluginRoot>/.claude-plugin/plugin.json in place; ResolvedPluginInstallable union NOT widened with a manifest field (NFR-7 intact)"
  - "D-23-03: accept any non-empty string as the plugin.json version (no SemVer enforcement); malformed/empty/non-string falls through"

patterns-established:
  - "Pattern C (reuse the non-empty-string gate, no SemVer) applied to the new plugin.json tier"
  - "Pattern D (read-parse-fall-through, never widen the discriminated union) for the in-place plugin.json re-read"

requirements-completed: [SNM-34]

# Metrics
duration: 11min
completed: 2026-05-29
---

# Phase 23 Plan 01: SNM-34 plugin.json-first version precedence Summary

**`resolvePluginVersion` reordered to a 3-tier precedence (plugin.json `version` -> marketplace `entry.version` -> PI-7 hash) via an in-place plugin.json re-read, so a plugin declaring its own version now surfaces that version instead of an opaque content hash.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-05-29T11:23:55Z
- **Completed:** 2026-05-29T11:34:52Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- 3-tier `resolvePluginVersion`: plugin.json `version` (new tier 1, wins) -> marketplace `entry.version` (now tier 2) -> `computeHashVersion` (tier 3, unchanged). Plugin.json is re-read in place; any read/parse failure or non-string `.version` silently falls through and never throws.
- `seedPathMarketplaceWithPlugin` gained a `pluginJsonVersion?: string | null` knob controlling the plugin's own plugin.json `version` independently of the marketplace `entry.version` (`undefined` preserves the legacy `0.0.1` shape; a string sets that version; `null` omits the field).
- New SNM-34 tier test proves the plugin.json tier fires when the marketplace entry version is absent; PI-7 (a)/(b) were repaired to honestly exercise the entry.version and hash-fallback tiers.
- SNM-34 (REQUIREMENTS.md) and ROADMAP Phase 23 SC#1 wording amended in lockstep to plugin.json-first order, direct re-read (no phantom `installable.manifest?.version`), and non-empty-string acceptance (no SemVer rejection).
- `npm run check` GREEN at 1129/1129 tests (+1 = the new SNM-34 tier test); `ResolvedPluginInstallableSchema` and `tests/domain/version.test.ts` untouched (NFR-7 + SC#3 intact).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add fixture knob and repair PI-7 (a)/(b) tests (RED for the new tier)** - `d974066` (test)
2. **Task 2: Reorder resolvePluginVersion to 3-tier** - `e8a9d88` (feat)
3. **Task 3: Amend SNM-34 and ROADMAP SC#1 wording in lockstep** - `7aaaa91` (docs)

_TDD gate sequence: `test(...)` (RED, `d974066`) precedes `feat(...)` (GREEN, `e8a9d88`). No refactor commit needed._

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` - `resolvePluginVersion` rewritten to 3 tiers; `import { readFile } from "node:fs/promises"` added; docblock rewritten to the new precedence order citing PI-7 / SNM-34 / D-23-01.
- `tests/orchestrators/plugin/install.test.ts` - `pluginJsonVersion` knob on the seed helper; new SNM-34 tier test; PI-7 (a)/(b) repaired with `pluginJsonVersion: null`; PI-9 / PI-9-corollary fixtures aligned to keep their byte assertions truthful (see Deviations).
- `.planning/REQUIREMENTS.md` - SNM-34 wording amended (plugin.json-first, direct re-read, non-empty-string, no union widening).
- `.planning/ROADMAP.md` - Phase 23 SC#1 wording amended (fall-through-not-rejection, version-string not SemVer).

## Decisions Made

- Followed the plan's D-23-01 / D-23-02 / D-23-03 decisions exactly: reorder (not insert), in-place re-read without widening the NFR-7 union, non-empty-string gate with no SemVer.
- PRD §11 PI-7 (`docs/prd/...prd.md:257`) already states the chosen order -- confirmed correct, no edit (matches the plan's expectation).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Aligned PI-9 and PI-9-corollary fixture plugin.json versions with their entry versions**
- **Found during:** Task 2 (3-tier reorder)
- **Issue:** The reorder makes the seed helper's default plugin.json (`version: "0.0.1"`, written when the new knob is `undefined`) the winning tier-1. Two byte-exact tests -- `PI-9: happy-path install ...` (entry version `1.0.0`) and `PI-9 corollary: empty plugin ...` (entry version `0.1.0`) -- assert the rendered version from the marketplace entry. With plugin.json now winning, both rendered `v0.0.1` and failed their byte assertions (`● hello v0.0.1 (installed) ...`). This is the fixture conflict PATTERNS.md flagged for PI-7 (b), but it also reached these two pipeline/rendering tests.
- **Fix:** Set `pluginJsonVersion` to match each test's `pluginVersion` (`"1.0.0"` and `"0.1.0"` respectively) so both tiers agree and the byte assertions stay truthful. These tests exercise the install pipeline and reload-hint rendering, not version precedence -- the dedicated tier tests (PI-7 (a)/(b), SNM-34) own that.
- **Files modified:** tests/orchestrators/plugin/install.test.ts
- **Verification:** `node --test tests/orchestrators/plugin/install.test.ts` -> 41/41 GREEN; `npm run check` -> 1129/1129 GREEN.
- **Committed in:** `e8a9d88` (Task 2 commit)

**2. [Rule 1 - Bug] Added required blank line before the plugin.json write (lint)**
- **Found during:** Task 2 (post-edit `npm run check`)
- **Issue:** The new `if/else if` block in the seed helper triggered `@stylistic/padding-line-between-statements` (expected blank line before the following `await writeFile(...)`).
- **Fix:** Inserted one blank line between the version-selection block and the write.
- **Files modified:** tests/orchestrators/plugin/install.test.ts
- **Verification:** `npm run lint` clean; `npm run check` GREEN.
- **Committed in:** `e8a9d88` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs -- both fixture/lint breakage directly caused by the Task 2 reorder; in scope).
**Impact on plan:** Both fixes were required to keep the byte-exact and lint gates GREEN after the precedence change. No scope creep -- no behavior beyond the plan's 3-tier reorder was added.

## Issues Encountered

- The plan's `<verify>` blocks use `cd /home/acolomba/pi-claude-marketplace` (the main repo). Because this plan ran in a git worktree, that path executes the MAIN-repo copy of the files (stale relative to my edits) and showed an unchanged 40-test run. Resolved by running `node --test ...` / `npm run check` from the worktree cwd (default), which executes the edited files and reports the correct 41/1129 counts. No code impact -- purely a verification-cwd correction.

## Known Stubs

None -- no placeholder values, empty data sources, or TODO/FIXME markers introduced.

## TDD Gate Compliance

- RED gate present: `test(23-01): ...` (`d974066`) -- the SNM-34 tier test failed against the 2-tier resolver (recorded a hash, not `1.2.3`).
- GREEN gate present: `feat(23-01): ...` (`e8a9d88`) -- the reorder lands and the test passes.
- REFACTOR gate: not needed (no cleanup required after GREEN).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 23-02 (SNM-35: `looksLikeHashVersion` + `formatHashVersionForDisplay` renderer transform in `shared/notify.ts`) is the serialized Wave 2 follow-on. It is file-disjoint from this plan (renderer + catalog/fixtures vs. resolver + install test) and can proceed.
- SNM-34's reorder fires at the NEXT install/reinstall/update only -- no state migration for already-installed hash-versioned plugins (REQUIREMENTS Out of Scope). `marketplace update` will naturally surface those as upgradable.

## Self-Check: PASSED

All claimed files exist on disk (shared.ts, install.test.ts, REQUIREMENTS.md, ROADMAP.md, 23-01-SUMMARY.md) and all four commits are present in history (`d974066`, `e8a9d88`, `7aaaa91`, `0718864`). The 3-tier `resolvePluginVersion` body and the `node:fs/promises` `readFile` import are confirmed in `shared.ts`. `npm run check` GREEN at 1129/1129.

---
*Phase: 23-version-display-bundle*
*Completed: 2026-05-29*
