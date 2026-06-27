---
phase: 65-force-install-update
verified: 2026-06-27T00:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 65: Force Install & Update Verification Report

**Phase Goal:** `install --force` / `update --force` degrades unsupported components instead of blocking, while hard failures still block regardless of `--force`, and no force path emits a `Warning:` summary.
**Verified:** 2026-06-27
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `install --force` on an `unsupported` plugin installs supported components and skips unsupported ones | VERIFIED | Gate selects `requireForceInstallable` at `install.ts:496`; materialize path unchanged; FORCE-01 degrade test passes (86/86) |
| 2 | `--force` on a fully-supported plugin is a no-op — installs as `(installed)` | VERIFIED | `requireForceInstallable` admits the `installable` arm unchanged; FORCE-01 no-op test asserts `(installed)` row and empty `compatibility.unsupported` |
| 3 | `update --force` on a plugin whose candidate became `unsupported` degrades instead of failing | VERIFIED | Gate at candidate resolve `update.ts:742` selects `requireForceInstallable(resolved, "update")`; FORCE-02 test passes (68/68), `record.version` bumped to 1.1.0, skill materialized |
| 4 | Without `--force`, install/update of an `unsupported` plugin still blocks | VERIFIED | `else requireInstallable(resolved, op)` branch preserved; FORCE-03 install test: no state record written; FORCE-03 update test: `(skipped) {no longer installable}` matches |
| 5 | `--force` never bypasses hard failures and no `Warning:` summary emitted on any force path | VERIFIED | `requireForceInstallable` still throws on `state === "unavailable"`; FORCE-05 tests (install unavailable, install missing marketplace, update unavailable, update missing marketplace) all pass; FORCE-04 install/update: zero `severity === "warning"` notifications, no message starts with `Warning:` |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/domain/resolver.ts` | `MaterializablePlugin = ResolvedPluginInstallable \| ResolvedPluginUnsupported` alias | VERIFIED | Line 136; excludes `unavailable`; NFR-7 doc comment anchored to D-65-03 |
| `extensions/pi-claude-marketplace/domain/index.ts` | Re-export `MaterializablePlugin` | VERIFIED | Line 34 |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts` | `--force` in `parsePositionalsWithFlags` before unknown-flag rejection; `force` on both result shapes | VERIFIED | Lines 41, 56, 61-65, 74, 81, 118 — `--force` arm precedes `token.startsWith("--")` rejection at line 66 |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` | `requireForceInstallable` gate + `MaterializablePlugin` holders + `force` threading | VERIFIED | Lines 104, 143, 269, 307, 361, 496-499, 506, 978 |
| `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` | `requireForceInstallable` at candidate resolve + `MaterializablePlugin` + `force` threading | VERIFIED | Lines 90, 132, 196, 318, 322, 619, 625, 639, 733, 742-745 |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts` | `--force` in allow-list + `force` destructure + conditional spread + `[--force]` in USAGE | VERIFIED | Lines 32, 45, 55, 86 |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts` | `--force` in allow-list + `force` destructure + conditional spread + `[--force]` in USAGE | VERIFIED | Lines 24, 32, 42, 80 |
| `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts` | Widened to `MaterializablePlugin` (65-03 blocking fix) | VERIFIED | Line 30 — param `resolved: MaterializablePlugin` |
| Seven shared holders (2 orchestrator/plugin/shared.ts + 5 bridge params) | `MaterializablePlugin` instead of `ResolvedPluginInstallable` | VERIFIED | All seven sites confirmed |
| `tests/domain/resolver.types.test.ts` | NFR-7 / FORCE-05 type assertion: `MaterializablePlugin` admits installable + unsupported and excludes unavailable | VERIFIED | Lines 90-110; `@ts-expect-error` guard at line 109 |
| `tests/orchestrators/plugin/install.test.ts` | FORCE-01 (degrade + no-op), FORCE-03, FORCE-04, FORCE-05 cases | VERIFIED | Lines 3002, 3060, 3103, 3141, 3181, 3221 — all pass |
| `tests/orchestrators/plugin/update.test.ts` | FORCE-02, FORCE-03, FORCE-04, FORCE-05 cases | VERIFIED | Lines 2899, 2946, 2984, 3025, 3064 — all pass |
| `tests/edge/handlers/plugin/install.test.ts` | Force threading parse case + USAGE assertion | VERIFIED | Lines 289, 309, 329 |
| `tests/edge/handlers/plugin/update.test.ts` | Force threading parse case + USAGE assertion | VERIFIED | Lines 335, 345, 358, 376 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `edge/handlers/plugin/install.ts` | `installPlugin` options | `...(force && { force: true })` at line 86 | WIRED | `force` destructured from `parseMapModelArgs` result; conditionally spread |
| `edge/handlers/plugin/update.ts` | `updatePlugins` options | `...(force && { force: true })` at line 80 | WIRED | Same pattern |
| `orchestrators/plugin/install.ts` | `requireForceInstallable` in `domain/resolver.ts` | `opts.force === true` gate branch at lines 496-499 | WIRED | Gate selects `requireForceInstallable` vs `requireInstallable` |
| `orchestrators/plugin/update.ts` | `requireForceInstallable` at candidate resolve | `args.force === true` at lines 742-745 inside `preflightUpdate` | WIRED | Gated on the CANDIDATE `resolveStrict` result (D-65-04) |
| `parsePositionalsWithFlags` | `ParsedMapModelArgs.force` | `force: flagged.force` at aggregator return line 118 | WIRED | Threaded through `parseMapModelArgs` |
| `domain/index.ts` | `domain/resolver.ts` | `export { MaterializablePlugin }` at line 34 | WIRED | Re-export confirmed |

### Data-Flow Trace (Level 4)

The phase delivers a gate-selection behavior (not a data-rendering component), so data-flow is the boolean `force` propagating from CLI to resolver gate.

| Stage | Variable | Source | Produces Real Effect | Status |
|-------|----------|--------|----------------------|--------|
| Edge parse | `force: boolean` | `parsePositionalsWithFlags` token `"--force"` | Boolean set from user arg | FLOWING |
| Handler to orchestrator | `force: true` (conditional) | `...(force && { force: true })` spread | Passes through only when parsed | FLOWING |
| Orchestrator gate | `opts.force === true` / `args.force === true` | Runtime check at preflight | Selects `requireForceInstallable` | FLOWING |
| Resolver gate | `r.state === "installable" \|\| r.state === "unsupported"` | Discriminated union narrow | Admits/rejects based on state | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Typecheck green | `npm run typecheck` | 0 errors | PASS |
| NFR-7 type test | `node --test tests/domain/resolver.types.test.ts` | 1/1 pass | PASS |
| Install FORCE tests | `node --test tests/orchestrators/plugin/install.test.ts tests/edge/handlers/plugin/install.test.ts` | 86/86 pass | PASS |
| Update FORCE tests | `node --test tests/orchestrators/plugin/update.test.ts tests/edge/handlers/plugin/update.test.ts` | 68/68 pass | PASS |
| NFR-5 network isolation | `node --test tests/architecture/no-orchestrator-network.test.ts` | 1/1 pass | PASS |

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` declared for this phase; plans use `npm run typecheck` + `node --test` (run above as behavioral spot-checks).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FORCE-01 | 65-01, 65-02 | `install --force` degrades unsupported; no-op on supported | SATISFIED | `requireForceInstallable` gate + FORCE-01 degrade and no-op tests pass |
| FORCE-02 | 65-01, 65-03 | `update --force` degrades unsupported candidate | SATISFIED | `requireForceInstallable` at candidate resolve + FORCE-02 test passes |
| FORCE-03 | 65-02, 65-03 | Without `--force`, unsupported still blocks | SATISFIED | `requireInstallable` branch intact; FORCE-03 install and update tests pass |
| FORCE-04 | 65-02, 65-03 | No `Warning:` summary on any force path | SATISFIED | Success rows stay `severity:"info"`; FORCE-04 tests assert zero warning-severity notifications |
| FORCE-05 | 65-01, 65-02, 65-03 | `--force` never bypasses hard failures | SATISFIED | `requireForceInstallable` throws on `unavailable`; FORCE-05 tests (unavailable + missing marketplace) pass for both install and update |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `domain/resolver.ts` | 1106-1108 | Stale comment: "no production caller yet" for `requireForceInstallable` | Info | Phase 64 wrote this before Phase 65 added production callers; cosmetic only, no debt marker |

No TBD/FIXME/XXX markers found in any phase-modified file. The stale comment does not contain a debt marker and does not block the goal.

### Human Verification Required

None. All observable truths are verifiable programmatically. The phase is narrowly behavioral (gate selection + boolean threading) with no UI/visual surface.

D-65-01 locked: absence of the SEV-01..05 severity ladder and the Phase-69 `--force`-citing error message are intentionally deferred to Phase 69 and are NOT gaps for this phase.

### Gaps Summary

No gaps. All five success criteria are verified against the actual codebase with passing tests and green typecheck.

---

_Verified: 2026-06-27T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
