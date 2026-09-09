---
phase: 06-assertion-and-module-refinement
plan: 45
subsystem: plugin-orchestration
tags: [typescript, reinstall, transaction, persistence, tdd, direct-coverage]
requires:
  - phase: 06-assertion-and-module-refinement
    provides: Direct reinstall target-selection and clone-probe owners from Plan 44
provides:
  - Atomic reinstall replacement owner with prepare, replace, rollback, finalize, hooks, and maintenance contracts
  - Reinstall record owner for installed, partial, disabled, missing, failed, and manual-recovery outcomes
  - Exact direct coverage for both new owners without a facade, re-export, or compatibility overload
affects: [plugin-reinstall, import-orchestration, edge-register, phase-06-hub-retirement]
plan_head_before: d1a5bb6df3f9419800865bb0c39410e9292ff0ff
actuals:
  tokens: 20546
  tasks: 2
  commits: 6
tech-stack:
  added: []
  patterns:
    - physical reinstall bridges return one opaque compensation token used by rollback and finalize
    - reinstall outcome composition owns both persisted success shapes and non-mutating skip/failure arms
key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts
    - tests/orchestrators/plugin/reinstall-replace.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts
    - tests/orchestrators/plugin/reinstall-record.test.ts
    - .planning/phases/06-assertion-and-module-refinement/06-45-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
key-decisions:
  - "Keep createReinstallPlugin/createNodeReinstallPlugin/createNodeReinstallPlugins and their register caller in reinstall.ts until the locked flow-owner Plan 46; the hub remains genuine rather than becoming a facade."
  - "Treat the replacement result as an opaque compensation token so rollback and finalize always use the same bridge-operation owner that performed replacement."
  - "Compose skipped and failed outcomes through recordReinstallOutcome as non-mutating arms while the reinstalled arm alone writes the exact persisted record."
patterns-established:
  - "Transaction leaf: prepare and replace produce a compensation token; state persistence decides whether the token rolls back or finalizes."
requirements-completed: [TREF-07, TREF-09]
coverage:
  - id: D1
    description: Reinstall replacement preserves prepare order, unconditional replacement, hook placement, reverse rollback, forward finalization, cleanup, and exact atomic tree outcomes.
    requirement: TREF-07
    verification:
      - kind: unit
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts
        status: pass
      - kind: integration
        ref: owner, legacy reinstall, edge register, transaction lifecycle, hooks lifecycle, and cross-operation suites
        status: pass
    human_judgment: false
  - id: D2
    description: Installed, partial, disabled, missing, failed, errno, typed-error, and manual-recovery arms retain exact outcomes and persisted record shapes.
    requirement: TREF-09
    verification:
      - kind: unit
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts
        status: pass
      - kind: integration
        ref: owner, legacy reinstall, and import execution suites
        status: pass
    human_judgment: false
duration: 30min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 45: Reinstall Replacement and Record Owners Summary

**Atomic physical replacement and exact reinstall record/outcome composition now live in two direct-tested owners while the flow hub preserves every state, path, rollback, notification, and caller contract.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-09-09T18:50:09Z
- **Completed:** 2026-09-09T19:20:00Z
- **Tasks:** 2
- **Task commits:** 6
- **Files changed by task commits:** 8
- **Realized diff scale:** 20,546 estimate tokens (82,186 diff characters / 4)

## Accomplishments

- Extracted bridge preparation, atomic replacement, hook commit, reverse rollback, forward finalization, completion-cache refresh, and plugin-data cleanup into `reinstall-replace.ts` behind `replaceReinstalledPlugin`.
- Moved `RemoveDataDirFn`, `ReinstallTransaction`, and the production transaction composition to the replacement owner. The result retains the exact operation owner that created it, preventing compensation from drifting across injected and production bridges.
- Extracted installed/partial record mutation plus skipped, failed, typed-error, errno, and manual-recovery outcome composition into `reinstall-record.ts` behind `recordReinstallOutcome`.
- Migrated the reinstall flow and import documentation directly to the new owners. No compatibility facade, re-export, duplicate implementation, or stale helper remains.
- Kept `reinstall.ts` and `reinstall.test.ts` as the genuine flow hub-ledger pair for the locked Plan 46 flow extraction and Plan 48 deletion.

## Task Commits

Each TDD phase was committed atomically:

1. **Task 1 RED: failing replacement-owner specification** - `d4e3dfc0` (test)
2. **Task 1 GREEN: atomic replacement owner and flow composition** - `1ad1fb97` (refactor)
3. **Task 2 RED: failing record-owner specification** - `2dafb710` (test)
4. **Task 2 GREEN: record/outcome owner and import migration** - `89839a43` (refactor)
5. **Direct-coverage expansion: complete replacement transaction proof** - `0ce199f4` (test)
6. **Quality-gate refactor: complexity, lint, and fallow compliance** - `5b37e6c2` (refactor)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts` - Direct owner of all physical replacement steps, compensation, finalization, hooks, and post-commit maintenance.
- `tests/orchestrators/plugin/reinstall-replace.test.ts` - Mirrored direct suite for success, preparation failure, replacement failure, hooks success/failure, all rollback/finalize arms, and maintenance success/failure.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts` - Direct owner of persisted reinstall records and every `ReinstallPluginOutcome` arm.
- `tests/orchestrators/plugin/reinstall-record.test.ts` - Mirrored direct suite for installed/partial shapes, skips, failures, typed reasons, and concurrent removal.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` - Composes both leaves while retaining only genuine target resolution, locked flow, lifecycle routing, bulk orchestration, and public factories.
- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` - Points its analogous outcome-composition documentation at the new record owner.

## Decisions Made

- Left the public create factories and register wiring in `reinstall.ts`. Plan 46 explicitly owns their move to `reinstall-flow.ts`; moving register early would either create a compatibility overload or make the current hub a facade.
- Kept replacement compensation opaque. Callers can pass it only back to rollback/finalize, while direct tests inject the same physical-operation set used to create it.
- Kept hook writes outside the rollback ledger, preserving the documented manual-recovery window after hook removal and before later failure.
- Kept `updatedAt` generation at the record owner and preserved version, installed time, optional resolved SHA, optional hook entries, compatibility, resource ordering, and optional degradation fields exactly.

## TDD Gate Compliance

- Task 1 RED failed specifically because `reinstall-replace.ts` did not exist. `.planning/tdd-evidence/06-45-01.json` passed `check tdd-red-evidence` before production edits.
- Task 1 GREEN preserves the full 114-case legacy reinstall suite and the 20-case register suite. The direct owner gate reports **47/47 branches, 16/16 functions, and 486/486 lines**.
- Task 2 RED failed specifically because `reinstall-record.ts` did not exist. `.planning/tdd-evidence/06-45-02.json` passed `check tdd-red-evidence` before production edits.
- Task 2 GREEN passes five direct record cases, all 114 legacy reinstall cases, and all 48 import cases. The direct owner gate reports **46/46 branches, 11/11 functions, and 192/192 lines**.
- No commit was amended; RED, GREEN, direct-coverage expansion, and quality-gate fixes remain independently auditable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical verification seam] Added direct physical-operation injection**

- **Found during:** Task 1 direct-coverage verification
- **Issue:** The first extraction preserved runtime behavior but the mirrored test could reach the private bridge schedule only through the legacy flow, leaving the required direct-pair gate below 100%.
- **Fix:** Added one internal physical-operation seam to the replacement input and retained it on the opaque compensation result. Production still uses the real bridge set; tests now prove exact ordering, rollback, finalize, hooks, and cleanup directly.
- **Files modified:** `reinstall-replace.ts`, `reinstall-replace.test.ts`
- **Verification:** Direct coverage is 47/47 branches, 16/16 functions, and 486/486 lines.
- **Committed in:** `0ce199f4`, `5b37e6c2`

**2. [Rule 1 - Quality regression] Restored the flow hub's cognitive-complexity ceiling**

- **Found during:** Overall fallow verification
- **Issue:** Inline maintenance-input composition raised `reinstallPluginWithTransaction` one point over the enforced cognitive-complexity threshold.
- **Fix:** Extracted the eight-line `maintenanceInput` mapper without changing inputs or behavior.
- **Files modified:** `reinstall.ts`
- **Verification:** `npm run fallow` passes with zero enforced issues.
- **Committed in:** `5b37e6c2`

---

**Total deviations:** 2 auto-fixed issues.
**Impact on plan:** Both changes enforce the requested direct proof and existing repository quality constraints; neither changes public behavior or adds compatibility surface.

## Verification

- Replacement owner + legacy reinstall + register: **144/144 cases pass**.
- Record owner + legacy reinstall + import: **167/167 cases pass**.
- Replacement direct coverage: **47/47 branches, 16/16 functions, 486/486 lines**.
- Record direct coverage: **46/46 branches, 11/11 functions, 192/192 lines**.
- Transaction lifecycle cascade, cross-operation convergence, and hooks lifecycle architecture suites: pass.
- Hub-ledger owner suite: pass; the fixture still names `reinstall.ts` and `reinstall.test.ts` exactly.
- Stale-owner scan finds `RemoveDataDirFn` and `ReinstallTransaction` only in `reinstall-replace.ts`; old record/replacement helpers are absent from the hub.
- `npm run typecheck`: pass.
- `npm run test:corresponding`: pass.
- `npm run fallow`: pass with no enforced issue.
- `npm run lint`: pass with zero warnings.
- `npm run test:corresponding:negative`: pass.
- `npm run test:coverage:direct:negative`: pass outside the sandbox after the sandbox reproduced its known child-process stderr suppression.
- Targeted Prettier across every changed Phase 06-45 TypeScript file: pass.
- Repository `npm run format:check`: reports only the preserved untracked `.mcp.json`, the known pre-existing formatting debt.

## Issues Encountered

- Repository-wide formatting remains red only for the pre-existing untracked `.mcp.json`. It was preserved byte-for-byte and excluded from every commit.
- Existing unrelated Phase 1 review artifacts and local configuration changes were preserved unchanged and excluded from every task commit.
- Best-effort deviation registration in `.planning/WINDOWS.md` was rejected because its pre-existing rendered table disagrees with JSON rows 9 and 30. The ledger was left untouched rather than rewriting unrelated entries.

## Known Stubs

None. Empty collections in the changed files are initialized transaction accumulators, exact empty-resource outcomes, or fully asserted fixtures; the existing “placeholder” wording documents a real synthetic failure row.

## Threat Flags

None - the plan moves existing state mutation, physical file replacement, hook access, and failure composition into named owners without adding an endpoint, authentication path, filesystem trust boundary, schema change, or notification dispatch.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Replacement and record behavior now have complete direct owner pairs. Plan 46 can extract the remaining flow/factory surface without rediscovering physical compensation or persisted outcome contracts.
- The genuine reinstall hub/test pair remains intact for the Plan 48 pre-edit ledger and atomic retirement.

---

_Phase: 06-assertion-and-module-refinement_
_Completed: 2026-09-09_

## Self-Check: PASSED

Both direct owner pairs and this summary exist; all six task/TDD commits resolve from the persisted plan base; the measured commit count is six; both direct coverage gates report 100% branches, functions, and lines; focused caller and integration suites pass; and stale-owner scans leave only the intended direct owners and genuine flow hub routes.
