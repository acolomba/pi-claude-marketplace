---
phase: 99
slug: post-audit-tech-debt-closure
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-10
updated: 2026-08-10
---

# Phase 99 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

**Spec-less probe fallback: skipped (visible skip).** This phase has no requirement IDs to probe —
ROADMAP §Phase 99 records it as post-audit debt closure tracked by decision IDs and audit items,
not by REQUIREMENTS.md IDs. Must-haves were derived instead from the ROADMAP success criteria and
the mechanism sections of the three carrier todos, with prohibitions authored per plan where a
wrong turn is foreseeable.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node ≥20.19.0 built-in) + `node:assert/strict` |
| **Config file** | none — glob-driven from `package.json` scripts |
| **Quick run command** | `node --test <one suite file>` |
| **Full suite command** | `PI_SUBAGENTS_ROOT=/home/acolomba/.pi/agent/npm/node_modules/pi-subagents npm run check` |
| **Estimated runtime** | single suite ~5-20s; full check several minutes (3386 unit + 18 integration) |

---

## Sampling Rate

- **After every task commit:** `node --test <the affected suite>`, plus `npm run typecheck` whenever a type moved
- **After every plan wave:** `npm run typecheck && npm run lint && npm test`
- **Before `/gsd-verify-work`:** `PI_SUBAGENTS_ROOT=… npm run check` with `CHECK_EXIT` captured directly; 0 required
- **Max feedback latency:** < 60s per task (single-suite runs)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 99-01-01 | 01 | 1 | D-99-02c | T-99-01-01 | persisted install-record key set unmoved (COMPAT-01 pin untouched) | typecheck + unit | `npm run typecheck && node --test tests/orchestrators/plugin/reinstall.test.ts tests/orchestrators/reconcile/notify.test.ts` | ✅ | ⬜ pending |
| 99-01-02 | 01 | 1 | D-99-02c | T-99-01-02 | boolean signal consumers cannot accept a name array (type-enforced) | typecheck + grep + unit | `npm run typecheck && node --test tests/orchestrators/plugin/update.test.ts tests/orchestrators/marketplace/update.test.ts` | ✅ | ⬜ pending |
| 99-02-01 | 02 | 1 | D-99-02b | T-99-02-02 | each twin spelling of the disabled-state rederivation is flagged | unit (self-test) | `node --test tests/orchestrators/reconcile/plan.test.ts` | ✅ (new cases) | ⬜ pending |
| 99-02-02 | 02 | 1 | D-99-02b | T-99-02-01 | whole-tree walk stays green; no pattern is global | architecture (walk) | `node --test tests/orchestrators/reconcile/plan.test.ts && npm run lint` | ✅ | ⬜ pending |
| 99-03-01 | 03 | 1 | D-99-04 | T-99-03-01 | catalog byte contract holds in both walk directions | architecture (byte) | `node --test tests/architecture/catalog-uat.test.ts` | ✅ (new fixture) | ⬜ pending |
| 99-03-02 | 03 | 1 | D-99-04 | T-99-03-01 | prose edit stayed outside every compared fence | architecture (byte) | `node --test tests/architecture/catalog-uat.test.ts tests/architecture/partial-vocabulary-guard.test.ts` | ✅ | ⬜ pending |
| 99-03-03 | 03 | 1 | D-99-04 | T-99-03-02 | the eight live-meaning files keep their identifier | grep + typecheck + lint | `! grep -rn "RLD-04" extensions/ && npm run typecheck && npm run lint && npm run format:check` | ✅ | ⬜ pending |
| 99-04-01 | 04 | 2 | WR-12 / D-99-03 | T-99-04-01, T-99-04-02 | degraded update row names the shortfall; reasons come only from the closed set | integration (byte, through the public verb) | `npm run typecheck && node --test tests/orchestrators/plugin/update.test.ts` | ✅ (new cases) | ⬜ pending |
| 99-04-02 | 04 | 2 | WR-12 / D-99-03 | T-99-04-01 | cascade row byte-equals standalone row (one composer, no drift) | integration (byte) | `npm run typecheck && node --test tests/orchestrators/plugin/update.test.ts tests/orchestrators/marketplace/update.test.ts` | ✅ | ⬜ pending |
| 99-04-03 | 04 | 2 | WR-12 / D-99-03 | T-99-04-03 | catalog fixture matches emitted bytes; no closed set grew | architecture (byte + enumeration) | `node --test tests/architecture/catalog-uat.test.ts tests/architecture/compat-01-no-expansion.test.ts` | ✅ (new fixture) | ⬜ pending |
| 99-05-01 | 05 | 3 | D-99-02a | T-99-05-01, T-99-05-02 | absence claimed only after a successful read; domain layering keeps no cycle | unit (regression, unchanged assertions) | `npm run typecheck && node --test tests/orchestrators/plugin/list.test.ts tests/orchestrators/plugin/list-manifest-absent.test.ts` | ✅ | ⬜ pending |
| 99-05-02 | 05 | 3 | D-99-02a | T-99-05-01 | info and update absence rows byte-unchanged after rewiring | unit (regression, unchanged assertions) | `npm run typecheck && node --test tests/orchestrators/plugin/info.test.ts tests/orchestrators/plugin/info-manifest-absent.test.ts tests/orchestrators/plugin/update.test.ts tests/architecture/catalog-uat.test.ts` | ✅ | ⬜ pending |
| 99-05-03 | 05 | 3 | D-99-02a | T-99-05-01, T-99-05-04 | a fourth surface cannot re-derive the lookup ungated | architecture (walk + self-test) | `node --test tests/architecture/manifest-lookup-drift.test.ts && npm run lint` | ❌ W0 (created in-task) | ⬜ pending |
| 99-06-01 | 06 | 4 | D-99-05a | T-99-06-01, T-99-06-02 | refreshed source stays containment-validated; enabled path untouched | unit + integration (byte) | `npm run typecheck && node --test tests/orchestrators/plugin/update.test.ts` | ✅ (new cases) | ⬜ pending |
| 99-06-02 | 06 | 4 | D-99-05a | T-99-06-04 | no-op refresh writes nothing (guard proven load-bearing) | unit (mutation-proven) | `node --test tests/orchestrators/plugin/update.test.ts tests/orchestrators/marketplace/update.test.ts tests/orchestrators/plugin/enable-disable.test.ts` | ✅ | ⬜ pending |
| 99-07-01 | 07 | 5 | D-99-05b | T-99-07-02 | coverage metric reflects real coverage (no exclusion added) | measurement | `test -s coverage/unit.lcov && ls .planning/todos/pending/ \| grep -i coverage` | ✅ (script exists) | ⬜ pending |
| 99-07-02 | 07 | 5 | D-99-05b | T-99-07-01 | rollback arms restore state, asserted on consequence | unit | `node --test tests/orchestrators/plugin/update.test.ts && npm run lint` | ✅ (new cases) | ⬜ pending |
| 99-07-03 | 07 | 5 | D-99-05b | T-99-07-01, T-99-07-03 | reinstall/install failure arms covered; fixtures carry no secret | unit | `node --test tests/orchestrators/plugin/reinstall.test.ts tests/orchestrators/plugin/install.test.ts && npm run lint` | ✅ (new cases) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity:** every one of the 18 tasks carries an `<automated>` verify. No three
consecutive tasks lack automated feedback. No watch-mode flag appears in any command.

---

## Wave 0 Requirements

Existing infrastructure covers all but one file. `node:test` is built in, every affected suite
already exists, and `tests/helpers/` already supplies the mock factories, so no framework install
and no shared-fixture bootstrap is needed.

- [ ] `tests/architecture/manifest-lookup-drift.test.ts` — the only NEW test file in the phase.
      Created inside task 99-05-03 itself (its planted-twin self-test is written before the
      patterns are wired into the walk), so it needs no separate Wave 0 pass.

All other new coverage lands as new CASES in existing suites:
- degraded-update byte case + clean-row non-regression guard (99-04-01) — `tests/orchestrators/plugin/update.test.ts`
- degraded-command, both-kinds-ordered, cascade-equals-standalone (99-04-02) — same file
- `update-degraded-component` FIXTURES entry (99-04-03) and the autoupdate cascade skip fixture (99-03-01) — `tests/architecture/catalog-uat.test.ts`
- widened-regex self-tests and negative controls (99-02-01) — `tests/orchestrators/reconcile/plan.test.ts`
- moved-source refresh, compatibility drift, guard-is-load-bearing (99-06-01/02) — `tests/orchestrators/plugin/update.test.ts`
- measured residual failure/rollback arms (99-07-02/03) — update, reinstall and install suites

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The deep-equal refresh guard is genuinely load-bearing | D-99-05a | An automated assertion proves the guard's EFFECT; proving the guard is what produces that effect requires deleting it and observing the red, which no committed test can do to itself | In task 99-06-02: comment out the guard, run `node --test tests/orchestrators/plugin/update.test.ts`, confirm the nothing-moved case fails, restore the guard, confirm green. Record the observed failure text in the summary. |

Runtime UAT before archive was explicitly waived by the operator (D-99-01), on the grounds that
coverage is sufficient. For WR-12 specifically the waiver is defensible because the deliverable IS
a byte fixture asserted through the public verb — the fixture is the verification.

Everything else in the phase has automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (one new file, created in-task)
- [x] No watch-mode flags
- [x] Feedback latency < 60s per task
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
