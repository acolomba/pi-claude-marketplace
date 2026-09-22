---
phase: "09"
slug: "reload-installs-missing-dependencies"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-21"
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in `node:test` + `node:assert/strict`, with `--experimental-test-coverage` for the coverage gates |
| **Config file** | none — test discovery and coverage thresholds are inline flags on the `npm run test:*` scripts in `package.json` |
| **Quick run command** | `npm run test:corresponding` then a targeted `node --test tests/orchestrators/reconcile/plan.test.ts tests/orchestrators/reconcile/apply.test.ts tests/orchestrators/reconcile/dependency-verdict.test.ts tests/orchestrators/plugin/install-cascade.test.ts tests/orchestrators/plugin/install-flow.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~2-5 minutes for the targeted files; `npm run check` runs longer (full unit + integration + lint gates) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:corresponding` plus the targeted `node --test` invocation covering only the files touched by that task.
- **After every plan wave:** Run `npm run test:coverage:direct:commit` (every changed line covered by its paired test) and `npm run test:coverage:unit` (100% line/function/branch over `extensions/**`).
- **Before `/gsd-verify-work`:** `npm run check` must be green.
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | MISS-01 | T-09-01 | Bucket derives from the verdict's `missing` arm; D-09-02 inclusion predicate; deduped by key; sorted by key; `pluginsToInstall` keys excluded; raw ranges + `requiredBy` carried, no fold in `plan.ts` | unit | `node --test tests/orchestrators/reconcile/plan.test.ts tests/orchestrators/reconcile/dependency-verdict.test.ts tests/orchestrators/reconcile/notify.test.ts tests/orchestrators/reconcile/types.test.ts` | ✅ | ⬜ pending |
| 09-01-01 | 01 | 1 | MISS-01 | — | Convergence fixpoint: missing key plans the bucket; recorded-as-dependency plans nothing; the D-09-14 retry re-plans the same entry | integration | `node --test tests/integration/reconcile-plan-convergence.test.ts` | ✅ | ⬜ pending |
| 09-01-02 | 01 | 1 | MISS-01 | T-09-03 | D-09-08 lift is provenance-independent; a user's disable and a config-declared disable are never lifted | unit | `node --test tests/orchestrators/reconcile/plan.test.ts` | ✅ | ⬜ pending |
| 09-01-03 | 01 | 1 | closed-set | T-09-05 | `{dependency installed}` amendment pins (REASONS 61, header count, catalog state 221 + bytes, locks, enumerations) and the projection arm with no cause line | architecture | `node --test tests/architecture/notify-closed-set-locks.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts tests/shared/notification-types.test.ts tests/architecture/compat-01-no-expansion.test.ts tests/orchestrators/reconcile/notify.test.ts` | ✅ | ⬜ pending |
| 09-02-01 | 02 | 1 | MISS-01 | T-09-06 | Root-range input folded once at the existing fold site; a failing fold is `constraint-failed`, never no-constraint; a wildcard makes no query | unit | `node --test tests/orchestrators/plugin/install-cascade.test.ts` | ✅ | ⬜ pending |
| 09-02-02 | 02 | 1 | MISS-01 | T-09-07 | Disabled-as-wall cascade option: no re-enable phase, record untouched, RESV-05 check still runs | unit | `node --test tests/orchestrators/plugin/install-cascade.test.ts` | ✅ | ⬜ pending |
| 09-03-01 | 03 | 2 | MISS-01 | T-09-09, T-09-10 | New entry point: `provenance: "dependency"` for every member, no config write, no promotion, no DFEN-04 arm, lands enabled; one `(installed) {dependency installed}` row per member; reason-gated to `reload`; `event.reason` threaded from `index.ts` | unit | `node --test tests/orchestrators/reconcile/apply.test.ts tests/orchestrators/plugin/install-flow.test.ts tests/orchestrators/plugin/operations.test.ts tests/orchestrators/reconcile/types.test.ts tests/index.test.ts` | ✅ | ⬜ pending |
| 09-03-02 | 03 | 2 | MISS-01 | T-09-13 | Re-plan lifts a marker-held dependent (config-declared or dependency-provenance) in the same reload; already-present key skipped; round-1 source mismatches kept; a failed second read falls back and reports `state.json`; nothing-missing reload reads once and stays offline | unit | `node --test tests/orchestrators/reconcile/apply.test.ts` | ✅ | ⬜ pending |
| 09-03-02 | 03 | 2 | MISS-02 | T-09-11, T-09-12 | Failing dependency on its own `(failed)` row with the reused classifier's actual token and a redacted cause; not-added marketplace never added; dependent held by the round-1 check; retried on the next reload; nothing half-materialized | unit | `node --test tests/orchestrators/reconcile/apply.test.ts tests/orchestrators/plugin/install-flow.test.ts` | ✅ | ⬜ pending |
| 09-01-01, 09-03-01 | 01, 03 | 1, 2 | purity/network | T-09-10 | `plan.ts` stays fs-free; `apply.ts` calls the operation, never git; no new network exemption | architecture | `node --test tests/architecture/reconcile-planner-purity.test.ts tests/architecture/no-orchestrator-network.test.ts tests/architecture/unowned-exports-census.test.ts` | ✅ | ⬜ pending |
| 09-04-01 | 04 | 3 | MISS-02 | T-09-16 | The two-row failure form is a catalog state (222) whose bytes the real dispatcher renders and the apply test pins | architecture | `node --test tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts` | ✅ | ⬜ pending |
| 09-04-02 | 04 | 3 | MISS-01, MISS-02 | T-09-17 | Docs, changelog and backlog describe the shipped behavior; the failure table stays parseable | architecture | `node --test tests/architecture/dependency-doc-agreement.test.ts tests/architecture/partial-vocabulary-guard.test.ts` | ✅ | ⬜ pending |
| 09-04-03 | 04 | 3 | all | T-09-18 | Type-member pins remapped once; full gate green | full suite | `npm run lint:type-members && npm run check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs are `{phase}-{plan}-{task}`; filled by the planner on 2026-09-21 from 09-01..09-04-PLAN.md.*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Every production file this phase touches already has a paired `tests/.../X.test.ts`, the closed-set architecture tests already exercise this class of change (Phases 6-8), and `tests/integration/reconcile-plan-convergence.test.ts` needs only a new case.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A real `/reload` in Pi against a scope with a recorded plugin whose declared dependency is missing installs it and renders the row | MISS-01 | The `resources_discover` event and the live Pi renderer are not driven by the unit harness | Install a plugin, hand-uninstall its dependency (or hand-edit `state.json` to drop the record), start Pi (expect the LOAD-01 disable row, no install), run `/reload` (expect `(installed) {dependency installed}` and the dependent enabled) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
