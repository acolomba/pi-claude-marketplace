---
phase: 06-assertion-and-module-refinement
plan: "21"
subsystem: notification architecture
tags: [typescript, notifications, direct-imports, plugin-lifecycle, reconciliation]
requires:
  - phase: 06-assertion-and-module-refinement
    provides: Named notification owners and sole dispatch boundary from Plans 06-12 through 06-14
  - phase: 06-assertion-and-module-refinement
    provides: Verify-without-churn caller attribution from Plans 06-15 through 06-19
provides:
  - Seven reinstall, shared, uninstall, update-row, update, and reconcile callers verified on genuine notification owners
  - Six stale source comments repointed from the legacy hub to grammar, summary, or dispatch owners
  - Zero legacy shared/notify.ts references across the complete 06-21 caller set
affects: [notification-callers, plugin-reinstall, plugin-uninstall, plugin-update, reconcile-apply]
actuals:
  tokens: 1395
  tasks: 2
  commits: 3
plan_head_before: 70b8bd42f27f97c46170c06cbf928e32941b191c
tech-stack:
  added: []
  patterns: [atomic caller migration, genuine direct owner, verify-without-churn, zero-stale census]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
key-decisions:
  - "Keep all seven already-direct notification import graphs unchanged; only six stale documentation references required repointing."
  - "Preserve uninstall as a cohesive transaction: its only 06-21 change is one import-path prose correction in uninstall.messaging.ts."
patterns-established:
  - "A bounded caller migration traces every scoped symbol to a genuine owner, leaves correct imports untouched, and repairs only stale ownership prose."
requirements-completed: [TREF-07, TREF-09]
coverage:
  - id: D1
    description: All seven scoped callers use genuine direct notification owners and contain zero shared/notify.ts references.
    requirement: TREF-09
    verification:
      - kind: other
        ref: CodeGraph owner attribution and seven-file zero-stale census
        status: pass
      - kind: other
        ref: npm run typecheck && npm run fallow
        status: pass
      - kind: other
        ref: tests/architecture/notify-producer-wire-coverage.test.ts and sole-dispatch source census
        status: pass
    human_judgment: false
  - id: D2
    description: Reinstall, uninstall, update, and reconcile behavior retains exact output, redaction, order, severity, rollback, and reconciliation contracts.
    requirement: TREF-07
    verification:
      - kind: unit
        ref: focused reinstall/shared/uninstall/update/update-row/reconcile suites
        status: pass
      - kind: unit
        ref: tests/shared/notification-dispatch.test.ts and tests/edge/notification-boundary.ts
        status: pass
      - kind: integration
        ref: npm run test:integration
        status: pass
    human_judgment: false
duration: 12min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 21: Reinstall, Uninstall, and Update Notification Caller Summary

**Seven lifecycle callers retain byte-exact behavior through genuine named notification owners, with six stale hub comments repointed and no legacy path left in scope.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-09T09:37:52Z
- **Completed:** 2026-09-09T09:49:51Z
- **Tasks:** 2
- **Production files modified:** 3

## Accomplishments

- Traced notification-related symbols in every plan-listed caller through CodeGraph and confirmed that Plan 06-14 had already moved all seven import graphs to genuine owners.
- Repointed uninstall and update source prose to `notification-grammar.ts`, `notification-summary.ts`, and `notification-dispatch.ts` without changing an import, type, API, statement, assertion, fixture, transaction, rollback path, or reconciliation output.
- Proved zero `shared/notify.ts` references across all seven callers and exactly eight production TypeScript `ctx.ui.notify` call sites, all in `notification-dispatch.ts`.
- Preserved exact output bytes, redaction, caller order, severity, reload behavior, rollback children, and reconciliation results through focused, direct-coverage, structural, and aggregate verification.

## Task Commits

1. **Task 1: Reinstall/shared/uninstall/update-row callers** - `c73c4325` (docs)
2. **Task 2: Update and reconcile-apply callers** - `04be21fa` (docs)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts` - Names `notification-grammar.ts` as the shared presentation owner.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts` - Names `notification-grammar.ts` as the shared presentation owner.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` - Attributes row grammar, summary folding, and final dispatch to their named owners.

The following scoped callers were already correct and stayed byte-for-byte unchanged:

- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts`

## Caller Ownership Evidence

| Caller | Notification surface | Exact owner | Result |
| --- | --- | --- | --- |
| `reinstall.ts` | stable scope ordering; message types; contextual rows and dispatch | `compare-name-scope.ts`; `notification-types.ts`; `notify-context.ts` to `notification-dispatch.ts` | Already direct; unchanged |
| `shared.ts` | structured and diagnostic dispatch; message types; contextual rows; redaction | `notification-dispatch.ts`; `notification-types.ts`; `notify-context.ts`; `redact-absolute-paths.ts` | Already direct; unchanged |
| `uninstall.messaging.ts` | row grammar; message types; command context | `notification-grammar.ts`; `notification-types.ts`; `notify-context.ts` | Imports unchanged; stale grammar comment fixed |
| `uninstall.ts` | message types; contextual rows and dispatch | `notification-types.ts`; `notify-context.ts` to `notification-dispatch.ts` | Already direct; unchanged |
| `update-row.ts` | message and reason types; update-row projection | `notification-types.ts`; `notify-reasons.ts`; `probe-classifiers.ts` | Already direct; unchanged |
| `update.messaging.ts` | row grammar; message types; command context | `notification-grammar.ts`; `notification-types.ts`; `notify-context.ts` | Imports unchanged; stale grammar comment fixed |
| `update.ts` | stable scope ordering; message types; contextual update summaries and dispatch | `compare-name-scope.ts`; `notification-types.ts`; `notify-context.ts` to `notification-summary.ts` and `notification-dispatch.ts` | Imports unchanged; four stale owner comments fixed |

`notify-context.ts` is the genuine command-context composition owner. It widens command-local rows into the typed cascade, delegates row rendering through the caller's total render map, and calls the concrete dispatch owner without re-exporting or forwarding the legacy hub API.

## Four-Part Repointing Gate

| Category | Evidence |
| --- | --- |
| source-scanning gate | CodeGraph attributes every scoped notification symbol to a genuine owner. The seven-file stale-path scan returns zero matches, and the production TypeScript census finds exactly eight direct Pi calls only in `shared/notification-dispatch.ts`. |
| documentation comment | The one uninstall and five update comments that named `shared/notify.ts` now name `notification-grammar.ts`, `notification-summary.ts`, or `notification-dispatch.ts`; no scoped comment or import retains the old path. |
| test ownership | Reinstall, shared, uninstall messaging, uninstall, update-row, update messaging, update, and reconcile apply suites pass; dispatch owner, edge boundary, and producer-wire architecture proofs pass. |
| completeness invariant | Every plan-listed caller has an explicit ownership row, all named owners remain direct, all seven callers are stale-path-free, and no compatibility facade or re-export was introduced. |

## Protected Uninstall Diff Evidence

- `uninstall.ts` is byte-for-byte unchanged from `plan_head_before` through Task 2.
- `uninstall.messaging.ts` changes exactly one source-comment path: `shared/notify.ts` to `shared/notification-grammar.ts`.
- The protected diff contains no import, API, assertion, fixture, transaction, cascade, rollback, or reconciliation change.

## Verification

- Task 1: `npm run typecheck` and reinstall, plugin shared, uninstall messaging, uninstall, and update-row owner suites passed 5/5; the five-file stale-path gate returned zero matches.
- Task 2: `npm run typecheck` and update messaging, update, and reconcile apply suites passed 3/3; the two-file stale-path gate returned zero matches.
- Plan gates: repeated typecheck, `npm run fallow`, canonical full-project ESLint, `npm run test:corresponding`, focused Prettier, and `git diff --check` passed.
- Direct-pair coverage: uninstall messaging, update messaging, and update each passed at 100% branches, functions, and lines.
- Sole-dispatch proof: notification dispatch, edge boundary, and producer-wire suites passed 3/3. The production census finds exactly 8 direct `ctx.ui.notify` expressions, all in `shared/notification-dispatch.ts`.
- Focused TypeScript style review: canonical lint with zero warnings, typecheck, focused Prettier, diff whitespace checks, and the changed-line quick-token scan passed with no findings. No executable TypeScript changed.
- Focused unit-test review: no test code changed; focused owner suites, direct coverage, strict notification boundary, correspondence, and integration gates pass with no skips or todos introduced.
- Aggregate `npm test`: 259/261 files passed. `tests/architecture/revalidation.test.ts` remains the declared sealed Phase 1 fixture debt for TREF-04 through TREF-09. `tests/orchestrators/marketplace/add.test.ts` reproduced the known sandbox Unix-socket denial and passed 63/63 unrestricted.
- Direct-coverage negative controls reproduced their known sandbox child-process restriction and passed unrestricted. Integration passed 32/32.
- Final scoped stale-path census: zero `shared/notify.ts` references in all seven callers.

## Decisions Made

- Kept all already-direct imports unchanged. The task required documentation ownership repair, not import churn.
- Kept `notifyWithContext` on its genuine `notify-context.ts` composition owner; it reaches `notification-dispatch.ts` directly and is not a compatibility seam.
- Applied the uninstall exception literally: only one stale path in source prose changed, while the cohesive uninstall flow and tests remained untouched.

## Deviations from Plan

None - the plan explicitly required four-part documentation repointing while preserving already-correct direct imports and behavior.

## Issues Encountered

- Aggregate testing reproduced only the two declared results: the sealed Phase 1 revalidation fixture debt and the sandbox Unix-socket denial. Marketplace/add passed 63/63 unrestricted, attributing its aggregate failure to the environment.
- The direct-coverage negative-control runner cannot spawn its child processes in the sandbox and passed unrestricted.
- The review skill's broad `npx eslint . --max-warnings=0` form enters unconfigured `.codex/gsd-core` CommonJS files and errors before linting project code. The repository's canonical `extensions tests scripts eslint.config.js` scope passed with `--max-warnings=0`.

## Known Stubs

None.

## Threat Flags

None - this plan changes source comments only and introduces no endpoint, authentication path, file access pattern, schema, or trust-boundary behavior.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The complete 06-21 caller group has direct named ownership, exact behavior evidence, and zero legacy notify-hub references.
- Remaining notification caller waves can use the same CodeGraph attribution and verify-without-churn pattern before Plan 06-27 deletes the migration marker.
- The sealed Phase 1 revalidation fixture debt remains intentionally deferred and unmodified.

## Self-Check: PASSED

The summary exists, both task commits are present in git history, all seven scoped callers remain stale-path-free, the uninstall diff is prose-only, and the sole-dispatch census still resolves exactly eight TypeScript call sites to `notification-dispatch.ts`.

---
_Phase: 06-assertion-and-module-refinement_
_Completed: 2026-09-09_
