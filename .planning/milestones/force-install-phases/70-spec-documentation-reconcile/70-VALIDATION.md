---
phase: 70
slug: spec-documentation-reconcile
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-28
validated: 2026-06-28
---

# Phase 70 — Validation Strategy

> Per-phase validation contract. Created retroactively from phase artifacts (no
> scaffolded VALIDATION.md existed). Final milestone phase: reconcile the
> byte-level output-contract docs and the PRD to the shipped force design, freeze
> the `--force` hint trailer, finalize the `unavailable`-arm severity, and sweep
> stale comments. Largely a documentation reconcile; the byte contract is guarded
> by the catalog-UAT byte-equality runner.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in), Node >= 20.19.0 |
| **Config file** | none — globbed by `package.json` `test` script |
| **Quick run command** | `node --test "tests/architecture/catalog-uat.test.ts" "tests/orchestrators/plugin/install.test.ts" "tests/architecture/notify-closed-set-locks.test.ts"` |
| **Full suite command** | `npm run check` (serialize with `TEST_CONCURRENCY=1` to avoid the temp-dir cleanup races noted in 65.1) |
| **Estimated runtime** | ~3 seconds (quick); ~120 seconds (full `npm run check`) |

---

## Sampling Rate

- **After every task commit:** Run `node --test "tests/architecture/catalog-uat.test.ts"` (byte-equality gate) plus the touched orchestrator file
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** `npm run check` must be green
- **Max feedback latency:** ~3 seconds (quick run)

---

## Per-Requirement Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| DOC-02 | `docs/output-catalog.md` + `docs/messaging-style-guide.md` reflect the reconciled token set (`force-installed`, `unsupported`, `force-upgradable`), derived-state severity, and exact byte forms; catalog-UAT byte-equality GREEN; closed set unchanged (22/17/7) | byte-equality | `node --test "tests/architecture/catalog-uat.test.ts" "tests/architecture/notify-closed-set-locks.test.ts"` | ✅ COVERED | ✅ green |
| D-70-02 (SEV-02 residual) | No-`--force` install of an `unavailable` (structural) plugin stamps **error** severity with NO `--force` suggestion; the `unsupported` arm stamps the `--force` hint at error | unit (orchestrator) | `node --test "tests/orchestrators/plugin/install.test.ts"` (install.test.ts:2273-2297) | ✅ COVERED | ✅ green |
| D-70-01 (hint freeze) | The frozen `FORCE_INSTALL_HINT_TRAILER` byte form (`Re-run with --force to install the supported components.`) renders on the force-degradable install error and is locked into the catalog | unit (orchestrator) + byte | `node --test "tests/orchestrators/plugin/install.test.ts" "tests/architecture/catalog-uat.test.ts"` | ✅ COVERED | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* The byte contract was
maintained in lockstep across the milestone (65.1/66/67/69), so Phase 70 is the
final reconcile, not new test scaffolding. The only code change (D-70-02
`unavailable`-arm severity) is covered by the existing `install.test.ts`
severity cases; the byte forms are covered by the existing `catalog-uat`
byte-equality runner. No new framework, config, or fixture file was required.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PRD §11 documents `--force` install/update, the three-way resolver state, the new status tokens, and force-upgradable rules; dropped scope (global force default, manual `complete` command) FULLY REMOVED | DOC-01 | Prose-spec correctness in `docs/prd/pi-claude-marketplace-prd.md` is not a unit-testable byte contract; verified by gsd-verifier review (70-VERIFICATION.md, 10/10) cross-checked against REQUIREMENTS.md | Read PRD §11; confirm it describes only the shipped force design and contains no "global force default" / manual `complete` text |
| No stale comment claims idempotent autoupdate is "warning"; idempotent skips documented as info/benign | DOC-03 | Comment-cleanliness sweep across `notify.ts` / `marketplace/update.ts` / `plugin/update.ts` / `reinstall.ts` is a prose review, not a runtime assertion | `grep -rn "idempotent.*warning" extensions/` — confirm surviving comments read "idempotent skip -> info, actionable skip -> warning" (the reconciled rule), with no claim that an idempotent autoupdate is a warning |

*DOC-01 and DOC-03 are documentation/comment reconciles — inherently prose-review
verifications. The verifier subagent independently confirmed Phase 70 at 10/10.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (DOC-01/DOC-03 are documented manual-only prose reconciles)
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
| Escalated (manual-only) | 2 |

Retroactive audit: no scaffolded VALIDATION.md existed; this document is created
from phase artifacts. DOC-02 (byte contract) and the D-70-02 `unavailable`-arm
severity code change carry automated coverage (catalog-UAT byte-equality +
`install.test.ts` severity cases); D-70-01 hint-freeze byte form is locked in
both. DOC-01 (PRD §11 prose) and DOC-03 (stale-comment sweep) are documentation
reconciles classified manual-only — verified by the gsd-verifier review (10/10).
139 targeted tests pass (catalog-uat, install, update, closed-set locks). No new
tests generated; no implementation files touched.
