---
phase: 62-asyncrewake-registry-background-spawn
plan: 02
subsystem: hooks
tags:
  - hooks
  - async-rewake
  - registry
  - spawn
  - whitelist-amendment
  - child_process
  - sendMessage
  - notify-il2-exemption

# Dependency graph
requires:
  - phase: 62-asyncrewake-registry-background-spawn
    provides:
      - "ring-buffer.ts (RingBuffer + STDERR_CAP_BYTES + STDOUT_CAP_BYTES)"
      - "pid-table.ts (readPidTable + writePidTable + unlinkPidTable + PidTableEntry)"
      - "domain/components/hooks.ts asyncRewake field-family admission (HOOK-03 lenient)"
  - phase: 60-payload-translators
    provides:
      - "buildTranslationContext + 8 per-event translator dispatch"
      - "dispatch-exec.ts EXEC-01..04 sync sibling (prepareEnv/planSpawn/serializeWithTruncation patterns)"
  - phase: 59-event-router
    provides:
      - "currentEpoch() captured-epoch zombie defense (D-59-03)"
      - "RoutingEntry shape with handlerDecl.{asyncRewake,rewakeMessage,rewakeSummary,timeout,shell,args,command}"
  - phase: 58-matcher-parser-supportability
    provides:
      - "D-58-01 atomic-supersession lesson (whitelist amendment + first import same commit)"
provides:
  - "bridges/hooks/async-rewake/registry.ts — spawnAndRegister, shutdownInMemoryChildren, reapOrphans, AsyncRewakeEntry interface, MARKER_ENV constant, 7 test seams"
  - "shared/notify.ts — notifyAsyncRewakeSummary IL-2-exempt seam"
  - "tests/architecture/no-shell-out.test.ts — closed-set whitelist grown 2 → 3"
affects:
  - "62-03 (dispatch-exec async branch + event-router factory wiring)"
  - "63 (LIFE-03 plugin-install-time hook validation will encounter the asyncRewake field family)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "discriminated OutcomeKind union + assertNever exhaustiveness pin (NFR-7)"
    - "fire-and-forget child + per-child once('exit') handler + captured-epoch zombie defense (D-62-03)"
    - "marker-env (PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH) + /proc/<pid>/environ verify before SIGKILL (D-62-05)"
    - "notify routing through shared/notify.ts wrapper for the single sanctioned IL-2 exemption"

key-files:
  created:
    - "extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts"
    - ".planning/phases/62-asyncrewake-registry-background-spawn/62-02-SUMMARY.md"
  modified:
    - "tests/architecture/no-shell-out.test.ts"
    - "extensions/pi-claude-marketplace/shared/notify.ts"

key-decisions:
  - "Use pi: ExtensionAPI for the sendMessage call site; ctx: ExtensionContext for ui.notify and isIdle. ExtensionContext does not carry sendMessage in the installed peer-dep snapshot (@earendil-works/pi-coding-agent@0.79.0); the research doc claim was incorrect. spawnAndRegister's signature now accepts both (entry, event, ctx, pi, loc)."
  - "Route the rewakeSummary IL-2 EXEMPTION through a new shared/notify.ts helper (notifyAsyncRewakeSummary) rather than calling ctx.ui.notify directly. The project-wide no-restricted-syntax ESLint rule forbids direct ctx.ui.notify outside shared/notify.ts; the helper preserves the exemption without bypassing the gate. T-62-09 documentation reflects the new seam name."
  - "Atomically land the no-shell-out.test.ts whitelist amendment + the first import 'node:child_process' line in ONE commit (D-58-01). Task 1 of this plan is exactly that commit; Task 2 (which only adds further uses of spawn but no new import-site sources) lands the body in a separate commit and the architecture suite stays GREEN across the intermediate state."
  - "Copy planSpawn, prepareEnv, and serializeWithTruncation from dispatch-exec.ts into registry.ts as planAsyncSpawn / prepareAsyncEnv / serializeWithTruncation private helpers. v1.14+ may extract to a shared module if duplication becomes load-bearing; for v1.13, minimize churn against the sync sibling (Open Question #2 — keep dispatch-exec.ts untouched)."
  - "AsyncRewakeEntry carries loc: ScopedLocations so onChildExit's fire-and-forget persistPidTableForLoc can write the per-scope table without re-deriving location from entry.scope/cwd. Adds a 14th field to the entry; documented in the entry's JSDoc."

patterns-established:
  - "shared/notify.ts seam grows to admit the asyncRewake IL-2 exemption: any future runtime notify originating from bridges/hooks/async-rewake/ goes through a dedicated helper here, not direct ctx.ui.notify, so the existing ESLint gate has a single audit point."
  - "Sanctioned node:child_process site declares the whitelist cross-reference in its file-leading comment block, mirroring dispatch-exec.ts (43-49) verbatim with the THIRD-of-THREE position swapped in."
  - "OrphanProbes test seam (killProbe + environReader) for deterministic reap tests without touching real OS state. Mirrors dispatch-exec.ts's SpawnImpl seam."

requirements-completed:
  - HOOK-06
  - EXEC-05

# Metrics
duration: ~25min
completed: 2026-06-15
---

# Phase 62 Plan 02: asyncRewake Registry & Background-Spawn Summary

**Bridge-owned asyncRewake registry: detached=false spawn + ring-buffered stderr/stdout + EXEC-02 timer ladder + captured-epoch zombie defense + exit-code-2 pi.sendMessage injection + PID-table-backed orphan reap on `/reload` — the THIRD and FINAL sanctioned `node:child_process` site in the extension tree, atomically supersedes the 2-element whitelist to 3 in the same commit (D-58-01).**

## Performance

- **Duration:** ~25 min (executor wall-clock)
- **Started:** 2026-06-15T23:30:00Z
- **Completed:** 2026-06-15T23:54:00Z
- **Tasks:** 2 (atomic-supersession commit + full body fill)
- **Files modified:** 3 (1 created + 2 edited)

## Accomplishments

- **`bridges/hooks/async-rewake/registry.ts` (NEW, 729 LoC):** load-bearing async-rewake registry. Public surface: `spawnAndRegister`, `shutdownInMemoryChildren`, `reapOrphans`, `AsyncRewakeEntry`, `MARKER_ENV`. Test seams: `_setSpawnForTest`, `_resetSpawnForTest`, `_setDispatchIdGeneratorForTest`, `_resetDispatchIdGeneratorForTest`, `_setOrphanProbesForTest`, `_resetOrphanProbesForTest`, `_getRegistryForTest`.
- **`tests/architecture/no-shell-out.test.ts`:** ALLOWED_CHILD_PROCESS_FILES set grown TWO → THREE, sibling assertion renamed `exactly two` → `exactly three`, docstring header gained the EXEC-05 / HOOK-06 / D-62-01 third-sanctioned-site paragraph. Both tests still GREEN.
- **`shared/notify.ts`:** added `notifyAsyncRewakeSummary(ctx, summary)` as the T-62-09 IL-2-exempt seam so the bridge's `rewakeSummary` surface routes through the canonical sanctioned notify chokepoint instead of bypassing the project-wide `no-restricted-syntax` gate.
- **`npm run check` GREEN** end-to-end (typecheck + ESLint + Prettier + 2184 unit tests + 10 integration tests).
- **Atomic-supersession honored:** Task 1's single commit `8ef02c5` contains BOTH the whitelist amendment AND the first `import { spawn } from "node:child_process"` line; the architecture test never went RED in any intermediate state.

## Task Commits

1. **Task 1: Atomic-supersession (whitelist amend + registry skeleton)** — `8ef02c5` (feat)
2. **Task 2: Fill registry.ts with spawnAndRegister + exit handler + orphan reap + test seams** — `e53f190` (feat)

_Note: Task 2 internally adds the `notifyAsyncRewakeSummary` helper in `shared/notify.ts` to satisfy the existing `no-restricted-syntax` ESLint gate; both source files landed in the same task commit because they are inseparable (registry.ts imports the helper added in the same edit)._

## Files Created/Modified

- **`extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`** (NEW, 729 LoC) — async-rewake registry: spawnAndRegister + per-child onChildExit/onChildError handlers + shutdownInMemoryChildren + reapOrphans + AsyncRewakeEntry + MARKER_ENV + planAsyncSpawn + prepareAsyncEnv + serializeWithTruncation copies + buildInjectionContent + OutcomeKind discriminator + 7 test seams.
- **`tests/architecture/no-shell-out.test.ts`** — whitelist 2 → 3 (3 surgical edits: docstring header third paragraph, ALLOWED_CHILD_PROCESS_FILES set, sibling assertion title + expected array). Both tests pass with the new 3-element set.
- **`extensions/pi-claude-marketplace/shared/notify.ts`** — added `notifyAsyncRewakeSummary(ctx, summary)` helper; documented as the T-62-09 IL-2 exemption seam.

## Decisions Made

- **`pi: ExtensionAPI` is the sendMessage carrier; `ctx: ExtensionContext` keeps `ui.notify` and `isIdle`.** The 62-RESEARCH.md note at lines 787-794 claimed `ctx.sendMessage` lives on `ExtensionContext` per `types.d.ts:1099` SendMessageHandler exposure. In the installed peer-dep snapshot (`@earendil-works/pi-coding-agent@0.79.0`), `ExtensionContext` (lines 208-239 of `types.d.ts`) does NOT carry `sendMessage` — only `ExtensionAPI` (lines 857-860) and `ReplacedSessionContext` (lines 288-291) do. `spawnAndRegister` therefore takes `pi: ExtensionAPI` as a 4th parameter, and the exit-handler closure calls `pi.sendMessage(...)` while continuing to use `ctx.isIdle()` and (via the notify seam) `ctx.ui.notify` for the IL-2-exempt summary surface. Plan 03's wiring closure must provide both.
- **Route the IL-2 EXEMPTION through `shared/notify.ts`.** The project-wide ESLint rule (`eslint.config.js:127-131`) forbids direct `ctx.ui.notify` outside `shared/notify.ts`. Bypassing it via inline `eslint-disable-next-line` was rejected — the cleaner architectural fix is a dedicated `notifyAsyncRewakeSummary` helper that takes the summary string and applies the canonical `("info")` severity. The new helper is documented in the existing shared/notify.ts header as a sanctioned exception alongside `notifyUsageError` and `notifyDiagnostic`.
- **Atomic-supersession in Task 1.** D-58-01 requires the architecture test amendment to land in the SAME commit as the first source line that imports `node:child_process` from the new file path. Task 1's commit (`8ef02c5`) contains EXACTLY that: the whitelist set + sibling-assertion edit + the stub `registry.ts` with the `import { spawn, type ChildProcess } from "node:child_process"` line. Task 2 expands the body but adds no new `import "node:child_process"` line, so the architecture test never went RED in the intermediate state.
- **Carry `loc: ScopedLocations` on `AsyncRewakeEntry`.** RESEARCH lines 431-447 specified 13 readonly fields; adding `loc` as the 14th avoids re-deriving the per-scope persistence target inside `persistPidTableForLoc` (which is called from `onChildExit` after `void persistPidTableForLoc(entry.loc)`). Plan 03 supplies the `loc` argument to `spawnAndRegister` at the dispatcher site (the composite handler closure knows the dispatch-time scope), so the value flows in once at spawn time.
- **Copy `planSpawn` / `prepareEnv` / `serializeWithTruncation` from dispatch-exec.ts.** RESEARCH Open Question #2 left implementer choice between Option A (copy) vs Option B (extract to a shared module). Picked A because it leaves Phase 60's sync sibling untouched in this plan; the duplication is documented inline as "deferred to v1.14+ if duplication becomes load-bearing".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `ctx.sendMessage` does not exist on `ExtensionContext` in the installed peer-dep snapshot**
- **Found during:** Task 2 (registry body fill — typecheck would have failed on `ctx.sendMessage(...)`)
- **Issue:** Both the plan's `<behavior>` block (steps 10-11) and RESEARCH.md (line 768) instructed the exit handler to call `void ctx.sendMessage({...}, { deliverAs: lane })`. Verification against `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts` (the installed v0.79.0 snapshot) shows `ExtensionContext` (lines 208-239) carries `isIdle()`, `ui`, `cwd`, `sessionManager`, etc. — but **NOT** `sendMessage`. Only `ExtensionAPI` (lines 857-860) and `ReplacedSessionContext` (lines 288-291) declare `sendMessage`. RESEARCH note 787-794 acknowledged the discrepancy but concluded both surfaces expose the same shape — they do not in the v0.79.0 type definitions.
- **Fix:** Added `pi: ExtensionAPI` as a 4th parameter to `spawnAndRegister(entry, event, ctx, pi, loc)`. The exit-handler closure now captures both `ctx` (for `isIdle()` + the IL-2 notify seam) and `pi` (for `pi.sendMessage(...)`). Plan 03's dispatcher wiring will provide both at the call site.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`
- **Verification:** `npx tsc --noEmit` GREEN; `npm run check` GREEN.
- **Committed in:** `e53f190` (Task 2 commit)

**2. [Rule 2 — Missing Critical] `ctx.ui.notify` direct call violates project-wide ESLint gate**
- **Found during:** Task 2 (first `pre-commit run` after the body fill)
- **Issue:** `eslint.config.js:127-131` registers a `no-restricted-syntax` rule forbidding direct `ctx.ui.notify(...)` calls outside `shared/notify.ts`. The plan's `<behavior>` step 6 and RESEARCH.md (lines 738-745) instructed the exit handler to call `ctx.ui.notify(entry.rewakeSummary, "info")` directly inside `bridges/hooks/async-rewake/registry.ts`. ESLint rejected this even with the documented IL-2-EXEMPTION comment block — the gate is binary, not justification-aware.
- **Fix:** Added `notifyAsyncRewakeSummary(ctx, summary)` to `shared/notify.ts` (the canonical IL-2-exempt seam). The exit handler now calls `notifyAsyncRewakeSummary(ctx, entry.rewakeSummary)`. The IL-2 EXEMPTION (T-62-09) is preserved end-to-end: the rendered byte-on-the-wire is identical (`ctx.ui.notify(summary, "info")`), but the call site moves to the sanctioned chokepoint. The file-leading comment block in `registry.ts` was updated to name the new seam.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`, `extensions/pi-claude-marketplace/shared/notify.ts`
- **Verification:** `pre-commit run` GREEN; `npm run check` GREEN; the existing `tests/shared/notify-v2.test.ts` suite continues passing.
- **Committed in:** `e53f190` (Task 2 commit)

**3. [Rule 3 — Blocking] Initial stub imports under wrong relative-path depth + `async function` with no `await`**
- **Found during:** Task 1 (first typecheck of the stub)
- **Issue:** First-pass stub imports were written as `from "../../persistence/locations.ts"` (Phase 60 sibling depth, 3 levels) but `registry.ts` is 4 levels deep under `bridges/hooks/async-rewake/`. The stub's `async function spawnAndRegister(...): Promise<void> { throw new Error(...) }` tripped `@typescript-eslint/require-await` because the body had no `await` expression.
- **Fix:** (a) updated all imports to `../../../` depth; (b) converted the stubs from `async function ... { throw new Error("not yet implemented") }` to `function ... { return Promise.reject(new Error("not yet implemented")) }` so the lint stays GREEN at the stub checkpoint.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`
- **Verification:** `npx tsc --noEmit` GREEN; `pre-commit run` GREEN.
- **Committed in:** `8ef02c5` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 1 missing critical, 1 blocking)
**Impact on plan:** All three fixes essential for correctness. (1) was a peer-dep type-shape mismatch the planner did not catch; (2) was a project-wide ESLint gate the planner did not check; (3) was a stub-time path/lint typo. None changed the runtime contract or the public surface Plan 03 inherits.

## Issues Encountered

- **Pre-commit "Fix Unicode dash characters" hook rewrote `—` glyphs to `--`.** The hook auto-fixed; the byte-on-the-wire impact is comment-only (no behavior change). The post-commit test counts (2184 unit + 10 integration) reflect the rewritten state.
- **`tsx` not installed.** The plan's `<verify>` block for Task 1 used `node --test --import tsx tests/architecture/no-shell-out.test.ts`. The project has migrated to Node 22.18+ native TS strip (per the tech-stack `tsx` reconsider note) so `tsx` is no longer a dev dep. Resolved by re-running with `node --test "tests/architecture/no-shell-out.test.ts"` (no `--import`). Both architecture tests pass.

## User Setup Required

None — no external service configuration introduced by this plan. The `PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH` env var is internal to the spawn site and does not require user provisioning.

## Next Phase Readiness

Plan 03 inherits a complete async-rewake registry surface:

- **Public:** `{ spawnAndRegister, shutdownInMemoryChildren, reapOrphans }` exported from `./async-rewake/registry.ts`.
- **Test seams:** `_setSpawnForTest`, `_setDispatchIdGeneratorForTest`, `_setOrphanProbesForTest`, `_getRegistryForTest` (plus their `_reset*` counterparts) for deterministic mock-based unit tests.
- **Constant:** `MARKER_ENV = "PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH"` for the architecture test's byte-equality pin.

Plan 03's wiring tasks:

1. **dispatch-exec.ts async branch:** detect `entry.handlerDecl.asyncRewake === true` BEFORE the sync `spawnAndCollect` call, then call `spawnAndRegister(entry, event, ctx, pi, loc)` and return `{ kind: "noop" }` to the reducer. The composite handler in `dispatch.ts` must thread `pi: ExtensionAPI` through (currently it only carries `ctx`); this is a small signature widening of the per-event registration call at `event-router.ts:580-614`.
2. **event-router.ts factory entry:** between the `liveEpoch += 1` line and the existing hydrate step, call `shutdownInMemoryChildren()` then `for (const scope of SCOPES) { const loc = locationsFor(...); await reapOrphans(loc); }`. The `SCOPES` tuple and `locationsFor` are already imported.
3. **Architecture test:** pin `display: false` byte-equality on the `pi.sendMessage` argument; pin the `MARKER_ENV` byte value; pin the `deliverAs: ctx.isIdle() ? "nextTurn" : "followUp"` discriminator.

No blockers.

---
*Phase: 62-asyncrewake-registry-background-spawn*
*Plan: 02*
*Completed: 2026-06-15*
