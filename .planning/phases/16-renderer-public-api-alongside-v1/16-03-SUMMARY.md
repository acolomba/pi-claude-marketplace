---
phase: 16-renderer-public-api-alongside-v1
plan: 03
subsystem: presentation
tags: [typescript, notify, discriminated-union, assertNever, switch]

# Dependency graph
requires:
  - phase: 15-shared-notify-type-model
    provides: MarketplaceNotificationMessage, MarketplaceStatus tuple/type, MarketplaceDetails, assertNever helper, causeChainTrailer
  - phase: 16-renderer-public-api-alongside-v1 (16-01, 16-02)
    provides: planning context (16-CONTEXT.md, 16-PATTERNS.md) + V2 UsageError overload landed on shared/notify.ts
provides:
  - File-private renderMpHeader(mp): string helper -- first of two v2 rendering helpers (D-16-09)
  - File-private icon constants ICON_INSTALLED ("●"), ICON_AVAILABLE ("○"), ICON_UNINSTALLABLE ("⊘") duplicated inline per D-16-04
  - assertNever co-imported with causeChainTrailer from ./errors.ts (ready for plan 04's renderPluginRow consumption)
  - Documented "void <symbol>" escape hatch in shared/notify.ts for the bounded plan-03/plan-04 window where helpers are declared but not yet wired
affects: [16-04 renderPluginRow, 16-05 public notify(), 16-06 unit tests, 21 final teardown]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated-union switch with case undefined: + assertNever(discriminator) default (mirrors presentation/compact-line.ts:270-293 idiom inside shared/ layer)"
    - "Explicit early-return type narrowing for optional-and-independent discriminant fields (mp.details === undefined guard, NOT optional chaining)"
    - "void <symbol> discard for file-private helpers that are declared one plan ahead of their consumer (alternative to inline ESLint disable)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts (additions lines 487-577)

key-decisions:
  - "V2 marketplace-header byte form per state-change arm: '<icon> <name> [<scope>] (<status>)' -- mirrors V1 renderMarketplace token order (compact-line.ts:351-357) with the marker slot omitted since state-change marketplace headers have no autoupdate marker."
  - "Failed arm uses ICON_UNINSTALLABLE (⊘); added/removed/updated use ICON_INSTALLED (●) -- consistent with V1 iconForMarketplace dispatch on outcomeClass."
  - "case undefined: arm guards mp.details === undefined explicitly with an early return rather than optional chaining (mp.details?.autoupdate) because SUB-BRANCH A's bare-header byte form is structurally distinct from SUB-BRANCH B's empty-token degeneration, and TS strict requires the guard to type-narrow mp.details before SUB-BRANCH B reads autoupdate / lastUpdatedAt."
  - "Autoupdate marker token: '<autoupdate>' emitted iff mp.details.autoupdate === true, omitted entirely when false -- V1-byte-equivalent to marketplace-list.ts:88 ('...(record.autoupdate === true && { marker: \"autoupdate\" as const })')."
  - "LastUpdatedAt token: '<last-updated {value}>' -- v2-only marker (V1 has no precedent); follows V1's angle-bracket marker convention (compact-line.ts MarketplaceRow.marker slot) for visual consistency with the autoupdate marker."
  - "SUB-BRANCH B uses [tokens].filter(t => t !== '').join(' ') token composition rather than string concatenation, so the optional autoupdate / lastUpdated slots can be empty strings without producing double-spaces -- mirrors compact-line.ts:489-491 joinTokens helper."
  - "Helper kept file-private (no export) per SNM-17 / D-16-09; consumer-future-needs (TS noUnusedLocals + ESLint no-unused-vars) handled via `void renderMpHeader;` and `void ICON_AVAILABLE;` self-references rather than inline `// eslint-disable-next-line` directives. Rationale: the per-file ESLint override at eslint.config.js BLOCK B disables `no-restricted-syntax` for shared/notify.ts but does NOT disable `reportUnusedDisableDirectives`, so inline disables would trigger warnings. The void discard is the cleanest documented escape hatch."

patterns-established:
  - "Pattern: file-private v2 rendering helpers live in shared/notify.ts (not presentation/), with grammar literals duplicated inline -- intentional D-16-04 duplication bounded by Phase 21 teardown"
  - "Pattern: case undefined: as a first-class arm in a discriminated-union switch (not a default-arm fallthrough), with assertNever still guarding genuinely-unknown values"
  - "Pattern: '<marker>' angle-bracket convention extends to v2-only markers (e.g. <last-updated YYYY-MM-DDTHH:MM:SSZ>) to stay visually consistent with V1's <autoupdate> marker"

requirements-completed: [SNM-17]

# Metrics
duration: ~15 min
completed: 2026-05-25
---

# Phase 16 Plan 03: renderMpHeader file-private v2 switch helper Summary

**Added a file-private `renderMpHeader(mp: MarketplaceNotificationMessage): string` helper to `shared/notify.ts`, switching over `"added" | "removed" | "updated" | "failed" | undefined` with explicit `mp.details === undefined` runtime guard and `assertNever(mp.status)` exhaustiveness default.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-25 (local session)
- **Completed:** 2026-05-25
- **Tasks:** 1 (single-task plan)
- **Files modified:** 1 (`shared/notify.ts` only)

## Accomplishments
- File-private `renderMpHeader` switch helper landed inside `shared/notify.ts` with all 5 arms (4 literal `MarketplaceStatus` members + `undefined` list-surface case) + `assertNever(mp.status)` default for compile-time exhaustiveness (D-16-09 / D-16-10).
- `case undefined:` arm guards `mp.details === undefined` with an explicit early return so SUB-BRANCH B (`mp.details !== undefined`) reads narrowed `mp.details.autoupdate` / `mp.details.lastUpdatedAt` under TS strict without crashing at runtime on the empty-list-surface payload (PRD `<canonical_refs>` / Phase 15 D-15-06).
- Icon constants `ICON_INSTALLED` (●), `ICON_AVAILABLE` (○), `ICON_UNINSTALLABLE` (⊘) duplicated inline at module scope per D-16-04 -- zero `presentation/*` imports added.
- `assertNever` co-imported with `causeChainTrailer` from `./errors.ts` -- ready for plan 04's `renderPluginRow` and the broader phase 16 wiring.
- All 1327 existing tests stay green; `npm run check` (typecheck + ESLint + Prettier + tests) GREEN.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add file-private icon constants and `renderMpHeader` switch helper** -- see commit below (feat).

## Files Created/Modified
- `extensions/pi-claude-marketplace/shared/notify.ts` -- added lines 487-577: section comment + 3 icon constants + `renderMpHeader` (lines 527-565) + two `void <symbol>;` self-references (lines 571, 577) at end of file. Existing import on line 1 updated from `import { causeChainTrailer } from "./errors.ts";` to `import { assertNever, causeChainTrailer } from "./errors.ts";`.

## Decisions Made

See `key-decisions` in the frontmatter. Headline: planner chose `<last-updated {value}>` as the v2-only `lastUpdatedAt` token shape (no V1 precedent existed); the autoupdate marker stays V1-byte-equivalent (`<autoupdate>` iff `autoupdate === true`, omitted when false).

### Exact byte forms (per arm)

| Arm | Byte form |
|---|---|
| `"added"` | `● {name} [{scope}] (added)` |
| `"removed"` | `● {name} [{scope}] (removed)` |
| `"updated"` | `● {name} [{scope}] (updated)` |
| `"failed"` | `⊘ {name} [{scope}] (failed)` |
| `undefined` SUB-BRANCH A (`mp.details === undefined`) | `● {name} [{scope}]` (bare header, no trailing tokens) |
| `undefined` SUB-BRANCH B (`mp.details !== undefined`) | `● {name} [{scope}]` + ` <autoupdate>` (iff `mp.details.autoupdate === true`) + ` <last-updated {mp.details.lastUpdatedAt}>` (iff defined). Token composition uses `[parts].filter(t => t !== "").join(" ")` so empty optional slots collapse cleanly. |

Worked SUB-BRANCH A example (the empty-list-surface payload from acceptance criterion #14):
- Input: `{ name: "demo", scope: "user", status: undefined, details: undefined, plugins: [] }`
- Output: `● demo [user]`

Worked SUB-BRANCH B examples:
- `{ name: "demo", scope: "user", status: undefined, details: { autoupdate: true }, plugins: [] }` → `● demo [user] <autoupdate>`
- `{ name: "demo", scope: "user", status: undefined, details: { autoupdate: false }, plugins: [] }` → `● demo [user]` (autoupdate marker omitted entirely when false -- V1 byte-equivalent)
- `{ name: "demo", scope: "user", status: undefined, details: { autoupdate: true, lastUpdatedAt: "2026-05-25T00:00:00Z" }, plugins: [] }` → `● demo [user] <autoupdate> <last-updated 2026-05-25T00:00:00Z>`
- `{ name: "demo", scope: "user", status: undefined, details: { autoupdate: false, lastUpdatedAt: "2026-05-25T00:00:00Z" }, plugins: [] }` → `● demo [user] <last-updated 2026-05-25T00:00:00Z>`

### Line range

The new helper occupies lines 487-577 of `extensions/pi-claude-marketplace/shared/notify.ts`:
- Lines 487-496: section divider comment
- Lines 498-501: icon constants (`ICON_INSTALLED`, `ICON_AVAILABLE`, `ICON_UNINSTALLABLE`)
- Lines 503-526: `renderMpHeader` TSDoc block
- Lines 527-565: `renderMpHeader` function body (the 5-arm switch)
- Lines 567-577: `void ICON_AVAILABLE;` + `void renderMpHeader;` self-references with explanatory comments

### Plan-04 readiness checklist

- ✅ Plan 04 can consume `ICON_INSTALLED`, `ICON_AVAILABLE`, `ICON_UNINSTALLABLE` (all three at module scope).
- ✅ Plan 04 can consume the `assertNever` co-import (already in the top-of-file import statement).
- ✅ Plan 04's `renderPluginRow` should DELETE the `void ICON_AVAILABLE;` self-reference (line 571) once it consumes ICON_AVAILABLE in its `(available)` / `(uninstalled)` arms.
- ✅ Plan 05's `notify()` should DELETE the `void renderMpHeader;` self-reference (line 577) once it composes `renderMpHeader` into the marketplace-block loop.

### Runtime safety confirmation (acceptance criterion: SUB-BRANCH A cannot crash)

The `mp.details === undefined` guard executes BEFORE any read of `mp.details.autoupdate` or `mp.details.lastUpdatedAt`, so calling `renderMpHeader({ kind: ..., name: "demo", scope: "user", status: undefined, details: undefined, plugins: [] })` returns the bare header `"● demo [user]"` WITHOUT throwing. This is what plan 06's empty-list-surface test (test case #17 in plan 06's taxonomy) will assert.

## Deviations from Plan

None - plan executed exactly as written, with one Rule-2 / Rule-3-adjacent stylistic ratchet:

### Auto-fixed Issues

**1. [Rule 3 - Blocking lint/format errors] Prettier + `@stylistic/padding-line-between-statements` ESLint rule required additional blank lines and reflow inside the new `renderMpHeader` body**
- **Found during:** Task 1 verification (`npm run check`)
- **Issue:** After initial code emission, ESLint flagged two `Expected blank line before this statement @stylistic/padding-line-between-statements` errors (blank line missing before `default:` arm and before `void ICON_AVAILABLE;` outside the function), then Prettier flagged formatting drift on the SUB-BRANCH B `lastUpdatedToken` ternary expression (single-line vs multi-line break shape).
- **Fix:** Inserted the missing blank lines (between SUB-BRANCH B's closing `}` and `default:`, and between the function's closing `}` and the trailing `void ICON_AVAILABLE;` comment block), then ran `npx prettier --write` on the file to settle the canonical formatting (Prettier collapsed the multi-line ternary into the project's preferred shape).
- **Files modified:** `extensions/pi-claude-marketplace/shared/notify.ts`
- **Verification:** `npm run check` GREEN (typecheck + ESLint + Prettier + 1327 tests).
- **Committed in:** included in the Task 1 commit.

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking lint/format) -- pure formatting ratchet, no semantic change.
**Impact on plan:** None. Plan executed exactly as written; the formatting ratchet is the expected `npm run check` post-edit cleanup pass and does not affect the byte forms documented above.

## Issues Encountered

None blocking. One environmental note worth recording for downstream agents:

- **cwd drift between Bash invocations:** A single `cd /home/acolomba/pi-claude-marketplace` early in the session leaked out of the worktree into the main repo and caused subsequent `grep` invocations to read the main-repo copy of `shared/notify.ts` (which lacks the v2 additions). The fix was to drop the explicit `cd` and let Bash's default cwd (the worktree) take effect. Worktree-path-safety reference notes this exact failure mode (#3097 / #3099). No file in the main repo was modified; only verification reads were affected.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04 (renderPluginRow file-private switch helper) is unblocked. ICON_AVAILABLE, ICON_INSTALLED, ICON_UNINSTALLABLE are all available as file-private constants; assertNever is co-imported.
- Plan 05 (public `notify()` composing both helpers) is unblocked once plan 04 lands.
- Plan 06 (notify-v2 unit tests) will assert the exact byte forms documented in "Decisions Made" above.
- No blockers or concerns.

---
*Phase: 16-renderer-public-api-alongside-v1*
*Completed: 2026-05-25*
