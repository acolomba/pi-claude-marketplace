---
phase: "3"
slug: "typed-raw-surfaces"
# status lifecycle: draft (seeded by plan-phase) -> validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
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

Filled by the planner per task; requirement-level map from RESEARCH.md:

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| RAWS-01 | usage-error / usage-info bytes and arity (SNM-13) | unit | `node --test tests/shared/notification-dispatch.test.ts tests/edge/handlers/plugin/help.test.ts` | ✅ | ⬜ pending |
| RAWS-02 | diagnostic join and empty no-op | unit | `node --test tests/shared/notification-dispatch.test.ts tests/orchestrators/import/execute.test.ts tests/orchestrators/reconcile/apply.test.ts` | ✅ | ⬜ pending |
| RAWS-03 | domain passes values; prompt bytes; AUTH-09 retarget | unit + arch | `node --test tests/domain/github-auth.test.ts tests/orchestrators/auth-host.test.ts tests/architecture/no-credential-leak.test.ts` | ✅ (planted controls ❌ W0) | ⬜ pending |
| RAWS-04 | reconcile-aborted / plugin-path-skipped bytes; resolve serializes cause | unit | `node --test tests/index.test.ts tests/shared/notification-resolve.test.ts` | ✅ | ⬜ pending |
| RAWS-05 | rewake passthrough; cap from the bridge constant | unit + arch | `node --test tests/bridges/hooks/settle.test.ts tests/bridges/hooks/async-rewake/registry.test.ts tests/architecture/hooks-cap-notify.test.ts` | ✅ | ⬜ pending |
| TEXT-01 | per-kind arity (D-15); sink-only strings (D-16); bytes | unit + arch + tooling | `node --test tests/shared/notification-grammar.test.ts tests/architecture/<sink-gate>.test.ts && node scripts/notify-corpus.mjs check` | ❌ W0 (sink gate) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Sink-gate architecture test with planted controls (D-16)
- [ ] Planted-control cases in `tests/architecture/no-credential-leak.test.ts` (D-11)
- [ ] D-15 per-kind arity rows in the text-strategy test
- [ ] `.planning/phases/03-typed-raw-surfaces/03-CORPUS-CHANGES.json` ledger (D-17)

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 1600s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
