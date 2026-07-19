---
phase: 66
slug: derived-force-state-glyphs
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-27
validated: 2026-06-28
---

# Phase 66 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 66-RESEARCH.md "Validation Architecture". This phase is
> derivation/display only; all behaviors have automated coverage in existing
> test files (no Wave 0 framework install).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in) + `node:assert/strict` |
| **Config file** | none — glob in `package.json` `test` script |
| **Quick run command** | `node --test "tests/architecture/notify-closed-set-locks.test.ts" "tests/shared/notify-v2.test.ts"` |
| **Full suite command** | `npm run check` (serialize with `TEST_CONCURRENCY=1` to avoid the temp-dir cleanup races noted in 65.1) |
| **Estimated runtime** | ~60-120 seconds (full `npm run check`); quick run ~3s |

---

## Sampling Rate

- **After every task commit:** Run `node --test "tests/architecture/notify-closed-set-locks.test.ts" "tests/shared/notify-v2.test.ts"`
- **After every plan wave:** Run `node --test "tests/architecture/**/*.test.ts" "tests/orchestrators/plugin/**/*.test.ts" "tests/orchestrators/reconcile/**/*.test.ts"`
- **Before `/gsd-verify-work`:** `npm run check` must be green (TEST_CONCURRENCY=1)
- **Max feedback latency:** ~10 seconds (quick run + targeted orchestrator tests)

---

## Per-Task Verification Map

> Task IDs resolve once plans land; rows are keyed by requirement + target plan.
> The closed-set tripwire wave (notify vocabulary) MUST land atomically in one
> green commit per the lockstep gate (D-66-05).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 66-01-* | 01 | 1 | FSTAT-02 / D-66-05 | — / N/A | `◉` force-installed glyph distinct from `●`; closed sets bump exactly | architecture+unit | `node --test "tests/architecture/notify-closed-set-locks.test.ts"` | ✅ COVERED | ✅ green |
| 66-01-* | 01 | 1 | FSTAT-04 | — / N/A | force-upgradable wears `●`; union arms render via assertNever | unit (byte) | `node --test "tests/shared/notify-v2.test.ts"` | ✅ COVERED | ✅ green |
| 66-01-* | 01 | 1 | FSTAT-06 | — / N/A | `will force install` modifier renders; grammar invariant holds | invariant | `node --test "tests/architecture/notify-grammar-invariant.test.ts"` | ✅ COVERED | ✅ green |
| 66-02-* | 02 | 2 | FSTAT-01 / FSTAT-03 | — / N/A | derivation purity (no state write); auto-return to installed | unit | `node --test "tests/orchestrators/plugin/list.test.ts"` | ✅ COVERED | ✅ green |
| 66-02-* | 02 | 2 | FSTAT-04 / FSTAT-05 | — / N/A | force-upgradable matrix + exclusion-of-force-installed; no-network resolve | unit+architecture | `node --test "tests/orchestrators/plugin/list.test.ts" "tests/architecture/no-orchestrator-network.test.ts"` | ✅ COVERED | ✅ green |
| 66-03-* | 03 | 2 | FSTAT-07 | — / N/A | info `force-installed` + dropped-component detail; success row reads "force-installed" | unit | `node --test "tests/orchestrators/plugin/info.test.ts"` | ✅ COVERED | ✅ green |
| 66-04-* | 04 | 2 | FSTAT-06 | — / N/A | reconcile pending `will force install` via force modifier; `will force update` absent | unit | `node --test "tests/orchestrators/reconcile/*.test.ts"` | ✅ COVERED | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* New CASES are added to
existing files (`notify-closed-set-locks`, `catalog-uat`, `notify-grammar-invariant`,
`notify-stamp-coverage`, `notify-v2`, list/info/reconcile orchestrator tests). No new
framework, config, or fixture file is required.

**Lockstep reminder:** any new force-installed / force-upgradable example added to
`docs/output-catalog.md` requires a matching `FIXTURES` entry in
`tests/architecture/catalog-uat.test.ts` in the SAME commit.

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

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

Retroactive audit: FSTAT-01..07 all carry automated coverage landed during
execution (closed-set locks, notify-v2 byte, grammar-invariant, list force-state
derivation, info dropped-component detail, reconcile `will force install`,
catalog-uat). 253 + 97 targeted tests pass across architecture/notify, list,
info, and reconcile suites. No new tests generated; no implementation files
touched.
