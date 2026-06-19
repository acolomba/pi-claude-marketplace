---
phase: 58-matcher-parser-tool-name-mapping-supportability-gate
plan: 01
subsystem: hooks
tags: [hooks, tool-names, closed-set, typebox, typescript-exhaustiveness, architecture-test]

# Dependency graph
requires:
  - phase: 57-schema-component-type-payload-extension-tolerance
    provides: HOOKS_CONFIG_SCHEMA + parseHooksConfig discriminated parser (consumer of TOOL-01 lands in 58-03)
provides:
  - PI_TO_CLAUDE_TOOL_NAMES static record (7 entries, Pi -> Claude direction)
  - CLAUDE_TO_PI_TOOL_NAMES static record (7 entries, Claude -> Pi direction)
  - PiToolName literal-union type (bash | read | edit | write | grep | find | ls)
  - ClaudeToolName literal-union type (Bash | Read | Edit | Write | Grep | Glob | LS)
  - TOOL-01 architecture-test gate (3 invariants: inverse, completeness, find <-> Glob lock)
  - ToolCallEvent re-export through platform/pi-api.ts (peer-dep boundary)
affects:
  - 58-03 (matcher parser will read CLAUDE_TO_PI_TOOL_NAMES at parse time)
  - 58-04 (HOOK-04 byte-equality coverage adopts PiToolName)
  - Phase 60 future payload translators (will read PI_TO_CLAUDE_TOOL_NAMES at dispatch time)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated-union arm filtering for literal-only derivation (LiteralToolNameArm helper to drop the open-ended CustomToolCallEvent arm whose toolName: string widens the parent union)"
    - "Hand-written reverse maps (computed reverse via Object.fromEntries would erase keys to Record<string, X> and lose the locked ClaudeToolName literal-union shape)"
    - "as const satisfies Record<K, V> as the LOAD-BEARING compile-time exhaustiveness gate (mirrors Phase 57 P04 @ts-expect-error pattern)"

key-files:
  created:
    - extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts
    - tests/architecture/hooks-tool-name-map.test.ts
  modified:
    - extensions/pi-claude-marketplace/platform/pi-api.ts

key-decisions:
  - "Derive PiToolName via discriminated-union arm filtering (LiteralToolNameArm<T extends { toolName: infer N }> filtering string extends N) rather than the research's proposed Exclude<ToolCallEvent['toolName'], string>; the naive Exclude collapses to never because the union literal-or-string widens to string at the property-access step. Recorded as deviation R1-1."
  - "Re-export ToolCallEvent through platform/pi-api.ts rather than direct peer-dep import; required by the project-wide no-restricted-imports rule that funnels all @earendil-works/pi-coding-agent imports through the single boundary. Recorded as deviation R3-1."

patterns-established:
  - "Pattern 1: Discriminated-union arm filtering -- when a peer-dep union includes both literal arms and an open-ended string-arm escape hatch, filter the open arm by `T extends { field: infer N } ? string extends N ? never : N : never` rather than `Exclude<T['field'], string>` (which collapses to never)."
  - "Pattern 2: Hand-written inverse maps for type-locked records -- when both directions of a bidirectional map need locked literal-union key shapes, write each direction independently; runtime arch test enforces inverse invariance."

requirements-completed: [TOOL-01]

# Metrics
duration: 12min
completed: 2026-06-14
---

# Phase 58 Plan 01: Matcher Parser Tool-Name Mapping & Supportability Gate Summary

**TOOL-01 bidirectional Claude <-> Pi tool-name map at the locked
`domain/components/hook-tool-names.ts` location, with a compile-time
`satisfies Record<PiToolName, string>` exhaustiveness gate against the
peer-dep `ToolCallEvent` discriminated union and a three-invariant
architecture-test gate (inverse, peer-dep completeness with count-lock,
D-58-05 find <-> Glob lock).**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-14T13:43:07Z
- **Completed:** 2026-06-14T13:54:59Z
- **Tasks:** 2
- **Files modified:** 3 (2 created + 1 modified)

## Accomplishments

- New `PI_TO_CLAUDE_TOOL_NAMES` and `CLAUDE_TO_PI_TOOL_NAMES` static records
  (seven entries each) at the D-58-04-locked path
  `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts`.
- `PiToolName` literal-union type derived from the peer-dep
  `ToolCallEvent` discriminated union by filtering out the
  `CustomToolCallEvent` open-ended arm; `ClaudeToolName` derived as
  `keyof typeof CLAUDE_TO_PI_TOOL_NAMES`.
- `as const satisfies Record<PiToolName, string>` LOAD-BEARING
  compile-time exhaustiveness gate -- adding an eighth Pi tool literal
  to the peer-dep without updating the local record red-fails
  `npm run typecheck`.
- Three-invariant runtime architecture-test gate
  (`tests/architecture/hooks-tool-name-map.test.ts`): inverse
  round-trip, peer-dep completeness with seven-entry count-lock, and
  the D-58-05 `find <-> Glob` LOW-confidence mapping locked in both
  directions.
- `npm run check` GREEN: 1900 unit tests + 10 integration tests pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create hook-tool-names.ts with bidirectional map and PiToolName/ClaudeToolName exports** - `85b0091` (feat)
2. **Task 2: Add hooks-tool-name-map.test.ts architecture-test gate** - `3f390b4` (test)

_TDD note: Task 1 uses `npm run typecheck` as the compile-time RED/GREEN
gate; Task 2's runtime architecture test is the supplementary gate that
also fires on peer-dep additions whose load-bearing compile check is
the type-level `satisfies` clause._

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts` (NEW)
  -- TOOL-01 bidirectional map, `PiToolName` / `ClaudeToolName` literal
  unions, D-58-04 / D-58-05 traceability comments. 100 lines.
- `tests/architecture/hooks-tool-name-map.test.ts` (NEW) -- three
  TOOL-01 invariant pins (inverse, completeness with seven-entry
  count-lock, find <-> Glob lock). 120 lines.
- `extensions/pi-claude-marketplace/platform/pi-api.ts` (MODIFIED) --
  added `ToolCallEvent` to the peer-dep type re-exports so the new
  domain module imports the type through the sanctioned boundary
  (one-line `type` insertion in the existing `export type { ... }
  from "@earendil-works/pi-coding-agent"` block).

## Decisions Made

- **PiToolName derivation amendment (vs. RESEARCH.md proposal):** The
  research document (§ "TypeScript-level exhaustiveness") proposed
  `Exclude<ToolCallEvent["toolName"], string>` to drop the
  `CustomToolCallEvent` open-ended arm. In practice, this evaluates to
  `never`: at the `ToolCallEvent["toolName"]` step TypeScript widens
  the union `"bash" | "read" | ... | string` to plain `string`, so
  there is nothing literal left for `Exclude` to keep. Adopted the
  discriminated-union arm-filtering helper instead
  (`type LiteralToolNameArm<T> = T extends { toolName: infer N } ?
  string extends N ? never : N : never`). The
  `PI_TO_CLAUDE_TOOL_NAMES satisfies Record<PiToolName, string>`
  exhaustiveness contract is preserved; the seven literal arms enter
  the union, the `CustomToolCallEvent` arm is filtered by
  `string extends N`. Confirmed empirically: with the helper in place,
  removing any of the seven entries red-fails `npm run typecheck`
  (verified during initial RED state before the seven entries landed).
- **ToolCallEvent re-export through platform/pi-api.ts:** The project
  enforces a `no-restricted-imports` rule (eslint.config.js:275-289)
  that funnels all `@earendil-works/pi-coding-agent` imports through
  `extensions/pi-claude-marketplace/platform/pi-api.ts`. Adding
  `ToolCallEvent` to the existing `export type { ... }` block in
  pi-api.ts is the minimal compliant insertion; the new domain module
  imports `ToolCallEvent` from `../../platform/pi-api.ts` instead of
  the peer-dep package name.
- **Hand-written reverse map (vs. computed):** Per RESEARCH.md
  § "Don't Hand-Roll" -- a computed reverse via
  `Object.fromEntries(Object.entries(...).map(([k, v]) => [v, k]))`
  would erase the value-typed keys to `Record<string, PiToolName>`,
  losing the locked `ClaudeToolName` literal-union shape that the
  architecture test's type-level assertions depend on. The reverse
  map is hand-written and the runtime arch test enforces inverse
  invariance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] PiToolName derivation: `Exclude<..., string>` evaluates to `never`**

- **Found during:** Task 1 (initial Write of `hook-tool-names.ts`)
- **Issue:** The research-recommended derivation
  `type PiToolName = Exclude<ToolCallEvent["toolName"], string>`
  evaluates to `never` because the parent union
  `"bash" | "read" | ... | string` collapses to `string` at the
  property-access step. The first `npm run typecheck` failed with
  seven `TS2322: Type '"bash"' is not assignable to type 'never'` errors
  on every entry of `CLAUDE_TO_PI_TOOL_NAMES`.
- **Fix:** Switched to a discriminated-union arm-filtering helper
  (`type LiteralToolNameArm<T> = T extends { toolName: infer N } ?
  string extends N ? never : N : never;`) that walks the
  `ToolCallEvent` arms individually, preserving each
  `*ToolCallEvent.toolName` literal arm and filtering out the
  `CustomToolCallEvent` arm whose `toolName: string` triggers the
  `string extends N` guard. `PiToolName` is then defined as
  `LiteralToolNameArm<ToolCallEvent>` and resolves to the intended
  seven-literal union.
- **Files modified:** `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts`
- **Verification:** `npm run typecheck` GREEN; the architecture test's
  inverse and completeness assertions both pass; manual spot-check by
  temporarily removing the `ls` entry from `PI_TO_CLAUDE_TOOL_NAMES`
  confirmed `npm run typecheck` red-fails with a missing-property
  satisfies error (gate fires as designed).
- **Committed in:** `85b0091` (Task 1 commit)

**2. [Rule 3 - Blocking] `no-restricted-imports` lint blocks direct peer-dep import**

- **Found during:** Task 1 (eslint run on the new file)
- **Issue:** The project enforces a `no-restricted-imports` rule that
  forbids every file except `extensions/pi-claude-marketplace/platform/pi-api.ts`
  from importing `@earendil-works/pi-coding-agent` directly. The
  initial `import type { ToolCallEvent } from "@earendil-works/pi-coding-agent"`
  in the new file failed lint.
- **Fix:** Added `ToolCallEvent` to the existing
  `export type { ... } from "@earendil-works/pi-coding-agent"` block
  in `platform/pi-api.ts` (one-line insertion, alphabetically sorted).
  Updated `hook-tool-names.ts` to import from `../../platform/pi-api.ts`
  instead.
- **Files modified:** `extensions/pi-claude-marketplace/platform/pi-api.ts`,
  `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts`
- **Verification:** `npx eslint extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts`
  reports zero errors; `npm run typecheck` GREEN.
- **Committed in:** `85b0091` (Task 1 commit -- both files staged together)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - Blocking; both
required to make Task 1's compile-time gate work)
**Impact on plan:** Neither deviation alters the plan's contract; both
preserve the documented `satisfies Record<PiToolName, string>` gate
and the seven-literal `PiToolName` shape. No scope creep.

## Issues Encountered

- None beyond the two auto-fixed Rule-3 blockers documented above.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- TOOL-01 surface is ready for Plan 58-02 (HOOK-04 byte-equality
  coverage) and Plan 58-03 (matcher parser, which will read
  `CLAUDE_TO_PI_TOOL_NAMES` at parse time to translate Claude-form
  matcher tokens into Pi-form literals).
- Future Phase 60 payload translators will read
  `PI_TO_CLAUDE_TOOL_NAMES` at dispatch time to translate Pi
  `event.toolName` values back into Claude `tool_name` fields.
- No blockers; `npm run check` GREEN.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts` FOUND
- `tests/architecture/hooks-tool-name-map.test.ts` FOUND
- Commit `85b0091` FOUND
- Commit `3f390b4` FOUND

---
*Phase: 58-matcher-parser-tool-name-mapping-supportability-gate*
*Completed: 2026-06-14*
