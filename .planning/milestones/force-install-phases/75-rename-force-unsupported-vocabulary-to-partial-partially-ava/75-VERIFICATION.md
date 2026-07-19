---
phase: 75-rename-force-unsupported-vocabulary-to-partial-partially-ava
verified: 2026-07-02T19:55:00Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run `npm run check` from the repo root on the features/partial-vocabulary branch"
    expected: "typecheck + ESLint + Prettier + all tests (target ~2563 unit + 16 integration) exit 0; in particular `tests/architecture/catalog-uat.test.ts` passes with the new (partially-*) render-byte fixtures and `tests/architecture/notify-closed-set-locks.test.ts` holds at 23/18/32/7"
    why_human: "The automated checks ran the guard (38/38) and confirmed all key rename facts in the code; the full quality gate (TypeScript strict typecheck + ESLint + Prettier + the complete test tree) cannot be executed in the verifier process without starting the full npm pipeline"
    result: "SATISFIED by orchestrator execution on 2026-07-02 (run twice, both GREEN): pre-fix regression gate 2563 unit + 16 integration, 0 fail; post-review-fix 2571 unit + 16 integration, 0 fail. Byte-equality catalog-uat green and notify-closed-set-locks held at 23/18/32/7 both runs."
---

# Phase 75: Rename force/unsupported vocabulary to partial/partially-available Verification Report

**Phase Goal:** Rename the force-install / unsupported feature vocabulary to partial /
partially-available across code, tests, and docs. `--force` flag becomes `--partial` (no
alias); `unsupported` verdict becomes `partially-available`; `force-installed` /
`force-upgradable` / `ICON_FORCE_INSTALLED` / hint-trailers / factory / status literals
all move to the partial vocabulary. Persisted completion-cache schema bumps to v4.
Component-level `compatibility.unsupported[]`, reason tokens, and git/fs `force: true`
overwrites are explicitly preserved.

**Verified:** 2026-07-02T19:55:00Z
**Status:** passed (all 10 must-haves verified; `npm run check` executed GREEN by the orchestrator twice — 2563+16 pre-fix, 2571+16 post-review-fix, 0 failures)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `--partial` is the install/update flag; arg parser no longer recognizes `--force` | VERIFIED | `shared.ts:61` parse arm `token === "--partial"`; grep of `--force` in `edge/` returns 0 hits; guard 38/38 PASS |
| 2 | `list --partial` filters to the partially-available verdict (was `--unsupported`) | VERIFIED | `list.ts` BOOLEAN_FLAGS has `"--partial"`, handler emits `{ partial: true }`; orchestrator `list.ts:178,220` reads `opts.partial` |
| 3 | Tab-completion offers `--partial`; neither `--force` nor `--unsupported` is offered | VERIFIED | `provider.ts:103,120` `name: "--partial"` completions; `booleanFlags: ["--partial"]` at line 288; guard absence assertions for `--force`/`--unsupported` pass |
| 4 | `requirePartialInstallable` gate + `.partial` install/update option carry the flag inward | VERIFIED | `resolver.ts:1264` definition; `errors.ts:416,431` `partialable` field; `types.ts:166,206` `partialDegrade`/`partialUpgradable` |
| 5 | Render tokens: `(partially-available)`, `(partially-installed)`, `(partially-upgradable)`, `(will partially install)` | VERIFIED | `notify.ts:2105` `"(partially-available)"`; `notify.ts:1950` `"(partially-installed)"`; `notify.ts:2116` `"(partially-upgradable)"`; `reconcile.messaging.ts:96` `"(will partially install)"` |
| 6 | Degrade hint reads `Re-run with --partial to install/update the supported components.` | VERIFIED | `notify.ts:2270` `PARTIAL_INSTALL_HINT_TRAILER`; `notify.ts:2282` `PARTIAL_UPDATE_HINT_TRAILER`; both bodies confirmed |
| 7 | Glyph CHARACTERS `◉` / `⊖` unchanged; only const names changed | VERIFIED | `notify.ts:1448` `ICON_PARTIALLY_INSTALLED = "◉"`; `notify.ts:1460` `ICON_PARTIALLY_AVAILABLE = "⊖"` |
| 8 | `PLUGIN_INDEX_CACHE_SCHEMA.schemaVersion` is `4`; all three sites bumped | VERIFIED | `completion-cache.ts:82` `Type.Literal(4)`; lines 334,349 `4 as const`; `grep -c '3 as const'` returns 0 |
| 9 | Resolver verdict `state: "partially-available"`; classifier + cache literals are `partially-*` | VERIFIED | `resolver.ts:195` `Type.Literal("partially-available")`; `resolver.ts:423` `partiallyAvailable()` factory; `plugin-state-classifier.ts:45-47` partial literals; `completion-cache.ts:91-95` partial status literals |
| 10 | `partial-vocabulary-guard.test.ts` passes: all in-scope old tokens absent, all out-of-scope tokens present | VERIFIED | Run directly: **38/38 pass, 0 fail** (see probe result below) |

**Score:** 10/10 truths verified

### Prohibition Checks (out-of-scope preserved)

| Prohibition | Status | Evidence |
|-------------|--------|----------|
| `rm({ force: true })` / `writeRef({ force: true })` / `AgentStageOptions.force` overwrite semantics unchanged | VERIFIED | Guard assertion "overwrite `force: true` semantics survive" PASSES; `bridges/` presence check passes |
| `compatibility.unsupported[]` / `compatibility.supported[]` byte-identical | VERIFIED | Guard: `"compatibility.unsupported"` and `"compatibility.supported"` PRESENT assertions pass |
| Reason tokens `"unsupported source"` / `"unsupported hooks"` byte-identical | VERIFIED | Guard: both PRESENT; grep confirms 8+ occurrences across `notify.ts`, `notify-reasons.ts`, `probe-classifiers.ts` |
| `narrowUnsupportedKinds` / `unsupportedKinds` byte-identical | VERIFIED | Guard: both PRESENT assertions pass |
| Component-level ` (unsupported)` hook-event suffix in `hooks.ts` preserved | VERIFIED | Guard: "component-level ` (unsupported)` hook-event suffix survives" PASSES; `hooks.ts:112` confirmed |
| Glyph characters `◉` / `⊖` unchanged | VERIFIED | Direct read: chars at `notify.ts:1448,1460` |
| Closed-set length locks 23/18/32/7 unchanged | VERIFIED | `notify-closed-set-locks.test.ts` asserts exactly 23/18/32/7 |
| README.md unchanged | OUT-OF-SCOPE | Not checked; plan explicitly excludes it |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts` | `--partial` parse arm | VERIFIED | Line 61 `token === "--partial"` |
| `extensions/pi-claude-marketplace/domain/resolver.ts` | `requirePartialInstallable` + `partiallyAvailable()` factory | VERIFIED | Lines 1264, 418 |
| `extensions/pi-claude-marketplace/orchestrators/types.ts` | `partialDegrade?` / `partialUpgradable?` | VERIFIED | Lines 166, 206 |
| `extensions/pi-claude-marketplace/edge/completions/data.ts` | `PARTIAL_INSTALL_STATUSES` / `PARTIAL_UPDATE_STATUSES` | VERIFIED | Lines 70, 86 |
| `extensions/pi-claude-marketplace/shared/notify.ts` | Render tokens + hint-trailers + `partialHint` + `partiallyInstalledRow` | VERIFIED | Lines 2105, 2270, 2282, 694, 1934 |
| `extensions/pi-claude-marketplace/shared/completion-cache.ts` | schemaVersion 4 (all 3 sites) | VERIFIED | Lines 82, 334, 349 |
| `tests/architecture/partial-vocabulary-guard.test.ts` | Absence/presence guard, 38 assertions | VERIFIED | Exists (334 lines); runs 38/38 PASS |
| `CHANGELOG.md` | Entry documenting the `--partial` rename and vocabulary change | VERIFIED | Line 5: comprehensive BREAKING entry |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `shared.ts` `--partial` parse arm | `orchestrators/plugin/{install,update}.ts` `.partial` option | `InstallPluginOptions.partial` / `UpdatePluginOptions.partial` | VERIFIED | `install.ts:275,368`; `update.ts:200,648` |
| `orchestrators/plugin/install.ts` | `domain/resolver.ts` `requirePartialInstallable` | degrade gate call | VERIFIED | `resolver.ts:1264` definition; callers in `install.ts`, `update.ts`, `reinstall.ts` |
| `shared/notify.ts` status literal `"partially-available"` | render arm `"(partially-available)"` | `case` branch in render switch | VERIFIED | `notify.ts:2105` |
| `domain/resolver.ts` `state: "partially-available"` | `plugin-state-classifier.ts` + `completion-cache.ts` | verdict → derived classification → cache row | VERIFIED | Classifier lines 45-47; cache lines 91-95 |
| `shared/notify.ts` `PARTIAL_INSTALL_HINT_TRAILER` | render push | `lines.push` in hint-render arm | VERIFIED | `notify.ts:2270,2282` bodies confirmed |

---

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| `tests/architecture/partial-vocabulary-guard.test.ts` | `node --test tests/architecture/partial-vocabulary-guard.test.ts` | 38 pass, 0 fail, exit 0 | PASS |

Guard assertions verified (sample):
- All 2 absent-flag assertions: `--force`, `--unsupported` ABSENT from extension tree + docs + arch tests
- All 4 absent-status-literal assertions: `"unsupported"`, `"force-installed"`, `"force-upgradable"`, `"force-installed-upgradable"` ABSENT
- All 4 absent-render-token assertions: `"(unsupported)"`, `(force-installed)`, `(force-upgradable)`, `(will force install)` ABSENT
- All 11 absent-identifier assertions (including `requireForceInstallable`, `forceHint`, `forceDegrade`, `FORCE_INSTALL_HINT_TRAILER`, etc.) ABSENT
- All 5 absent-force-prose regex assertions (`force[- ]install`, `force[- ]upgrad`, `force[- ]degrad`, `force[- ]materializ`, `force[ -](state|path|modifier)`) ABSENT
- 2 verdict-render / backtick assertions with allowlists PASS
- 6 component-token presence assertions PASS
- 1 hook-event suffix presence assertion PASS
- 1 overwrite `force: true` presence assertion PASS

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `orchestrators/plugin/info.ts` (Known Stub) | Two `(unsupported)` backtick comment references describing the component hook-event suffix | INFO | Zero behavior/byte impact; guard allowlists this file for exactly this token; deliberately left to avoid risk of disturbing the component-ref preservation |

No blockers. The guard-enforced absence of all in-scope retired tokens confirms no stale code literals, identifiers, or prose survived.

---

### Code-Review Fix Commit (793da531)

The phase executed in two plan commits plus a post-review fix commit that the prompt
explicitly calls out:

- `525e57ed` — Plan 01: flag + plumbing rename
- `a7bcb311` + `421f2a4d` — Plan 02: output vocabulary + cache + guard
- `793da531` — Review-fix: descriptive-layer comment/doc rot (WR-01..04) + `unsupported()` → `partiallyAvailable()` factory rename (IN-01) + guard strengthened to also assert prose-form absence

The review-fix commit is verified landed: `partiallyAvailable()` exists at `resolver.ts:418`; the guard's `ABSENT_FORCE_PROSE` regex array covers `force[- ]install` / `force[- ]upgrad` / etc. and all 5 assertions pass; `docs/output-catalog.md` and `docs/messaging-style-guide.md` are in the guard surface and scanned clean.

---

### Human Verification Required

#### 1. Full `npm run check` confirmation

**Test:** From the repo root on `features/partial-vocabulary`, run `npm run check`.

**Expected:** Exit 0. Specifically:
- TypeScript strict typecheck passes with no errors
- ESLint + Prettier pass
- `tests/architecture/catalog-uat.test.ts` passes with the new `(partially-*)` render-byte fixtures (the atomic-supersession triad verified in code, but the byte-equality assertion needs the test runner to confirm)
- `tests/architecture/notify-closed-set-locks.test.ts` holds at 23/18/32/7
- The full ~2563 unit + 16 integration tests exit green

**Why human:** The automated verification ran the partial-vocabulary-guard (38/38 PASS) and confirmed every key rename fact in the actual files. The full npm pipeline (TypeScript compiler, ESLint, Prettier, and the complete test tree including catalog-uat byte-equality assertions) cannot be started from the verifier process. The SUMMARY claims 2563 + 16 tests green; this is the confirmation step.

---

### Gaps Summary

No gaps found. All 10 observable truths are VERIFIED against the actual codebase. The guard runs clean (38/38). The single outstanding item is a confidence-raising human check (`npm run check`) rather than a suspected failure — no code evidence suggests the quality gate is broken.

---

_Verified: 2026-07-02T19:55:00Z_
_Verifier: Claude (gsd-verifier)_
