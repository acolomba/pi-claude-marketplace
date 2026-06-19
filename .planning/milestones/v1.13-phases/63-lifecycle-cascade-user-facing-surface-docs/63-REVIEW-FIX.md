---
phase: 63-lifecycle-cascade-user-facing-surface-docs
fixed_at: 2026-06-16T23:30:00Z
review_path: .planning/phases/63-lifecycle-cascade-user-facing-surface-docs/63-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 4
skipped: 1
status: partial
---

# Phase 63: Code Review Fix Report

**Fixed at:** 2026-06-16T23:30:00Z
**Source review:** .planning/phases/63-lifecycle-cascade-user-facing-surface-docs/63-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 5 (warnings WR-01 through WR-05; 0 critical, 4 info out of scope)
- Fixed: 4
- Skipped: 1

## Fixed Issues

### WR-01: `update.ts` hooks phase: post-failure leak when removeHookConfig throws

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`
**Commit:** 0b65461
**Applied fix:** Adopted the documentation alternative (option (a) from the review). Extended the cascade-slot comment at the hooks phase to spell out the recovery contract explicitly: when `removeHookConfig` throws partway through (EACCES, EIO), the `failedPhases.has("hooks")` finalize guard correctly preserves the OLD inventory slug, but the dispatcher's routing table on `/reload` will point at the partially-deleted file until the user runs `reinstall`. The `RECOVERY_PLUGIN_REINSTALL_PREFIX` hint from the phase-3b path covers this case; the comment now states the contract so future readers don't have to reconstruct it. Atomic-or-noop removal (option (b)) and phase reordering (option (c)) were rejected as too invasive for a non-correctness-blocking hazard.

### WR-02: `install.ts` cache+routing mutation runs INSIDE the lock closure AFTER tx.save()

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`
**Commit:** 58fe02e
**Applied fix:** Wrapped the post-`tx.save()` `addInstalledPluginHooksToCache` + `rebuildRoutingTables` arm in a defensive try/catch that routes failures through `hookDebugLog` only. This prevents a closure-throw after the save from escaping to the outer catch in `installPlugin`, where it would surface as a `(failed)` notification while state.json on disk recorded the install as successful. The cache will be rebuilt from state.json on the next `/reload`'s factory-time hydrate (D-59-03), matching the non-fatal discipline that `addInstalledPluginHooksToCache` already uses for its own internal read+parse arms.

### WR-03: `reinstall.ts` same cache-after-save hazard

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`
**Commit:** 16baa8e
**Applied fix:** Mirrored the WR-02 install.ts fix. Wrapped the post-`tx.save()` `removePluginConfigFromCache` + `readAndCacheReinstalledPluginHooks` + `rebuildRoutingTables` arm in a defensive try/catch that routes failures through `hookDebugLog` only. Without it, a throw from any of those calls would hit the outer catch and route through `errorWithManualRecovery`, surfacing as a `(manual recovery)` row while state.json on disk has already persisted the new record.

### WR-05: `reinstall.ts::commitHooks` defensively cleans up stale subtree without recording the cleanup

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`
**Commit:** 7fcde73
**Applied fix:** Adopted the documentation alternative. Extended the comment at the hooks cascade slot in `applyReplacements` to spell out the hooks-removed-then-later-step-failed window as a known manual-recovery case: the hooks file is intentionally NOT pushed onto `replacements[]`, so a later-step throw cannot restore it via the rollback loop. The throw routes through `errorWithManualRecovery`, and the manual-recovery hint directs the user to re-run `reinstall`, which re-resolves version B (no hooks) and persists the truthful state. The sentinel-handle alternative was rejected as too invasive for a non-correctness-blocking hazard.

## Skipped Issues

### WR-04: `resolver.ts::readStandaloneHooks` uses `process.cwd()` as projectRoot fallback

**File:** `extensions/pi-claude-marketplace/domain/resolver.ts:697`
**Reason:** The reviewer's fix requires threading `ExtensionContext.cwd` (or a `homedir`/`cwd`/`projectRoot` struct) through `ResolveContext` so the resolver has a real anchor at every call site. This is an architectural change to `ResolveContext` — a domain-layer struct consumed across the resolver, info, install, update, reinstall, and reconcile surfaces — and the change touches both `domain/resolver.ts::readStandaloneHooks` AND `orchestrators/plugin/info.ts::readHookSummaryEntries` (the same `process.cwd()` fallback pattern). The current code is correct today: the `skipIfMap: true` short-circuit makes the `ctx` fields effectively unused, and the existing comment block (resolver.ts:686-697; info.ts:255-260) acknowledges the trade-off and explains the safety argument. The fix is future-proofing against a hypothetical edit to `parseHooksConfig` that would consume the context fields BEFORE the `skipIfMap` short-circuit — a fragility concern, not a current bug. Given the surgical-change discipline (CLAUDE.md §3) and the architectural scope of the proposed change, the fix is deferred to a future phase that can audit `ResolveContext`'s call sites holistically.
**Original issue:** The resolver's `readStandaloneHooks` falls back to `process.cwd()` for the `cwd` / `projectRoot` slots of the `CompileIfPredicateContext`. Correct today (because `skipIfMap: true` short-circuits predicate compilation), but the contract is fragile: if a future edit to `parseHooksConfig` ever consumes the `ctx` fields BEFORE the short-circuit, the resolver will silently use the wrong project root. The `info.ts` mirror at lines 260-262 has the same pattern with the same fragility.

---

_Fixed: 2026-06-16T23:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
