---
phase: 97
slug: disabled-state-classification-repair
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-09
---

# Phase 97 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in runner, TS run natively) |
| **Config file** | package.json scripts (no separate config) |
| **Quick run command** | `node --test tests/orchestrators/plugin/enable-disable.test.ts tests/orchestrators/reconcile/plan.test.ts` |
| **Full suite command** | `PI_SUBAGENTS_ROOT=~/.pi/agent/npm/node_modules/pi-subagents npm run check` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test <touched-suite>.test.ts`
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 97-01 T1 (tracer) | 97-01 | 1 | ENBL-05, ENBL-06 | T-97-02, T-97-06 | Predicate stays narrow (soft-degraded ENABLED records keep materializing); no local twin can re-appear | unit + integration (byte-exact) | `node --test tests/orchestrators/reconcile/plan.test.ts tests/orchestrators/plugin/info-manifest-absent.test.ts tests/orchestrators/reconcile/plan-convergence.test.ts tests/orchestrators/edge-deps.test.ts && npm run typecheck` | ✅ | ✅ green |
| 97-01 T2 | 97-01 | 1 | ENBL-05 | T-97-02 | Classifier precedence pinned in both directions | unit | `node --test tests/orchestrators/plugin/plugin-state-classifier.test.ts tests/orchestrators/edge-deps.test.ts` | ✅ | ✅ green |
| 97-02 T1 | 97-02 | 2 | ENBL-06 | T-97-05 | Disabled row is bare; no reason brace can leak a manifest-absence claim | integration (byte-exact) | `node --test tests/orchestrators/plugin/list.test.ts` | ✅ | ✅ green |
| 97-02 T2 | 97-02 | 2 | ENBL-06 | T-97-09 | Skip note reports the true cause | integration (byte-exact) | `node --test tests/orchestrators/plugin/info-manifest-absent.test.ts` | ✅ | ✅ green |
| 97-02 T3 | 97-02 | 2 | ENBL-06 | T-97-08 | Binding contract prose matches shipped trigger | architecture (byte gate) + lint | `node --test tests/architecture/catalog-uat.test.ts && npm run lint && npm run format:check` | ✅ | ✅ green |
| 97-03 T1 | 97-03 | 2 | ENBL-07 | T-97-04, T-97-10, T-97-11 | Partial gate widens to the partially-available arm only; unavailable still rejected; fail-clean before any ledger phase | integration (byte-exact) | `node --test tests/orchestrators/plugin/enable-disable.test.ts && npm run typecheck && npm run lint` | ✅ | ✅ green |
| 97-03 T2 | 97-03 | 2 | ENBL-07 | T-97-11 | Idempotent disable runs no cascade (proven by unchanged state bytes) | integration (byte-exact) | `node --test tests/orchestrators/plugin/enable-disable.test.ts` | ✅ | ✅ green |
| 97-04 T1 | 97-04 | 2 | ENBL-08 | T-97-01 (high), T-97-13 | Load-time backfill cannot re-materialize or re-enable a user-disabled plugin | unit (seam) | `node --test tests/orchestrators/reconcile/backfill.test.ts && npm run typecheck && npm run lint` | ✅ | ✅ green |
| 97-04 T2 | 97-04 | 2 | ENBL-08 | T-97-12 | Planner is a fixed point; no repeated unstage cascade | unit (pure planner) | `node --test tests/orchestrators/reconcile/plan.test.ts tests/orchestrators/reconcile/plan-convergence.test.ts` | ✅ | ✅ green |
| 97-05 T1 | 97-05 | 2 | ENBL-09 | T-97-03 | Persisted availability discriminant agrees with the unsupported list | integration (state assertion) | `node --test tests/orchestrators/plugin/update.test.ts && npm run typecheck && npm run lint` | ✅ | ✅ green |
| 97-05 T2 | 97-05 | 2 | ENBL-09 | T-97-14, T-97-15 | No artifact re-staged on disk; operation is a fixed point | integration | `node --test tests/orchestrators/plugin/update.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Sampling continuity: every task carries an `<automated>` verify; there is no run of three
consecutive tasks without one.

---

## Wave 0 Requirements

None. `node:test`, the hermetic-HOME helper, and every target file's local seed factory already
exist. Three factories gain an optional unsupported-kind axis inside their own test file
(`seedRealDisabledMarketplace` and `writeUserState` in `enable-disable.test.ts`, and a
partial-disabled record variant in `update.test.ts`); the `list.test.ts` and
`info-manifest-absent.test.ts` factories already carry both axes and need no change. Per house
convention these are extended in place, never imported across test trees.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

Two tasks additionally require a one-time **red-proof**: temporarily revert the source edit,
observe the new test fail, then restore. This is a step inside the task, not a separate manual
verification.

- 97-03 T1 — remove the ledger's partial gate; the re-materialization test must go red.
- 97-04 T1 — remove the disabled-record early return; the backfill guard test must go red.
- 97-05 T1 — restore the hard-coded availability value; the degraded-case test must go red.

---

## Environment Note

The full suite requires `PI_SUBAGENTS_ROOT` pointed at Pi's managed `pi-subagents` (>= 0.42.1).
The unqualified local fallback resolves a stale global below the `>=0.35.0` optional-peer floor
and fails two integration checks; CI has no global peer and skips them. A failure in those two
checks is environmental, not a phase regression.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-08-09 — full suite exit 0 with `PI_SUBAGENTS_ROOT` set; all three red-proofs recorded in the plan SUMMARYs

---

## Validation Audit 2026-08-09

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 11 task rows COVERED: every automated command is a subset of `npm run
check`, green at the post-review-loop gate (3331 unit + 18 integration, exit
0). The review fix loop added coverage beyond the strategy: two new catalog
byte states (`enable-degraded`, `enable-orphan-rewake`), the clone-GC
assertion on the disabled update arm, and the mtime/`updatedAt` idempotency
pin.
