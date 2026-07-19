---
phase: 68
slug: load-time-backfill
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-27
validated: 2026-06-28
---

# Phase 68 — Validation Strategy

> Per-phase validation contract. Reconstructed retroactively from phase
> artifacts (the scaffolded template was unfilled). Load-time backfill promotes
> a force-installed plugin's previously-skipped components once the extension
> supports them, gated on the `lastReconciledExtensionVersion` stamp.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in), Node >= 20.19.0 |
| **Config file** | none — globbed by `package.json` `test` script |
| **Quick run command** | `node --test "tests/orchestrators/reconcile/backfill.test.ts" "tests/architecture/extension-version-sync.test.ts" "tests/persistence/state-io.test.ts"` |
| **Full suite command** | `npm run check` (serialize with `TEST_CONCURRENCY=1` to avoid the temp-dir cleanup races noted in 65.1) |
| **Estimated runtime** | ~5 seconds (quick); ~120 seconds (full `npm run check`) |

---

## Sampling Rate

- **After every task commit:** Run the targeted reconcile/backfill, state-io, or extension-version-sync file for the touched surface
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** `npm run check` must be green
- **Max feedback latency:** ~5 seconds (quick run)

---

## Per-Requirement Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| BFILL-01 | Load-time backfill re-materializes a force-installed plugin's now-supported components via the unconditional reinstall primitive (D-68-02); full promotion → `(installed)` with empty unsupported set; partial re-materialize stays force-installed with the real unsupported set; no supported-set growth → skipped (no row, no churn) | unit (orchestrator) | `node --test "tests/orchestrators/reconcile/backfill.test.ts"` | ✅ COVERED (backfill.test.ts:332/370/405) | ✅ green |
| BFILL-01 | Reinstalling a force-installed (unsupported) plugin succeeds via the repair primitive and records the real compatibility set at the same version (no upgrade) | unit (orchestrator) | `node --test "tests/orchestrators/plugin/reinstall.test.ts"` | ✅ COVERED (reinstall.test.ts:2697/2722/2758) | ✅ green |
| BFILL-01 | Promotion rows fold into the single `applyReconcile` cascade notify (RECON-04 single-notify preserved, D-68-04) | unit (orchestrator) | `node --test "tests/orchestrators/reconcile/apply.test.ts" "tests/orchestrators/reconcile/notify.test.ts"` | ✅ COVERED | ✅ green |
| BFILL-02 | `EXTENSION_VERSION` constant is a non-empty semver string equal to repo-root `package.json` version (runtime version read) | unit (architecture) | `node --test "tests/architecture/extension-version-sync.test.ts"` | ✅ COVERED (extension-version-sync.test.ts:19/24) | ✅ green |
| BFILL-02 | Scan gate: changed/absent stamp opens the gate and stamps the running version; unchanged stamp skips the scan and leaves `state.json` untouched and silent (RECON-05); gate-open with zero force-installed plugins still stamps and emits nothing (D-68-03) | unit (orchestrator) | `node --test "tests/orchestrators/reconcile/backfill.test.ts"` | ✅ COVERED (backfill.test.ts:250/262/274/297) | ✅ green |
| BFILL-02 | `lastReconciledExtensionVersion` optional field validates and round-trips; an old doc without the stamp loads unchanged with no `schemaVersion` bump (additive, non-destructive migration, D-68-01) | unit (persistence) | `node --test "tests/persistence/state-io.test.ts"` | ✅ COVERED (state-io.test.ts:634/653) | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* Coverage landed during
execution across the reconcile/backfill, reinstall, state-io,
extension-version-sync, notify, and catalog-uat suites. No new framework, config,
or fixture file was required beyond the new `backfill.test.ts` and
`extension-version-sync.test.ts` files added in execution.

---

## Manual-Only Verifications

*All phase behaviors have automated verification.* The backfill promotion,
scan-gate semantics, version-stamp migration, single-cascade-notify rule, and the
runtime extension-version read are all exercised by `node:test` unit +
architecture tests.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-06-28

## Validation Audit 2026-06-28

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Retroactive audit: the scaffolded VALIDATION.md template was unfilled; this
document reconstructs the requirement-to-test map from phase artifacts. BFILL-01
and BFILL-02 both carry automated coverage landed during execution across 7 test
files (backfill, reinstall, apply, notify, extension-version-sync, state-io,
catalog-uat). 157 targeted tests pass. No new tests generated; no implementation
files touched.
