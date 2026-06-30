---
phase: 73-force-cross-surface-token-unification
verified: 2026-06-30T03:55:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
---

# Phase 73: Force Cross-Surface Token Unification — Verification Report

**Phase Goal:** A force-installable (`unsupported`) plugin is described consistently across every user-facing surface. Phase 72 de-collapsed `list` and `info` to `⊖ (unsupported)`, but the install-failure and update-decline surfaces still described the same plugin with the old `⊘ (unavailable)` framing. This phase extends the resolver-state-driven render to those surfaces and removes the misleading `{no longer installable}` wording for the force-degradable case. Severity is already correct (SEV-02 / SEV-04) and is NOT changed.

**Verified:** 2026-06-30T03:55:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A no-`--force` install of an `unsupported` (force-installable) plugin renders `⊖ … (unsupported) {reasons}` plus the install-worded `--force` hint trailer, not `⊘ … (unavailable)`. | VERIFIED | `composeNotInstallableMessage` in install.ts:1522–1545 splits on `entityErrorRow.forceable === true` → `status: "unsupported", forceHint: true, severity: "error"`. Trailer gate at notify.ts:3448 fires on `(p.status === "unavailable" \|\| p.status === "unsupported") && p.forceHint === true`. Integration test: `install.test.ts` asserts `⊖ helper (unsupported) {unsupported hooks, lsp}` + trailer. |
| 2 | A no-`--force` install failure of a structural `unavailable` plugin still renders `⊘ … (unavailable)` with NO trailer. | VERIFIED | Else-arm of `composeNotInstallableMessage` (install.ts:1538–1544): `status: "unavailable"`, no `forceHint`. Structural arm of gate at notify.ts:3448 never fires (forceHint absent). Catalog state `failure-structural-unavailable` (output-catalog.md:460–469) byte-unchanged `⊘ helper (unavailable) {unsupported source}`. |
| 3 | `info` non-locally-resolvable arm derives its status (and reason source) from `resolved.state`; existing non-path structural `unavailable` rows are byte-unchanged. | VERIFIED | info.ts:1045–1066: `const reasons = resolved.state === "unsupported" ? narrowUnsupportedKinds(resolved.unsupported) : narrowResolverNotes(resolved.notes)` and `status: resolved.state === "unsupported" ? "unsupported" : "unavailable"`. Guard at info.ts:1045 narrows union before access. No live byte change today (non-path sources never resolve `unsupported` without network — latent-divergence repair). |
| 4 | A targeted manual `update` (no `--force`) of a force-upgradable plugin renders the `force-upgradable` token (`● … (force-upgradable) {degrade reason}`) plus an update-worded `--force` trailer, at `warning` severity. | VERIFIED | update.ts:777–791 catch arm: when `err.shape.kind === "no-longer-installable" && err.shape.forceable`, emits `partition: "skipped", forceUpgradable: true, reasons: narrowUnsupportedKinds(err.shape.unsupportedKinds ?? [])`. `projectSkippedOutcome` at update.ts:1646–1656: `status: "force-upgradable", forceHint: true, severity: cardinality === "single" ? "warning" : "info"`. Integration test `update.test.ts:1041` asserts `● hello v1.0.0 (force-upgradable) {lsp}\n    Re-run with --force to update with the supported components.` + `severity: "warning"`. |
| 5 | The same force-upgradable candidate skipped by a bulk update renders the same `force-upgradable` row at `info` severity (no summary line; counted in the tally). | VERIFIED | Same `projectSkippedOutcome` arm with `cardinality === "plural"` → `severity: "info"`. Integration test `update.test.ts:3212` asserts `(force-upgradable)` present, `{no longer installable}` absent, `severity === undefined` (info). Catalog state `skip-force-upgradable-bulk` (output-catalog.md:882–892) matches byte-exact. |
| 6 | The force-upgradable update-decline reason matches how `list` describes the same plugin (its degrade kinds, e.g. `{lsp}` / `{unsupported source}`), NOT the misleading `{no longer installable}`, and is BYTE-IDENTICAL to the `list (force-upgradable)` reason brace for the same fixture. | VERIFIED | Reason sourced via `narrowUnsupportedKinds(err.shape.unsupportedKinds ?? [])` — the same seam `list` uses. Cross-surface byte-parity assertion at catalog-uat.test.ts:3700–3755 renders both the list-inventory and update-decline rows through `notify()` and asserts `extractBrace(declineBody) === extractBrace(listBody)`. Test passes: `✔ XSURF-03: update-decline force-upgradable reason brace === list force-upgradable brace (same kinds)`. |
| 7 | The list-inventory `force-upgradable` row stays byte-frozen (no `--force` trailer). | VERIFIED | `PluginForceUpgradableMessage.forceHint` is optional; list producers never set it. Trailer gate at notify.ts:3455 requires `p.forceHint === true`. Byte-parity assertion at catalog-uat.test.ts:3705–3715 passes the list row with no `forceHint` and the assert confirms the list row has no trailer in the extracted string. |
| 8 | Closed-set tripwire counts (REASONS=32, STATUS_TOKENS=23, PLUGIN_STATUSES=18) are unchanged. | VERIFIED | notify-closed-set-locks.test.ts lines 29–47: `assert.equal(REASONS.length, 32)`, `assert.equal(STATUS_TOKENS.length, 23)`, `assert.equal(PLUGIN_STATUSES.length, 18)`. All pass — no closed-set member added this phase (`unsupported` and `force-upgradable` already existed from Phase 72/66). |
| 9 | `npm run check` is green. | VERIFIED | Full suite run: typecheck (tsc --noEmit clean), lint (ESLint clean), format:check (Prettier clean), unit tests 2504 pass / 2 skipped / 0 fail, integration tests 16 pass / 0 fail. |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/shared/notify.ts` | `forceHint?` on `PluginUnsupportedMessage` + `PluginForceUpgradableMessage`; `FORCE_UPDATE_HINT_TRAILER`; widened install gate; new update gate | VERIFIED | Lines 720, 791: both interfaces carry `readonly forceHint?: boolean`. Line 2253: `FORCE_UPDATE_HINT_TRAILER = "Re-run with --force to update with the supported components."`. Lines 3448, 3455: two trailer gates present and correctly gated. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts` | `INSTALL_STATUSES` += `"unsupported"`; `InstallMsg` += `PluginUnsupportedMessage`; `INSTALL_RENDER` unsupported arm | VERIFIED | Line 47: `"unsupported"` in `INSTALL_STATUSES`. Line 49 (imports) and union type: `PluginUnsupportedMessage` included. Lines 108–116: `unsupported` render arm using `ICON_UNSUPPORTED`, `"(unsupported)"`. `satisfies CommandContext<InstallStatus, InstallMsg>` totality gate passes tsc. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts` | `UPDATE_STATUSES` += `"force-upgradable"`; `UpdateMsg` += `PluginForceUpgradableMessage`; `UPDATE_RENDER` force-upgradable arm | VERIFIED | Line 36: `"force-upgradable"` in `UPDATE_STATUSES`. Line 49: `PluginForceUpgradableMessage` in `UpdateMsg`. Lines 82–83: `"force-upgradable"` render arm: `pluginRow(ICON_INSTALLED, p, mpScope, "(force-upgradable)", probe)`. `satisfies CommandContext<UpdateStatus, UpdateMsg>` totality gate passes tsc. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `install.ts::composeNotInstallableMessage` | `PluginUnsupportedMessage { status: "unsupported", forceHint: true }` | `entityErrorRow.forceable === true` branch | VERIFIED | install.ts:1527: `if (entityErrorRow.forceable === true)` → returns `{ status: "unsupported", …, forceHint: true }`. |
| `update.ts` catch arm (manual decline) | force-upgradable projection arm | `err.shape.kind === "no-longer-installable" && err.shape.forceable` → `forceUpgradable: true` on outcome | VERIFIED | update.ts:778–791: guard `err instanceof PluginShapeError && err.shape.kind === "no-longer-installable" && err.shape.forceable`; emits `forceUpgradable: true`. `projectSkippedOutcome` at 1646 keys on `outcome.forceUpgradable === true`. `resolved` is NOT accessed in catch arm — discriminant sourced from `err.shape` only, no TS2304. |
| `notify.ts` trailer composer | update-worded force trailer | `p.status === "force-upgradable" && p.forceHint === true` | VERIFIED | notify.ts:3455: exact condition. `FORCE_UPDATE_HINT_TRAILER` at line 2253 emitted with 4-space indent. |

### Data-Flow Trace (Level 4)

Not applicable — this phase is a render-token/reason rename across three producers. No component renders fetched DB data or async state. All data flows through synchronous type-discriminant splits already verified at Levels 1–3.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| XSURF-01: install failure of force-degradable plugin renders `⊖ (unsupported)` + trailer | `node --test "tests/orchestrators/plugin/install.test.ts"` (as part of `npm run check`) | Pass — byte-exact assertion in test `SEV-02 / D-69-03: composeInstallFailureMessage points at --force iff the verdict is force-degradable` | PASS |
| XSURF-03: targeted update decline renders `● (force-upgradable) {lsp}` + update trailer at warning | `node --test "tests/orchestrators/plugin/update.test.ts"` (as part of `npm run check`) | Pass — `update.test.ts:1041` byte-exact; `severity === "warning"` asserted | PASS |
| XSURF-03 SEV-04 bulk: same decline at info | `node --test "tests/orchestrators/plugin/update.test.ts"` (as part of `npm run check`) | Pass — `update.test.ts:3212`; `severity === undefined` (info); `{no longer installable}` absent | PASS |
| Cross-surface byte-parity assertion | `node --test "tests/architecture/catalog-uat.test.ts"` | `✔ XSURF-03: update-decline force-upgradable reason brace === list force-upgradable brace (same kinds)` | PASS |
| Closed-set tripwire unchanged | `node --test "tests/architecture/notify-closed-set-locks.test.ts"` | REASONS=32, STATUS_TOKENS=23, PLUGIN_STATUSES=18 all pass | PASS |
| Full green gate | `npm run check` | 2504 unit pass, 16 integration pass, 0 fail, tsc/eslint/prettier all clean | PASS |

### Probe Execution

No phase-declared probes. Step 7c SKIPPED (no probe-*.sh files; no migration phase).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| XSURF-01 | 73-01-PLAN.md | Install-failure surface renders `⊖ (unsupported)` for force-installable plugin; SEV-02 `--force` hint preserved; structural `unavailable` stays `⊘` no trailer | SATISFIED | `composeNotInstallableMessage` forceable split; INSTALL_RENDER unsupported arm; notify.ts trailer gate widened; install.test.ts byte assertions; output-catalog.md `failure-unsupported-features` block updated |
| XSURF-02 | 73-01-PLAN.md | `info.ts` non-locally-resolvable arm derives status from `resolved.state`; existing non-path `unavailable` rows byte-unchanged | SATISFIED | info.ts:1055–1060 derives `status` and `reasons` from `resolved.state`; latent-divergence repair (no live byte change, correctly documented); info test suite green |
| XSURF-03 | 73-01-PLAN.md | Manual `update` decline of force-upgradable plugin surfaces force-aware reason (not `{no longer installable}`) pointing at `--force`; SEV-04 split (targeted=warning, bulk=info) preserved | SATISFIED | catch arm sources discriminant from `err.shape.forceable` (resolved out of scope); `narrowUnsupportedKinds(err.shape.unsupportedKinds ?? [])` for list-consistent reason; `projectSkippedOutcome` flips force-upgradable arm; SEV-04 keyed on status arm not reason string; cascadeSkipSeverity untouched; two update.test.ts assertions plus catalog-uat byte-parity assertion |

No orphaned requirements: XSURF-01, XSURF-02, XSURF-03 are the only requirements mapped to Phase 73 in REQUIREMENTS.md, and all three appear in the plan's `requirements` field.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| update.ts | 425, 2118, 2127, 2140 | `PLACEHOLDER` in `SYNTHETIC_UPDATE_PLACEHOLDER_NAME` | Info | Domain constant name for a synthetic plugin name used in test fixtures; not a code debt marker. Not a stub. |

No TBD, FIXME, XXX, or TODO markers in any file modified by this phase.

### Human Verification Required

None. All three XSURF requirements are verifiable programmatically via byte-exact test assertions and the full `npm run check` gate.

---

## Notable Decisions Reconciled

The plan's Task 2 prose specified `narrowResolverReasons(err.shape.reasons, err.shape.unsupportedKinds)` for the XSURF-03 reason, but the executor reconciled to `narrowUnsupportedKinds(err.shape.unsupportedKinds ?? [])` — the same seam `list` uses — as authorized by the plan's Task 3 byte-parity directive ("use whichever the `list` row uses"). The cross-surface byte-parity assertion in catalog-uat.test.ts:3700 confirms this was the correct choice: both sides extract identically. The SUMMARY.md records this reconciliation under "Decisions Made".

SEV-04 is preserved by the STATUS arm of `projectSkippedOutcome`, not by the reason string: `cardinality === "single" ? "warning" : "info"` is applied directly in the `forceUpgradable === true` branch (update.ts:1654). `cascadeSkipSeverity` is unchanged and its `reasons.includes("no longer installable")` branch continues to serve the structural decline path (update.ts:1612–1613). The targeted-warning / bulk-info split is explicitly regression-asserted by the pair of tests at update.test.ts:1041 and update.test.ts:3212.

---

_Verified: 2026-06-30T03:55:00Z_
_Verifier: Claude (gsd-verifier)_
