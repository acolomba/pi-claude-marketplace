---
phase: 01-foundations-toolchain
plan: 04
subsystem: infra
tags: [pi-extension, entrypoint, registerCommand, resources_discover, isomorphic-git, supersession]

# Dependency graph
requires:
  - phase: 01-foundations-toolchain
    provides: shared/notify.ts (Plan 02 -- notifyWarning wrapper); package.json pi.extensions pointer (Plan 01 -- "./extensions/claude-marketplace/index.ts")
provides:
  - "Working Pi extension entrypoint at extensions/claude-marketplace/index.ts (1 command + 1 event + 0 LLM tools)"
  - "Legacy single-file stub deleted; module-resolution ambiguity closed (Pitfall #7)"
  - "REQUIREMENTS.md MA-7 marked superseded by D-18/D-21 with strikethrough + supersession note"
  - "PROJECT.md Key Decisions records D-21 (isomorphic-git supersession of MA-7)"
affects:
  - "Phase 3 (Resource Bridges -- will replace empty resources_discover handler with real walk)"
  - "Phase 4 (Marketplace Orchestrators -- uses platform/git built on isomorphic-git per D-21)"
  - "Phase 6 (Edge Layer -- will replace stub /claude:plugin handler with real router; will add LLM tools via edge/handlers/list.ts)"

# Tech tracking
tech-stack:
  added: []  # No new dependencies; all required deps already shipped by prior plans
  patterns:
    - "Default-export factory pattern: (pi: ExtensionAPI) => void (D-13 directory entrypoint)"
    - "Non-async handler returning Promise.resolve() (avoids @typescript-eslint/require-await for empty bodies)"
    - "import type for ExtensionAPI (Pitfall #6: type-only imports erased under native TS strip)"
    - "Strikethrough + inline supersession note for REQ-IDs whose contract is replaced rather than removed"

key-files:
  created:
    - "extensions/claude-marketplace/index.ts (Pi entrypoint; 43 lines, 1 cmd + 1 event + 0 tools)"
    - ".planning/phases/01-foundations-toolchain/01-04-SUMMARY.md (this file)"
  modified:
    - ".planning/REQUIREMENTS.md (MA-7 marked superseded; Traceability + Coverage + per-phase counts updated)"
    - ".planning/PROJECT.md (Key Decisions table gains D-21 row)"
  deleted:
    - "extensions/claude-marketplace.ts (legacy single-file stub; intentional; closes module-resolution ambiguity)"

key-decisions:
  - "D-21 captured in PROJECT.md Key Decisions: isomorphic-git supersedes MA-7 (git-CLI-not-found failure mode no longer reachable)"
  - "MA-7 retained in REQUIREMENTS.md via strikethrough rather than deleted, so the contract delta stays visible"
  - "Phase 1 index.ts registers ZERO LLM tools (Phase 6 lands them in edge/handlers/list.ts per the 9-folder layout D-10)"
  - "Handler routes through notifyWarning from shared/notify.ts; direct ctx.ui.notify is forbidden everywhere except shared/notify.ts itself (D-06 + D-07)"

patterns-established:
  - "Pi extension entrypoint: thin default-export factory that wires registerCommand + on(event), no business logic"
  - "REQ-ID supersession pattern: strikethrough source line + inline supersession marker + Traceability row updated to '--' / 'Superseded by Dxx' + Coverage section recount + per-phase REQ count adjustment"

requirements-completed: [NFR-6]

# Metrics
duration: ~12min
completed: 2026-05-09
---

# Phase 01 Plan 04: Replace Legacy Stub With Directory Entrypoint Summary

**Working Pi extension entrypoint (1 command + 1 event + 0 tools) replaces single-file stub; D-21 supersession of MA-7 (git-CLI failure mode) recorded in REQUIREMENTS.md and PROJECT.md.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-09T23:03:00Z (approx)
- **Completed:** 2026-05-09T23:15:12Z
- **Tasks:** 2
- **Files modified:** 3 (+1 created, +1 deleted)

## Accomplishments

- Created `extensions/claude-marketplace/index.ts` as the directory entrypoint Pi resolves from `package.json` `pi.extensions` (closes Pitfall #7 dangling-pointer concern; the pointer was set by Plan 01 to a file that didn't exist yet -- this plan creates that file).
- Deleted `extensions/claude-marketplace.ts` legacy single-file stub. With both files present, ESLint would lint two surfaces and the legacy stub still imported `Type` from `typebox` and registered `claude_marketplace_list` (a tool we don't want in Phase 1); deleting the stub eliminates module-resolution ambiguity.
- Phase 1 `index.ts` registers exactly 1 slash command (`/claude:plugin`, stub warning handler) + 1 event handler (`resources_discover`, returns empty arrays) + 0 LLM tools. Tool registration is deliberately deferred to Phase 6 / `edge/handlers/list.ts` per the 9-folder layout (D-10) and per RESEARCH.md Open Question 3 resolution.
- Slash command handler routes user-visible output through `notifyWarning` from `shared/notify.ts` (the sole sanctioned `ctx.ui.notify` call site per D-07). Direct `ctx.ui.notify` is blocked at lint time by `no-restricted-syntax` everywhere except `shared/notify.ts`.
- REQUIREMENTS.md now records MA-7 as `[x]`-checked, strikethrough, with an inline supersession marker (`superseded by D-18/D-21`). The original PRD §5.1.1 text is preserved verbatim under the strikethrough so the contract delta stays visible to anyone reading the file. Traceability table row, Coverage section, and Phase 4 per-phase REQ count all updated to reflect the supersession.
- PROJECT.md Key Decisions table now contains a D-21 row recording the isomorphic-git adoption rationale and the affected phases (Phase 1 `platform/git.ts`, Phase 4 marketplace orchestrators).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create extensions/claude-marketplace/index.ts and delete extensions/claude-marketplace.ts** -- `2941f7a` (`feat(01-04)`)
2. **Task 2: Update REQUIREMENTS.md (MA-7 superseded) and PROJECT.md (D-21 entry)** -- `dbf8a4c` (`docs(01-04)`)

_Note: This plan is not a TDD plan (`type: execute`); only the per-task commits exist; no separate test/feat/refactor split._

## Files Created/Modified

- `extensions/claude-marketplace/index.ts` (created) -- Thin Pi extension entrypoint; default-export factory `claudeMarketplaceExtension(pi: ExtensionAPI)` registering `/claude:plugin` slash command (stub warning handler) and `resources_discover` event handler (returns empty arrays). Imports `notifyWarning` from `./shared/notify.ts`; `import type` for `ExtensionAPI` ensures it's erased under Node native TS strip.
- `extensions/claude-marketplace.ts` (deleted) -- Legacy single-file stub registered `claude_marketplace_list` LLM tool + `claude-marketplace:list` command; both replaced by the new directory entrypoint (with tool registration deferred to Phase 6).
- `.planning/REQUIREMENTS.md` (modified) -- MA-7 entry strikethrough + supersession note; Traceability row `MA-7 | -- | Superseded by D-18/D-21`; Coverage section recount (199 mapped, 99.5%); Phase 4 per-phase count adjusted from 44 to 43.
- `.planning/PROJECT.md` (modified) -- Appended D-21 row to Key Decisions table.

## Decisions Made

- **Index.ts is non-async with explicit `Promise.resolve()` returns.** Both the `resources_discover` handler and the slash-command handler return `Promise.resolve()` instead of being declared `async`. This avoids `@typescript-eslint/require-await` flagging an `async` function with no `await` -- the canonical workaround for handlers that satisfy a `Promise`-returning contract but don't actually await anything. Phase 6 will swap these for proper async dispatchers when real work is added.
- **Type-only import for `ExtensionAPI` even though TypeBox is a value-import in other files.** `ExtensionAPI` is purely a type annotation; using `import type` erases the import under Node's native TS strip (Pitfall #6), avoiding any chance of a phantom runtime dependency on the host's API module shape.
- **Import order: value imports before type imports** (per existing project convention in `shared/notify.ts`; `eslint-plugin-import-x` `import-x/order` enforces this). Initial draft had the type import first; lint flagged it, fix was a one-line swap.
- **MA-7 supersession recorded as strikethrough rather than deletion.** Deleting the line would erase the user-contract delta from history (anyone reading the file later would have no idea MA-7 ever existed). Strikethrough + inline supersession note keeps the delta visible. PROJECT.md Key Decisions table provides the authoritative pointer for downstream agents.
- **Phase 4 per-phase REQ count updated from 44 to 43, not left as 44.** The per-phase counts table is intended to reflect the live REQ surface that each phase OWNS. Since MA-7 is no longer owned by any phase, leaving the Phase 4 count at 44 would erode the table's signal-to-noise.

## Deviations from Plan

None -- plan executed exactly as written. The two minor in-flight adjustments (described in Decisions Made above) were import-order convention adherence and the standard "non-async handler with Promise.resolve()" pattern that the plan explicitly called out in its implementation notes.

## Issues Encountered

- **TruffleHog pre-commit hook fails inside Claude Code worktrees.** The TruffleHog hook tries to read `.git/index` directly, but in a worktree `.git` is a file (pointing at the main repo's `worktrees/<id>` directory), not a directory. The hook errors with `failed to read index file: ... not a directory`. The parallel-execution context anticipates this and sanctions `SKIP=trufflehog git commit ...` as the documented workaround inside worktrees. Both task commits used `SKIP=trufflehog`. All other hooks (Prettier, smartquotes, ligatures, npm lint/format/typecheck, gitlint) ran clean.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- Plan 06 (Smoke Tests) is now unblocked; it will ship a `node:test` test that imports `./extensions/claude-marketplace/index.ts`, confirms the default export is a function, calls it with a mock `pi` object, and asserts exactly 1 `registerCommand("claude:plugin", ...)` + 1 `on("resources_discover", ...)` + 0 `registerTool(...)` -- which mirrors the inline smoke test executed during Task 1 verification of this plan.
- `pi.extensions` pointer in `package.json` now resolves to a real file; Pi can load the extension cleanly with no ENOENT.
- `edge/` directory remains intentionally empty in Phase 1 (the new `index.ts` imports only from `shared/`); Phase 6 will populate `edge/handlers/list.ts` and friends.
- Phase 4 (Marketplace Orchestrators) is freed of the MA-7 obligation; `platform/git.ts` (Phase 1 D-18/D-19/D-20 territory) will be built on `isomorphic-git`, making the "git CLI not found on PATH" failure mode unreachable.

## Self-Check

- **Created files exist:**
  - `extensions/claude-marketplace/index.ts` -- FOUND
  - `.planning/phases/01-foundations-toolchain/01-04-SUMMARY.md` -- FOUND (this file, written by Task 2's follow-up)
- **Legacy file deleted:**
  - `extensions/claude-marketplace.ts` -- CONFIRMED ABSENT
- **Commits exist:**
  - `2941f7a` (feat 01-04) -- FOUND in `git log`
  - `dbf8a4c` (docs 01-04) -- FOUND in `git log`
- **Verification commands at task close:**
  - `npm run check` -- exit 0 (typecheck + lint + format:check + tests all pass)
  - Runtime smoke (1 command + 1 event + 0 tools) -- PASS
  - REQUIREMENTS.md supersession mentions -- 2 (line 17 lowercase + line 357 capital S)
  - PROJECT.md D-21 row -- present, mentions `isomorphic-git`
- **Result:** PASSED

---

*Phase: 01-foundations-toolchain*
*Plan: 04*
*Completed: 2026-05-09*
