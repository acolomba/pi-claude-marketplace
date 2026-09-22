---
phase: "10"
slug: "constraint-aware-update"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-22"
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` (no third-party runner) |
| **Config file** | none — invoked directly via npm scripts |
| **Quick run command** | `node --test tests/orchestrators/plugin/update-preflight.test.ts` (plus the new leaf's own test path once created) |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~9 minutes for the full gate; seconds for a scoped `node --test` |

---

## Sampling Rate

- **After every task commit:** Run the scoped `node --test <touched test files>` command.
- **After every plan wave:** Run `npm run test:coverage:direct`
- **Before `/gsd-verify-work`:** `npm run check` must be green
- **Max feedback latency:** 60 seconds for the scoped run

---

## Per-Task Verification Map

> Filled by the planner as tasks are authored. The rows below are the
> requirement-level skeleton the planner must cover; each becomes one or more
> task rows with real task IDs.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | UPDT-01 | — | Highest version inside the intersection is selected, both source kinds | unit | `node --test tests/orchestrators/plugin/update-preflight.test.ts` + new leaf test | ❌ W0 (leaf test) | ⬜ pending |
| TBD | TBD | TBD | UPDT-02 | — | No satisfying version → skip; reason names the constraining plugin(s) | unit | new leaf test + `update-preflight.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC3 (regression) | — | An unconstrained plugin updates exactly as before, both cascades | unit | `node --test tests/orchestrators/plugin/update-cascade.test.ts tests/orchestrators/marketplace/update.messaging.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | TBD | SC3 (network) | — | `update-flow.ts` / `update-preflight.ts` remain the only git consumers | architecture | `node --test tests/architecture/no-orchestrator-network.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | TBD | UPDT-02 (catalog) | — | The held row renders byte-exactly on both cascades | architecture | `node --test tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts tests/architecture/notify-closed-set-locks.test.ts` | ✅ (fixture is W0) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/orchestrators/plugin/<leaf-name>.test.ts` — the new leaf module's paired test.
      `scripts/test-coverage-direct.pin.json` currently has an EMPTY `rows: []`, so there are
      no exempted shortfalls anywhere in the tree: a new production module ships with a paired
      test at 100% direct coverage or `npm run test:coverage:direct` fails outright.
- [ ] A held-row fixture in `tests/architecture/catalog-uat/fixtures/plugin-update.ts` for
      both cascades. `catalog-contract.test.ts` pins an exact state count and UTF-8 byte
      count; both constants move in the SAME change as the fixture.
- [ ] Framework install: none — `node:test` is built in.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | — |

*All phase behaviors have automated verification — the constraint gate, the two probes and
both cascades are all reachable through injected seams, so no live network or live
marketplace is needed.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
