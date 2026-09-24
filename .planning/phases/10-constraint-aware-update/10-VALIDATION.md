---
phase: "10"
slug: "constraint-aware-update"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: true) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
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

> Filled by the planner as tasks are authored. One row per task across the four
> plans; the Wave-0 items (the leaf's paired test and the held-row catalog
> fixture) land inside 10-01-T2, because the closed-set amendment and the
> paired-test pairing rule both fail a tree that carries one without the other.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-T1 | 10-01 | 1 | UPDT-02 | T-10-04 | The one-way closed-set amendment is settled by a human before nine pinning surfaces move | checkpoint | — (`checkpoint:decision`, `gate="blocking-human"`) | n/a | ✅ green |
| 10-01-T2 | 10-01 | 1 | UPDT-02 | T-10-01, T-10-02, T-10-04, T-10-05 | Disjoint dependent ranges hold the update end to end; the cause line interpolates recorded keys and a capped range only | unit + architecture | `node --test tests/orchestrators/plugin/update-constraint-gate.test.ts tests/orchestrators/plugin/update-preflight.test.ts tests/orchestrators/plugin/update-cascade.test.ts tests/orchestrators/plugin/update-row.test.ts tests/shared/notification-grammar.test.ts` | ✅ created | ✅ green |
| 10-01-T3 | 10-01 | 1 | UPDT-02 | T-10-02 | An unreadable declarer holds the update with the walk's own redacted message; no absolute path reaches the line | unit | `node --test tests/orchestrators/plugin/update-constraint-gate.test.ts tests/orchestrators/plugin/update-preflight.test.ts` | ✅ (after 10-01-T2) | ✅ green |
| 10-02-T1 | 10-02 | 2 | UPDT-01 | T-10-06, T-10-08, T-10-10 | The highest satisfying tag is selected through the existing prefix-checked selector; the auth bundle is threaded, never composed | unit + architecture | `node --test tests/orchestrators/plugin/update-constraint-gate.test.ts tests/architecture/no-orchestrator-network.test.ts tests/architecture/marketplace-tag-probe-offline.test.ts` | ✅ | ✅ green |
| 10-02-T2 | 10-02 | 2 | UPDT-01 | T-10-07, T-10-09 | The pin travels through the resolver's own callbacks and the record stores the version the tag names | unit + gate | `node --test tests/orchestrators/plugin/update-preflight.test.ts tests/orchestrators/plugin/update-swap.test.ts tests/orchestrators/plugin/update-flow.test.ts` then `npm run lint:type-members` | ✅ | ✅ green |
| 10-02-T3 | 10-02 | 2 | UPDT-01 | T-10-10 | One run lists each repository and each marketplace clone once; a failed listing is still retried | unit | `node --test tests/orchestrators/plugin/update-flow.test.ts tests/orchestrators/plugin/update-preflight.test.ts tests/orchestrators/plugin/update-constraint-gate.test.ts` | ✅ | ✅ green |
| 10-03-T1 | 10-03 | 3 | UPDT-01, UPDT-02 | T-10-11, T-10-12, T-10-13, T-10-14 | The post-fetch guard re-checks the version that landed and names only the dependents that reject it; the disclosure member is declared required-but-nullable so an omitting site is a compile error, and all 51 construction sites are swept | unit + architecture + typecheck | `node --test tests/orchestrators/plugin/update-constraint-gate.test.ts tests/orchestrators/plugin/update-preflight.test.ts tests/orchestrators/types.test.ts tests/orchestrators/marketplace/update.test.ts tests/orchestrators/plugin/update-row.test.ts tests/orchestrators/marketplace/update.messaging.test.ts tests/orchestrators/plugin/update-cascade.test.ts tests/orchestrators/plugin/update-swap.test.ts tests/orchestrators/plugin/update-flow.test.ts tests/edge/types.test.ts tests/edge/handlers/marketplace/update.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts` then `npm run typecheck` | ✅ | ✅ green |
| 10-03-T2 | 10-03 | 3 | UPDT-01 | T-10-14, T-10-20 | The prepared-update slot has exactly one consumer, and both `unchanged` rows read the gate verdict instead — a second consumer fails a criterion rather than shipping | unit + architecture | `node --test tests/orchestrators/plugin/update-row.test.ts tests/orchestrators/plugin/update-swap.test.ts tests/orchestrators/plugin/update-cascade.test.ts tests/orchestrators/plugin/update-preflight.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts` | ✅ | ✅ green |
| 10-03-T3 | 10-03 | 3 | UPDT-02 | T-10-15 | The held row is `warning` on both cascades and goes red if the token ever joins the idempotent set | unit + architecture | `node --test tests/orchestrators/marketplace/update.messaging.test.ts tests/orchestrators/plugin/update-cascade.test.ts tests/shared/notify-reasons.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts` | ✅ | ✅ green |
| 10-04-T1 | 10-04 | 4 | UPDT-02 | T-10-18 | The prose is held to the token the real composer stamps, so it cannot drift back | architecture | `node --test tests/architecture/dependency-doc-agreement.test.ts tests/architecture/partial-vocabulary-guard.test.ts` | ✅ | ✅ green |
| 10-04-T2 | 10-04 | 4 | UPDT-01, UPDT-02 | T-10-16, T-10-17, T-10-19 | SC3 proven non-vacuously on both cascades; network policy unchanged; no gate disarmed and no coverage exemption added | unit + architecture + full gate | `node --test tests/orchestrators/plugin/update-cascade.test.ts tests/orchestrators/marketplace/update.messaging.test.ts tests/orchestrators/plugin/update-flow.test.ts tests/architecture/no-orchestrator-network.test.ts` then `npm run check` | ✅ | ✅ green |

*Status: ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity:** no three consecutive tasks lack an automated verify.
`10-01-T1` is the only task without one, and it is a `checkpoint:decision`
whose whole purpose is a human judgment; the task immediately after it carries
four automated commands.

---

## Wave 0 Requirements

- [x] `tests/orchestrators/plugin/update-constraint-gate.test.ts` — the new leaf module's
      paired test, created inside task `10-01-T2`.
      `scripts/test-coverage-direct.pin.json` currently has an EMPTY `rows: []`, so there are
      no exempted shortfalls anywhere in the tree: a new production module ships with a paired
      test at 100% direct coverage or `npm run test:coverage:direct` fails outright.
- [x] A held-row fixture in `tests/architecture/catalog-uat/fixtures/plugin-update.ts`,
      created inside task `10-01-T2`; the autoupdate-cascade sibling in
      `fixtures/marketplace-update.ts` arrives with `10-03-T3`.
      `catalog-contract.test.ts` pins an exact state count and UTF-8 byte count and
      `catalog-parser.test.ts` pins the same count a second time; all three constants move in
      the SAME change as each fixture. The count runs 222 → 223 (10-01-T2) → 224 (10-03-T1)
      → 226 (10-03-T2) → 227 (10-03-T3).
- [x] Framework install: none — `node:test` is built in.

**Why both Wave-0 items land inside a task rather than ahead of the phase.** A
test file that imports a module which does not exist does not typecheck, and a
catalog fixture that names a reason token the closed set does not carry does not
compile either — so neither can be committed before the code it pairs with. The
`test:corresponding` and `test:coverage:direct` gates enforce the pairing in the
other direction, which is what makes `10-01-T2` atomic rather than splittable.

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-09-24

## Validation Audit 2026-09-24

| Metric | Count |
| --- | ---: |
| Behavioral requirement gaps | 0 |
| New tests needed | 0 |
| Escalated | 0 |

The phase plans and summaries map every behavior to a named test. The current milestone run passed 7,760/7,760 unit tests and all 15 integration files. The corresponding source/test pairs, catalog contracts, and architecture guards remain active. The chain-wide `npm run check` still stops on the operator-owned `.planning/config.json` formatting drift; the test results above were run separately on the current tree.
