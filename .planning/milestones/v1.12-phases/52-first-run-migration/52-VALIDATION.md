---
phase: 52
slug: first-run-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-10
---

# Phase 52 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in, Node `>=20.19.0`) |
| **Config file** | none — invoked via npm scripts |
| **Quick run command** | `node --test tests/persistence/migrate-config.test.ts` |
| **Full suite command** | `npm run check` (typecheck + lint + format + test + integration) |
| **Estimated runtime** | ~5 seconds (quick) / ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/persistence/migrate-config.test.ts`
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** `npm run check` must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | MIG-01 | — | every state marketplace + plugin in the generated config | unit | `node --test tests/persistence/migrate-config.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MIG-01 | — | soft-degraded plugins included (Pitfall 52-1) | unit | same | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MIG-01 | — | source recovered byte-stably from `ParsedSource.raw` (Pitfall 52-3) | unit | same | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MIG-01 | — | D-13 legacy `autoupdate` captured | unit | same | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MIG-01 | — | plugin keys collision-free across marketplaces (Pitfall 52-6) | unit | same | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MIG-02 | — | idempotency: second call short-circuits | integration | same | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MIG-02 | T-config-clobber | NEVER overwrites existing valid OR invalid config (Pitfall 52-5) | integration | same | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MIG-02 | — | atomicity proxy: written file passes `CONFIG_VALIDATOR` | integration | same | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MIG-02 | — | data-level convergence: `mergeScopeConfigs(generated, {})` mirrors state | unit | same | ❌ W0 | ⬜ pending |
| — | — | — | MIG-02 (deferred) | — | planner-level convergence: `planReconcile` returns empty | unit (Phase 53) | — | Phase 53 | deferred |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/persistence/migrate-config.test.ts` — covers MIG-01 + MIG-02 unit and integration behaviors
- [ ] `tests/persistence/fixtures/legacy/state-populated-mixed.json` — populated fixture: 2 marketplaces (one autoupdate=true), one soft-degraded plugin, two same-named plugins across marketplaces
- [ ] `extensions/pi-claude-marketplace/persistence/migrate-config.ts` — the seam itself
- [ ] (Conditional, only if A1 wrong) `tests/architecture/config-state-write-seams.test.ts` — allow-list + exactly-N update

Framework install: none — `node:test` is built-in.

---

## Manual-Only Verifications

All phase behaviors have automated verification. SC4's planner-level convergence proof is deferred to Phase 53 (planner does not exist yet) — covered at the data level in this phase.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
