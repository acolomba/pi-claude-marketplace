---
phase: "3"
slug: "typed-raw-surfaces"
# status lifecycle: draft (seeded by plan-phase) -> validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: true) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-02"
---

# Phase 3 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` + `strong-mock` (existing) |
| **Config file** | `package.json` scripts; `tsconfig.json` |
| **Quick run command** | `node --test tests/shared/notification-dispatch.test.ts tests/shared/notification-grammar.test.ts tests/shared/notification-resolve.test.ts` |
| **Full suite command** | `npm run check` (observed 23-27 min; `test_gate_timeout` 2400 s) |
| **Corpus** | `node scripts/notify-corpus.mjs check` (~140 s, not in `check`); nothing missing beyond the D-17 ledger, extras exactly the ledgered ones |
| **Catalog** | `git diff --exit-code 4e6c568a -- docs/output-catalog.md` and `node --test tests/architecture/catalog-uat/catalog-contract.test.ts` |
| **Estimated runtime** | ~1500 seconds (full); ~30 seconds (quick) |

---

## Sampling Rate

- **After every task commit:** the task's owner tests plus `npm run typecheck`, and pre-commit run manually (`SKIP=trufflehog pre-commit run --files ...`)
- **After every plan wave:** `npm run check` unpiped with the exit code written to a log, then the corpus check, the catalog diff, and `npm run lint:type-members` after Prettier
- **Before `/gsd-verify-work`:** full suite green, corpus matches the ledger exactly, catalog diff empty
- **Max feedback latency:** 1600 seconds

---

## Per-Task Verification Map

All commands run from the checkout root. Each PLAN `<automated>` command has a
paired `<fails_when>`. The corpus tool accepts extras by design, so exit 0 alone
is insufficient: the corpus wrapper commands in the plans assert the exact
missing and extra lines.

| Task ID | Wave | Requirement | Behavior and owner | Automated command | Threat Ref | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 03-01-01 | 1 | RAWS-04, TEXT-01 | Tracer: load-time kinds through resolve, text strategy, and the single sink; structured path on the same sink; real extension load unchanged | `npm run typecheck && node --test tests/index.test.ts tests/shared/notification-types.test.ts tests/shared/notification-resolve.test.ts tests/shared/notification-grammar.test.ts tests/shared/notification-dispatch.test.ts` | T-03-01, T-03-02, T-03-03 | ✅ green |
| 03-01-01 | 1 | TEXT-01 | Corpus: no missing entry, exactly the two approved dispatch-test extras | The corpus wrapper `node --input-type=module -e` command in 03-01 Task 1 | T-03-05 | ✅ green |
| 03-01-02 | 1 | RAWS-01 | usage-error and usage-info kinds; SNM-13 bytes; RAWS-01 edges; callers unchanged | `npm run typecheck && node --test tests/shared/notification-types.test.ts tests/shared/notification-grammar.test.ts tests/shared/notification-dispatch.test.ts tests/edge/handlers/plugin/help.test.ts tests/edge/router.test.ts tests/edge/handlers/shared.test.ts` and the D-03 `git diff --exit-code 4e6c568a -- …` caller command | T-03-01, T-03-03 | ✅ green |
| 03-02-01 | 2 | RAWS-02 | diagnostic kind; joins and the empty no-op in the text strategy; producers unchanged | `npm run typecheck && node --test tests/shared/notification-types.test.ts tests/shared/notification-grammar.test.ts tests/shared/notification-dispatch.test.ts tests/orchestrators/import/execute.test.ts tests/orchestrators/plugin/shared.test.ts tests/orchestrators/reconcile/apply.test.ts` | T-03-06, T-03-08 | ✅ green |
| 03-02-02 | 2 | RAWS-05 | Hook kinds; rewake passthrough; cap from STOP_OVERRIDE_CAP; byte pins hold | `npm run typecheck && node --test tests/shared/notification-types.test.ts tests/shared/notification-grammar.test.ts tests/shared/notification-dispatch.test.ts tests/architecture/hooks-cap-notify.test.ts tests/architecture/hooks-async-rewake.test.ts tests/bridges/hooks/settle.test.ts tests/bridges/hooks/runtime.test.ts tests/bridges/hooks/async-rewake/registry.test.ts` | T-03-06, T-03-07 | ✅ green |
| 03-03-01 | 3 | RAWS-03 | Domain passes values; prompt bytes; raw callback deleted; AUTH-09 retargeted with positive counts | `npm run typecheck && node --test tests/domain/github-auth.test.ts tests/domain/device-flow-fake.test.ts tests/orchestrators/auth-host.test.ts tests/orchestrators/marketplace/add.test.ts tests/shared/notification-types.test.ts tests/shared/notification-grammar.test.ts tests/shared/notification-dispatch.test.ts tests/architecture/no-credential-leak.test.ts tests/integration/auth-e2e.test.ts` | T-03-09, T-03-10, T-03-12 | ✅ green |
| 03-03-02 | 3 | TEXT-01 | D-17 ledger: exactly two removals and three additions against blob `225a5161a97bc3952a41cfae067592fe2c8bc6ca` | The ledger `node --input-type=module -e` command in 03-03 Task 2, which must print `Approved corpus changes: 2 removals, 3 additions; unchanged occurrences: 3131; total: 3134` | T-03-11 | ✅ green |
| 03-04-01 | 4 | RAWS-03 | AUTH-09 planted offenders reject; benign and comment near-miss pass | `node --test tests/architecture/no-credential-leak.test.ts` | T-03-13 | ✅ green |
| 03-04-02 | 4 | TEXT-01 | D-16 presentation-sink gate and its planted controls | `node --test tests/architecture/presentation-sink.test.ts tests/architecture/gate-targets.test.ts tests/architecture/source-scan.test.ts` | T-03-14, T-03-15 | ✅ green |
| All | 1-4 | All | Changed source owners keep 100% direct coverage | `npm run test:coverage:direct -- <changed sources>` per task; `npm run test:coverage:direct:all` through each full-fallback pre-commit | T-03-01 | ✅ green |
| All | 1-4 | All | Full project quality gates | `npm run check`, unpiped, exit code written to a log | T-03-01, T-03-11 | ✅ green |
| All | 1-4 | TEXT-01 | Corpus: 3134 present, 0 extra after 03-03; catalog unchanged with 260 states and 39,143 bytes | Corpus wrapper; `git diff --exit-code 4e6c568a -- docs/output-catalog.md`; `node --test tests/architecture/catalog-uat/catalog-contract.test.ts` | T-03-05, T-03-11 | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Sink-gate architecture test with planted controls (D-16): 03-04 Task 2
- [x] Planted-control cases in `tests/architecture/no-credential-leak.test.ts` (D-11): 03-04 Task 1; the retarget with positive counts lands with the rename in 03-03 Task 1
- [x] D-15 per-kind arity rows in the text-strategy test: created in 03-01 Task 1; a mapped type over every resolved kind forces one row per kind added in 03-01 Task 2, 03-02, and 03-03
- [x] `.planning/phases/03-typed-raw-surfaces/03-CORPUS-CHANGES.json` ledger (D-17): 03-03 Task 2

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 1600s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-03

## Validation Audit 2026-10-03

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Every mapped test file ran green in one `node --test` run (1159 pass, 0 fail). The verifier ran the corpus check (3134 present, 0 extra) and the D-17 ledger command (`2 removals, 3 additions`). The full `npm run check` passed at `13729cd8`, the current code tree.
