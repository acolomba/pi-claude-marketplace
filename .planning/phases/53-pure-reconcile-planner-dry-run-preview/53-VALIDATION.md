---
phase: 53
slug: pure-reconcile-planner-dry-run-preview
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-10
---

# Phase 53 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in, Node `>=20.19.0`) |
| **Config file** | none — discovered via package.json scripts |
| **Quick run command** | `npm run typecheck && node --test tests/orchestrators/reconcile/*.test.ts tests/architecture/reconcile-planner-purity.test.ts` |
| **Full suite command** | `npm run check` (typecheck + lint + format + test + integration) |
| **Estimated runtime** | ~15 seconds (quick) / ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run the quick command above
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** `npm run check` must be green (baseline: ≥1575 unit + 7 integration from Phase 52 close)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | DIFF-01 | T-impure-planner | `planReconcile` pure (no fs/network/save/notify imports) | architecture | `node --test tests/architecture/reconcile-planner-purity.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DIFF-01 | — | empty plan for steady state (Phase 52 convergence proof) | unit | `node --test tests/orchestrators/reconcile/plan-convergence.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DIFF-01 | — | 7 buckets populated correctly across exhaustive desired-x-actual matrix | unit | `node --test tests/orchestrators/reconcile/plan.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DIFF-01 | T-preview-mutation | preview twice → byte-identical output, no file/state mutation | unit | `node --test tests/orchestrators/reconcile/preview.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DIFF-01 | T-preview-network | preview performs no network calls | architecture | extension of `tests/architecture/no-orchestrator-network.test.ts` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | DIFF-01 | T-preview-write | preview performs no writes to config/state paths | architecture | `tests/architecture/config-state-write-seams.test.ts` (walker auto-covers) | ✅ existing | ⬜ pending |
| TBD | TBD | TBD | DIFF-02 | — | subject-first rows with closed-set `(will ...)` tokens, byte-locked | architecture | `tests/architecture/catalog-uat.test.ts` (extend FIXTURES) | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | DIFF-02 | — | STATUS_TOKENS length locks updated in lockstep | architecture | `tests/architecture/notify-types.test.ts` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | DIFF-02 | — | grammar invariant holds for new variants | architecture | `tests/architecture/notify-grammar-invariant.test.ts` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | DIFF-02 | — | inverse walk: every FIXTURES entry has catalog annotation | architecture | `tests/architecture/catalog-uat.test.ts` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/architecture/reconcile-planner-purity.test.ts` — DIFF-01 purity gate
- [ ] `tests/orchestrators/reconcile/plan.test.ts` — exhaustive matrix
- [ ] `tests/orchestrators/reconcile/plan-convergence.test.ts` — Phase 52 deferred proof
- [ ] `tests/orchestrators/reconcile/notify.test.ts` — plan-to-message projection
- [ ] `tests/orchestrators/reconcile/preview.test.ts` — idempotency + no-mutation
- [ ] `tests/edge/handlers/plugin/preview.test.ts` — shim parse + dispatch
- [ ] Extensions: no-orchestrator-network FORBIDDEN_TARGETS, catalog-uat FIXTURES, notify-types length locks, notify-grammar-invariant

Framework install: none — `node:test` is built-in.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
