---
phase: 64-resolver-three-way-state
verified: 2026-06-27T04:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 64: Resolver Three-Way State Verification Report

**Phase Goal:** The resolver distinguishes "force can degrade the unsupported parts" from "force cannot help" via a three-way discriminated state, type-enforcing that force degrades components but never hard failures (NFR-7 refined, not weakened).
**Verified:** 2026-06-27
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | resolveStrict / resolveLoose return one of installable / unsupported / unavailable (RSTATE-01) | VERIFIED | `domain/resolver.ts` lines 64-123: three TypeBox schemas + union; `decideResolution` returns all three arms |
| 2 | Structural defect + unsupported kinds resolves unavailable (structural precedence, RSTATE-02) | VERIFIED | `decideResolution` checks `structuralDirty` before `partial.unsupported.length`; `preflightStages` short-circuits all 4 structural paths to `unavailable`; RSTATE-02 test in both strict and loose |
| 3 | unavailable exposes pluginRoot to no consumer (compile-enforced, RSTATE-03) | VERIFIED | `ResolvedPluginUnavailableSchema` omits `pluginRoot`; `@ts-expect-error` on `unavail.pluginRoot` and `r.pluginRoot` under `r.state === "unavailable"` in `resolver.types.test.ts`; `npm run typecheck` exits 0 |
| 4 | requireInstallable narrows to installable only; requireForceInstallable admits installable | unsupported and throws on unavailable (RSTATE-04) | VERIFIED | `requireInstallable`: guard `if (r.state === "installable")`; `requireForceInstallable`: guard `if (r.state === "installable" \|\| r.state === "unsupported")`; RSTATE-04 gate tests in both strict and loose; compile-level assertion in `resolver.types.test.ts` (gateExcludesUnavailable) |
| 5 | Per-kind unsupported markers identical across list, info, and install including multi-kind (RSTATE-05 + CR-01 fix) | VERIFIED | `narrowUnsupportedKinds` in `probe-classifiers.ts`; list.ts/info.ts consume it for `unsupported` arm; install.ts CR-01 fix (line 1734) routes non-lspServers `contains <kind>` notes through same helper; multi-kind parity test asserts `["lspServers","themes"]` yields `["lsp","unsupported source"]` on both surfaces |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/domain/resolver.ts` | Three-arm union, factories, structural-precedence decision, two gates | VERIFIED | 3x `state: Type.Literal(...)` schemas counted; `unavailable()` factory returns only `{state, name, notes}`; `decideResolution` with structural-first branch; `requireForceInstallable` exported |
| `extensions/pi-claude-marketplace/domain/index.ts` | Exports ResolvedPluginUnsupported, ResolvedPluginUnavailable, requireForceInstallable | VERIFIED | Lines 30-42: all three types + `requireForceInstallable` exported; `ResolvedPluginNotInstallable` correctly dropped |
| `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` | `narrowUnsupportedKinds` shared helper mapping unsupported[] to closed REASON set | VERIFIED | Lines 146-160: maps `lspServers` → `lsp`, else `unsupported source`, first-wins dedup |
| `tests/domain/resolver.types.test.ts` | @ts-expect-error NFR-7 compile assertions + requireForceInstallable type gate | VERIFIED | Lines 58/64 negative pluginRoot reads; line 82 gateExcludesUnavailable; all `@ts-expect-error` directives fire (typecheck green) |
| `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` | Multi-kind parity + structural-stays-on-notes regression guard | VERIFIED | Lines 65-153: per-kind cases (lspServers/monitors/themes), multi-kind case (line 109), structural guard (line 139) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `list.ts` | `resolved.state` | switch + assertNever | VERIFIED | `availableRowMessage` switch at line 359; `default: return assertNever(resolved)` at line 388 (WR-03 fix) |
| `info.ts` | `resolved.state` | switch + assertNever in `buildNonInstallableRowFields` | VERIFIED | Lines 766-786: `case "unsupported"` reads typed list via `narrowUnsupportedKinds`; `case "unavailable"` re-derives via `deriveLenientComponentPaths`; `default: return assertNever(resolved)` at line 785 (WR-03 fix) |
| `edge-deps.ts` | `resolved.state === "installable"` | local `installable` boolean | VERIFIED | Line 154: `installable = resolved.state === "installable"` |
| `list.ts` | `shared per-kind marker helper` | `narrowUnsupportedKinds(resolved.unsupported)` | VERIFIED | Line 375 (unsupported arm); line 376 `narrowResolverNotes` for unavailable arm |
| `info.ts` | `shared per-kind marker helper` | `narrowUnsupportedKinds(resolved.unsupported)` in `buildNonInstallableRowFields` | VERIFIED | Line 770: `unsupported` arm; line 780: `unavailable` arm uses `narrowResolverNotes` |
| `install.ts` | `shared per-kind marker helper` | CR-01: `narrowUnsupportedKinds([token])` for non-lspServers kinds | VERIFIED | Lines 1726-1737: all `contains <kind>` notes now routed through `narrowUnsupportedKinds` |

### Data-Flow Trace (Level 4)

Not applicable — Phase 64 is a pure TypeScript type-level refactor. No new data sources introduced; existing resolver I/O paths unchanged. Type system enforces field exposure at compile time; runtime behavior is the existing resolver logic with updated discriminant.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Three-arm TypeBox schemas: exactly 3 state literals | `grep -c 'state: Type.Literal("installable")\|...' resolver.ts` | 3 | PASS |
| No residual `.installable` reads in migrated consumers | `grep -rn '\.installable\b' list.ts info.ts edge-deps.ts` (excl. compatibility) | (no output) | PASS |
| requireForceInstallable exported from domain/index.ts | `grep requireForceInstallable domain/index.ts` | found at line 41 | PASS |
| RSTATE-02 precedence test in strict | `grep -n "RSTATE-02" resolver-strict.test.ts` | line 665 | PASS |
| RSTATE-04 gate tests in strict and loose | `grep -c "requireForceInstallable" resolver-strict.test.ts resolver-loose.test.ts` | >=1 each | PASS |
| Typecheck exits 0 | `npm run typecheck` | exit 0 (no output) | PASS |

### Probe Execution

No probes declared for this phase (pure TypeScript refactor, no shell probe scripts).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RSTATE-01 | 64-01 | Three-way discriminated state replaces binary installable | SATISFIED | resolver.ts union; resolveStrict/resolveLoose return ResolvedPlugin |
| RSTATE-02 | 64-01 | Structural defect takes precedence over unsupported kinds | SATISFIED | decideResolution structural-first; preflightStages unavailable short-circuits; RSTATE-02 tests |
| RSTATE-03 | 64-01 | unsupported exposes pluginRoot; unavailable compile-strips it | SATISFIED | Schema design + @ts-expect-error + typecheck=0 |
| RSTATE-04 | 64-01 | Two narrowing gates: requireInstallable / requireForceInstallable | SATISFIED | Both functions in resolver.ts + exported + test-covered |
| RSTATE-05 | 64-02 | Per-kind markers derived from list, identical across surfaces | SATISFIED | narrowUnsupportedKinds helper; CR-01 fix in install.ts; multi-kind parity test |

### Code Review Findings (post-plan fixes)

The following findings from 64-REVIEW.md were addressed with separate commits after the initial plan deliveries. All are verified fixed in the codebase.

| Finding | Severity | Fix Commit | Verification |
|---------|----------|------------|-------------|
| CR-01: install surface dropped non-lspServers kinds on multi-kind plugins | Critical | `37f0ef31` | install.ts lines 1726-1737 route all `contains <kind>` through `narrowUnsupportedKinds`; multi-kind parity test (line 109 of cross-surface test) asserts `["lsp","unsupported source"]` on both surfaces |
| WR-01: parity test only covered single-element inputs | Warning | `45f13ef5` | cross-surface-reason-parity.test.ts line 109: multi-kind case pairs `["lspServers","themes"]` against `["contains lspServers","contains themes"]` |
| WR-02: PathContainmentError uncaught in buildNotInstalledRow | Warning | `701e2130` | info.ts lines 927-951: outer try/catch wraps buildNonInstallableRowFields, returns `(unavailable)` row via `narrowProbeError(err)` |
| WR-03: if/ternary without assertNever in list.ts and info.ts | Warning | `b8d3f296` | list.ts line 388 and info.ts line 785: `default: return assertNever(resolved)` added |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

Scanned all 9 modified production files and 5 modified test files. No TBD/FIXME/XXX markers, no placeholder returns, no hardcoded empty stubs in rendering paths.

### Test Suite

`npm run check` result: 2361 tests, 2358 pass, **1 fail**, 2 skipped.

The single failing test is `tests/orchestrators/marketplace/autoupdate.test.ts:674` ("D-UPD: setMarketplaceAutoupdate leaves a disabled plugin record untouched") with `ENOTEMPTY` on a temp directory cleanup. This test:
- Uses no resolver code (exercises the persisted `compatibility.installable` boolean)
- Is flaky (~1 in 3 runs); passes deterministically in isolation (20/20 in SUMMARY)
- Is explicitly documented as a pre-existing latent `withHermeticHome` isolation race in the 64-01 SUMMARY's "Deferred Issues" section
- Predates Phase 64 work; the fast in-memory resolver tests added this phase perturbed concurrent timing and surfaced the race

This test failure is not attributable to Phase 64 and does not affect any RSTATE requirement. Typecheck, lint, and Prettier components of `npm run check` are all green.

### Human Verification Required

None. All success criteria are verifiable programmatically. The three-way discriminant, compile-enforcement of NFR-7, and cross-surface marker parity are all mechanically checkable (and checked).

### Gaps Summary

None. All five ROADMAP success criteria are VERIFIED. All five RSTATE requirements (01-05) are SATISFIED. The code review critical finding (CR-01) and all three warnings (WR-01, WR-02, WR-03) were fixed and verified in the codebase.

---

_Verified: 2026-06-27_
_Verifier: Claude (gsd-verifier)_
