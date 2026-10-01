---
phase: "12"
slug: "standalone-prune-with-dry-run"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-23"
---

# Phase 12 — Validation Strategy

> Audited against all eight plans, their execution summaries, and the final
> goal verification report. All mapped requirements have behavioral tests.

---

## Test Infrastructure

| Property | Value |
| --- | --- |
| **Framework** | Node `node:test` with TypeScript source execution |
| **Config file** | `package.json`, `tsconfig.json`, `scripts/test-coverage-direct.pin.json` |
| **Quick run command** | `node --test tests/orchestrators/plugin/prune.test.ts tests/edge/handlers/plugin/prune.test.ts` after Wave 0 |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | Quick run: under 30 seconds; full suite: several minutes |

---

## Sampling Rate

- **After every task commit:** Run focused `node --test` for changed pairs and
  `npm run test:coverage:direct -- <changed source>` where TypeScript source
  changed.
- **After every plan wave:** Run affected architecture/catalog tests plus
  `npm run test:integration` when command routing or disk behavior changed.
- **Before `$gsd-verify-work`:** Run `npm run check`; if the parent checkout's
  pre-existing `.planning/config.json` formatting drift still blocks its chain,
  run the unaffected downstream gates separately and record the limit.
- **Max feedback latency:** 30 seconds for focused unit tests; broader gates
  run at wave boundaries.

---

## Per-Task Verification Map

| Work area | Requirement | Threat Ref | Secure behavior | Test type | Automated command | File Exists | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Full-scope selection and read-only state | PRUNE-06, PRUNE-07 | T-12-01, T-12-02 | No wrong-scope deletion or dry-run write | unit | `node --test tests/orchestrators/plugin/dependency-index.test.ts tests/persistence/state-io.test.ts tests/orchestrators/plugin/prune.test.ts` | ✅ | ✅ green |
| Locked removal and member failure | PRUNE-06 | T-12-01, T-12-02 | Fail closed; failed member holds descendants | unit, integration | `node --test tests/orchestrators/plugin/prune.test.ts tests/integration/standalone-prune.test.ts` | ✅ | ✅ green |
| Preview and notification rows | PRUNE-07 | T-12-03 | Preview names intended removals without mutating state | unit, catalog | `node --test tests/shared/notification-grammar.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts` | ✅ | ✅ green |
| Flag surface and completion | FLAG-02 | T-12-01 | Reject unsupported flags and extra operands | unit, architecture | `node --test tests/edge/handlers/plugin/prune.test.ts tests/edge/router.test.ts tests/edge/completions/provider.test.ts tests/architecture/flag-catalog-drift.test.ts` | ✅ | ✅ green |
| Offline boundary | PRUNE-06, PRUNE-07 | T-12-02 | Neither prune path fetches network data | architecture | `node --test tests/architecture/no-orchestrator-network.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/orchestrators/plugin/prune.test.ts` — real state and disk cases
  for PRUNE-06/07, including legacy migration and zero-write preview.
- [x] `tests/edge/handlers/plugin/prune.test.ts` — exact FLAG-02 parser and
  scope cases.
- [x] `tests/integration/standalone-prune.test.ts` — command-to-state
  transaction and preview checks.
- [x] `tests/architecture/catalog-uat/fixtures/plugin-prune.ts` — actual,
  pending, empty, and error rows.

Existing Node test infrastructure and fixtures need no new dependency.

---

## Manual-Only Verifications

All phase requirements have automated verification targets. A live Pi session
may still judge whether the preview and empty-result wording reads clearly;
that check does not replace the automated state and disk assertions.

---

## Validation Sign-Off

- [x] Every plan task has an automated verification command.
- [x] No three consecutive tasks lack automated verification.
- [x] Wave 0 creates each new test and catalog fixture above.
- [x] No watch-mode flags are used.
- [x] Focused feedback fits the 30-second target.
- [x] Set `nyquist_compliant: true` after the validation audit confirms coverage.

**Approval:** validated 2026-09-24

## Validation Audit 2026-09-24

| Metric | Count |
| --- | ---: |
| Requirements covered | 3/3 |
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

The final verification report maps PRUNE-06, PRUNE-07, and FLAG-02 to
behavioral tests and records 27/27 must-haves verified. The direct test pairs
reached 100% coverage; the full unit suite passed 7,760/7,760 tests, and the
standalone prune integration suite passed 25/25. The live Pi flow also passed
the one manual UAT check. The full `npm run check` chain stopped on an
operator-owned `.planning/config.json` formatting change; unaffected typecheck,
lint, unit, integration, direct-coverage, and changed-file formatting gates
passed separately.
