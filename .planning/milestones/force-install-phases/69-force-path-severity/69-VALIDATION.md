---
phase: 69
slug: force-path-severity
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-28
validated: 2026-06-28
---

# Phase 69 — Validation Strategy

> Per-phase validation contract. Reconstructed retroactively from phase
> artifacts (the scaffolded template was unfilled). Wires the force-path
> notifications to the SEV-01..05 desired-state severity ladder on the existing
> caller-stamped, MAX-reducing notification model.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in), Node >= 20.19.0 |
| **Config file** | none — globbed by `package.json` `test` script |
| **Quick run command** | `node --test "tests/orchestrators/plugin/install.test.ts" "tests/orchestrators/plugin/update.test.ts" "tests/orchestrators/marketplace/update.test.ts"` |
| **Full suite command** | `npm run check` (serialize with `TEST_CONCURRENCY=1` to avoid the temp-dir cleanup races noted in 65.1) |
| **Estimated runtime** | ~5 seconds (quick); ~120 seconds (full `npm run check`) |

---

## Sampling Rate

- **After every task commit:** Run the targeted install/update/marketplace-update/reconcile/notify file for the touched surface
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** `npm run check` must be green
- **Max feedback latency:** ~5 seconds (quick run)

---

## Per-Requirement Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| SEV-01 | Direct `install --force` / `update --force` degrade success → **info** (no `Warning:`); `reinstall` manual-recovery + missing soft-dep companion → **warning** | unit (orchestrator) + byte | `node --test "tests/orchestrators/plugin/install.test.ts" "tests/orchestrators/plugin/update.test.ts" "tests/architecture/catalog-uat.test.ts"` | ✅ COVERED | ✅ green |
| SEV-02 | Install of `unsupported` without `--force` → **error** appending a `--force` hint; install of `unavailable` (structural) → **error** with NO `--force` suggestion (three-way-arm conditioning, D-69-03) | unit (orchestrator) + byte | `node --test "tests/orchestrators/plugin/install.test.ts" "tests/shared/notify-v2.test.ts" "tests/architecture/notify-producer-wire-coverage.test.ts"` | ✅ COVERED | ✅ green |
| SEV-03 | Auto-update of a force-upgradable plugin taken automatically; **warning** only when it NEWLY degrades a previously-clean plugin, **info** when already degraded (prior-compatibility lookup, D-69-01) | unit (orchestrator) + byte | `node --test "tests/orchestrators/marketplace/update.test.ts" "tests/orchestrators/plugin/update.test.ts"` | ✅ COVERED | ✅ green |
| SEV-04 | Targeted `update <plugin>@<marketplace>` declining a force-upgradable upgrade → **warning**; untargeted/bulk `update` skipping one → **info** (invocation-shape signal, D-69-02) | unit (orchestrator) + byte | `node --test "tests/orchestrators/plugin/update.test.ts"` | ✅ COVERED | ✅ green |
| SEV-05 | Every row carries a factual `{reasons}` brace when reasons are present, including `installed` / `force-installed` / `force-upgradable` rows; brace-less rows stay byte-identical (D-69-04) | unit (orchestrator) + byte | `node --test "tests/orchestrators/reconcile/notify.test.ts" "tests/architecture/catalog-uat.test.ts"` | ✅ COVERED | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* Coverage landed during
execution across the install, update, marketplace-update, reconcile (notify +
apply), notify-v2, notify-inert-fields, notify-producer-wire-coverage, and
catalog-uat suites. No new framework, config, or fixture file was required.

---

## Manual-Only Verifications

*All phase behaviors have automated verification.* The severity-ladder stamping,
three-way-arm SEV-02 conditioning, newly-degraded SEV-03 detection, targeted-vs-
bulk SEV-04 distinction, and SEV-05 reasons-brace extension are all exercised by
`node:test` unit + byte-equality (catalog-uat) tests.

**Documented deliberate omission (not a gap):** the SEV-01 missing-companion
**warning** is intentionally NOT applied on the marketplace autoupdate cascade
surface (WR-01; recorded in 69-REVIEW.md and a comment in
`orchestrators/marketplace/update.ts`). SEV-01 targets the interactive install
and manual-update success arms; the autoupdate surface relies on the SEV-03
`newlyDegraded` warning for its actionable signal. This is a locked decision,
honored — not reopened.

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
document reconstructs the requirement-to-test map from phase artifacts. SEV-01..05
all carry automated coverage landed during execution across 10 test files. 375
targeted tests pass. The SEV-01 autoupdate-cascade omission is a documented,
deliberate decision (WR-01), honored as-is. No new tests generated; no
implementation files touched.
