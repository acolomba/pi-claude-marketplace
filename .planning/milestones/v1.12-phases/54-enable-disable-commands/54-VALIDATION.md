---
phase: 54
slug: enable-disable-commands
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-10
---

# Phase 54 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in, Node `>=20.19.0`) |
| **Config file** | none — run via `node --test` |
| **Quick run command** | `node --test tests/orchestrators/plugin/enable-disable.test.ts tests/edge/handlers/plugin/enable-disable.test.ts` |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + tests + integration) |
| **Estimated runtime** | ~10 seconds (quick) / ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `node --test <directly-touched test files>`
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** `npm run check` must be green (baseline ≥1635 unit + 7 integration)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | ENBL-01 | — | `enable`/`disable` with `--scope` + `--local` parse and dispatch | unit | `node --test tests/edge/handlers/plugin/enable-disable.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ENBL-01 | T-config-write-seam | `enabled: true/false` written to config only via `saveConfig` | unit | `node --test tests/orchestrators/plugin/enable-disable.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ENBL-02 | — | disable keeps config entry + version pin; artefacts removed | unit | same orchestrator test | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ENBL-02 | — | reconcile desired-materialized = declared AND enabled | unit | `node --test tests/orchestrators/reconcile/plan.test.ts` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | ENBL-03 | T-network-on-enable | enable re-materializes from cache, NO network | unit + architecture | `node --test tests/architecture/no-orchestrator-network.test.ts tests/orchestrators/plugin/enable-disable.test.ts` | ✅ extend + ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ENBL-03 | — | version pin preserved on enable round-trip | unit | orchestrator test (version-roundtrip fixture) | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ENBL-04 | — | `(disabled)` renders distinct from `(unavailable)` on list/info (D-54-01) | unit + byte-equality | `node --test tests/shared/notify-v2.test.ts tests/architecture/catalog-uat.test.ts` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | ENBL-04 | — | closed-set token + catalog + FIXTURES atomic lockstep | architecture | `node --test tests/architecture/catalog-uat.test.ts tests/architecture/notify-types.test.ts tests/architecture/notify-grammar-invariant.test.ts` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/orchestrators/plugin/enable-disable.test.ts` — ENBL-01/02/03 orchestrator-level behavior
- [ ] `tests/edge/handlers/plugin/enable-disable.test.ts` — ENBL-01 edge USAGE + argument parsing
- [ ] Extensions: reconcile plan.test.ts (enabled-flag wiring), notify-v2/catalog-uat/notify-types/notify-grammar-invariant (D-54-01 token), no-orchestrator-network (enable orchestrator)

Framework install: none — `node:test` is built-in.

---

## Manual-Only Verifications

All phase behaviors have automated verification. (ENBL-03's "network unplugged" criterion is satisfied structurally by the no-orchestrator-network architecture gate plus a gitOps-throwing mock test.)

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
