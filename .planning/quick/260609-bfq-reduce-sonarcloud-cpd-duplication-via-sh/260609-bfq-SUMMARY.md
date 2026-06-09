---
phase: quick-260609-bfq
plan: 01
subsystem: refactoring
tags: [sonarcloud, cpd, duplication, edge-handlers, orchestrators, notify, byte-neutral]

# Dependency graph
requires:
  - phase: v1.11 (Phase 50)
    provides: shared/notify.ts structured-notification seam + catalog-uat byte-form gate
provides:
  - parseMapModelArgs shared arg-parse helper (plugin edge handlers)
  - makeSingleNameMarketplaceHandler factory (marketplace edge handlers)
  - resolveScopeOrNotifyNotAdded lifted to orchestrators/marketplace/shared.ts
  - pluginRow file-private helper folding 4 identical notify switch arms
  - version bump 0.4.2 -> 0.4.3
affects: [edge-handlers, marketplace-orchestrators, notify-renderer, sonarcloud-cpd]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared helper extraction to cut SonarCloud CPD without sonar.cpd.exclusions"
    - "Structural-subset param typing so divergent option types satisfy one helper"
    - "Byte-neutral refactor gated by catalog-uat + notify-v2 byte-form regression suites"

key-files:
  created:
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts
  modified:
    - extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/info.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
    - extensions/pi-claude-marketplace/shared/notify.ts
    - package.json
    - sonar-project.properties
    - package-lock.json
    - CHANGELOG.md

key-decisions:
  - "Reverted an incidental npm package-lock bin-path normalization (./dist/cli.js) to keep the lockfile diff to only the two version fields"
  - "Folded only the 4 byte-equivalent notify arms (upgradable/skipped/failed/manual recovery); left the unavailable arm untouched (its renderScopeBracket(undefined,...) carve-out is not byte-equivalent)"

patterns-established:
  - "parseMapModelArgs: shared opening parse for --map-model handlers; carries parsed.scope via spread under TS strict"
  - "makeSingleNameMarketplaceHandler: factory over divergent orchestrator option types via a structural run param"
  - "resolveScopeOrNotifyNotAdded: single lifted helper takes { ctx, pi, name, scope? } structural subset so both update + remove option types satisfy it"

requirements-completed: [NFR-6]

# Metrics
duration: 23min
completed: 2026-06-09
---

# Quick Task 260609-bfq: Reduce SonarCloud CPD Duplication Summary

**Four shared helpers extracted (plugin/marketplace edge arg-parse + single-name handler factory, marketplace orchestrator scope-resolution, notify plugin-row arms) plus a 0.4.2 -> 0.4.3 patch bump — strictly byte-neutral, every commit green.**

## Performance

- **Duration:** ~23 min
- **Started:** 2026-06-09T08:30:01-04:00 (first task commit)
- **Completed:** 2026-06-09T08:52:42-04:00 (version-bump commit)
- **Tasks:** 5
- **Files modified:** 14 (1 created)

## Accomplishments

- Extracted `parseMapModelArgs` into `edge/handlers/plugin/shared.ts`, eliminating the identical parseArgs-try/catch + parsePositionalsWithFlags opening block duplicated in `install.ts` and `update.ts`.
- Created `edge/handlers/marketplace/shared.ts` with `makeSingleNameMarketplaceHandler`; `info.ts` and `remove.ts` collapsed to one-line wrappers (info/remove were identical except their USAGE string and delegate).
- Lifted the ~33-line `resolveScopeOrNotifyNotAdded` (duplicated near-verbatim in marketplace `update.ts` + `remove.ts`) into `orchestrators/marketplace/shared.ts` with a structural-subset signature both option types satisfy.
- Folded the four identical `renderPluginRow` switch arms (`upgradable`/`skipped`/`failed`/`manual recovery`) into a file-private `pluginRow` helper in `shared/notify.ts`.
- Bumped 0.4.2 -> 0.4.3 across package.json, sonar-project.properties, package-lock.json, and added the CHANGELOG entry.
- `npm run check` green after every one of the 5 commits (1511 unit/arch + 7 integration); the catalog-uat + notify-v2 byte-form gates (110 tests) prove output is byte-identical.

## Task Commits

Each task was committed atomically (Conventional Commits; `npm run check` green and `pre-commit run --files <changed>` clean before each):

1. **Task 1: plugin edge-handler arg-parse boilerplate** - `6984c8d` (refactor)
2. **Task 2: single-name marketplace edge handler factory** - `f8eaa36` (refactor)
3. **Task 3: lift marketplace resolveScopeOrNotifyNotAdded to shared** - `17d3fa2` (refactor)
4. **Task 5: fold notify plugin-row switch arms into helper** - `285ddf2` (refactor)
5. **Task 6: bump version to 0.4.3** - `7242a1e` (chore)

_(Task numbering follows the plan: refactor 1, 2, 3, 5, then the version bump. Refactor #4 — the predicate-divergent block in orchestrators/plugin/shared.ts — was explicitly out of scope and untouched.)_

## Files Created/Modified

- `edge/handlers/marketplace/shared.ts` (created) - `makeSingleNameMarketplaceHandler` factory over the info/remove delegates.
- `edge/handlers/plugin/shared.ts` - added `parseMapModelArgs` + its `ParsedMapModelArgs` type.
- `edge/handlers/plugin/install.ts` / `update.ts` - opening parse block replaced with the helper; distinct post-parse logic preserved verbatim.
- `edge/handlers/marketplace/info.ts` / `remove.ts` - reduced to thin factory wrappers; each keeps its USAGE + header rationale.
- `orchestrators/marketplace/shared.ts` - lifted `resolveScopeOrNotifyNotAdded` (exported, structural-subset signature); added `notify` + `ExtensionContext`/`ExtensionAPI` type imports.
- `orchestrators/marketplace/update.ts` / `remove.ts` - deleted local copies; import the shared helper; removed now-unused imports.
- `shared/notify.ts` - added file-private `pluginRow`; rewrote the 4 folded arms.
- `package.json`, `sonar-project.properties`, `package-lock.json`, `CHANGELOG.md` - 0.4.3 bump.

## Decisions Made

- **Lockfile minimization:** `npm install --package-lock-only` regenerated the lockfile with an incidental `bin` path normalization (`./dist/cli.js` -> `dist/cli.js`) on a transitive peer-dep entry, unrelated to the version bump. Per the plan ("change ONLY the two version fields"), I reverted that one line by hand so the lockfile diff is exactly the two `0.4.2 -> 0.4.3` version fields.
- **notify fold scope:** Only the four byte-equivalent arms were folded. The `unavailable` arm passes `renderScopeBracket(undefined, mpScope)` (MSG-PL-6 / SNM-11 carve-out — no `scope?` field) and is therefore NOT byte-equivalent, so it was deliberately left inline, as were all other arms.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Import-order ESLint error in plugin/shared.ts**
- **Found during:** Task 1 (plugin arg-parse extraction)
- **Issue:** Added `import { parseArgs } from "../../args.ts"` before the existing `parseCommandArgs` from `../../args-schema.ts`; ESLint `import-x/order` requires `args-schema.ts` before `args.ts`.
- **Fix:** Reordered the two import lines.
- **Files modified:** extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
- **Verification:** `npm run lint` clean; committed in `6984c8d`.

---

**Total deviations:** 1 auto-fixed (1 blocking import-order). No scope creep — within the file Task 1 already edits.
**Impact on plan:** Trivial; required for the lint gate.

## Issues Encountered

None beyond the auto-fixed import-order. All typecheck/lint/format/test gates were green on first or second attempt per task; no fix-attempt limits approached.

## Constraints Honored

- `sonar.cpd.exclusions` NOT modified (verified via `git diff`).
- Refactor #4 (`orchestrators/plugin/shared.ts`) NOT touched (verified — zero diff).
- No public API, output, or behavior change — strictly internal helper extraction; catalog-uat + notify-v2 byte-form suites green unchanged throughout.
- Version reads 0.4.3 across package.json, sonar-project.properties, and package-lock.json (root + self-entry).
- Committed only code/config; docs artifacts (PLAN/SUMMARY/STATE) left to the orchestrator.

## Next Phase Readiness

- All 5 commits land on `features/reduce-cpd-duplication`; final `npm run check` green (1511 + 7).
- Ready for the orchestrator's docs commit and PR. SonarCloud CPD should drop on the next scan (4 duplicated blocks collapsed).

## Self-Check: PASSED

- All 4 extracted helpers present at their target files (`parseMapModelArgs`, `makeSingleNameMarketplaceHandler`, exported `resolveScopeOrNotifyNotAdded`, `pluginRow`).
- All 5 commits present in history: `6984c8d`, `f8eaa36`, `17d3fa2`, `285ddf2`, `7242a1e`.
- Created file `edge/handlers/marketplace/shared.ts` and the SUMMARY exist on disk.
- Final `npm run check` exit 0 (1511 unit/arch + 7 integration); byte-form gates 110/110.

---
*Quick task: 260609-bfq-reduce-sonarcloud-cpd-duplication-via-sh*
*Completed: 2026-06-09*
