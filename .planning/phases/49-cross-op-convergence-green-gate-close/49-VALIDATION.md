---
phase: 49
slug: cross-op-convergence-green-gate-close
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-08
---

# Phase 49 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution. This is the milestone
> GREEN-gate close: the final commit leaves the tree GREEN and ready for /gsd-audit-milestone.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in) + `node:assert/strict` |
| **Config file** | none (package.json `test` glob) |
| **Quick run command** | `node --test "tests/architecture/**/*.test.ts"` (catalog + types + the new convergence test) |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier:check + npm test) |
| **Byte-contract runner** | `node --test "tests/architecture/catalog-uat.test.ts"` |
| **Estimated runtime** | architecture cluster < 5s; full check ~1-2 min |

---

## Sampling Rate

- **While editing / per task:** `node --test "tests/architecture/**/*.test.ts"` (catalog + types + convergence -- the fast contract gate) + the touched op's `node --test tests/orchestrators/marketplace/<op>.test.ts`.
- **Per wave merge:** `npm test` (full suite).
- **Phase gate (milestone GREEN gate):** `npm run check` exit 0 (typecheck + lint + format + tests; count >= 1473 Phase-45 baseline, expect ~1502+) before `/gsd-verify-work` -> `/gsd-audit-milestone` -> `/gsd-complete-milestone`.
- **Max feedback latency:** architecture cluster < 5s.

---

## Per-Task Verification Map

> Task IDs assigned during planning. This phase closes NO requirements; the verification targets are
> the 5 ROADMAP success criteria + the two convergence fixes (marketplace-update gap, IN-02).

| Target | Behavior | Test Type | Automated Command | Status |
|--------|----------|-----------|-------------------|--------|
| SC#1 | All ops emit byte-identical `(failed) {not added}` for marketplace-absent; `marketplace update <missing>` converges (no raw throw) | architecture matrix + orchestrator regression | `node --test tests/architecture/cross-op-convergence.test.ts`; `node --test tests/orchestrators/marketplace/update.test.ts` | ⬜ pending |
| SC#2 | REASONS length-lock 29 + `not added` member; no new member | compile proof | `node --test tests/architecture/notify-types.test.ts` | ⬜ pending |
| SC#3 | Catalog byte-equality GREEN + no orphan fixture (both walks) | catalog UAT + inverse-walk coverage | `node --test tests/architecture/catalog-uat.test.ts` | ⬜ pending |
| SC#4 | `npm run check` exit 0; count >= 1473; no regression; NFR-5/7/10 unaffected | full gate | `npm run check` | ⬜ pending |
| SC#5 | Traceability all-mapped, no TBD | doc verify | `grep -c TBD .planning/REQUIREMENTS.md` -> 0 | ⬜ pending |
| IN-02 fix | schema-invalid manifest reads `{invalid manifest}` on info/list (parity with add) | unit (probe-classifiers) + catalog UAT | `node --test tests/shared/*probe*.test.ts`; catalog-uat | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

The convergence surface is implemented (Phases 46-48); this phase adds the proof + two small
convergence fixes:

- [ ] `tests/architecture/cross-op-convergence.test.ts` -- the SC#1 cross-op byte-identity matrix (all converged ops + both scope-bracket rows). NEW.
- [ ] `tests/architecture/catalog-uat.test.ts` -- ADD an inverse-walk coverage assertion (every FIXTURES (section,state) key has a matching catalog annotation) for SC#3 "no orphan".
- [ ] `tests/orchestrators/marketplace/update.test.ts` -- ADD a regression case: `marketplace update` of a missing marketplace emits `marketplace-not-added` (no raw throw), explicit-scope + bare forms.
- [ ] probe-classifier / info-surface test -- ADD a schema-invalid-manifest case asserting `{invalid manifest}` (IN-02 close).

No framework install.

---

## Manual-Only Verifications

*All phase behaviors have automated verification* (the convergence matrix, catalog byte-equality +
inverse walk, the marketplace-update regression, the IN-02 probe case, and the full `npm run check`
gate). SC#5 traceability is a deterministic `grep TBD` doc check.

---

## Validation Sign-Off

- [ ] Cross-op convergence matrix test GREEN (SC#1) incl. the newly-converged marketplace-update op
- [ ] catalog-uat byte-equality + inverse-walk GREEN (SC#3)
- [ ] REASONS length-lock + closed-set proof GREEN (SC#2)
- [ ] `npm run check` exit 0, count >= 1473 (SC#4)
- [ ] REQUIREMENTS.md no TBD; all 15 mapped (SC#5)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
