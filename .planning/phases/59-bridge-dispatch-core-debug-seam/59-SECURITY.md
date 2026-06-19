---
phase: 59
slug: bridge-dispatch-core-debug-seam
status: secured
threats_open: 0
threats_total: 17
threats_mitigated: 10
threats_accepted: 7
asvs_level: 1
block_on: high
created: 2026-06-14
audited: 2026-06-14
---

# Phase 59 Security Audit — Bridge Dispatch Core + Debug Seam

**Phase:** 59 — bridge-dispatch-core-debug-seam
**Audit Date:** 2026-06-14
**ASVS Level:** 1
**Block On:** high
**Threats Closed:** 17/17 (10 `mitigate` verified present in code; 7 `accept` documented)
**Verdict:** SECURED

This report verifies each declared threat in the three plan-time threat
registers (59-01, 59-02, 59-03) by its declared disposition. Mitigations
were checked against the implemented code; accepted risks were checked
against documented disposition in plan/SUMMARY. Implementation files were
not modified.

## Threat Verification — Plan 59-01 (debug-log seam)

| Threat ID    | Category               | Disposition | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------ | ---------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-59-01-01   | Information Disclosure | mitigate    | CLOSED. `extensions/pi-claude-marketplace/shared/debug-log.ts:21` carries the exact-equal gate `if (process.env.PI_CLAUDE_MARKETPLACE_DEBUG === "1")`. `tests/shared/debug-log.test.ts:77` locks the gate with the full fuzzy-truthy fixture array `["0", "true", "", "yes", "ON", "01", " 1 "]`; each fixture asserts zero `console.error` calls. Architecture test Block 6 (hooks-dispatch.test.ts:465) pins that `console.error` appears ONLY in `shared/debug-log.ts` across the entire extension tree. |
| T-59-01-02   | Tampering              | mitigate    | CLOSED. `eslint.config.js:154` carries the single-literal files glob `"extensions/pi-claude-marketplace/shared/debug-log.ts"` with `no-restricted-syntax: off` + `no-console: off`. Architecture test Block 6 (hooks-dispatch.test.ts:490–554) parses `eslint.config.js`, asserts symmetric set equality between the no-console allowance set and the locked 3-entry set `{notify.ts, debug-log.ts, migrate.ts}`. Any widening or narrowing red-fails CI.                                                              |
| T-59-01-03   | Repudiation            | accept      | Documented in 59-01-PLAN.md threat register; operator-opt-in via env var; no audit trail expected for debug-mode operator who already has FS access.                                                                                                                                                                                                                                                                                                                              |
| T-59-01-SC   | Tampering (supply)     | accept      | Documented; no new package dependencies introduced. `package.json` not modified by Plan 59-01.                                                                                                                                                                                                                                                                                                                                                                                  |

## Threat Verification — Plan 59-02 (dispatch core)

| Threat ID    | Category                | Disposition | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------ | ----------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-59-02-01   | Tampering               | mitigate    | CLOSED. `bridges/hooks/event-router.ts:112–114` declares `cacheKey(scope, marketplace, pluginId)` returning the exact format `` `${scope}\x00${marketplace}\x00${pluginId}` ``. All three call sites (lines 130, 147, 229) flow through this helper. Unit test "cache: key includes marketplace -- same (scope, pluginId) under different marketplaces do NOT collide" (`tests/bridges/hooks/event-router.test.ts:140`) red-fails if marketplace is dropped from the key.                                                       |
| T-59-02-02   | Denial of Service       | mitigate    | CLOSED. `rebuildRoutingTables` in `event-router.ts:183–203` is synchronous and walks the in-memory cache + state Map exclusively. Unit test "rebuildRoutingTables: zero disk I/O on the hot path" (`tests/bridges/hooks/event-router.test.ts:275`) wraps `fs.promises.readFile` via `t.mock.method` to throw on call, then asserts `rebuildRoutingTables` does not throw. Pinned structurally.                                                                                                                                            |
| T-59-02-03   | Repudiation             | mitigate    | CLOSED. `event-router.ts:96` declares `let liveEpoch = 0`; `registerHooksBridge` bumps at line 468 (`liveEpoch += 1`) and captures into `capturedEpoch` (line 469). `dispatch.ts:124–126` and `dispatch.ts:154–156` short-circuit on `capturedEpoch !== currentEpoch()`. Unit test "compositeHandlerFor: epoch mismatch causes no-op without invoking dispatchHookExec" (`event-router.test.ts:424`) and "toolResultCompositeHandler: epoch mismatch causes no-op" (line 511) pin the contract. Architecture test Block 4 (DISP-03) re-pins it. |
| T-59-02-04   | Information Disclosure  | mitigate    | CLOSED. `event-router.ts:46` imports `hookDebugLog`. Hydrate-time failure arms route through `hookDebugLog` exclusively: line 331 (loadState failure), line 384 (read failure per plugin), line 391 (parse failure per plugin), line 439 (project-scope deferred hydrate loadState failure). No `ctx.ui.notify`, no `console.*`, no `process.stdout` calls anywhere in the file. ESLint BLOCK A enforces this globally for bridges/.                                                                  |
| T-59-02-05   | Elevation of Privilege  | mitigate    | CLOSED. `dispatch.ts:79–91` (`matcherFiresOnToolEvent`) switches on the pre-parsed `ParsedMatcher.kind` discriminated union; the `regex` and `unmapped` arms return `false` defensively (parser already gates them at parse time per TOOL-02 / Phase 58). `dispatch.ts:205–227` (`entryFires`) uses an exhaustive switch on the `Exclude<BucketAEvent, "PostToolUse" | "PostToolUseFailure">` union — TypeScript exhaustiveness catches future BucketAEvent additions at compile time.                                                  |
| T-59-02-06   | Tampering               | mitigate    | CLOSED. `event-router.ts:236–241` calls `collected.sort((a,b) => compareByNameThenScope(...))`. `event-router.ts:256, 280` keep the monotonic `declarationIndex` counter across the (event, group, handler) flatten. `dispatch.ts:133–139` and 164–170 use explicit `for (const entry of bucket) { ... await activeExecutor(entry, event, ctx); }` — no `Promise.all`. Unit tests "cross-plugin order" (`event-router.test.ts:167`), "within-plugin declaration order" (line 204), and "dispatch is sequential awaited (NOT Promise.all)" (line 544) pin all three contracts; the last test uses start/end markers and a delayed mock executor to prove serial execution. |
| T-59-02-SC   | Tampering (supply)      | accept      | Documented; no new package dependencies introduced.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## Threat Verification — Plan 59-03 (lifecycle wiring)

| Threat ID    | Category                | Disposition | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------ | ----------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-59-03-01   | Tampering               | mitigate    | CLOSED. `orchestrators/reconcile/apply.ts:888–899` defines `rebuildScopeRoutingTable` that calls `withLockedStateTransaction(loc, async (tx) => { rebuildRoutingTables(tx.state, loc); /* NO tx.save() */ })`. The explicit `// NO tx.save() -- read-only snapshot acquisition.` comment at line 896 documents the contract. Verified by grep: `withLockedStateTransaction` appears at lines 138 and 894; only the line-138 call (the apply path) calls `tx.save()` elsewhere — the line-894 call does not. Read-only contract preserved.                  |
| T-59-03-02   | Tampering               | accept      | Documented; bounded leak per D-59-02 (next `/reload` resets cache via factory-time hydrate). 59-03-SUMMARY.md "Decisions Made" section documents the trade-off; in-line comment at `install.ts:931–938` cites D-59-02 and the bounded-leak rationale.                                                                                                                                                                                                                                                                                              |
| T-59-03-03   | Information Disclosure  | accept      | Documented; architecture test reads local repo .ts files only via `node:fs/promises` (`tests/architecture/hooks-dispatch.test.ts:171–192` `collectExtensionTsFiles` walker). No network calls; `node_modules`, `dist`, `build` excluded.                                                                                                                                                                                                                                                                                                          |
| T-59-03-04   | Repudiation             | mitigate    | CLOSED. Architecture test Block 1 (DISP-01) at `tests/architecture/hooks-dispatch.test.ts:199–234` asserts `piMock.calls.length === 7` AND symmetric set equality against the locked event-name set `{session_start, session_shutdown, session_before_compact, session_compact, input, tool_call, tool_result}`. Any drift (count or name) red-fails immediately.                                                                                                                                                                              |
| T-59-03-05   | Denial of Service       | accept      | Documented; brief read-only lock acquisition. A pathological lock-held race surfaces as the existing WR-01 `invalid-block` outcome via `rebuildScopeRoutingTableIsolated` (`apply.ts:908–925`) — no new failure mode introduced.                                                                                                                                                                                                                                                                                                                       |
| T-59-03-06   | Elevation of Privilege  | mitigate    | CLOSED. `bridges/hooks/index.ts:13–21` only re-exports `addPluginConfigToCache, hydrateProjectScopeForCwd, registerHooksBridge, rebuildRoutingTables, removePluginConfigFromCache` (value) and `RoutingEntry` (type). Grep for `_routingTableForTest\|_bumpEpochForTest\|_setRoutingBucketForTest\|_resetForTest\|_parsedConfigCacheForTest\|_setExecutorForTest\|_resetExecutorForTest` against `index.ts` returns zero hits — test-only inspectors are bridge-internal and not part of the public surface. Tests import directly from `event-router.ts` / `dispatch.ts`. |
| T-59-03-SC   | Tampering (supply)      | accept      | Documented; no new package dependencies introduced.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## Accepted Risks Log

| Risk ID      | Description                                                                                                                                                                                                                                       | Acceptance Rationale                                                                                                                                                                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-59-01-03   | `hookDebugLog` writes to `console.error` with no audit trail; absolute paths are not redacted at this seam.                                                                                                                                       | Debug channel is operator-opt-in via `PI_CLAUDE_MARKETPLACE_DEBUG=1`. Debug-mode operator already has filesystem access; NFR-9 path redaction is not enforced at this seam (matches Phase 57/58 baseline). Documented in 59-01-PLAN.md threat register.                                                                                          |
| T-59-01-SC   | No new package dependencies (Plan 59-01).                                                                                                                                                                                                         | Slopcheck baseline carries over from v1.12; no `[ASSUMED]`/`[SUS]` tokens emitted.                                                                                                                                                                                                              |
| T-59-02-SC   | No new package dependencies (Plan 59-02).                                                                                                                                                                                                         | Slopcheck baseline carries over.                                                                                                                                                                                                                                                                |
| T-59-03-02   | install.ts cache-add after partial failure leaves a bridge-internal cache entry without a corresponding state record if the closure throws between `installCtx = result.installCtx` and `tx.save()`.                                              | Cache is in-memory and bounded — next `/reload` resets via factory-time hydrate (D-59-02). Bounded leak documented in `install.ts:931–938`.                                                                                                                                                                  |
| T-59-03-03   | Architecture test import-graph scan reads local repo .ts files.                                                                                                                                                                                   | Local-only file reads, no network. NFR-9 absolute-path redaction is not required at the test layer.                                                                                                                                                                                            |
| T-59-03-05   | Brief read-only state-lock acquisition in `rebuildScopeRoutingTable`.                                                                                                                                                                              | Sub-ms lock-held grace; pathological races surface via existing WR-01 `invalid-block` outcome.                                                                                                                                                                                                  |
| T-59-03-SC   | No new package dependencies (Plan 59-03).                                                                                                                                                                                                         | Slopcheck baseline carries over.                                                                                                                                                                                                                                                                |

## Unregistered Flags

None. SUMMARY.md `## Threat Flags` sections for 59-02 and 59-03 both state
"None" with the rationale that surfaces introduced (factory-time loadState
read, async-factory contract, deferred project hydrate, per-scope rebuild,
cache add/remove) are interior bridge mutations already covered by the
plan-time threat registers (e.g. T-59-02-04 for hydrate parse-failure
emission).

## Carry-Forward Code Review Concerns (security-relevant)

The Phase 59 code review (`59-REVIEW.md`) identified 5 warnings; the
following are noted for their security implications but do NOT invalidate
any Phase 59 must_have and are non-blocking for this phase. They are
listed verbatim from `59-VERIFICATION.md` "Carry-Forward" and the SUMMARY
audit findings.

- **WR-01 (information disclosure / phantom-entry risk)**: factory-time
  project-scope hydrate at `index.ts:54` passes `homedir()` as `cwd` —
  if `~/.pi/...` carries real state, project-scope cache could phantom-load
  user-scope entries. Bounded because the rebuild's per-scope state walk
  would normally skip absent records, and the deferred `hydrateProjectScopeForCwd`
  on first `resources_discover` re-hydrates with the correct cwd.
  Recommend a 5-line skip of the project arm at factory time OR a
  clear-project-cache prefix in `hydrateProjectScopeForCwd`.

- **WR-03 (cache/routing-table desync)**: standalone install/uninstall
  mutate the cache (`install.ts:941`, `uninstall.ts:456`) but never
  rebuild routing tables in-band. Masked while `dispatchHookExec` is a
  stub (D-59-04). The desync surfaces only after the Phase 60 execution
  layer fills the stub. Phase 60 must wire a rebuild call alongside the
  cache mutators OR rely on reconcile's per-scope rebuild.

- **Reinstall/Update audit gap (T-59-03-02 expansion)**: `reinstall.ts`
  and `update.ts` do NOT route through `installPlugin`/`uninstallPlugin`
  (audit in 59-03-SUMMARY.md "Reinstall/Update Audit Findings"). Cache
  add/remove does NOT flow through those orchestrators today, so a
  reinstall/update leaves the cache stale until the next reconcile pass.
  Acceptable disposition per Plan 03's done-state ("(or document the gap
  if not)"); follow-up plan should wire the cache mutators into
  reinstall.ts + update.ts directly to close the bounded gap.

These items are tracked in `59-REVIEW.md` and `59-VERIFICATION.md`
"Carry-Forward (from 59-REVIEW.md)" — no new findings introduced by this
audit.

---

*Phase: 59-bridge-dispatch-core-debug-seam*
*Audit completed: 2026-06-14*
