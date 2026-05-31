---
phase: 16-renderer-public-api-alongside-v1
verified: 2026-05-26T00:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 16: Renderer Public API Alongside V1 -- Verification Report

**Phase Goal:** The new `notify(ctx, NotificationMessage)` and `notifyUsageError(ctx, UsageErrorMessage)` entrypoints exist in `shared/notify.ts` next to the V1 severity-named wrappers, with full per-status unit coverage, and produce byte-equal output to the V1 callers when given equivalent payloads -- but no orchestrator call sites have migrated yet.

**Verified:** 2026-05-26
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (Success Criteria from ROADMAP)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `shared/notify.ts` exports `notify(ctx, pi, message)` and `notifyUsageError(ctx, message)` as the sole structured-payload entrypoints; both coexist with V1 wrappers | VERIFIED | `notify` exported at line 1034 with signature `notify(ctx: ExtensionContext, pi: ExtensionAPI, message: NotificationMessage): void`. `notifyUsageError` 2-arg overload at line 109 (V2 signature `(ctx, UsageErrorMessage): void`). V1 wrappers `notifySuccess` (L59), `notifyWarning` (L64), `notifyError` (L87), V1 3-arg `notifyUsageError` overload (L107) all still present and unchanged. Signature is the locked SNM-12 3-arg form (D-16-01). |
| 2 | `notify()` derives severity from contents (failed → error, skipped/manual recovery → warning, else success); emits reload-hint trailer iff state-changing plugin status OR state-changing marketplace status set; probes pi-subagents/pi-mcp-adapter at render time per declared `Dependency`; no caller-supplied severity, reload flag, or probe state | VERIFIED | `computeSeverity()` at L903 implements two-pass first-match ladder (D-16-11): pass 1 returns "error" on any failed plugin OR marketplace, pass 2 returns "warning" on any skipped/manual recovery, else undefined. `shouldEmitReloadHint()` at L931 implements D-16-12 trigger (state-changing plugin set OR state-changing marketplace status -- NOT failed). `softDepStatus(pi)` called exactly once at L1041 inside `notify()` and threaded into every `renderPluginRow` invocation via `composePluginLines`. `notify(ctx, pi, message)` takes no severity/reload/probe args from caller. **Note on criterion 2 wording:** ROADMAP success criterion 2 reads "iff state-changing plugin status OR any marketplace status set" but the implementation per D-16-12 trigger ladder correctly excludes `failed` marketplace (per SNM-15 refinement landed in plan 01). REQUIREMENTS.md SNM-15 has been updated to match implementation; the ROADMAP success-criterion phrasing has a known wording lag but the orchestrator note in the verification request explicitly flags this is the expected design. The implementation matches the refined SNM-15 and D-16-12, which is the binding contract. |
| 3 | `notify()`'s internal switch is the SOLE grammar-knowing site; `assertNever(...)` arm catches unhandled statuses at compile-time. `presentation/` composers are not re-exported from any barrel (only user-facing TYPES are public) | VERIFIED | `renderMpHeader` (L529) is file-private (no `export`) with `assertNever(mp.status)` default arm. `renderPluginRow` (L736) is file-private with `default: return assertNever(p);` exhaustiveness gate. Both are file-private functions consumed only within `shared/notify.ts` via `composeMarketplaceBlock` / `composePluginLines`. `extensions/pi-claude-marketplace/index.ts` exports only the default `claudeMarketplaceExtension(pi)` function -- no composer re-exports. `grep -rE "export.*renderMpHeader|export.*renderPluginRow|export.*composeReasons"` over `extensions/` returns 0 matches. |
| 4 | Per-status unit tests exist for every PluginNotificationMessage variant (10), every MarketplaceStatus value (4), plus empty `plugins: []`, single-plugin, multi-plugin, orphan-fold (`scope?` set), rollbackPartial, multi-cause cascades | VERIFIED | `tests/shared/notify-v2.test.ts` exists (1141 lines, 32 test cases). `node --test` reports 32/32 pass, 0 fail. Coverage: tests 1-10 cover all 10 PluginNotificationMessage variants (installed/updated/reinstalled/uninstalled/available/unavailable/upgradable/skipped/failed; manual recovery = test 30); tests 11-14 cover all 4 MarketplaceStatus values (added/removed/updated/failed); test 15 covers list-surface (`undefined`) SUB-BRANCH B; test 16 covers empty `plugins: []`; test 17 covers empty `marketplaces: []`; test 17a BLOCKER-3 coverage (empty-list-surface SUB-BRANCH A no-crash); test 18 single-plugin; test 19 multi-plugin caller-order preservation; test 20 multi-marketplace; test 21 orphan-fold PRESENT; test 21a orphan-fold ABSENT (BLOCKER-1 coverage); tests 22-23 rollbackPartial (no-cause + with-cause-chain); test 24 multi-cause cascade; tests 25-27 severity ladder; test 28 reload-hint suppression; test 29 notifyUsageError; test 30 manual recovery with cause. |
| 5 | Catalog UAT (`tests/architecture/catalog-uat.test.ts`) still passes byte-equality against V1 callsites unchanged; `npm run check` stays GREEN | VERIFIED | `npm run check` passes: typecheck + ESLint + Prettier + 1359 tests across 90 suites all GREEN. `tests/architecture/catalog-uat.test.ts` last touched 575bba4 (Phase 13); `git diff HEAD~6..HEAD --stat tests/architecture/catalog-uat.test.ts` shows zero changes through this phase. V1 callers in `orchestrators/marketplace/list.ts`, `orchestrators/marketplace/autoupdate.ts`, etc. still consume V1 wrappers (`notifySuccess`, `notifyWarning`, `notifyError`) -- no orchestrator migration to `notify()` has occurred (matches the phase goal's "but no orchestrator call sites have migrated yet" stipulation). |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `extensions/pi-claude-marketplace/shared/notify.ts` | V2 `notify(ctx, pi, message)` + V2 `notifyUsageError(ctx, UsageErrorMessage)` + V1 wrappers (coexist) + file-private renderMpHeader/renderPluginRow/composition helpers + RELOAD_HINT_TRAILER literal + computeSeverity + shouldEmitReloadHint | VERIFIED | 1065 lines. Public exports: `notifySuccess`, `notifyWarning`, `notifyError`, `notifyUsageError` (V1 3-arg overload + V2 2-arg overload sharing one impl body that dispatches on `typeof message === "string"`), `notify` (line 1034). File-private helpers: `renderMpHeader` (L529), `renderPluginRow` (L736), `computeSeverity` (L903), `shouldEmitReloadHint` (L931), `renderIndentedCauseChain` (L960), `composeRollbackPartialLines` (L976), `composePluginLines` (L999), `composeMarketplaceBlock` (L1019), supporting helpers `joinTokens`/`renderVersion`/`renderScopeBracket`/`composeVersionArrow`/`composeReasons`. File-private constants: `RELOAD_HINT_TRAILER` (L900), `ICON_INSTALLED`/`ICON_AVAILABLE`/`ICON_UNINSTALLABLE` (L501-503), `SOFT_DEP_MARKER_AGENTS`/`SOFT_DEP_MARKER_MCP` (L586-587). |
| `tests/shared/notify-v2.test.ts` | Per-status unit suite ≥22 cases covering 10 plugin variants + 4 marketplace statuses + cross-cutting cases + BLOCKER-coverage tests | VERIFIED | 1141 lines, 32 test cases, 100% passing. Mini-spec header lines 1-118 anchored as the de facto v2 grammar spec per D-16-04 authority resolution. Imports `notify`, `notifyUsageError`, type aliases from `../../extensions/pi-claude-marketplace/shared/notify.ts`. Mock-ctx and mock-pi (4 factory helpers: `piWithBothLoaded`/`piWithSubagentsLoaded`/`piWithMcpLoaded`/`piWithNothingLoaded`) pattern reused verbatim from V1 idiom. No imports from `presentation/*` (D-11 layering preserved). No imports from `docs/output-catalog.md` (D-16-18 honored). |
| `.planning/REQUIREMENTS.md` | SNM-12 row updated to 3-arg signature; SNM-15 row updated to state-changing-only marketplace trigger | VERIFIED | Plan 01 commit `de6a193` updated SNM-12 row at line 30 to `notify(ctx: ExtensionContext, pi: ExtensionAPI, message: NotificationMessage): void` with SNM-16 cross-reference for `pi` argument rationale. SNM-15 row at line 33 now reads `any state-changing marketplace status (added, removed, updated -- not failed)` with rationale appended. |
| `docs/adr/v2-001-structured-notify.md` | Decision-section signature snippet aligned with 3-arg form | VERIFIED | Line 27 snippet updated to `export function notify(ctx: ExtensionContext, pi: ExtensionAPI, message: NotificationMessage): void;` matching SNM-12. ADR Status (`Accepted`), Alternatives, and Phase 15 cross-references unchanged. |
| `extensions/pi-claude-marketplace/index.ts` (barrel) | Only types public; no composers re-exported | VERIFIED | Default export is `claudeMarketplaceExtension(pi: ExtensionAPI)`. Imports only from `edge/register.ts`, `orchestrators/discover.ts`, `orchestrators/marketplace/shared.ts`, `orchestrators/plugin/update.ts`, `persistence/locations.ts`. No re-exports from `shared/notify.ts` and no re-exports from `presentation/*`. The user-facing TYPES (NotificationMessage, etc.) are exported directly from `shared/notify.ts` per Phase 15 design and consumed by importers via direct import -- SNM-18 model. |
| `eslint.config.js` | MSG-Block 4a + 5 ignore lists extended to cover shared/notify.ts as V2 chokepoint | VERIFIED | Extended in plan 04 (MSG-Block 5 ignores for SOFT_DEP_MARKER_* literals) and plan 05 (MSG-Block 4a ignores for RELOAD_HINT_TRAILER literal). Both bounded by Phase 21 teardown per the documented exemption rationale. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `shared/notify.ts notify()` | `platform/pi-api.ts softDepStatus(pi)` | `const probe = softDepStatus(pi)` at L1041 | WIRED | Single probe per invocation per D-16-14; runtime value import added on line 1. |
| `shared/notify.ts notify()` | `shared/notify.ts renderMpHeader` (plan 03) + `renderPluginRow` (plan 04) | Direct call inside `composeMarketplaceBlock` (L1019-1032) and `composePluginLines` (L999-1017) | WIRED | `notify` → `composeMarketplaceBlock` → `renderMpHeader(mp)` and `composePluginLines` → `renderPluginRow(p, probe)`. Probe threaded end-to-end (SNM-16). |
| `shared/notify.ts notify()` reload-hint composer | `RELOAD_HINT_TRAILER` literal | `${body}\n\n${hint}` append at L1054 | WIRED | Trigger gated by `shouldEmitReloadHint(message)`; literal at L900 duplicated inline per D-16-04. |
| `shared/notify.ts notify()` severity dispatcher | `ctx.ui.notify` Pi API surface | `ctx.ui.notify(withHint, severity)` at L1063 / `ctx.ui.notify(withHint)` at L1061 | WIRED | Magic-string second-arg convention (`"warning"` / `"error"`) per V1 precedent; info omits 2nd arg. |
| `shared/notify.ts renderPluginRow` | `composeReasons` → soft-dep marker injection | `composeReasons(reasons, declaresAgents, declaresMcp, probe)` per-arm | WIRED | 5 reasons-less arms pass `undefined`; 5 reasons-bearing arms pass `p.reasons`. BLOCKER-2 fix: TS strict structurally enforces variant-correct field access. |
| `shared/notify.ts renderPluginRow` | `renderScopeBracket` (SOLE `[scope]` emitter) | All scope-bracket emissions flow through `renderScopeBracket(p.scope)` | WIRED | BLOCKER-1 fix: prevents `[undefined]` runtime hazard. `available`/`unavailable` arms pass `undefined` explicitly per MSG-PL-6 carve-out. |
| `shared/notify.ts renderMpHeader case undefined:` | SUB-BRANCH A bare-header path | `if (mp.details === undefined) return ...` early-return guard | WIRED | BLOCKER-3 fix: TS narrows `mp.details` before SUB-BRANCH B reads `mp.details.autoupdate` / `mp.details.lastUpdatedAt`. Test 17a in notify-v2.test.ts wraps the call in `assert.doesNotThrow` to lock against regression. |
| `tests/shared/notify-v2.test.ts` | `shared/notify.ts notify + notifyUsageError exports` | Named import `from "../../extensions/pi-claude-marketplace/shared/notify.ts"` | WIRED | 32/32 tests exercise both entry points; mock-ctx (V1 idiom) + mock-pi (4 factories) drive the public API. |

### Data-Flow Trace (Level 4)

This phase produces a library API (`notify`/`notifyUsageError`) with no dynamic UI data fetch -- the data flows from the caller-supplied `NotificationMessage` payload through pure-string composition helpers into `ctx.ui.notify(body, severity?)`. Level 4 trace confirms:

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `notify()` body | `body` string | `message.marketplaces.map(composeMarketplaceBlock)` joined with `\n\n` or `(no marketplaces)` sentinel | Yes -- exercised by 32 unit tests with concrete payloads | FLOWING |
| `notify()` severity | `severity` | `computeSeverity(message)` walks `message.marketplaces[][].plugins[]` | Yes -- tests 25-27 verify all 3 tiers with exact-byte severity-arg assertions | FLOWING |
| `notify()` reload-hint | `hint` | `shouldEmitReloadHint(message) ? RELOAD_HINT_TRAILER : ""` | Yes -- tests 1-5/11-13/16/18-21a/24 verify positive trigger; tests 9/14/22/23/28 verify negative suppression | FLOWING |
| `notifyUsageError()` body | `${message.message}\n\n${message.usage}` | Direct destructure of `UsageErrorMessage` payload | Yes -- test 29 asserts exact byte string with `"error"` severity | FLOWING |
| Soft-dep markers | `composeReasons` output | Per-row `dependencies?` × threaded `SoftDepStatus` probe | Yes -- tests 2-4 verify marker emission/suppression based on probe state | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| V2 notify-v2 test suite runs | `npx node --test tests/shared/notify-v2.test.ts` | 32 pass, 0 fail (duration ~1.7s) | PASS |
| Full project check is GREEN | `npm run check` | 1359 tests across 90 suites, 0 fail, typecheck + ESLint + Prettier all pass (duration ~23s) | PASS |
| V1 notify test suite still passes | (included in `npm run check`) | All pre-existing tests in `tests/shared/notify.test.ts` (7 tests) pass unchanged | PASS |
| V1 catalog UAT still passes | (included in `npm run check`) | `tests/architecture/catalog-uat.test.ts` passes unchanged; V1 callers byte-equal | PASS |
| V1 byte-equality of notifyUsageError | Plan 02 runtime check recorded in 16-02-SUMMARY | `V1 args === V2 args` (`["bad argv\n\nUsage: ...", "error"]`); byte-equal: true | PASS |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` probes were declared or implied for this phase. The phase explicitly uses `npm run check` + targeted `node --test` invocations as its verification gates. Both pass GREEN.

| Probe | Command | Result | Status |
|---|---|---|---|
| (n/a -- no probes declared) | -- | -- | SKIPPED |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| SNM-12 | 16-01 (editorial), 16-05 (impl) | `notify(ctx, pi, message)` signature exported from `shared/notify.ts` | SATISFIED | Public `notify` at L1034 with exact locked 3-arg signature; REQUIREMENTS.md row updated to match (plan 01). |
| SNM-13 | 16-02 | `notifyUsageError(ctx, UsageErrorMessage)` V2 entrypoint exported | SATISFIED | V2 overload at L109; combined impl at L110-131 dispatches on `typeof message`; byte-equal to V1 confirmed at runtime. |
| SNM-14 | 16-05 | Severity ladder computed from contents (failed → error; skipped/manual recovery → warning; else success) | SATISFIED | `computeSeverity` at L903 implements two-pass first-match ladder per D-16-11. Tests 25-27 lock the 3 tiers + first-match invariant. |
| SNM-15 | 16-01 (editorial), 16-05 (impl) | Reload-hint trailer emitted on state-changing plugin status OR state-changing marketplace status (added/removed/updated; NOT failed) | SATISFIED | `shouldEmitReloadHint` at L931 implements the D-16-12 trigger ladder. Tests 1-5/11-13/16/18-21a/24 (positive) and 9/14/22/23/28 (negative including failed-marketplace suppression). |
| SNM-16 | 16-04, 16-05 | Render-time soft-dep probe via `softDepStatus(pi)`; per-row markers `{requires pi-subagents}` / `{requires pi-mcp}` | SATISFIED | `softDepStatus(pi)` called once at L1041; threaded into every `renderPluginRow(p, probe)` via `composePluginLines`. `composeReasons` (plan 04) injects markers per declared dep × probe state. Tests 2-4 verify. |
| SNM-17 | 16-03, 16-04 | File-private switch over plugin/marketplace status is the SOLE grammar-knowing site; `assertNever` exhaustiveness | SATISFIED | `renderMpHeader` (5-arm switch, `assertNever(mp.status)` default) and `renderPluginRow` (10-arm switch, `default: return assertNever(p);`) are file-private (no `export`). Adding a new variant becomes a compile error. |
| SNM-18 | 16-03, 16-04 | `presentation/` composers become module-internal helpers; barrel exports user-facing TYPES only, not string-producing composers | SATISFIED | All Phase 16 v2 helpers (`renderMpHeader`, `renderPluginRow`, `composeReasons`, `renderScopeBracket`, etc.) are file-private inside `shared/notify.ts`. `extensions/pi-claude-marketplace/index.ts` re-exports nothing from `shared/notify.ts` or `presentation/*`. Phase 15-shipped type re-exports (NotificationMessage, etc.) remain in `shared/notify.ts` for direct-import consumption. Phase 21 will delete the `presentation/*` composers entirely. |
| SNM-30 | 16-06 | Per-status unit tests on `notify()` switch covering every PluginNotificationMessage variant + every MarketplaceStatus value + cross-cutting cases | SATISFIED | `tests/shared/notify-v2.test.ts` (1141 lines, 32 passing tests). Covers all 10 plugin variants + 4 marketplace statuses + list-surface SUB-BRANCH A/B + orphan-fold present/absent + rollbackPartial + multi-cause cascade + multi-marketplace + empty payloads + severity tiers + reload-hint trigger/suppression + notifyUsageError. |

### Anti-Patterns Found

No blocker-class anti-patterns. The file uses bounded-duplication of grammar literals (icon glyphs, soft-dep markers, reload-hint trailer) per D-16-04, with ESLint chokepoint exemptions documented and bounded by Phase 21 teardown. No `TBD`/`FIXME`/`XXX` debt markers introduced in Phase 16 commits. No `presentation/*` imports added (D-11 layering preserved end-to-end).

Two `TODO` debt-marker-adjacent strings appear in summaries (recording deferred work in Phase 17/18/21) but no `TBD`/`FIXME`/`XXX` were introduced in the modified source files.

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| (none) | -- | -- | -- | -- |

### Human Verification Required

None. The phase produced library code (entrypoints + unit tests). Every observable truth is verified programmatically:
- 32/32 unit tests passing exercise exact-byte assertions on `ctx.ui.notify` arguments via `assert.deepEqual`.
- `npm run check` GREEN across typecheck + ESLint + Prettier + 1359 tests.
- V1 byte-equality verified at runtime in plan 02 (notifyUsageError) and structurally preserved for severity wrappers (V1 wrappers untouched per `git diff`).
- Orchestrator-call-site-NOT-migrated invariant verified via `grep` (V1 `notifySuccess`/`notifyError` still in `orchestrators/marketplace/list.ts`, `orchestrators/marketplace/autoupdate.ts`).

No visual/UX/external-service component requires human testing in this phase. Phase 18-20 will migrate orchestrator call sites and may surface UX-related human-verify items at that point; Phase 17 will lift the mini-spec into `docs/output-catalog.md` v2.0.

### Gaps Summary

No gaps. All 5 ROADMAP success criteria are satisfied with code evidence; all 8 phase REQ-IDs (SNM-12, SNM-13, SNM-14, SNM-15, SNM-16, SNM-17, SNM-18, SNM-30) have implementation + test coverage; all file-private helpers are wired into the public `notify()` orchestration; V1 surface is preserved byte-equal; the catalog UAT and V1 unit suite remain GREEN.

**Note on criterion 2 wording lag:** The ROADMAP success criterion 2 phrasing ("any marketplace status set") describes an earlier draft of SNM-15. Plan 01 (commit `de6a193`) updated REQUIREMENTS.md SNM-15 to the refined "state-changing marketplace status (added, removed, updated -- not failed)" wording per D-16-12, and the implementation in plan 05 matches that refined contract. The ROADMAP wording is the design lag, not an implementation gap; the orchestrator's verification request explicitly flagged this discrepancy and asked the verifier to check both alignment with implementation and whether the criterion needs an update. The recommendation is to update ROADMAP success criterion 2 to match REQUIREMENTS.md SNM-15's refined wording in a separate editorial pass; this is NOT a phase-16 gap because the binding contract (REQUIREMENTS.md SNM-15) and the implementation are aligned.

---

*Verified: 2026-05-26*
*Verifier: Claude (gsd-verifier)*
