---
phase: "01"
slug: "live-evidence-revalidation"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
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

The final tracked implementation locations are `scripts/revalidation.mjs`,
`scripts/revalidation.negative.mjs`, and
`tests/architecture/revalidation.test.ts`. The canonical ledger uses normalized
top-level `files`, `sourceClaims`, `findings`, `decisions`, and `scopeChanges`
arrays as specified in `01-REVALIDATION-SCHEMA.md`. Mutation probes operate only
on repository-local temporary copies of the required source-test pair and
fixtures; they never patch the developer's live source or tests, and real state
remains approval-gated (01-RESEARCH.md, Open Questions (RESOLVED)).

---

## Sampling Rate

- **After every task commit:** Run the focused validator tests and `node scripts/revalidation.mjs validate --allow-incomplete`
- **After every plan wave:** Regenerate the Markdown view, validate the ledger, and run retained behavioral probes
- **Before `$gsd-verify-work`:** `npm run check` must be green, the generated view must be clean, the ledger must have no `inconclusive` record, and corpus coverage must be exactly 110/110
- **Max feedback latency:** 30 seconds for the focused validator check

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01-01 | 1 | RVAL-01, RVAL-02 | T-01-01 / T-01-02 | Reject path escape and instruction-derived records while proving stable rendering | tracer + architecture | `node --test tests/architecture/revalidation.test.ts --test-name-pattern='tracer'` | ✅ | ✅ green |
| 01-01-02 | 01-01 | 1 | RVAL-02, RVAL-03, RVAL-04 | T-01-01…T-01-05 | Reject malformed identities, invalid links, incomplete evidence/decisions/scope, unsafe shards, leakage, and view drift | unit + planted negative | `node --test tests/architecture/revalidation.test.ts && node scripts/revalidation.negative.mjs` | ✅ | ✅ green |
| 01-01-03 | 01-01 | 1 | RVAL-01 | T-01-01 / T-01-04 | Accept only the locked sorted 110-path inventory and canonical generated view | live manifest | `node scripts/revalidation.mjs inventory && node scripts/revalidation.mjs render && node scripts/revalidation.mjs validate --allow-incomplete` | ✅ | ✅ green |
| 01-02-01…01-54-03 | 01-02…01-54 | 2 | RVAL-01, RVAL-02 | T-01-02-01…T-01-43-03 | Preserve claim identity and reject incomplete or unsafe evidence records in 53 measured exclusive shards; mutation probes use only isolated repository-local copies | unit + shard ledger | `node scripts/revalidation.mjs validate-shard --assignment .planning/phases/01-live-evidence-revalidation/01-CORPUS-ASSIGNMENT.md --plan 01-NN --shard .planning/phases/01-live-evidence-revalidation/shards/01-NN.json` | ❌ W0 | ⬜ pending |
| 01-55-01 | 01-55 | 3 | RVAL-01, RVAL-02 | T-01-55-01 | Merge exact 110/110 evidence and block incomplete claims | live ledger | `node scripts/revalidation.mjs validate` | ❌ W0 | ⬜ pending |
| 01-58-01…01-66-01 | 01-58…01-66 | 6-14 | RVAL-03 | T-01-45-01…T-01-47-02 | Keep operator decisions unresolved until every premise has terminal live evidence | decision ledger | `node scripts/revalidation.mjs validate --decision MF-DEC-NN` | ❌ W0 | ⬜ pending |
| 01-68-01 | 01-67…01-69 | 15-17 | RVAL-04 | T-01-67…01-69-01 | Preserve historical traceability while removing stale-only scope from active requirements | artifact validation | `node scripts/revalidation.mjs scope-impact --check` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `scripts/revalidation.mjs` — enumerate, validate, and render the canonical ledger
- [x] `tests/architecture/revalidation.test.ts` — positive and planted-negative semantic validation
- [x] A schema/protocol document defining identities, required fields, evidence methods, and completion rules
- [x] `01-REVALIDATION.json` initialized with all 110 sorted file records and no falsely completed reviews
- [x] Negative cases for missing, extra, or duplicate paths; duplicate identities; dangling or cyclic duplicate links; missing evidence; illegal status or route; unresolved decision premises; and Markdown drift

---

## Manual-Only Verifications

All phase completion behaviors have automated validation. The operator still makes policy choices for live surviving premises, but the ledger mechanically enforces that their evidence, alternatives, selection, and downstream effects are recorded.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30 seconds for focused checks
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** automated evidence green for Plan 01-01
