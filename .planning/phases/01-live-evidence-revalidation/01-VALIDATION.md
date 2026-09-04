---
phase: "01"
slug: "live-evidence-revalidation"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-04"
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in test runner on Node v26.8.1 |
| **Config file** | none — repository scripts invoke `node --test` directly |
| **Quick run command** | `node --test tests/architecture/revalidation.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | quick check under 30 seconds; full suite measured during execution |

---

## Sampling Rate

- **After every task commit:** Run the focused validator tests and `node scripts/revalidation.mjs validate`
- **After every plan wave:** Regenerate the Markdown view, validate the ledger, and run retained behavioral probes
- **Before `$gsd-verify-work`:** `npm run check` must be green, the generated view must be clean, the ledger must have no `inconclusive` record, and corpus coverage must be exactly 110/110
- **Max feedback latency:** 30 seconds for the focused validator check

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-W0-01 | TBD | 0 | RVAL-01, RVAL-02 | T-01 / T-02 | Reject path escape, malformed identities, invalid links, missing evidence, and view drift | unit + architecture | `node --test tests/architecture/revalidation.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-01 | TBD | 1 | RVAL-01 | T-01 | Accept only the locked, sorted 110-path inventory | unit + live manifest | `node scripts/revalidation.mjs validate` | ❌ W0 | ⬜ pending |
| 01-02-01 | TBD | 2 | RVAL-02 | T-01 / T-03 | Preserve claim identity and reject incomplete or unsafe evidence records | unit + live ledger | `node scripts/revalidation.mjs validate` | ❌ W0 | ⬜ pending |
| 01-03-01 | TBD | 3 | RVAL-03 | T-03 | Keep operator decisions unresolved until every premise has terminal live evidence | unit + live ledger | `node --test tests/architecture/revalidation.test.ts --test-name-pattern='decision'` | ❌ W0 | ⬜ pending |
| 01-04-01 | TBD | 4 | RVAL-04 | T-03 | Preserve historical traceability while removing stale-only scope from active requirements | unit + artifact validation | `node scripts/revalidation.mjs validate` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/revalidation.mjs` — enumerate, validate, and render the canonical ledger
- [ ] `tests/architecture/revalidation.test.ts` — positive and planted-negative semantic validation
- [ ] A schema/protocol document defining identities, required fields, evidence methods, and completion rules
- [ ] `01-REVALIDATION.json` initialized with all 110 sorted file records and no falsely completed reviews
- [ ] Negative cases for missing, extra, or duplicate paths; duplicate identities; dangling or cyclic duplicate links; missing evidence; illegal status or route; unresolved decision premises; and Markdown drift

---

## Manual-Only Verifications

All phase completion behaviors have automated validation. The operator still makes policy choices for live surviving premises, but the ledger mechanically enforces that their evidence, alternatives, selection, and downstream effects are recorded.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30 seconds for focused checks
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
