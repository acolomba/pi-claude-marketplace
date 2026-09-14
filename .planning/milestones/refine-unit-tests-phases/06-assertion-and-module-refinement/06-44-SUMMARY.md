---
phase: 06-assertion-and-module-refinement
plan: 44
subsystem: plugin-orchestration
tags: [typescript, reinstall, ownership-migration, tdd, direct-coverage]
requires:
  - phase: 06-assertion-and-module-refinement
    provides: Retired update hub and reinstall hub-ledger fixture from Plan 43
provides:
  - Direct reinstall target-selection owner with exact scope, order, cardinality, and concurrent-removal behavior
  - Direct reinstall clone-probe owner with warm-mirror, recorded-sha, subdirectory, auth, and failure classification
  - Direct handler and flow imports without facade, re-export, or compatibility overload
affects: [plugin-reinstall, plugin-resolver, reinstall-handler, phase-06-hub-retirement]
plan_head_before: cbb3c4548a3db2fac5154ff92f765f0111da25cb
actuals:
  tokens: 16257
  tasks: 2
  commits: 5
tech-stack:
  added: []
  patterns:
    - structural invocation cardinality is returned beside target expansion by its direct owner
    - recorded-sha reinstall clone probing owns its materialization seam and preserves thrown values unchanged
key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-targets.ts
    - tests/orchestrators/plugin/reinstall-targets.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts
    - tests/orchestrators/plugin/reinstall-clone-probe.test.ts
    - .planning/phases/06-assertion-and-module-refinement/06-44-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
    - tests/orchestrators/plugin/reinstall.test.ts
key-decisions:
  - "Keep ReinstallPluginsOptions and the public flow factory in reinstall.ts for the later flow-owner plan, while moving ReinstallPluginsTarget and selection-only options to reinstall-targets.ts now."
  - "Preserve bare-scope Promise.all reads and the confirmation read so project-first precedence and concurrent marketplace removal retain their exact legacy behavior."
  - "Make probeReinstallClone own the optional production clone-cache seam and accept the recorded sha directly; reinstall never re-resolves a remote ref."
patterns-established:
  - "Direct leaf extraction: owner types, algorithm, seam, and exhaustive mirrored cases move together; callers import the leaf directly."
requirements-completed: [TREF-07, TREF-09]
coverage:
  - id: D1
    description: Reinstall target selection preserves explicit and bare forms, empty/single/many cardinality, both-scope precedence, equal-name ordering, misses, and concurrent removal.
    requirement: TREF-07
    verification:
      - kind: unit
        ref: node --test --test-isolation=none tests/orchestrators/plugin/reinstall-targets.test.ts tests/orchestrators/plugin/reinstall.test.ts
        status: pass
      - kind: unit
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-targets.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Reinstall clone probing preserves warm cache, cold recorded-sha fallback, missing subdirectory, provider auth, cleanup ownership, and exact failure attribution.
    requirement: TREF-09
    verification:
      - kind: unit
        ref: node --test --test-isolation=none tests/orchestrators/plugin/reinstall-clone-probe.test.ts tests/orchestrators/plugin/reinstall.test.ts tests/edge/handlers/plugin/reinstall.test.ts
        status: pass
      - kind: unit
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts
        status: pass
      - kind: integration
        ref: affected cross-op, edge-register, transaction-cascade, and hub-ledger suites
        status: pass
    human_judgment: false
duration: 28min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 44: Reinstall Target and Clone-Probe Owners Summary

**Reinstall target expansion and recorded-SHA clone probing now live in two named direct-tested owners while the existing flow, handler, state, path, order, notification, and failure contracts remain exact.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-09-09T18:18:49Z
- **Completed:** 2026-09-09T18:46:34Z
- **Tasks:** 2
- **Task commits:** 5
- **Files changed by task commits:** 10
- **Realized diff scale:** 16,257 estimate tokens (65,030 diff characters / 4)

## Accomplishments

- Extracted `ReinstallPluginsTarget`, selection inputs/results, deterministic expansion, scope resolution, and invocation-form cardinality into `reinstall-targets.ts`. Direct tests cover empty, one, and many targets; explicit and bare forms; both scopes; equal names; project-first ties; every miss shape; and removal between resolution and enumeration.
- Extracted `ReinstallCloneCacheSeam` and recorded-SHA clone probing into `reinstall-clone-probe.ts`. The owner distinguishes warm unpinned mirrors, cold or per-SHA fallback, materialized/missing subdirectories, provider and non-provider auth, and thrown clone failures without re-attribution.
- Migrated the reinstall flow and edge handler directly to the new owners. No facade, re-export, compatibility overload, or duplicate implementation remains.
- Preserved the generic hub-ledger fixture at the genuine `reinstall.ts` / `reinstall.test.ts` pair for the later atomic retirement plan.

## Task Commits

Each TDD phase was committed atomically:

1. **Task 1 RED: failing direct target-owner specification** - `6053e99f` (test)
2. **Task 1 GREEN: target selection owner and caller migration** - `bbdc5e47` (feat)
3. **Task 2 RED: failing direct clone-probe specification** - `7b2f1315` (test)
4. **Task 2 GREEN: clone-probe owner, seam, and caller migration** - `ae601b94` (feat)
5. **TDD refactor: enforced import and brace style** - `05fc7445` (style)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-targets.ts` - Direct owner of target types, structural cardinality, state-only scope resolution, deterministic ordering, and confirmation reads.
- `tests/orchestrators/plugin/reinstall-targets.test.ts` - Mirrored 18-case target contract, including a real-filesystem concurrent-removal proof.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts` - Direct owner of the reinstall clone seam and warm-mirror/recorded-SHA probe.
- `tests/orchestrators/plugin/reinstall-clone-probe.test.ts` - Mirrored eight-case clone contract with real temporary filesystem roots.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` - Delegates selection and Git materialization directly to the named owners while retaining the later flow-retirement surface.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts` - Imports `ReinstallPluginsTarget` directly from its owner.
- `extensions/pi-claude-marketplace/domain/plugin-resolver.ts` - Attributes reinstall Git materialization to the named clone-probe owner.
- `tests/orchestrators/plugin/reinstall.test.ts` - Imports the clone seam directly from its new owner while retaining legacy end-to-end flow coverage.

## Decisions Made

- Left `ReinstallPluginsOptions`, dependency/factory types, and flow entrypoints in `reinstall.ts`; Plan 48 owns the later flow migration and hub retirement. Moving them early would violate the locked plan sequence.
- Kept the bare target resolver's parallel project/user reads and post-resolution confirmation read. These are observable under legacy migration races and are required for exact concurrent-removal attribution.
- Kept the clone seam optional only at the clone owner, matching the existing install-probe pattern. Production uses the real materializer; tests can prove classification without network access.
- Returned clone materializer failures unchanged. Cleanup stays owned by `materializePluginClone`, and the reinstall flow remains the sole public error-projection boundary.

## TDD Gate Compliance

- Task 1 RED failed specifically because `reinstall-targets.ts` did not exist. `.planning/tdd-evidence/06-44-01.json` passed `check tdd-red-evidence` before implementation.
- Task 1 GREEN passed 18 direct cases, 114 legacy reinstall cases, 28 handler cases, and exact direct coverage: **59/59 branches, 14/14 functions, 216/216 lines**.
- Task 2 RED failed specifically because `reinstall-clone-probe.ts` did not exist. `.planning/tdd-evidence/06-44-02.json` passed `check tdd-red-evidence` before implementation.
- Task 2 GREEN passed eight direct cases plus the legacy and handler suites, with exact direct coverage: **13/13 branches, 2/2 functions, 92/92 lines**.
- The final style-only refactor was followed by both direct coverage gates and the combined 168-case owner/legacy/handler suite.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Behavior regression] Restored concurrent-removal detection during target extraction**

- **Found during:** Task 1 GREEN legacy verification
- **Issue:** Reusing the scope-resolution record for enumeration removed the legacy confirmation read, causing a marketplace removed during migration to render an empty success instead of `{marketplace not added}`.
- **Fix:** Retained a fresh confirmation read in the target owner, preserved the original parallel bare-scope reads, and moved the real-filesystem race proof into the mirrored owner suite.
- **Files modified:** `reinstall-targets.ts`, `reinstall-targets.test.ts`
- **Verification:** Direct coverage is 100%; all 114 legacy reinstall cases pass.
- **Committed in:** `bbdc5e47`

**2. [Rule 1 - Lint defect] Corrected direct-owner import ordering and concurrency-test guards**

- **Found during:** Overall verification
- **Issue:** Repository lint required sibling imports in lexical owner order, a blank line after the enumeration catch, and braced child-process guards.
- **Fix:** Applied only the enforced import, spacing, and brace changes, then reran direct coverage and all focused tests.
- **Files modified:** `edge/handlers/plugin/reinstall.ts`, `orchestrators/plugin/reinstall.ts`, `reinstall-targets.test.ts`
- **Verification:** Full repository ESLint passes with zero warnings; targeted Prettier passes.
- **Committed in:** `05fc7445`

---

**Total deviations:** 2 auto-fixed Rule 1 issues.
**Impact on plan:** Both fixes preserve existing observable behavior and project style; no new feature or compatibility surface was added.

## Verification

- Combined owner, legacy, and handler suite: **168/168 pass**, zero skips or todos.
- Target direct coverage: **59/59 branches, 14/14 functions, 216/216 lines**.
- Clone-probe direct coverage: **13/13 branches, 2/2 functions, 92/92 lines**.
- Affected callers: cross-operation convergence, edge registration, and transaction lifecycle cascade: **24/24 pass**.
- Hub-ledger owner suite: **6/6 pass**; the fixture still names `reinstall.ts` and `reinstall.test.ts` exactly.
- Stale owner scans for `makeReinstallCloneProbe`, `enumerateReinstallTargets`, `resolveMarketplaceReinstallScope`, and hub imports of the moved types: empty.
- `npm run typecheck`: pass.
- `npm run test:corresponding`: pass.
- `npm run fallow`: pass with no enforced issue.
- `npm run lint`: pass with zero warnings.
- `npm run test:corresponding:negative`: pass.
- `npm run test:coverage:direct:negative`: pass outside the sandbox after the sandbox reproduced its known child-process stderr suppression.
- Targeted Prettier across every changed Phase 06-44 TypeScript file: pass.
- Repository `npm run format:check`: reports only the preserved untracked `.mcp.json`, the known pre-existing formatting debt.

## Issues Encountered

- Repository-wide formatting remains red only for the pre-existing untracked `.mcp.json`. It was preserved byte-for-byte and excluded from every commit.
- Existing unrelated Phase 1 review artifacts and local configuration changes were preserved unchanged and excluded from every task commit.

## Known Stubs

None. Empty collections in the changed files are initialized accumulators, legitimate no-target outcomes, or fully asserted fixtures; the existing “placeholder” wording documents a real synthetic failure row.

## Threat Flags

None - the plan moved existing state reads, path containment, credential threading, and clone materialization into named owners without adding a network endpoint, authentication path, filesystem trust boundary, schema change, or notification path.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Reinstall target and clone-probe behavior now have complete direct owner pairs, so later plans can extract state, swap, cascade, and flow layers without rediscovering these contracts.
- The genuine reinstall hub/test pair remains in place for the hub-ledger checkpoint and later atomic retirement.

---

_Phase: 06-assertion-and-module-refinement_
_Completed: 2026-09-09_

## Self-Check: PASSED

Both direct owner pairs and this summary exist; all five task/TDD commits resolve from the persisted plan base; the measured commit count is five; both direct coverage gates report 100% branches, functions, and lines; and the stale-owner scans are empty.
