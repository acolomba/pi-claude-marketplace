---
phase: 59-bridge-dispatch-core-debug-seam
fixed_at: 2026-06-14T20:30:00Z
review_path: .planning/phases/59-bridge-dispatch-core-debug-seam/59-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 3
skipped: 2
status: partial
---

# Phase 59: Code Review Fix Report

**Fixed at:** 2026-06-14T20:30:00Z
**Source review:** `.planning/phases/59-bridge-dispatch-core-debug-seam/59-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 5 (WR-01..WR-05; Info-tier excluded per `critical_warning` scope)
- Fixed: 3 (WR-02, WR-04, WR-05)
- Skipped: 2 (WR-01, WR-03) — both explicitly carried forward to Phase 60 by
  `59-VERIFICATION.md` ("Carry-Forward") and `59-SECURITY.md` ("Carry-Forward
  Code Review Concerns")

`npm run check` passes after the three fixes (typecheck + ESLint + Prettier +
node:test architecture/bridges/domain/edge/helpers/orchestrators/persistence/
platform/shared/transaction suites + integration tests all green).

## Fixed Issues

### WR-02: Hydrate path joins state-supplied slug onto hooksDir without containment check

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`
**Commit:** `50d1d50`
**Applied fix:**

- Added `assertPathInside` import from `../../shared/path-safety.ts`.
- `tryHydrateOnePlugin` now takes `hooksDir` as an additional parameter and
  calls `await assertPathInside(hooksDir, hooksJsonPath, "hooks.json hydrate
  path")` before `readFile`. Containment violations log via `hookDebugLog`
  and short-circuit the per-plugin hydrate (matching the existing parse-fail
  and read-fail soft-degrade pattern).
- `hydrateScopeFromState`'s call site passes `loc.hooksDir` to the helper.

Defense-in-depth (NFR-10): state.json is normally written only by this
extension, but the slug component (`pluginRecord.resources.hooks[i]`) is
state-supplied data. A corrupted state record (third-party tampering or
future schema mismatch) carrying a traversal slug like `"../../etc"` would
otherwise let the read escape `loc.hooksDir`. Mirrors the symmetric guard
at WRITE sites.

### WR-04: Architecture test `pi.on` count not hermetic — reads developer's real `$HOME`

**Files modified:** `tests/architecture/hooks-dispatch.test.ts`
**Commit:** `fe7fed8`
**Applied fix:**

- Added `mkdtemp`, `rm` to the `node:fs/promises` import and added `tmpdir`
  from `node:os`.
- Wrapped the DISP-01 test body in the `withHermeticEnv` pattern from
  `tests/edge/index-handler.test.ts`: save original `HOME` and
  `PI_CODING_AGENT_DIR`, redirect `HOME` to a tmp dir, delete
  `PI_CODING_AGENT_DIR`, run `registerHooksBridge` and the 7-handler
  assertions inside a `try`, then restore the original env and clean up
  the tmp dirs in `finally`.
- Replaced the prior `tests/fixtures/no-such-dir-for-hooks-dispatch`
  fixture cwd with a fresh `mkdtemp` cwd inside the hermetic block.

The 7-handler assertion does not depend on hydrate output today, so the
test passed either way before the fix; the change locks the hermetic
invariant for future assertions that may depend on hydrate.

### WR-05: `compositeHandlerFor`'s return-type narrowing leaks a union, not a per-event type

**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`
**Commit:** `6782ee2`
**Applied fix:**

- Introduced a generic `E extends Exclude<BucketAEvent, "PostToolUse" |
  "PostToolUseFailure">` on `compositeHandlerFor` so the literal flowed
  through `CompositeEventFor<E>` rather than getting widened to the full
  union.
- All six existing call sites in `event-router.ts` pass literal event
  names (`"SessionStart"`, `"SessionEnd"`, `"PreCompact"`, etc.) and the
  three test sites pass `"PreToolUse"` / `"SessionStart"` /
  `"UserPromptSubmit"` literals, so the generic narrows cleanly with no
  signature churn at the registration sites.

This is a type-narrowing quality defect; runtime correctness was unaffected
both before and after the fix.

## Skipped Issues

### WR-01: Factory-time project-scope hydrate uses `homedir()` as cwd; never cleared by deferred hydrate

**File:** `extensions/pi-claude-marketplace/index.ts:54` and
`extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:315-342`
**Reason:** Phase 60 follow-up — lifecycle semantics. Both
`59-VERIFICATION.md` ("Carry-Forward") and `59-SECURITY.md`
("Carry-Forward Code Review Concerns: WR-01 information disclosure /
phantom-entry risk") explicitly defer this to Phase 60 or a v1.13 cleanup
pass. The recommended remediation (skip the project arm at factory time
OR add a clear-project-cache prefix to `hydrateProjectScopeForCwd`)
changes hydrate lifecycle semantics that Phase 60 is best positioned to
own alongside the exec-layer fill.

**Original issue:** Factory-time `registerHooksBridge(pi, { ctx, cwd: homedir() })`
hydrates the project arm against `<homedir>/.pi/...` state. If that path
carries real state, phantom project-scope cache entries land in
`parsedConfigCache` keyed on `(scope, marketplace, pluginId)` without cwd
— `hydrateProjectScopeForCwd(event.cwd)` only ADDS, never CLEARS, so the
phantom entries survive into the routing-table rebuild.

### WR-03: Standalone install/uninstall mutate `parsedConfigCache` but never rebuild routing tables

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:940-947`
and `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:456`
**Reason:** Phase 60 follow-up — rebuild semantics tied to exec lifecycle.
Both `59-VERIFICATION.md` and `59-SECURITY.md` (T-59-03-WR-03) explicitly
classify this as a Phase 60 concern: the desync is masked today because
`dispatchHookExec` is a no-op stub (D-59-04), and the contract "rebuild
after cache mutation" is logically owned by the exec layer that fills the
stub. Adding `rebuildRoutingTables` calls in install.ts / uninstall.ts
right now would couple Phase 59 to a contract Phase 60 must own (and
SECURITY.md notes "Phase 60 must wire a rebuild call alongside the cache
mutators OR rely on reconcile's per-scope rebuild").

**Original issue:** Both orchestrators call
`addPluginConfigToCache` / `removePluginConfigFromCache` under the
per-scope lock to keep the cache in sync with state but neither calls
`rebuildRoutingTables`. For standalone `/claude:plugin install` or
`/claude:plugin uninstall` invocations not routed through
`applyReconcile`, the routing table stays stale until the next `/reload`
— after install, new handlers don't fire; after uninstall, stale handlers
keep firing on incoming Pi events.

---

_Fixed: 2026-06-14_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
