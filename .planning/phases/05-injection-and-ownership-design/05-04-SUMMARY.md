---
phase: 05-injection-and-ownership-design
plan: 04
subsystem: testing
tags: [dependency-injection, reconcile, state-race, composition, tdd]

requires:
  - phase: 05-injection-and-ownership-design
    provides: required consumer-owned capability and real-adapter patterns from Plan 05-01
provides:
  - required reconcile-owned selected-state reader
  - explicit production binding through the unchanged public applyReconcile export
  - complete race and ordinary two-scope composition evidence with real children
affects: [05-injection-and-ownership-design, 06-global-patch-removal]

actuals:
  tokens: 5502
  tasks: 2
  commits: 3
plan_head_before: 4197ed15cc854988b1b665216aea80ff4e6ad7af

tech-stack:
  added: []
  patterns:
    - required consumer-owned capability factory
    - explicit real adapter bound into an unchanged public composition root

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - tests/orchestrators/reconcile/apply.test.ts

key-decisions:
  - "Limit the reconcile reader to the single selected state load and compose the public export from an explicit Node-backed adapter."
  - "Keep every reconcile child, lock, save, route, projection, and notification operation real; the race controls only snapshot selection."
  - "Retain applyReconcile and bootstrapClaudePlugin as exactly the two behavioral-composition exceptions, with builtin synchronization removal deferred to Phase 6."

patterns-established:
  - "Selected-snapshot race: a case-owned reader returns a real snapshot, changes backing state, and then lets the complete production apply flow converge."
  - "Composition evidence: public outcomes, exact state/configuration/tree bytes, unrelated files, silence, and notifications remain primary assertions."

requirements-completed: [TREF-04]

coverage:
  - id: D1
    description: "The required one-operation reader controls the selected state snapshot while the raced scope converges and the sibling scope completes through real reconcile children."
    requirement: TREF-04
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#RECON-02 marketplace another process removed first"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The public production export preserves full two-scope results, state, configuration, trees, unrelated bytes, silence, notification order, and real-child composition."
    requirement: TREF-04
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#applies multiple actions deterministically across both scopes"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/bootstrap.test.ts"
        status: pass
      - kind: integration
        ref: "npm run test:integration"
        status: pass
    human_judgment: false

duration: 21min
completed: 2026-09-07
status: complete
---

# Phase 5 Plan 4: Reconcile State Reader and Composition Summary

**Reconcile apply now selects state through one required production reader while preserving real children, locks, persistence, routing, exact two-scope effects, and notifications.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-09-07T20:54:51Z
- **Completed:** 2026-09-07T21:15:22Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Classified ORA-F15 as a reconcile-owned capability containing only the selected state load.
- Reproduced the authorized post-selection race with real case-owned state and the unchanged locked apply flow, including exact final project/user state, both trees, unrelated bytes, canonical rows, sibling progress, silence, and notification order.
- Strengthened the ordinary public-export case to prove complete two-scope composition while leaving every real install, uninstall, enable, disable, marketplace, routing, persistence, projection, and notification path intact.
- Preserved `applyReconcile` and `bootstrapClaudePlugin` as exactly the two approved behavioral-composition exceptions, with bootstrap and Phase 6 builtin synchronization work unchanged.

## Task Commits

1. **Task 1 RED: selected-state reader race proof** - `f5e33296` (test)
2. **Task 1 GREEN: required reconcile state reader** - `c06dffea` (feat)
3. **Task 2: complete public composition evidence** - `c80e3d98` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` - Adds `ReconcileStateReader`, threads it only into the locked read pass, and binds the unchanged public export to the real loader through `createApplyReconcile`.
- `tests/orchestrators/reconcile/apply.test.ts` - Migrates only the selected race to the factory and adds complete race and ordinary public-composition observations while retaining builtin synchronization cases.

## Decisions Made

- `ReconcileStateReader` exposes exactly one readonly `loadState` operation matching the existing loader. It does not own locks, saves, child operations, routing, projection, or notification delivery.
- `createApplyReconcile(reader)` is required and production-used. `applyReconcile` is its explicit real-loader binding; there is no optional argument, default dependency, broad bundle, test-only export, or dead seam.
- The selected race keeps real project and user scopes. The case-owned reader returns the selected project snapshot, performs the competing project write, and allows the real user scope and all downstream work to continue.
- The existing `createRequire` and `syncBuiltinESMExports` machinery remains for Phase 6. Bootstrap remains unchanged and is the second composition-preservation control.
- TREF-04 remains pending in the project requirement ledger because later Phase 5 plans classify the remaining ownership roots.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Exact `npm run check` passed typecheck, repository lint, and all Fallow gates, then stopped only at `format:check` because the pre-existing untracked `.mcp.json` is not formatted. The file was preserved unchanged. Plan-owned formatting and every subsequent check stage passed independently.
- The direct-coverage negative controls require child process creation, and two unrelated unit files require subprocess or Unix-socket access. Their sandbox runs failed at those environment boundaries; all passed unchanged with the required process permissions.

## Verification

- Both task `<verify>` command chains passed exactly, including the unchanged bootstrap composition control.
- Direct owner coverage passed at 119/119 branches, 23/23 functions, and 950/950 lines for `apply.ts`.
- Repository typecheck, lint, Fallow, corresponding-test gates, corresponding negative controls, direct-coverage negative controls, focused ESLint, and plan-owned Prettier checks passed.
- The aggregate unit run passed 246 of 248 files in the sandbox; the two sandbox-restricted files then passed independently with 193/193 tests.
- `npm run test:integration` passed all 13 integration files.
- The base-to-HEAD diff contains only the declared apply source and owner test. Bootstrap source/test have no diff.
- Static audits found one required reader operation, one explicit real production binding, no child dependency bundle, no optional/default/test-only/dead seam, no new suppression, and retained `createRequire` plus both `syncBuiltinESMExports` calls.
- `scripts/revalidation.mjs:1124` remains byte-exact: `// fallow-ignore-next-line complexity -- temporary; remove after Phase 01-71 refactor`.

## TDD Gate Compliance

- Task 1 RED failed because `createApplyReconcile` was absent; `tdd-red-evidence` returned `RED_EVIDENCE_OK` before production work.
- Task 1 GREEN passed the apply owner suite, 100% direct coverage, typecheck, focused lint, and the tracer feedback gate.
- Task 2 was a preservation audit after the Task 1 production migration. It found no production behavior gap, so the strengthened whole-state, timestamp, configuration, tree, unrelated-file, clone, and notification evidence was committed test-only and passed the complete apply/bootstrap verification chain.

## Known Stubs

None. The scanned empty arrays are exercised result or interaction accumulators; none flows to UI rendering or represents placeholder data.

## User Setup Required

None - no external service configuration is required.

## Next Phase Readiness

ORA-F15 now has one terminal required-reader classification with a real public binding and complete effect evidence. Later Phase 5 plans can continue ownership classification and runtime propagation; Phase 6 can remove retained builtin patching without widening the reader or replacing real reconcile children.

## Self-Check: PASSED

- Both plan-owned modified files and this summary exist.
- All three task commits exist in repository history.
- Summary metadata records the required factory, complete effect evidence, measured actuals, decisions, verification results, and TREF-04 classification.

---

_Phase: 05-injection-and-ownership-design_
_Completed: 2026-09-07_
