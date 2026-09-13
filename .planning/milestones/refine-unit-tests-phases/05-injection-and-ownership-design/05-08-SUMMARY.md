---
phase: 05-injection-and-ownership-design
plan: 08
subsystem: completion-cache
tags: [cache-ownership, autocomplete, filesystem-invalidation, tdd]

requires:
  - phase: 05-injection-and-ownership-design
    provides: factory-owned plugin-index cache and bounded transition identity from Plan 05-07
provides:
  - census-backed removal of the unconsumed marketplace-name memory reader and map
  - authoritative project-before-user marketplace-name completion unchanged
  - live schema-2 scoped names-file invalidation with exact filesystem behavior
affects: [05-injection-and-ownership-design, 06-global-patch-removal]

actuals:
  tokens: 6667
  tasks: 2
  commits: 5
plan_head_before: 29c652854669e61c5f7f4429e75b78e37ef2757c

tech-stack:
  added: []
  patterns:
    - production-consumer census before trace-preserving dead-surface removal
    - file-only invalidation retained independently of removed in-memory readers

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/completion-cache.ts
    - extensions/pi-claude-marketplace/persistence/locations.ts
    - tests/shared/completion-cache.test.ts
    - tests/orchestrators/marketplace/add.test.ts

key-decisions:
  - "Remove the marketplace-name memory reader, map, and private file-read helper because the fresh production census found zero genuine consumers."
  - "Retain schema version 2, scoped path derivation, public invalidation signatures, and exact file deletion semantics as live cross-process contracts."
  - "Keep authoritative scoped completion and Plan 05-07's plugin-index cache and transition behavior unchanged."

patterns-established:
  - "Trace-preserving removal: production CodeGraph and text evidence controls whether a public-looking surface is deleted or migrated."
  - "Invalidation ownership: mutation paths delete only the derived schema-2 artifact and preserve unrelated bytes."

requirements-completed: [TREF-05, TREF-06]

coverage:
  - id: D1
    description: "The zero-consumer marketplace-name memory reader and its test-shaped ownership surface are removed while authoritative scoped completion remains exact."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/shared/completion-cache.test.ts; tests/edge/completions/data.test.ts"
        status: pass
      - kind: other
        ref: "100% direct branch, function, and line coverage for completion-cache.ts and data.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Schema-2 names-file invalidation deletes only the scoped artifact after a real marketplace add and preserves complete public behavior and unrelated bytes."
    requirement: TREF-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts#D-03-INV; tests/persistence/locations.test.ts"
        status: pass
      - kind: other
        ref: "100% direct branch, function, and line coverage for locations.ts"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-07
status: complete
---

# Phase 5 Plan 8: Marketplace-Name Cache Disposition Summary

**A fresh zero-consumer census removed the unused marketplace-name memory lifetime while preserving authoritative scoped completion and exact schema-2 file invalidation.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-07T23:03:42Z
- **Completed:** 2026-09-07T23:28:11Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Removed `getMarketplaceNames`, `memMarketplaceNames`, and the private names-file reader only after CodeGraph and production text searches found no genuine consumer.
- Kept `getMarketplaceNamesAcrossScopes` on direct authoritative state rebuilds with project-before-user precedence, stable uniqueness and ordering, and original error identity.
- Preserved marketplace-names schema version 2, the existing scoped cache path, file-only invalidation, `ENOENT` idempotence, and non-`ENOENT` propagation.
- Strengthened the real marketplace-add owner to prove exact outcome, notification, persisted state, configuration, full scope tree, names-file deletion, and unrelated-file byte preservation.

## Production Consumer Census

- **CodeGraph:** `getMarketplaceNames` had no production caller outside its definition. `memMarketplaceNames` and `readMarketplaceNamesFile` were reachable only from that defining module. `getMarketplaceNamesAcrossScopes` called the authoritative `rebuildNamesForScope` path directly.
- **Production text census:** the three identifiers had zero executable consumers under `extensions/pi-claude-marketplace`. The only remaining text outside the defining module was a legacy comment in `orchestrators/edge-deps.ts`, outside this plan's owned files.
- **Test census:** only artificial reader ownership cases in `tests/shared/completion-cache.test.ts` and memory priming in `tests/orchestrators/marketplace/add.test.ts` referenced the removed surface.
- **Disposition:** the locked zero-consumer branch applied. The reader, map, helper, and artificial cases were removed together; the live schema-2 file contract remained.

## Task Commits

1. **Task 1 RED: Prove marketplace-name reader removal** - `66c17841` (test)
2. **Task 1 GREEN: Remove the unused marketplace-name memory reader** - `c67565e9` (feat)
3. **Task 2 characterization: Strengthen real names-file invalidation evidence** - `09f87fb2` (test)
4. **Task 2 fix: Narrow persisted timestamp evidence** - `a20b5404` (fix)
5. **Task 2 refactor: Describe the live schema-2 names artifact** - `4545843f` (refactor)

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/completion-cache.ts` - Removes the dead names-memory lifetime while retaining schema 2 and file-only invalidation through the existing public cache surface.
- `extensions/pi-claude-marketplace/persistence/locations.ts` - Describes the scoped names path as a live cross-process invalidation artifact rather than an input to the removed reader.
- `tests/shared/completion-cache.test.ts` - Replaces artificial memory-reader cases with public-surface absence and exact file-invalidation evidence while retaining plugin-cache reset coverage.
- `tests/orchestrators/marketplace/add.test.ts` - Proves real post-commit names-file deletion together with the complete inherited marketplace-add contract.

The other three frontmatter-scoped files—`edge/completions/data.ts`, `tests/edge/completions/data.test.ts`, and `tests/persistence/locations.test.ts`—were verified and remained byte-identical because their authoritative completion and exact path contracts already matched the plan.

## Decisions Made

- The names-memory branch was deleted, not migrated, because both required censuses found zero genuine production consumers.
- The public `CompletionCache.invalidateMarketplaceNames(path, scope)` and top-level invalidator signatures remain stable even though the implementation now needs only the path.
- Plugin-index schema 6, TTL, poison rows, memory ownership, registered read propagation, and the bounded transition identity remain unchanged for Plan 05-12.
- No marketplace-add production wiring was changed; the existing durable operation already invalidated the schema-2 file at the correct point.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated the marketplace-add test owner during Task 1**
- **Found during:** Task 1 GREEN typecheck
- **Issue:** Removing the reader export left Task 2's artificial memory-priming imports unable to compile.
- **Fix:** Removed the dead imports and priming immediately, seeded the real schema-2 file, and retained the invalidation assertion. Task 2 later strengthened the complete public evidence.
- **Files modified:** `tests/orchestrators/marketplace/add.test.ts`
- **Verification:** Task 1 typecheck and the complete Task 2 gate passed.
- **Committed in:** `c67565e9`

**2. [Rule 3 - Blocking] Narrowed the optional persisted timestamp in the strengthened proof**
- **Found during:** Task 2 typecheck
- **Issue:** The complete state assertion left `lastUpdatedAt` typed as optional before timestamp validation.
- **Fix:** Validated `lastUpdatedAt ?? ""` against the exact UTC ISO shape without changing runtime code or weakening the assertion.
- **Files modified:** `tests/orchestrators/marketplace/add.test.ts`
- **Verification:** Typecheck, focused tests, full unit tests, and integration tests passed.
- **Committed in:** `a20b5404`

---

**Total deviations:** 2 auto-fixed Rule 3 blocking issues.
**Impact on plan:** Both fixes were necessary to keep the test owner compiling and exact. No optional/default cache, reset seam, suppression, production marketplace change, or Phase 6 work was added.

## Issues Encountered

- Exact `npm run check` passed typecheck, full lint, and Fallow, then stopped at `format:check` because the pre-existing untracked `.mcp.json` is not formatted. It remained byte-identical at SHA-256 `09237a8c19625daeb677211c6ca9b38e01aa12eede0f4b5f2c26ed6ec7b449e6`. All four plan-modified files pass Prettier, and every later repository gate was run independently.
- The sandbox denied the marketplace-add Unix-socket case and nested child processes used by the direct-coverage negative control. Both gates passed unchanged outside the sandbox with the required OS permissions.

## Validation Results

- Both exact task commands passed: 172 focused tests, typecheck, focused ESLint, and Fallow.
- Direct coverage reached 100% branches, functions, and lines for `completion-cache.ts` (57/57, 22/22, 469/469), `data.ts` (109/109, 36/36, 631/631), and `locations.ts` (16/16, 7/7, 281/281).
- Repository typecheck, full ESLint, Fallow, corresponding-test gate, corresponding-test negative controls, and direct-coverage negative controls passed.
- Full unit suite passed: 5,419 tests, 0 failures, 0 skipped, 0 todo.
- Integration suite passed: 32 tests, 0 failures, 0 skipped, 0 todo.
- Post-edit text census found no executable production reader/map/helper consumers. No tracked file was deleted, and all unrelated dirty and untracked files were preserved.

## TDD Gate Compliance

- Task 1 RED failed only on the named public-module absence proof; `tdd-red-evidence` returned `RED_EVIDENCE_OK` with `target_test_failed` before production code changed.
- Task 1 GREEN passed its exact suite and direct-coverage gates. The committed tracer slice then passed the automated end-to-end feedback gate before expansion.
- Task 2 preserved already-live behavior rather than adding runtime behavior. Its strengthened characterization assertions passed against production; no artificial failure was introduced. The test-only commit preceded the documentation refactor, and the complete Task 2 gate passed afterward.

## Known Stubs

None. Empty arrays and maps in the verified completion code are live accumulators or exact empty results, not placeholders or unwired data.

## User Setup Required

None - no external service configuration is required.

## Next Phase Readiness

Plan 05-12 can remove the bounded plugin-index transition without carrying a second marketplace-name memory lifetime. Later invalidator and reset plans retain their assigned scope; no Phase 6 global-patch work was pulled forward.

## Self-Check: PASSED

- All four modified artifacts and all three verified-but-unchanged frontmatter artifacts exist.
- All five task commits exist and match the measured plan ledger from `29c652854669e61c5f7f4429e75b78e37ef2757c`.
- The production census is recorded, schema 2 and scoped file invalidation remain live, and no replacement reset/default/test-only/dead seam was introduced.

---

_Phase: 05-injection-and-ownership-design_
_Completed: 2026-09-07_
