---
phase: 66-derived-force-state-glyphs
plan: 01
subsystem: notifications
tags: [notify, status-tokens, glyphs, discriminated-union, catalog-uat, force-install]

# Dependency graph
requires:
  - phase: 64-resolver-three-way-state
    provides: three-way resolver state (installable/unsupported/unavailable) the force states derive from
  - phase: 65-force-install-update
    provides: the --force install/update path whose result this vocabulary displays
  - phase: 65.1
    provides: post-65.1 closed-set baseline (STATUS_TOKENS=20, MARKETPLACE_STATUSES=7) and the will-grammar
provides:
  - force-installed and force-upgradable realized PluginStatus tokens
  - ICON_FORCE_INSTALLED glyph (◉), distinct from ICON_INSTALLED (●)
  - PluginForceInstalledMessage / PluginForceUpgradableMessage union arms
  - will-install force render modifier rendering (will force install)
  - tools.ts projectRowStatus + scope/version arms for both force states
  - closed-set tripwire bumps (STATUS_TOKENS 22, PLUGIN_STATUSES 17) + catalog rows + byte fixtures
affects: [66-02-list-deriver, 66-03-info-success, 66-04-reconcile-pending]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Closed-set token extension via as-const tuple + assertNever-forced render/projection/glyph/stamp arms"
    - "Render-time boolean modifier (force) on an existing discriminator instead of a new closed-set token"
    - "Lockstep landing of source + closed-set tripwires + catalog rows + byte UAT fixtures in one commit"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/edge/handlers/tools.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - tests/architecture/notify-closed-set-locks.test.ts
    - tests/architecture/notify-grammar-invariant.test.ts
    - tests/architecture/notify-stamp-coverage.test.ts
    - tests/architecture/catalog-uat.test.ts
    - tests/shared/notify-v2.test.ts
    - docs/output-catalog.md

key-decisions:
  - "force-installed wears the dedicated ◉ glyph; force-upgradable reuses ● (clean today) per D-66-03"
  - "will force install is a render modifier on will install, NOT a new token; no will-force-update surface (D-66-05)"
  - "force-installed joins TRANSITION_STATUS_LIST (realized transition); force-upgradable excluded (list-inventory only)"
  - "info row Extract widened with force-installed only; force-upgradable is list-only"

patterns-established:
  - "Pattern: closed-set status growth bumps tripwires + catalog + fixtures in one lockstep commit"
  - "Pattern: boolean render modifier on an existing discriminator avoids a closed-set token for a pending-tense variant"

requirements-completed: [FSTAT-02, FSTAT-04, FSTAT-06]

# Metrics
duration: ~30min
completed: 2026-06-27
---

# Phase 66 Plan 01: Derived Force-State Status Vocabulary & Glyphs Summary

**Added the force-installed (◉) and force-upgradable (●) realized plugin statuses, the will-force-install render modifier, and threaded both through every assertNever-forced render/projection/glyph/stamp site, landing the closed-set tripwire bumps + catalog rows + byte fixtures in one green lockstep commit.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-06-27T17:43Z
- **Completed:** 2026-06-27T18:02Z
- **Tasks:** 2 (landed as one lockstep commit per D-66-05)
- **Files modified:** 9

## Accomplishments
- Extended STATUS_TOKENS (20->22) and PLUGIN_STATUSES (15->17) with `force-installed` and `force-upgradable`; MARKETPLACE_STATUSES (7) and REASONS (32) unchanged.
- Exported `ICON_FORCE_INSTALLED = "◉"` (U+25C9), byte-distinct from `ICON_INSTALLED = "●"`; force-upgradable reuses `●`.
- Added `PluginForceInstalledMessage` / `PluginForceUpgradableMessage` interfaces + union arms, modeled on `PluginUpgradableMessage` (required `reasons`).
- Added the `readonly force?: boolean` modifier to `PluginWillInstallMessage`; the `will install` render arm emits `(will force install)` when `force === true`, else `(will install)`. No `will force update` surface (vacuous; documented inline per D-66-05).
- Threaded both statuses through every compile-forced site: `renderPluginRow`, `pluginInfoStatusGlyph` + `PluginInfoRowBase.status` Extract (force-installed only), the PL-4 description filter, `tools.ts::projectRowStatus`/`pluginScopeOrFallback`/`pluginVersion`, and `list.ts::sortPluginsInBlock`.
- Bumped closed-set tripwires, widened `WILL_TOKEN_RE`, added `force-installed` to `TRANSITION_STATUS_LIST`, added catalog rows (force-installed-inventory, force-upgradable-inventory, mp-add-plugin-force-install) with matching byte UAT fixtures and notify-v2 render assertions.

## Task Commits

Tasks 1 and 2 were landed in a SINGLE lockstep commit (D-66-05: the closed-set tripwire and catalog-UAT byte gate would be RED between a source-only commit and a test-only commit, so source + tripwires + catalog + fixtures must land atomically; the 65.1 / commit 5e102920 precedent):

1. **Task 1 + Task 2 (lockstep):** `c00d0e69` (feat)

**Plan metadata:** (final docs commit — this SUMMARY + STATE + ROADMAP)

## Files Created/Modified
- `extensions/pi-claude-marketplace/shared/notify.ts` - force-state union arms, ICON_FORCE_INSTALLED, render switch arms, will-install force modifier, info glyph + Extract, PL-4 filter, closed-set tuples
- `extensions/pi-claude-marketplace/edge/handlers/tools.ts` - projectRowStatus + scope/version switch arms mapping both force states
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` - sortPluginsInBlock scope arm for both force states
- `tests/architecture/notify-closed-set-locks.test.ts` - STATUS_TOKENS=22, PLUGIN_STATUSES=17
- `tests/architecture/notify-grammar-invariant.test.ts` - WILL_TOKEN_RE widened for `will force install` + force:true fixture
- `tests/architecture/notify-stamp-coverage.test.ts` - force-installed in TRANSITION_STATUS_LIST
- `tests/architecture/catalog-uat.test.ts` - force-installed / force-upgradable / will-force-install FIXTURES
- `tests/shared/notify-v2.test.ts` - ◉ vs ● distinctness + force-upgradable + (will force install) byte assertions
- `docs/output-catalog.md` - byte rows for force-installed-inventory, force-upgradable-inventory, mp-add-plugin-force-install

## Decisions Made
None beyond the LOCKED D-66-01..05. Followed the plan as specified; honored D-66-03 (glyphs), D-66-04 (force modifier), D-66-05 (lockstep + no will-force-update).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Threaded force statuses through three additional exhaustive switches not enumerated in the task action**
- **Found during:** Task 1 (typecheck)
- **Issue:** Beyond the sites listed in the plan, three more `assertNever`-style exhaustive switches over `PluginNotificationMessage["status"]` failed to compile without arms for the two new statuses: `tools.ts::pluginScopeOrFallback`, `tools.ts::pluginVersion`, and `list.ts::sortPluginsInBlock::scopeOf`.
- **Fix:** Added `force-installed` / `force-upgradable` to the scope-bearing (orphan-fold) and version-bearing arms of those switches — both force states carry the optional `scope?` and `version?` slots like the other list-surface inventory variants.
- **Files modified:** extensions/pi-claude-marketplace/edge/handlers/tools.ts, extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
- **Verification:** `npm run typecheck` green; this is exactly the compiler-enumerates-missing-sites behavior the RESEARCH "compile-caught" pitfall predicted.
- **Committed in:** c00d0e69

**2. [Rule 1 - Bug] Corrected an invalid REASONS member in a draft catalog row**
- **Found during:** Task 2 (catalog authoring)
- **Issue:** The force-upgradable catalog row initially used `{unsupported features}`, which is not a member of the closed REASONS set (would fail catalog-UAT byte equality / type-check the fixture).
- **Fix:** Replaced with the valid `{unsupported hooks}` REASONS member.
- **Files modified:** docs/output-catalog.md
- **Verification:** catalog-uat byte gate green.
- **Committed in:** c00d0e69

**3. [Rule 1 - Bug] Moved per-group comments off case-label boundaries to satisfy no-fallthrough**
- **Found during:** Task 2 (lint)
- **Issue:** ESLint `no-fallthrough` flagged comments inserted BETWEEN consecutive `case` labels in the grouped switch arms (it does not treat an arbitrary comment as a fall-through annotation).
- **Fix:** Relocated each explanatory comment to ABOVE the first `case` label of the group; no behavior change.
- **Files modified:** extensions/pi-claude-marketplace/edge/handlers/tools.ts, extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
- **Verification:** `npm run lint` green.
- **Committed in:** c00d0e69

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs)
**Impact on plan:** All three were mechanical correctness fixes the plan anticipated ("let `npm run typecheck` enumerate any missed site"). No scope creep; no architectural change.

## Issues Encountered
- `npm run check` reported 2 CANCELLED unit tests (not failures): the documented flaky temp-directory teardown races (`ENOTEMPTY` / `ENOENT` on `/var/folders/.../T/...`). 0 assertion failures; the integration suite (16/16) ran (it only runs after `npm test` exits 0), confirming the gate is green.

## Known Stubs
None. This plan adds the RENDER vocabulary only; the orchestrators that EMIT these statuses (list deriver, info/success, reconcile pending) are Wave 2 (66-02..04) by design — the new statuses compile-render today but are not yet produced by any orchestrator, which is the intended foundation boundary.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wave 2 unblocked: the `force-installed` / `force-upgradable` closed-set members, glyphs, render arms, and the will-install force modifier now exist, so 66-02 (list deriver), 66-03 (info/success), and 66-04 (reconcile pending) can reference them without an assertNever compile error.
- No blockers.

## Self-Check: PASSED

- Created file present: `.planning/phases/66-derived-force-state-glyphs/66-01-SUMMARY.md`
- Modified files present: `extensions/pi-claude-marketplace/shared/notify.ts` (ICON_FORCE_INSTALLED confirmed), `docs/output-catalog.md`
- Commit present: `c00d0e69`

---
*Phase: 66-derived-force-state-glyphs*
*Completed: 2026-06-27*
