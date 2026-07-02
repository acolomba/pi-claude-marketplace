---
phase: 75-rename-force-unsupported-vocabulary-to-partial-partially-ava
plan: 01
subsystem: refactoring
tags: [vocabulary-rename, cli-flags, resolver, notification-plumbing, typescript]

# Dependency graph
requires:
  - phase: force-install (Phases 64-74)
    provides: the force-install feature vocabulary (--force/--unsupported flags, requireForceInstallable gate, forceDegrade/forceUpgradable outcome fields, FORCE_*_STATUSES completion sets) that this plan renames
provides:
  - "--partial user flag replacing --force (install/update) and --unsupported (list filter), no alias"
  - "internal degrade plumbing renamed to partial vocabulary (requirePartialInstallable, partialable, .partial option, partialDegrade, partialUpgradable, PARTIAL_*_STATUSES, list opts.partial)"
  - "an always-green, byte-output-identical foundation that shrinks Plan 02's atomic byte-gate commit"
affects: [75-02, output-vocabulary, byte-gate-catalog-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Symbol-level rename discipline (RESEARCH 4c): in-scope degrade/flag tokens renamed while out-of-scope overwrite force:true, component-level compatibility.unsupported/supported, reason strings, and narrowUnsupportedKinds stay byte-identical"
    - "Flag-vs-output split: user-input flag (--partial) and internal plumbing renamed in Plan 01; user-visible render strings + hint-trailer bodies deferred to Plan 02's atomic byte-gate"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts
    - extensions/pi-claude-marketplace/edge/completions/provider.ts
    - extensions/pi-claude-marketplace/edge/completions/data.ts
    - extensions/pi-claude-marketplace/domain/resolver.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - extensions/pi-claude-marketplace/shared/errors.ts

key-decisions:
  - "Single atomic commit for the whole plan (per plan <verification>) - the two tasks share files (data.ts, edge install/update handlers) so a per-task split is impossible without interactive staging (disabled)"
  - "Completion flag descriptions and reinstall retired-flag comments left as-is or reworded without the literal --force; output vocabulary strings deferred to Plan 02"
  - "reconcile/notify.ts needed no change - its force/unsupported tokens are all Plan-02 will-install-modifier / verdict / render / component-array (section 4b)"

patterns-established:
  - "Behavior-preserving rename verified by grep byte-identity assertions on out-of-scope tokens + tsc-guided consumer discovery + green byte-gate catalog UAT"

requirements-completed: [RVOC-01]

# Metrics
duration: 56min
completed: 2026-07-02
---

# Phase 75 Plan 01: Rename force/unsupported flag + plumbing to partial Summary

**Retired the `--force`/`--unsupported` user flags in favor of `--partial` (no alias) and renamed the full internal degrade-force plumbing (`requirePartialInstallable`, `partialable`, `.partial` option, `partialDegrade`, `partialUpgradable`, `PARTIAL_*_STATUSES`) to the partial vocabulary, with observable command OUTPUT byte-identical to pre-plan.**

## Performance

- **Duration:** 56 min
- **Started:** 2026-07-02T16:43:42Z
- **Completed:** 2026-07-02T17:40:39Z
- **Tasks:** 2
- **Files modified:** 31 (17 production + 14 tests)

## Accomplishments
- `--force` (install/update) and `--unsupported` (list filter) renamed to `--partial` across arg-parse, USAGE strings, and tab-completion; zero `--force`/`--unsupported` remain in the `edge/` layer.
- Internal degrade plumbing fully renamed to `partial`: resolver gate `requireForceInstallable` -> `requirePartialInstallable`, thrown-error flag `forceable` -> `partialable`, `InstallPluginOptions`/`UpdatePluginsOptions` `.force` -> `.partial`, `orchestrators/types.ts` `forceDegrade`/`forceUpgradable` -> `partialDegrade`/`partialUpgradable`, completion sets `FORCE_*_STATUSES` -> `PARTIAL_*_STATUSES` (const names only; members untouched), list filter `opts.unsupported` -> `opts.partial`.
- Observable OUTPUT is byte-identical: the codebase still renders `(unsupported)`/`(force-installed)`/`(force-upgradable)` and the failure hint still says `--force` (the `catalog-uat` and `notify-v2` byte-gate tests stayed green without touching `shared/notify.ts`).
- `npm run check` green end-to-end (2532 unit + 16 integration; typecheck + eslint + prettier).

## Task Commits

The two logically-distinct tasks (flag rename, plumbing rename) were landed as ONE atomic commit per the plan's `<verification>` directive ("Commit this plan as a SINGLE commit") and because the two tasks share files that cannot be split without interactive staging:

1. **Task 1 (flag rename) + Task 2 (plumbing rename)** - `525e57ed` (refactor)

**Plan metadata:** _(this docs commit)_

## Files Created/Modified

Production (flag + plumbing layer, 17 files):
- `edge/handlers/plugin/shared.ts` - parse arm `--partial`; internal `partial` boolean
- `edge/handlers/plugin/install.ts` / `update.ts` - USAGE + allow-list `--partial`; thread `{ partial: true }`
- `edge/handlers/plugin/list.ts` - `--partial` filter flag + `{ partial: true }` option
- `edge/handlers/plugin/reinstall.ts` - reworded retired-flag comments (no literal `--force`)
- `edge/completions/provider.ts` / `data.ts` - `--partial` completion + `partial` param; `PARTIAL_*_STATUSES` const names
- `domain/resolver.ts` / `domain/index.ts` - `requirePartialInstallable` gate + `partialable` thrown flag + re-export
- `orchestrators/plugin/install.ts` / `update.ts` / `list.ts` - `.partial` option, gate calls, list filter
- `orchestrators/plugin/reinstall.ts` - `requirePartialInstallable` gate caller (Rule 3)
- `orchestrators/types.ts` - `partialDegrade` / `partialUpgradable` outcome fields
- `orchestrators/edge-deps.ts` / `orchestrators/marketplace/update.ts` - `partialDegrade` consumer + `--partial` prose
- `shared/errors.ts` - `partialable` on PluginShapeError shapes

Tests (14 files): edge handler/completion tests + resolver/orchestrator/errors tests updated in lockstep (INPUT flag literals -> `--partial`; option keys and plumbing symbols renamed; OUTPUT render assertions and reinstall retired-flag rejection tests kept unchanged).

## Decisions Made
- **Single atomic commit:** the plan `<verification>` mandates a single commit; independently, `edge/completions/data.ts` and the edge `install.ts`/`update.ts` handlers carry edits from BOTH tasks, so a per-task split is infeasible without `git add -p` (interactive staging is disabled in this environment). Each of the two tasks was still verified green at its own gate (Task 1: edge `node --test` 152/152; Task 2: full `npm run check`).
- **Output vocabulary left for Plan 02:** completion flag descriptions ("Show unsupported (not-installed) plugins", "Force over collisions..."), all `(unsupported)`/`(force-installed)` render strings, glyph constants, and the `--force` hint-trailer bodies were intentionally NOT touched (they belong to Plan 02's atomic byte-gate). Comments describing the hint were still moved to `--partial` per the Task 2 instruction.
- **reinstall retired-flag comments:** reworded to describe "the retired reinstall force flag" without the literal `--force` token (RESEARCH 4c) so Plan 02's `--force`-absence guard stays clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Renamed `requireForceInstallable` caller in orchestrator reinstall.ts**
- **Found during:** Task 2 (surfaced by `tsc`)
- **Issue:** `orchestrators/plugin/reinstall.ts` imports and calls `requireForceInstallable` but is not in Task 2's declared file list; renaming the resolver gate breaks its compile.
- **Fix:** Renamed the import + call + the "requireForceInstallable gate" doc comment to `requirePartialInstallable`. Left the file's `{ force: true }` overwrite comment (section 4a, Plan 02) untouched.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
- **Verification:** `npm run check` green
- **Committed in:** 525e57ed

**2. [Rule 3 - Blocking] Updated forceDegrade/forceable consumers in two undeclared test files**
- **Found during:** Task 2 (surfaced by `tsc`)
- **Issue:** `tests/orchestrators/marketplace/update.test.ts` (forceDegrade) and `tests/orchestrators/reconcile/apply.test.ts` (forceable) consume renamed symbols but were not in Task 2's declared test list.
- **Fix:** Renamed `forceDegrade` -> `partialDegrade` and `forceable` -> `partialable` in those files.
- **Files modified:** tests/orchestrators/marketplace/update.test.ts, tests/orchestrators/reconcile/apply.test.ts
- **Verification:** `npm run check` green (2532 unit + 16 integration)
- **Committed in:** 525e57ed

**3. [Rule 1 - Correctness] Restructured completion-exclusion tests for the --partial reuse**
- **Found during:** Task 1
- **Issue:** `--partial` is now BOTH the list filter AND the install/update flag, so it legitimately appears in list/ls AND install/update completions. The prior "list-only flags must not leak" and "these heads exclude the flag" tests would falsely fail.
- **Fix:** Dropped the retired `--unsupported` from the install/update exclusion lists and narrowed the "excludes --partial" head loop to `[uninstall, marketplace]` (list/ls now offer `--partial`).
- **Files modified:** tests/edge/completions/provider.test.ts
- **Verification:** edge `node --test` 152/152 green
- **Committed in:** 525e57ed

---

**Total deviations:** 3 auto-fixed (2 blocking caller/consumer updates, 1 correctness test restructure)
**Impact on plan:** All were mechanically necessary for `tsc`/tests to pass after the rename. No behavior change, no scope creep. One planned file (`orchestrators/reconcile/notify.ts`) needed NO change and was correctly left untouched (its `force`/`unsupported` tokens are all Plan-02 will-install-modifier / verdict / render / component-array).

## Issues Encountered
- **RVOC-01 not in REQUIREMENTS.md:** the plan frontmatter lists `requirements: [RVOC-01]`, but per 75-CONTEXT.md "No formal requirement IDs are minted" and REQUIREMENTS.md has no RVOC-01 row. Recorded in frontmatter for traceability; the `requirements mark-complete` step is a no-op (goal + CONTEXT + RESEARCH are the spec).

## User Setup Required
None - no external service configuration required (pure code/config rename).

## Next Phase Readiness
- Plan 02 (the atomic byte-gate commit) can now flip the OUTPUT vocabulary in isolation: render tokens `(unsupported)`/`(force-installed)`/`(force-upgradable)` -> hyphenated `(partially-available)`/`(partially-installed)`/`(partially-upgradable)`, glyph constant names, `forceHint` -> `partialHint`, hint-trailer bodies (`--force` -> `--partial`), the `(will force install)` modifier, the completion-cache schemaVersion 3->4 bump, the still-remaining `--force` in `shared/notify.ts` / `shared/completion-cache.ts` / `*.messaging.ts` / `plugin-state-classifier.ts` / `edge/handlers/tools.ts`, and the `state: "unsupported"` resolver discriminant, in lockstep with `docs/output-catalog.md` + the catalog-uat FIXTURES.
- No blockers.

## Self-Check: PASSED

- FOUND: `.planning/phases/75-rename-force-unsupported-vocabulary-to-partial-partially-ava/75-01-SUMMARY.md`
- FOUND commit: `525e57ed` (code) and `92b2b83c` (docs)
- FOUND: `extensions/pi-claude-marketplace/domain/resolver.ts` (and all 31 modified files)
- Acceptance criteria verified by grep: plumbing symbols = 0; reason tokens = 21 (byte-identical); compatibility/kinds = 51 (byte-identical); notify `(unsupported)` = 1; `--force`/`--unsupported` in `edge/` = 0/0.
- `npm run check` GREEN (2532 unit + 16 integration).

---
*Phase: 75-rename-force-unsupported-vocabulary-to-partial-partially-ava*
*Completed: 2026-07-02*
