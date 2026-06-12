---
phase: 55
slug: load-time-reconcile-apply-notification-wiring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-10
---

# Phase 55 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in, Node `>=20.19.0`) |
| **Config file** | none — invoked via package.json scripts |
| **Quick run command** | `npm test -- tests/orchestrators/reconcile/apply.test.ts tests/integration/load-reconcile-race.test.ts` |
| **Full suite command** | `npm run check` (typecheck + lint + format + unit + integration) |
| **Estimated runtime** | ~30 seconds (quick) / ~75 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run the quick command above
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** `npm run check` must be green (baseline ≥1675 unit + 9 integration from Phase 54 close)
- **Max feedback latency:** 75 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | RECON-01 | — | declared-but-missing → automatic add+install at load | unit | `node --test tests/orchestrators/reconcile/apply.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | RECON-02 | T-unmanaged-removal | installed-but-undeclared → remove/uninstall, scoped to managed (state-recorded) entries only | unit (fixture: extra state record not in config) | same | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | RECON-03 | T-load-block | per-entry network failure soft-fails; pass continues; load never blocked | unit (failing gitOps via DI) | same | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | RECON-04 | — | cascade via `notify()` catalog-conformant; NO `/reload` hint | unit + grammar invariant | `node --test tests/shared/notify-v2.test.ts tests/architecture/notify-grammar-invariant.test.ts` | ❌ W0 fixtures | ⬜ pending |
| TBD | TBD | TBD | RECON-05 | T-config-rewrite | back-to-back reconcile strict no-op; config + state byte-unchanged | unit (mtime+bytes before/after) | `node --test tests/orchestrators/reconcile/apply.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | RECON-06 | T-double-apply | two-process simultaneous start: no double-apply, no interleaved write | integration (fork + IPC) | `node --test tests/integration/load-reconcile-race.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MIG-01 rail (Phase 52 deferred) | T-mass-uninstall | lock-covered migrate-then-load-then-plan on populated state (Pitfalls 52-2, 52-4) | integration + unit | both new test files | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/orchestrators/reconcile/apply.test.ts` — RECON-01/02/03/05 single-process behavior
- [ ] `tests/integration/load-reconcile-race.test.ts` — RECON-06 + Phase 52 deferred lock coverage (two-process)
- [ ] `tests/shared/notify-v2.test.ts` additions — RECON-04 byte forms (new variant fixtures)
- [ ] `tests/architecture/notify-grammar-invariant.test.ts` additions — NO `/reload` trailer on the new variant
- [ ] `tests/architecture/catalog-uat.test.ts` additions — paired FIXTURES for new catalog states
- [ ] `tests/architecture/notify-types.test.ts` additions — length locks / shape proofs for new variants
- [ ] (optional) light coverage of the resources_discover handler wiring

Framework install: none — `node:test` is built-in.

---

## Manual-Only Verifications

All phase behaviors have automated verification. (Live Pi-runtime smoke of startup reconcile may be deferred to milestone UAT.)

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 75s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
