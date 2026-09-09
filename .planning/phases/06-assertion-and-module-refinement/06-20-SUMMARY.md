---
phase: 06-assertion-and-module-refinement
plan: "20"
subsystem: notification architecture
tags: [typescript, notifications, direct-imports, plugin-lifecycle, ownership]
requires:
  - phase: 06-assertion-and-module-refinement
    provides: Named notification owners and sole dispatch boundary from Plans 06-12 through 06-14
  - phase: 06-assertion-and-module-refinement
    provides: Marketplace and enable caller ownership evidence from Plan 06-19
provides:
  - Eight plugin callers verified on genuine notification owners
  - Seven stale source comments repointed from the legacy hub to grammar, types, messaging, or renderer owners
  - Zero legacy shared/notify.ts references across the complete 06-20 caller set
affects:
  [
    notification-callers,
    plugin-fetch,
    plugin-install,
    plugin-list,
    plugin-reinstall,
    phase-06-refinement,
  ]
actuals:
  tokens: 1625
  tasks: 2
  commits: 3
plan_head_before: f7baacfeb24664ac987aa8f457f84c7fcd8a278a
tech-stack:
  added: []
  patterns: [atomic caller migration, genuine direct owner, verify-without-churn, zero-stale census]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
key-decisions:
  - "Keep all eight already-direct notification import graphs unchanged; only seven stale documentation references required repointing."
  - "Keep info.ts cohesive and byte-for-byte unchanged because its notification imports already name direct owners."
patterns-established:
  - "A bounded caller migration traces every imported symbol to its named owner, leaves already-correct imports alone, and repairs only stale source documentation."
requirements-completed: [TREF-07, TREF-09]
coverage:
  - id: D1
    description: All eight scoped callers use genuine direct notification owners and contain zero shared/notify.ts references.
    requirement: TREF-09
    verification:
      - kind: other
        ref: CodeGraph owner attribution and eight-file zero-stale census
        status: pass
      - kind: other
        ref: npm run typecheck && npm run fallow
        status: pass
    human_judgment: false
  - id: D2
    description: Plugin fetch, info, install, list, and reinstall behavior preserves exact types, bytes, redaction, order, severity, and lifecycle cardinality.
    requirement: TREF-07
    verification:
      - kind: unit
        ref: focused enable-disable, fetch, info, install, list, reinstall messaging, and reinstall lifecycle suites
        status: pass
      - kind: architecture
        ref: tests/shared/notification-dispatch.test.ts and tests/edge/notification-boundary.ts
        status: pass
      - kind: other
        ref: five direct-pair coverage gates and aggregate attribution
        status: pass
    human_judgment: false
duration: 14min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 20: Plugin Lifecycle Notification Caller Summary

**Eight plugin callers retain exact notification behavior through genuine named owners, with seven stale hub comments repointed and no legacy path left in scope.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-09-09T10:03:49Z
- **Completed:** 2026-09-09T10:17:49Z
- **Tasks:** 2
- **Production files modified:** 5

## Accomplishments

- Traced every notification-related symbol in all eight plan-listed callers through CodeGraph before source inspection and confirmed that Plan 06-14 had already moved every runtime import to a genuine owner.
- Repointed seven stale comments from `shared/notify.ts` to `notification-grammar.ts`, `notification-types.ts`, or the concrete list messaging renderer without changing executable code.
- Preserved every type, output byte, redaction step, row order, severity, caller API, Phase 06-01 ordered array, and cardinality invariant; deferred plugin-info work remains untouched.
- Proved zero `shared/notify.ts` references in all eight scoped callers and exactly eight production TypeScript `ctx.ui.notify` call sites, all owned by `notification-dispatch.ts`.

## Task Commits

1. **Task 1: Enable/fetch/info callers** - `57f96225` (docs)
2. **Task 2: Install/list/reinstall messaging callers** - `ed5a8e43` (docs)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts` - Names `notification-grammar.ts` as the shared presentation owner.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts` - Names `notification-grammar.ts` as the shared presentation owner.
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts` - Names `notification-grammar.ts` as the shared presentation owner.
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` - Names `list.messaging.ts`, `notification-types.ts`, and `notification-grammar.ts::renderMpHeader` as the exact renderer, type, and header owners.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts` - Names `notification-grammar.ts` as the shared presentation and scope-bracket owner.

The following scoped callers were already correct and stayed byte-for-byte unchanged:

- `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`

## Caller Ownership Evidence

| Caller                          | Notification surface                                        | Exact owner                                                                                           | Result                                                   |
| ------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `plugin/fetch.messaging.ts`     | grammar functions/constants; message types; context type    | `notification-grammar.ts`; `notification-types.ts`; `notify-context.ts`                               | Imports already direct; stale grammar comment fixed      |
| `plugin/fetch.ts`               | message types; absolute-path redaction; contextual dispatch | `notification-types.ts`; `redact-absolute-paths.ts`; `notify-context.ts` → `notification-dispatch.ts` | Already direct; unchanged                                |
| `plugin/info.ts`                | message types; contextual and direct dispatch               | `notification-types.ts`; `notify-context.ts` → `notification-dispatch.ts`; `notification-dispatch.ts` | Already direct; unchanged                                |
| `plugin/install.messaging.ts`   | grammar functions/constants; message types; context type    | `notification-grammar.ts`; `notification-types.ts`; `notify-context.ts`                               | Imports already direct; stale grammar comment fixed      |
| `plugin/install.ts`             | message types; absolute-path redaction; contextual dispatch | `notification-types.ts`; `redact-absolute-paths.ts`; `notify-context.ts` → `notification-dispatch.ts` | Already direct; unchanged                                |
| `plugin/list.messaging.ts`      | grammar functions/constants; message types; context type    | `notification-grammar.ts`; `notification-types.ts`; `notify-context.ts`                               | Imports already direct; stale grammar comment fixed      |
| `plugin/list.ts`                | top-level rendering; message types; contextual dispatch     | `list.messaging.ts`; `notification-types.ts`; `notify-context.ts` → `notification-dispatch.ts`        | Imports already direct; three stale owner comments fixed |
| `plugin/reinstall.messaging.ts` | grammar functions/constants; message types; context type    | `notification-grammar.ts`; `notification-types.ts`; `notify-context.ts`                               | Imports already direct; two stale grammar comments fixed |

`notify-context.ts` owns real command-context rendering and imports the concrete cascade emitters from `notification-dispatch.ts`; it neither re-exports the deleted hub nor forwards an old API path. `info.ts` deliberately stays cohesive and unchanged because both its contextual and direct dispatch imports already identify genuine owners.

## Four-Part Repointing Gate

| Category               | Evidence                                                                                                                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| source-scanning gate   | CodeGraph attributes every scoped notification symbol to a genuine owner. The eight-file stale-path scan returns zero matches, and the TypeScript production census finds eight direct Pi calls only in `notification-dispatch.ts`. |
| documentation comment  | All seven scoped comments that named `shared/notify.ts` now name the exact grammar, type, messaging, or renderer owner; no scoped comment or import retains the old path.                                                           |
| test ownership         | Focused enable-disable, fetch, info, install, list, reinstall messaging, and reinstall lifecycle suites pass; dispatch owner and edge boundary tests pass; all five changed production pairs pass direct coverage.                  |
| completeness invariant | Every plan-listed caller has an explicit ownership row, every named owner remains tracked, all eight callers are stale-path-free, and no compatibility facade or re-export was introduced.                                          |

## Verification

- Task 1: `npm run typecheck` and plugin enable-disable, fetch, and info suites passed 3/3; the three-file stale-path gate returned zero matches.
- Task 2: `npm run typecheck` and plugin install, list, and reinstall messaging suites passed 3/3; the five-file stale-path gate returned zero matches.
- Plan gates: repeated `npm run typecheck`, `npm run fallow`, `npm run test:corresponding`, corresponding-test negative controls, and integration passed. Fallow reports zero dead-code issues and zero health issues above configured thresholds; integration passed 13/13 files.
- Exact array/cardinality lock: the focused reinstall lifecycle suite passed, retaining the Phase 06-01 exact ordered arrays, single terminal summary, and notification cardinality assertions.
- Direct-pair coverage: fetch messaging, install messaging, list messaging, list, and reinstall messaging each passed at 100% branches, functions, and lines.
- Sole-dispatch proof: `tests/shared/notification-dispatch.test.ts` and `tests/edge/notification-boundary.ts` passed 2/2. The production TypeScript census finds exactly 8 direct `ctx.ui.notify` expressions, all in `shared/notification-dispatch.ts`.
- Focused TypeScript style review: repository lint, scoped Prettier, typecheck, and `git diff --check` passed with no findings. The five edited files change comments only and introduce none of the Google TypeScript style review quick-scan tokens.
- Focused unit-test review: no test code changed; all focused suites and five direct-pair coverage gates pass, with no skipped or todo cases introduced.
- Aggregate `npm test`: 259/261 files passed. `tests/architecture/revalidation.test.ts` remains the declared sealed Phase 1 fixture debt for TREF-04 through TREF-09. `tests/orchestrators/marketplace/add.test.ts` hit the known sandbox Unix-socket denial and passed 63/63 unrestricted.
- Direct-coverage negative controls reproduced their sandbox subprocess restriction and passed unrestricted.
- `npm run check` reached `format:check` and stopped only on the pre-existing user-owned untracked `.mcp.json`; every plan-owned file passes focused formatting, and every later check component was run separately as described above.
- Final scoped stale-path census: zero `shared/notify.ts` references in all eight callers.
- Executable-diff proof: the complete five-file production diff changes comments only; imports and runtime statements are byte-for-byte unchanged.

## Decisions Made

- Kept all eight already-direct imports unchanged. The task required ownership repointing, not process-only import churn.
- Kept `notifyWithContext` and its context types on their genuine `notify-context.ts` composition owner. That module routes directly to the sole dispatch owner and is not an old-path compatibility seam.
- Kept plugin-info behavior cohesive and byte-identical; no deferred split or reshape was performed.

## Deviations from Plan

None - the plan explicitly required four-part documentation repointing while preserving already-correct direct imports and behavior.

## Issues Encountered

- The repository-wide `npm run check` cannot pass formatting while the user-owned untracked `.mcp.json` remains intentionally unformatted. The file was preserved byte-for-byte; all plan-owned files and all later gate components pass independently.
- Aggregate testing reproduced only the two declared results: the sealed Phase 1 revalidation fixture debt and the sandbox Unix-socket denial. Marketplace/add passed 63/63 unrestricted, attributing its aggregate failure to the environment.
- The direct-coverage negative-control subprocess also lacked its expected stderr in the sandbox and passed unrestricted, confirming an environment-only restriction.

## Known Stubs

None.

## Threat Flags

None - this plan changes source comments only and introduces no endpoint, authentication path, file access pattern, schema, or trust-boundary behavior. Typed-message and redaction paths remain unchanged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The complete 06-20 caller group has direct named ownership, exact behavior evidence, and zero legacy notify-hub references.
- Wave 14 sibling Plan 06-22 can continue the same CodeGraph attribution and zero-stale census without compatibility exports.
- The sealed Phase 1 revalidation fixture debt and the untracked `.mcp.json` formatting obstruction remain intentionally untouched.

## Self-Check: PASSED

The summary exists, both task commits are present in git history, all eight scoped callers remain stale-path-free, and the sole-dispatch census still resolves exactly eight TypeScript call sites to `notification-dispatch.ts`.

---

_Phase: 06-assertion-and-module-refinement_
_Completed: 2026-09-09_
