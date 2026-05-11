---
phase: 05-plugin-orchestrators
plan: 04
subsystem: orchestrators
tags: [phase-05, helpers, shared, security, plugin, conflicts]

# Dependency graph
requires:
  - phase: 02-state-and-locations
    provides: ExtensionState shape (D-09 nested marketplaces.<mp>.plugins.<plugin>.resources); Scope union (D-10 cross-scope independence)
  - phase: 04-marketplace-orchestrators
    provides: orchestrators/marketplace/shared.ts pure-helper pattern (D-05 / Pattern Assignment)
  - phase: 05-plugin-orchestrators (05-01)
    provides: CrossPluginConflictError class (PI-6 / RN-3 pre-write cross-bridge conflict)
provides:
  - assertNoCrossPluginConflicts(scope, generatedNames, state): void pure helper
  - CrossPluginGeneratedNames interface (skills + commands + agents; MCP excluded by construction per PRD §6.5)
  - Deterministic conflict ordering contract (skills alpha, commands alpha, agents alpha) -- testable byte-for-byte
  - 5-case unit-test fixture (tests/orchestrators/plugin/shared.test.ts) covering no-conflict / single collision / multi-kind ordering / MCP exclusion / cross-scope independence
affects:
  - 05-06 install.ts (PI-6 callsite -- consumes assertNoCrossPluginConflicts)
  - 05-09 update.ts (PUP-2 callsite -- same guard ahead of phase-1 commit)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-function helper module in orchestrators/plugin/shared.ts mirroring the Phase 4 D-05 pattern from orchestrators/marketplace/shared.ts"
    - "Exclusion-by-construction for MCP names: the helper's input interface (CrossPluginGeneratedNames) has no mcpServers field; collision-at-the-bridge-layer (MC-4) is enforced at compile time"
    - "Cross-scope safety by construction: the helper signature consumes one ExtensionState (one scope's state.json) -- callers cannot accidentally enforce cross-scope conflicts (Phase 2 D-10)"
    - "Fully-typed test fixture builders (makeState / makeMarketplaceRecord / makePluginRecord) instead of `as unknown as ExtensionState` casts -- schema drift surfaces at compile time in the test file too"

key-files:
  created:
    - extensions/claude-marketplace/orchestrators/plugin/shared.ts
    - tests/orchestrators/plugin/shared.test.ts
    - .planning/phases/05-plugin-orchestrators/05-04-SUMMARY.md
  modified: []

key-decisions:
  - "Used `_scope` parameter name (TypeScript-ESLint default `argsIgnorePattern: ^_`) instead of inline `void _scope` no-op because the codebase has no existing convention for unused-but-required-by-contract parameters and the underscore prefix is the canonical Node/TS idiom"
  - "Test fixture uses fully-typed makeMarketplaceRecord / makePluginRecord builders (no `as unknown as ExtensionState` casts) -- the plan suggested the cast but the codebase pattern (cascade.test.ts / autoupdate.test.ts) is fully-typed builders; matched the codebase pattern to surface schema drift at compile time"
  - "Captured thrown errors via try/catch instead of `assert.throws(fn, Ctor)` because the latter returns void in node:assert (the only signatures that yield the error are the validator-function form and the regex form). Try/catch produces the cleanest path to assert against the structured `err.conflicts` payload"

patterns-established:
  - "orchestrators/plugin/shared.ts seed: first helper in a new shared-helper module that will accrue same-feature peers in later plans (e.g. PUP-2 syncCloneOnce memo); the file header explicitly documents the D-06 elevation rule for when promotion to orchestrators/types.ts is warranted"
  - "Deterministic conflict-message ordering for cross-bridge guards: skills first (alpha), then commands (alpha), then agents (alpha) -- the test asserts byte-for-byte so downstream UI diff tooling can rely on the contract"

requirements-completed: [PI-6, RN-3]

# Metrics
duration: 5min
completed: 2026-05-11
---

# Phase 5 Plan 4: orchestrators/plugin/shared.ts cross-plugin conflict guard Summary

**PI-6 / RN-3 cross-bridge name conflict pre-flight guard as a pure helper exported from `orchestrators/plugin/shared.ts`, with a 5-case unit-test fixture asserting deterministic conflict ordering byte-for-byte.**

## Performance

- **Duration:** 5 min (4m 28s wall clock)
- **Started:** 2026-05-11T02:08:28Z
- **Completed:** 2026-05-11T02:12:56Z
- **Tasks:** 2
- **Files created:** 2 (1 source + 1 test)
- **Files modified:** 0

## Accomplishments

- **Pure helper `assertNoCrossPluginConflicts(scope, generatedNames, state): void`** lives in `extensions/claude-marketplace/orchestrators/plugin/shared.ts`. The function walks the caller-supplied state snapshot (`state.marketplaces[*].plugins[*].resources` for the SAME SCOPE) and throws `CrossPluginConflictError` listing every conflict in fixed order: skills first (alpha), then commands -- mapped to the state field `prompts` -- (alpha), then agents (alpha). MCP server names are excluded by construction per PRD §6.5.
- **`CrossPluginGeneratedNames` interface** exported alongside the helper for Wave 2 `install.ts` (Plan 05-06) and Wave 3 `update.ts` (Plan 05-09) callsites. The shape has no `mcpServers` field -- MCP cross-slot collision is the MC-4 bridge concern, not the orchestrator's.
- **5-case unit-test fixture at `tests/orchestrators/plugin/shared.test.ts`** validates: (A) no conflicts -> void; (B) single skill collision -> single-entry `CrossPluginConflictError`; (C) skill + command + agent collisions emitted in deterministic order, asserted byte-for-byte; (D) MCP server collision NOT detected (PRD §6.5 exclusion); (E) cross-scope independence -- empty state representing this scope + the same-named skill living in the other scope (NOT passed) does not throw (Phase 2 D-10 by-construction).
- **`npm run check` is green** end-to-end (typecheck + ESLint + Prettier + 565 tests pass, including the 5 new cases).

## Signature Contract

```typescript
export interface CrossPluginGeneratedNames {
  readonly skills: readonly string[];
  readonly commands: readonly string[];
  readonly agents: readonly string[];
}

export function assertNoCrossPluginConflicts(
  scope: Scope,
  generatedNames: CrossPluginGeneratedNames,
  state: ExtensionState,
): void; // throws CrossPluginConflictError on any collision
```

Deterministic conflict-array order: `[skills (alpha), commands (alpha), agents (alpha)]`. The conflict-message format is `'<kind> "<name>" already owned by plugin "<plugin>"'` -- test case C asserts byte-for-byte.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create orchestrators/plugin/shared.ts with assertNoCrossPluginConflicts** -- `a987e1d` (feat)
2. **Task 2: Add 5-case test file tests/orchestrators/plugin/shared.test.ts** -- `de32ae6` (test)

## Files Created/Modified

- `extensions/claude-marketplace/orchestrators/plugin/shared.ts` -- new file. Exports `CrossPluginGeneratedNames` interface and `assertNoCrossPluginConflicts(scope, generatedNames, state): void`. 118 lines including header banner + JSDoc.
- `tests/orchestrators/plugin/shared.test.ts` -- new file. Local `makeState` / `makeMarketplaceRecord` / `makePluginRecord` builders + 5 named test cases. 204 lines.

## Decisions Made

- **Unused-parameter idiom: `_scope` (underscore prefix).** The TypeScript-ESLint default for `@typescript-eslint/no-unused-vars` is `argsIgnorePattern: "^_"`. The codebase has no inline `void _scope` precedent, so the underscore prefix is the canonical idiom. The JSDoc explains why the parameter is retained in the signature (diagnostic-message enrichment + symmetry with other orchestrator helpers).
- **Fully-typed test fixture (no `as unknown as ExtensionState`).** The plan suggested the cast, but the codebase precedent (`tests/orchestrators/marketplace/cascade.test.ts` `makePluginRecord` + `tests/orchestrators/marketplace/autoupdate.test.ts` `makeMarketplaceRecord`) is fully-typed builders. Matched the codebase pattern so schema drift surfaces at compile time in the test fixture too.
- **`try/catch` instead of `assert.throws(fn, Ctor)`.** `assert.throws` with a constructor returns void in `node:assert`; only the validator-function form or the regex form yield the thrown error. Capturing via try/catch gives the cleanest path to assert against the structured `err.conflicts` payload (case B / case C).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cases B and C initially failed -- `assert.throws(fn, ErrorClass)` returns void**

- **Found during:** Task 2 (test file)
- **Issue:** The plan's sketch used `const err = assert.throws(() => ..., CrossPluginConflictError) as CrossPluginConflictError`. The 2-arg form of `assert.throws` with a constructor returns void in `node:assert`; `err` was `undefined`, causing `TypeError: Cannot read properties of undefined (reading 'conflicts')` in two test cases.
- **Fix:** Replaced with try/catch capture (`let captured: unknown; try { ... } catch (e) { captured = e } assert.ok(captured instanceof CrossPluginConflictError, ...)`). Matches the codebase precedent in `tests/bridges/agents/convert.test.ts` for validator-function uses of `assert.throws`.
- **Files modified:** tests/orchestrators/plugin/shared.test.ts (cases B + C)
- **Verification:** Both cases now pass; deterministic-order assertion (case C) holds byte-for-byte.
- **Committed in:** de32ae6 (Task 2 commit)

**2. [Rule 3 - Blocking] ESLint `@stylistic/padding-line-between-statements` auto-fix**

- **Found during:** Task 1 (and again Task 2 during `npm run check`)
- **Issue:** The plan's source sketch had no blank lines between block-like `for` loops; the project's flat ESLint config enforces `padding-line-between-statements` with `{ blankLine: "always", prev: "block-like", next: "*" }` (eslint.config.js line ~56).
- **Fix:** Ran `npx eslint --fix` which inserted the required blank lines between the consecutive `for` loops. Followed by `npx prettier --write` for the test file. Cosmetic; no logic change.
- **Files modified:** extensions/claude-marketplace/orchestrators/plugin/shared.ts; tests/orchestrators/plugin/shared.test.ts
- **Verification:** `npm run check` green (typecheck + ESLint + Prettier + 565 tests).
- **Committed in:** a987e1d (Task 1) and de32ae6 (Task 2)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 test-code bug, 1 Rule 3 lint-config blocking)
**Impact on plan:** Both deviations are local to the test file shape and the lint-fixer; the helper signature, behavior, and conflict-ordering contract from the plan are preserved verbatim.

## Issues Encountered

- **gitlint title cap is 72 chars (not 75).** The first commit attempt used a 75-char subject (`feat(05-04): add orchestrators/plugin/shared.ts cross-plugin conflict guard`) and the pre-commit gitlint hook failed with `T1 Title exceeds max length (75>72)`. Re-wrote to `feat(05-04): add plugin/shared.ts cross-plugin conflict guard` (62 chars). Subsequent commits respected the cap.

## Threat Surface Scan

No new security-relevant surface introduced. The helper is pure (no I/O), reads only the caller-supplied state snapshot, and throws a known sentinel error (`CrossPluginConflictError` from Plan 05-01) without composing user-controlled strings into a privileged path.

The plan's `<threat_model>` mitigations are honored:

- **T-5-03 (EoP / Tampering -- two plugins racing on the same name)**: the guard reads in-memory state at the callsite; cross-process safety is handled by Plan 05-06's `withStateGuard` closure -- nothing in this plan changes that contract.
- **T-5-13 (EoP -- cross-scope ambient authority)**: accepted; the helper signature consumes a single ExtensionState and the JSDoc explicitly documents that cross-scope independence is by construction.

## Self-Check

- [x] D-05 satisfied: pure-function helper in `orchestrators/plugin/shared.ts`
- [x] D-05 RN-4 boundary respected: this plan touched nothing in `bridges/agents/stage.ts`
- [x] D-05 PRD §6.5 exclusion: no `mcpServers` field on the input shape (verified by case D)
- [x] Deterministic ordering: skills first (alpha), then commands (alpha), then agents (alpha) -- case C asserts byte-for-byte
- [x] Phase 2 D-10 cross-scope independence enforced BY CONSTRUCTION (case E)
- [x] D-11 import boundaries: only imports from `shared/`, type-only from `persistence/` and `shared/types.ts`; nothing from `bridges/`, nothing from `orchestrators/marketplace/*`
- [x] `npm run check` green (typecheck + ESLint + Prettier + 565 tests; 5 new cases all pass)

## Next Phase Readiness

- The helper signature and exported `CrossPluginGeneratedNames` interface match the Wave 2 (`install.ts`, Plan 05-06) and Wave 3 (`update.ts`, Plan 05-09) callsite expectations. Wave 2/3 planners can import `assertNoCrossPluginConflicts` directly.
- No follow-up TODOs deferred. No stubs introduced.

---
*Phase: 05-plugin-orchestrators*
*Completed: 2026-05-11*
