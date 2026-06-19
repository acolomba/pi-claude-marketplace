---
phase: 63-lifecycle-cascade-user-facing-surface-docs
plan: 01
subsystem: ui
tags: [typescript, discriminated-union, notify-grammar, hook-events, info-surface]

# Dependency graph
requires:
  - phase: 58-component-type-extension-tolerance
    provides: BUCKET_A_EVENTS / TOOL_EVENTS closed-set tuples in domain/components/hook-events.ts
provides:
  - ClaudeHookEvent literal-union export in shared/notify.ts (8 events)
  - HookSummaryEntry discriminated union (tool events carry matcher, non-tool events forbid it)
  - HookSummary interface wrapping readonly HookSummaryEntry[]
  - PluginInfoComponentsResolved.components.hooks? optional field (alphabetical between commands/mcp)
  - COMPONENT_KINDS 5-tuple ["agents","commands","hooks","mcp","skills"]
  - appendHooksBlock helper + kind === "hooks" arm in appendResolvedComponentLines emitting D-63-04 multi-line block
  - satisfies-pin in domain/components/hook-events.ts linking BUCKET_A_EVENTS/TOOL_EVENTS to the shared literal unions
affects: [63-02, 63-03, 63-04, 63-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "shared-side literal-union with domain-side satisfies-pin (architectural workaround for shared/<-domain/ import fence)"
    - "structural discriminator predicate ('matcher' in entry) for 2-arm tagged union -- no runtime guard required"
    - "single-helper extraction (appendHooksBlock) to keep appendResolvedComponentLines under sonarjs/cognitive-complexity threshold"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/domain/components/hook-events.ts
    - tests/shared/notify-v2.test.ts

key-decisions:
  - "[Phase 63] ClaudeHookEvent literal-union declared in shared/notify.ts (not re-exported from domain/) -- import-direction fence (import-x/no-restricted-paths) forbids shared/ importing from domain/. Single source of truth maintained via `as const satisfies readonly ClaudeHookEvent[]` pin in domain/components/hook-events.ts."

patterns-established:
  - "Cross-fence type-tuple coupling: declare the literal-union on the consumer side of the import fence; pin the runtime tuple on the producer side via `as const satisfies readonly Union[]`. Drift in either direction trips the typecheck at the satisfies site."

requirements-completed: [SURF-02]

# Metrics
duration: 32min
completed: 2026-06-16
---

# Phase 63 Plan 01: Hook Summary Type Seam Summary

**HookSummaryEntry discriminated union + ClaudeHookEvent literal-union + multi-line `hooks:` renderer arm in shared/notify.ts, foundation for plans 63-02..05.**

## Performance

- **Duration:** 32 min
- **Started:** 2026-06-16T10:29:47Z
- **Completed:** 2026-06-16T11:01:00Z (approx.)
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Type seam landed: `ClaudeHookEvent` (8-event literal-union), `HookSummaryEntry` (2-arm tagged union: tool events carry `matcher: string`, non-tool events forbid it), `HookSummary` interface. Declared in `shared/notify.ts` (consumer side of the import fence).
- `PluginInfoComponentsResolved.components.hooks?: readonly HookSummaryEntry[]` field added alphabetically between `commands` and `mcp`.
- `COMPONENT_KINDS` widened from 4-tuple to 5-tuple in alphabetical order `["agents", "commands", "hooks", "mcp", "skills"]`; tuple-length contract comment updated from "4 entries / 5th key" to "5 entries / 6th key".
- `appendHooksBlock` helper + `kind === "hooks"` arm in `appendResolvedComponentLines` emitting the D-63-04 multi-line block (4-space `hooks:` header + 6-space per-entry indent; `<event>(<matcher>)` for tool events, bare `<event>` for non-tool events).
- Single-source-of-truth pin: `BUCKET_A_EVENTS` and `TOOL_EVENTS` in `domain/components/hook-events.ts` carry `as const satisfies readonly ClaudeHookEvent[]` (resp. `readonly BucketAEvent[]`) so drift breaks the typecheck at the producer site.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ClaudeHookEvent / HookSummaryEntry / HookSummary + components.hooks? + 5-tuple COMPONENT_KINDS** — `70e103d` (feat)
2. **Task 2: Extend tests with discriminator + multi-line hooks: block fixtures** — `77ed3d9` (test)

## Exact line locations (post-Task-2 file state)

- `shared/notify.ts:177-185` — `export type ClaudeHookEvent` 8-member literal-union
- `shared/notify.ts:187` — file-private `_ToolEvent` literal-union
- `shared/notify.ts:189-191` — `export type HookSummaryEntry` discriminated union
- `shared/notify.ts:193-195` — `export interface HookSummary`
- `shared/notify.ts:1092` — `readonly hooks?: readonly HookSummaryEntry[];` in `PluginInfoComponentsResolved.components`
- `shared/notify.ts:2630-2637` — `COMPONENT_KINDS` 5-tuple literal
- `shared/notify.ts:2647-2660` — `appendHooksBlock` helper
- `shared/notify.ts:2682-2685` — `kind === "hooks"` arm in `appendResolvedComponentLines`
- `domain/components/hook-events.ts:37-49` — `BUCKET_A_EVENTS` tuple + new `as const satisfies readonly ClaudeHookEvent[]` pin
- `domain/components/hook-events.ts:71-79` — `TOOL_EVENTS` tuple + new `as const satisfies readonly BucketAEvent[]` pin

## Test count added

4 new tests in `tests/shared/notify-v2.test.ts`:

1. `SURF-02 / D-63-06: HookSummaryEntry discriminator REQUIRES matcher for tool events, FORBIDS it for non-tool events` — compile-time `@ts-expect-error` pins on both misuse cases.
2. `SURF-02 / D-63-04: renderer emits multi-line hooks: block at 4-space header + 6-space per-entry indent (mixed tool/non-tool entries)` — Task 1 Test 4 byte-form fixture (3 tool events with matchers + 1 non-tool event).
3. `SURF-02 / D-63-04: empty hooks ([]) emits NO hooks: header; non-hooks kinds still render their single-line comma-join`.
4. `SURF-02 / D-63-04: undefined hooks (field omitted) emits NO hooks: header; legacy 4-kind comma-join output is byte-stable`.

## Verification

- `npx tsc --noEmit` — green
- `npm test` — 2225 pass / 0 fail / 1 skip (added 4 new tests; baseline 2221)
- `npm run check` — green (typecheck + lint + format:check + unit + integration)
- `grep -n "COMPONENT_KINDS" extensions/pi-claude-marketplace/shared/notify.ts` — 5-element tuple literal present
- `grep -n "ClaudeHookEvent\|HookSummaryEntry\|HookSummary" extensions/pi-claude-marketplace/shared/notify.ts` — 3 exports + 1 internal type ref present
- `grep -c "lossy synthesis\|LOSSY_SYNTHESIS" extensions/pi-claude-marketplace/shared/notify.ts` — 0 (SURF-03 stays unshipped per plan)

## Decisions Made

- **Type declaration lives on the consumer side of the import fence (Rule 3 architectural workaround).** The plan instructed `shared/notify.ts` to `import { type BucketAEvent, type ToolEvent } from "../domain/components/hook-events.ts"`. The repository's `import-x/no-restricted-paths` ESLint rule forbids `shared/` from importing from `domain/` (`"shared/ may only import from platform/ for Pi API types."`). Resolution: declare `ClaudeHookEvent` as a self-contained literal-union in `shared/notify.ts`, then pin the runtime tuples in `domain/components/hook-events.ts` to the shared union via `as const satisfies readonly ClaudeHookEvent[]`. Single-source-of-truth is preserved because the `satisfies` assertion will break the typecheck at the producer site if the two declarations drift. Documented inline at both seams.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Import-direction fence forbids shared/ -> domain/ import**

- **Found during:** Task 1 verification (`pre-commit run --files extensions/pi-claude-marketplace/shared/notify.ts` lint stage)
- **Issue:** The plan's prescribed import (`import { type BucketAEvent, type ToolEvent } from "../domain/components/hook-events.ts"`) is rejected by `import-x/no-restricted-paths` in `eslint.config.js:256-267` — `shared/` files cannot import from `domain/`. The rule applies to type-only imports too.
- **Fix:** Declare `ClaudeHookEvent` (8-member) and a file-private `_ToolEvent` (3-member) as inline literal-unions in `shared/notify.ts`. Pin the runtime tuples in `domain/components/hook-events.ts` to the shared `ClaudeHookEvent` via `as const satisfies readonly ClaudeHookEvent[]` (and `TOOL_EVENTS` to `readonly BucketAEvent[]`). Direction is now `domain/ -> shared/` which IS allowed (`domain/ MUST NOT import upward -- shared/ and platform/ are the only sibling imports allowed`).
- **Files modified:** extensions/pi-claude-marketplace/shared/notify.ts, extensions/pi-claude-marketplace/domain/components/hook-events.ts
- **Verification:** `npx tsc --noEmit` and `npx eslint` both green. The `satisfies` assertion was sanity-checked by mentally toggling a tuple value — it would trip the typecheck at the producer site.
- **Committed in:** 70e103d (Task 1 commit)

**2. [Rule 1 - Bug] `appendResolvedComponentLines` cognitive complexity exceeded sonarjs threshold (22 > 15)**

- **Found during:** Task 1 verification (lint stage)
- **Issue:** Nested loop + conditional + `"matcher" in entry` branch pushed the renderer's cognitive complexity to 22.
- **Fix:** Extracted the hooks-block logic into `appendHooksBlock(lines, entries)` helper. Renderer body is now a single guarded `if (kind === "hooks") { appendHooksBlock(...); continue; }` arm.
- **Files modified:** extensions/pi-claude-marketplace/shared/notify.ts
- **Verification:** `npx eslint` green; tests verify the byte-form is unchanged.
- **Committed in:** 70e103d (Task 1 commit)

**3. [Rule 3 - Blocking] Plan references `tests/shared/notify.test.ts` but actual test file is `tests/shared/notify-v2.test.ts`**

- **Found during:** Task 2 (file location)
- **Issue:** The plan's `files_modified` and `<files>` block name `tests/shared/notify.test.ts`. That file does not exist in the repository; the actual notify unit-test file is `tests/shared/notify-v2.test.ts` (per the v2 grammar amendment in v1.4.x).
- **Fix:** Added the new tests to `tests/shared/notify-v2.test.ts`.
- **Files modified:** tests/shared/notify-v2.test.ts
- **Verification:** `npm test -- tests/shared/notify-v2.test.ts` lists all 4 new tests as passing.
- **Committed in:** 77ed3d9 (Task 2 commit)

**4. [Rule 3 - Blocking] Prettier reformatting of `appendHooksBlock` signature**

- **Found during:** Task 2 verification (`npm run check` format:check stage)
- **Issue:** Multi-line parameter list got auto-reflowed by prettier into one line (under the column limit when collapsed).
- **Fix:** Ran `npx prettier --write`.
- **Files modified:** extensions/pi-claude-marketplace/shared/notify.ts
- **Verification:** `npm run check` green.
- **Committed in:** 77ed3d9 (folded into Task 2 commit since amending the prior commit is forbidden by CLAUDE.md).

---

**Total deviations:** 4 auto-fixed (2 blocking, 1 bug-class, 1 follow-on formatting)
**Impact on plan:** Architectural workaround for the import-direction fence is the only structural deviation; semantically the type seam is byte-identical to the plan's intent (same literal sets, same discriminator shape, same renderer bytes). No new code paths, no new tokens, no new notify call sites. Downstream consumers (plans 63-02..05) import the same exported names from the same module.

## Issues Encountered

- None beyond the deviations above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Ready for plans 63-02..05 to consume `HookSummaryEntry` (per D-63-06) and the `PluginInfoComponentsResolved.components.hooks?` field (per D-63-07) without further type-model changes. The single source of truth for the 8 supported events is `ClaudeHookEvent` in `shared/notify.ts`; downstream consumers must import that union (not redeclare it locally) and let the `satisfies` pin in `domain/components/hook-events.ts` guard against drift.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/shared/notify.ts` — FOUND (modified)
- `extensions/pi-claude-marketplace/domain/components/hook-events.ts` — FOUND (modified)
- `tests/shared/notify-v2.test.ts` — FOUND (modified)
- Commit `70e103d` — FOUND in git log
- Commit `77ed3d9` — FOUND in git log

---
*Phase: 63-lifecycle-cascade-user-facing-surface-docs*
*Completed: 2026-06-16*
