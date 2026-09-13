---
phase: 05-injection-and-ownership-design
plan: 07
subsystem: completion-cache
tags: [dependency-injection, cache-ownership, autocomplete, tdd]

requires:
  - phase: 05-injection-and-ownership-design
    provides: required consumer-owned ports and explicit production composition from Plan 05-01
provides:
  - factory-owned plugin-index memory with isolated CompletionCache instances
  - one bounded production transition cache used by current exports and registered completions
  - required cache propagation through registration, provider routing, and every plugin-index candidate builder
affects: [05-injection-and-ownership-design, 06-global-patch-removal]

actuals:
  tokens: 13693
  tasks: 2
  commits: 6
plan_head_before: 74819ee8650d765bdd9dba925afb87772915cb23

tech-stack:
  added: []
  patterns:
    - closure-owned cache lifetime with a readonly behavior contract
    - required dependency propagation from production registration to data reads

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/completion-cache.ts
    - tests/shared/completion-cache.test.ts
    - extensions/pi-claude-marketplace/edge/completions/data.ts
    - extensions/pi-claude-marketplace/edge/completions/provider.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - tests/edge/completions/data.test.ts
    - tests/edge/completions/provider.test.ts
    - tests/edge/register.test.ts
    - tests/architecture/flag-catalog-drift.test.ts

key-decisions:
  - "Keep plugin-index memory private to each CompletionCache closure and expose only read and targeted invalidation operations."
  - "Use one eager transitionCompletionCache for current exports and registration until Plan 05-12 moves ownership to root composition."
  - "Keep resetCompletionCache outside the new contract for the Plan 05-30 caller migration and Plan 05-31 deletion."

patterns-established:
  - "Cache owner: createCompletionCache creates an independent plugin-index memory lifetime without exposing its map or a whole-cache reset."
  - "Required read dependency: registration captures one cache and passes it through provider and data boundaries without defaults or per-keystroke construction."

requirements-completed: [TREF-05, TREF-06]

coverage:
  - id: D1
    description: "Fresh CompletionCache instances isolate plugin-index memory while preserving schema-6 disk validation, TTL, poison, error identity, and targeted invalidation behavior."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/shared/completion-cache.test.ts"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/completion-cache.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Registered plugin completions use one required production cache through provider routing and every plugin-index data read without changing candidate behavior."
    requirement: TREF-06
    verification:
      - kind: unit
        ref: "tests/edge/completions/data.test.ts; tests/edge/completions/provider.test.ts; tests/edge/register.test.ts"
        status: pass
      - kind: other
        ref: "100% direct coverage for data.ts, provider.ts, and register.ts"
        status: pass
    human_judgment: false

duration: 33min
completed: 2026-09-07
status: complete
---

# Phase 5 Plan 7: Completion Cache Ownership Summary

**Plugin-index memory now belongs to isolated CompletionCache instances, while one required production transition cache serves every registered plugin completion path without changing disk, candidate, or failure contracts.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-09-07T22:26:27Z
- **Completed:** 2026-09-07T22:59:50Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Added a readonly `CompletionCache` contract and `createCompletionCache()` factory whose private plugin-index map is isolated per instance.
- Preserved schema version 6, TTL boundaries, malformed/stale rebuilds, exact disk bytes, poison rows, thrown identity, targeted invalidation, and idempotent `ENOENT` deletion.
- Captured one eager `transitionCompletionCache` at command registration and required that cache through provider routing and every install, uninstall, update, fetch, reinstall, info, enable, and disable plugin-index read.
- Preserved exact candidate labels, values, ordering, filtering, scope behavior, duplicate collapse, resolver timing, registration order, and null-versus-empty results.

## Task Commits

1. **Task 1 RED: CompletionCache ownership proofs** - `28f1f139` (test)
2. **Task 1 GREEN: Factory-owned plugin-index cache** - `dfaaeae5` (feat)
3. **Task 2 RED: Required cache propagation proofs** - `414f3670` (test)
4. **Task 2 GREEN: Required registered completion cache** - `943c0af5` (feat)
5. **REFACTOR: Production slice formatting** - `e1611384` (style)
6. **REFACTOR: Cache isolation proof formatting** - `816674a9` (style)

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/completion-cache.ts` - Defines the readonly cache contract, private factory ownership, bounded transition, and legacy delegates.
- `tests/shared/completion-cache.test.ts` - Proves same-instance reuse and fresh-instance isolation alongside the complete inherited cache contract.
- `extensions/pi-claude-marketplace/edge/completions/data.ts` - Requires the supplied cache for every scoped plugin-index read.
- `extensions/pi-claude-marketplace/edge/completions/provider.ts` - Requires and forwards the cache on plugin-reference branches.
- `extensions/pi-claude-marketplace/edge/register.ts` - Captures the single production transition cache once per command registration.
- `tests/edge/completions/data.test.ts` - Pins required-cache data reads and all inherited candidate behavior.
- `tests/edge/completions/provider.test.ts` - Pins required-cache provider routing and unchanged public results.
- `tests/edge/register.test.ts` - Proves the registered callback reads through the transition cache.
- `tests/architecture/flag-catalog-drift.test.ts` - Supplies the required production-shaped cache to the architecture compile caller.

## Decisions Made

- The public contract exposes semantic operations only. Its private map and the legacy whole-cache reset are not part of `CompletionCache`.
- Existing top-level cache functions delegate to the same eager transition object used by registration, so current readers and invalidators retain one production identity.
- The completion callback still resolves `process.cwd()` on each invocation; only the cache identity is captured during registration.
- The transition is explicitly temporary: Plan 05-12 moves cache ownership to root composition, Plan 05-30 migrates reset callers, and Plan 05-31 removes the legacy reset.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated the architecture compile caller for the required cache signature**
- **Found during:** Task 2 typecheck
- **Issue:** `tests/architecture/flag-catalog-drift.test.ts` still called `getArgumentCompletions` with two arguments after the cache became required.
- **Fix:** Passed the same production-shaped `transitionCompletionCache` used by registration. The later reset-caller migration remains unchanged.
- **Files modified:** `tests/architecture/flag-catalog-drift.test.ts`
- **Verification:** Focused architecture test, typecheck, focused ESLint, and the complete unit suite passed.
- **Committed in:** `943c0af5`

**2. [Rule 3 - Blocking] Removed two unreachable fallback branches exposed by exact direct coverage**
- **Found during:** Task 2 direct-coverage verification
- **Issue:** Existing defensive fallbacks in token splitting and flag-description shaping were unreachable under their declared invariants, leaving one uncovered branch in both `data.ts` and `provider.ts`.
- **Fix:** Expressed the non-empty token and required catalog-description invariants in the type shape without adding suppressions or changing runtime candidates.
- **Files modified:** `extensions/pi-claude-marketplace/edge/completions/data.ts`, `extensions/pi-claude-marketplace/edge/completions/provider.ts`
- **Verification:** Both modules reached 100% branch, function, and line coverage; typecheck, ESLint, and all candidate suites passed.
- **Committed in:** `943c0af5`

---

**Total deviations:** 2 auto-fixed (2 Rule 3 blocking issues)
**Impact on plan:** Both changes were required to compile and satisfy the plan's exact verification gates. No optional cache, compatibility default, reset seam, or broader ownership change was added.

## Issues Encountered

- Exact `npm run check` stops at `format:check` because the pre-existing untracked `.mcp.json` is not formatted. The file is outside this plan and remained byte-identical at SHA-256 `09237a8c19625daeb677211c6ca9b38e01aa12eede0f4b5f2c26ed6ec7b449e6`. All plan-owned files pass Prettier, and every later repository gate was run independently.
- The sandbox denied nested Node subprocesses in the direct-coverage negative control and two unit-suite files. The negative control and complete unit suite passed unchanged with subprocess permission.

## Validation Results

- Both exact task verification commands passed, including focused suites, typecheck, focused ESLint, and Fallow.
- Direct coverage is 100% branches, functions, and lines for `completion-cache.ts`, `data.ts`, `provider.ts`, and `register.ts`.
- Repository typecheck, full lint, Fallow, corresponding-test checks, and both negative-control gates passed.
- Full unit suite passed: 5,428 tests, 0 failures.
- Integration suite passed: 13 tests, 0 failures.
- The exact Fallow exception comment in `scripts/revalidation.mjs` remains present once, and no suppression was added.
- No tracked file was deleted; all unrelated dirty and untracked files were preserved.

## TDD Gate Compliance

- Task 1 RED failed on the named same-instance reuse and fresh-instance isolation proofs; `tdd-red-evidence` returned `RED_EVIDENCE_OK` before production work.
- Task 1 GREEN passed the full cache suite and 100% direct coverage; the committed tracer slice then passed its automated feedback gate before Task 2 began.
- Task 2 RED failed on the named data-layer required-cache proof and independently failed the provider routing proof; `tdd-red-evidence` returned `RED_EVIDENCE_OK` before production wiring.
- Task 2 GREEN and formatting refactors passed required-cache routing, registration identity, candidate preservation, architecture drift, typecheck, lint, coverage, and Fallow gates.

## Known Stubs

None. Empty arrays and maps in the changed files are live candidate accumulators, exact empty cache results, or test call ledgers, not placeholders or unwired data.

## User Setup Required

None - no external service configuration is required.

## Next Phase Readiness

Plan 05-12 can replace the bounded transition with root-owned cache composition without changing provider or data behavior. Plans 05-30 and 05-31 retain their intended reset-caller migration and reset deletion work.

## Self-Check: PASSED

- All nine modified source and test artifacts exist.
- All six task and refactor commits exist in repository history and match the measured pre-summary plan ledger count.
- One eager production transition is used by current exports and registered reads; cache parameters are required and no raw map, new reset, default cache, or per-keystroke cache construction is exposed.

---

_Phase: 05-injection-and-ownership-design_
_Completed: 2026-09-07_
