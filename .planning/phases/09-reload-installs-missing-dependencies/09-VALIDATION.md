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
| 09-XX-XX | — | — | MISS-01 | — | Bucket derives from the verdict's `missing` arm; D-09-02 inclusion predicate; deduped by key | unit | `node --test tests/orchestrators/reconcile/plan.test.ts` | ✅ | ⬜ pending |
| 09-XX-XX | — | — | MISS-01 | — | Root-range input and disabled-as-wall cascade option | unit | `node --test tests/orchestrators/plugin/install-cascade.test.ts` | ✅ | ⬜ pending |
| 09-XX-XX | — | — | MISS-01 | — | New entry point: `provenance: "dependency"`, no config write, no promotion, lands enabled | unit | `node --test tests/orchestrators/plugin/install-flow.test.ts` | ✅ | ⬜ pending |
| 09-XX-XX | — | — | MISS-01 | — | One `(installed) {dependency installed}` row per materialized member; reason-gated to `/reload`; re-plan lifts a marker-held dependent | unit | `node --test tests/orchestrators/reconcile/apply.test.ts` | ✅ | ⬜ pending |
| 09-XX-XX | — | — | MISS-01 | — | Convergence fixpoint: missing key plans the bucket; recorded-as-dependency plans nothing | integration | `node --test tests/integration/reconcile-plan-convergence.test.ts` | ✅ | ⬜ pending |
| 09-XX-XX | — | — | MISS-02 | — | Failing dependency on its own `(failed)` row with cause; dependent held by the re-derived check; nothing half-materialized | unit | `node --test tests/orchestrators/reconcile/apply.test.ts` | ✅ | ⬜ pending |
| 09-XX-XX | — | — | closed-set | — | `{dependency installed}` amendment pins (REASONS, header count, catalog bytes/states, locks) | architecture | `node --test tests/architecture/notify-closed-set-locks.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts tests/shared/notification-types.test.ts tests/architecture/compat-01-no-expansion.test.ts` | ✅ | ⬜ pending |
| 09-XX-XX | — | — | purity/network | — | `plan.ts` stays fs-free; no new git consumer | architecture | `node --test tests/architecture/reconcile-planner-purity.test.ts tests/architecture/no-orchestrator-network.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*The planner fills Task ID / Plan / Wave once PLAN.md files exist.*

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
